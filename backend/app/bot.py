"""
Dissidia Arena Discord bot.

One bot (the same Discord application as website sign-in) that can be added to each game's
community server. Run it alongside the web server:

    FLASK_APP=run.py flask bot

It also runs the matchmaker loop, so `flask matchmaker` isn't needed while the bot is up
(running both is harmless).

All database work goes through app.discord_service in a worker thread, so the Discord event
loop never blocks on MariaDB.
"""

import asyncio
import logging
import re
from datetime import datetime

import click
import discord
from discord import app_commands
from discord.ext import tasks
from flask import Flask

from . import discord_service as svc
from . import matchmaking as mm
from .extensions import db
from .models.user import REGIONS

log = logging.getLogger("arena.bot")

GAME_NAMES = {"012": "Dissidia 012", "nt": "Dissidia NT"}
GAME_ID_LABELS = {"012": "PPSSPP nickname", "nt": "PSN / Steam name"}
# What the host should pick when making the in-game lobby.
LOBBY_HINTS = {"012": "a Bo3 lobby", "nt": "a 1v1 lobby set to first to 2"}
COLOR = discord.Color.from_rgb(124, 58, 237)


def profile_of(user: discord.abc.User) -> svc.DiscordProfile:
    return svc.DiscordProfile(
        id=user.id,
        username=user.name,
        display_name=user.global_name,
        avatar_hash=user.avatar.key if user.avatar else None,
    )


def _ts(iso: str, style: str = "R") -> str:
    """Discord timestamp markup, which shows in each reader's own timezone."""
    unix = int(datetime.fromisoformat(iso.removesuffix("Z") + "+00:00").timestamp())
    return f"<t:{unix}:{style}>"


class ArenaBot(discord.Client):
    def __init__(self, app: Flask):
        super().__init__(intents=discord.Intents.default())  # slash commands need no privileged intents
        self.flask_app = app
        self.tree = app_commands.CommandTree(self)
        self.tree.on_error = self.on_command_error

    async def setup_hook(self) -> None:
        self.add_dynamic_items(MatchButton)  # buttons keep working across restarts
        for cmd in (arena_group, queue_cmd, leave_cmd):
            self.tree.add_command(cmd)
        if dev := self.flask_app.config["DISCORD_DEV_GUILD_ID"]:
            guild = discord.Object(int(dev))
            self.tree.copy_global_to(guild=guild)
            await self.tree.sync(guild=guild)
        else:
            await self.tree.sync()  # global: can take a while to appear the first time
        self.notify_loop.start()

    async def on_ready(self) -> None:
        log.info("signed in as %s, in %d servers", self.user, len(self.guilds))

    async def db(self, fn, *args):
        """Run a discord_service function in a thread with its own app context and session."""

        def run():
            with self.flask_app.app_context():
                try:
                    result = fn(*args)
                    db.session.commit()
                    return result
                except Exception:
                    db.session.rollback()
                    raise

        return await asyncio.to_thread(run)

    async def on_command_error(self, interaction: discord.Interaction, error: app_commands.AppCommandError) -> None:
        original = getattr(error, "original", error)
        if isinstance(original, mm.MatchmakingError):
            msg = original.message
        elif isinstance(error, app_commands.MissingPermissions):
            msg = "You need Manage Server to do that."
        else:
            log.exception("command failed", exc_info=original)
            msg = "Something went wrong. Try again in a moment."
        await reply(interaction, msg)

    # ------------------------------------------------------------ notifications

    @tasks.loop(seconds=2)
    async def notify_loop(self) -> None:
        try:
            events = await self.db(svc.collect_notifications)
        except Exception:
            log.exception("matchmaker tick failed")
            return
        frontend_url = self.flask_app.config["FRONTEND_URL"]
        for event in events:
            for ping in event["modPings"]:
                await self.post_mod_ping(ping, mod_ping_text(event, ping, frontend_url))
            for player in event["players"]:
                rendered = render_match(event["status"], player, frontend_url)
                if rendered:
                    await self.send_to(player["discordId"], *rendered, event["fallbackChannels"])

    @notify_loop.before_loop
    async def _wait_ready(self) -> None:
        await self.wait_until_ready()

    async def send_to(self, discord_id: int, embed: discord.Embed, view: discord.ui.View | None, fallback: list[int]) -> None:
        """DM the player; if their DMs are closed, @ them in a queue channel instead."""
        kwargs = {"embed": embed, **({"view": view} if view else {})}
        try:
            user = self.get_user(discord_id) or await self.fetch_user(discord_id)
            await user.send(**kwargs)
            return
        except discord.HTTPException:  # Forbidden = DMs closed
            pass
        for channel_id in fallback:
            channel = self.get_channel(channel_id)
            if not isinstance(channel, discord.abc.Messageable):
                continue
            if isinstance(channel, discord.abc.GuildChannel) and channel.guild.get_member(discord_id) is None:
                # Not cached doesn't always mean not a member, but it's the best cheap check.
                try:
                    await channel.guild.fetch_member(discord_id)
                except discord.HTTPException:
                    continue
            try:
                await channel.send(
                    content=f"<@{discord_id}> (your DMs are closed, so here it is)",
                    allowed_mentions=discord.AllowedMentions(users=True, roles=False, everyone=False),
                    **kwargs,
                )
                return
            except discord.HTTPException:
                continue
        log.warning("couldn't reach discord user %s", discord_id)

    async def post_mod_ping(self, ping: dict, text: str) -> None:
        channel = self.get_channel(ping["channel_id"])
        if not isinstance(channel, discord.abc.Messageable):
            return
        try:
            await channel.send(
                text,
                allowed_mentions=discord.AllowedMentions(roles=[discord.Object(ping["role_id"])], users=False, everyone=False),
            )
        except discord.HTTPException:
            log.warning("couldn't ping moderators in channel %s", ping["channel_id"])

    async def post_pings(self, result: dict) -> None:
        for ping in result["pings"]:
            channel = self.get_channel(ping["channel_id"])
            if not isinstance(channel, discord.abc.Messageable):
                continue
            try:
                await channel.send(
                    f"<@&{ping['role_id']}> **{discord.utils.escape_markdown(result['name'])}** is searching for "
                    f"{GAME_NAMES[result['game']]} ranked ({result['platform']}, {result['region']}). "
                    "Use `/queue` to play!",
                    allowed_mentions=discord.AllowedMentions(roles=True, users=False, everyone=False),
                )
            except discord.HTTPException:
                log.warning("couldn't ping in channel %s", ping["channel_id"])


async def reply(interaction: discord.Interaction, text: str) -> None:
    if interaction.response.is_done():
        await interaction.followup.send(text, ephemeral=True)
    else:
        await interaction.response.send_message(text, ephemeral=True)


# ---------------------------------------------------------------- rendering


def mod_ping_text(event: dict, ping: dict, frontend_url: str) -> str:
    """The moderator-role ping in one server for a new Disputed match, with a link to the case."""
    case = f"{frontend_url.rstrip('/')}/admin/cases/{event['matchId']}"
    what = "Replay not finished by the deadline" if event.get("replayNotFinished") else "was disputed"
    return f"<@&{ping['role_id']}> A result needs an Admin: {GAME_NAMES[event['game']]} match #{event['matchId']} {what}. {case}"


def render_match(status: str, player: dict, frontend_url: str) -> tuple[discord.Embed, discord.ui.View | None] | None:
    m = player["match"]
    you, opp = m["you"], m["opponent"]
    opp_name = discord.utils.escape_markdown(opp["displayName"])
    title_line = f"{GAME_NAMES[m['game']]} · 1v1 · Bo{m['bestOf']} · {m['platform']}"

    if status == "pending":
        cross = f" ({opp['region']})" if opp["region"] != you["region"] else ""
        embed = discord.Embed(
            title="Match found",
            description=f"{title_line}\nOpponent: **{opp_name}**{cross}\n\nAccept {_ts(m['acceptDeadline'])}, or you'll be taken out of the queue.",
            color=COLOR,
        )
        view = discord.ui.View(timeout=None)
        view.add_item(MatchButton("accept", m["id"]))
        view.add_item(MatchButton("decline", m["id"]))
        return embed, view

    room = f"{frontend_url.rstrip('/')}/match/live?match={m['id']}"

    if status == "active" and m["ruling"] and m["ruling"]["outcome"] == "replay":
        embed = discord.Embed(
            title="Replay",
            description=(
                f"{title_line}\n\nAn Admin ruled that your disputed match against **{opp_name}** is replayed "
                f"from game {len(m['games']) + 1}. Earlier games stand.\n\n"
                f"Reason: {discord.utils.escape_markdown(m['ruling']['reason'])}\n\n"
                f"You have {mm.REPLAY_HOURS} hours, until {_ts(m['replayDeadline'], 'f')} ({_ts(m['replayDeadline'])}), "
                f"to play and report the games in the [match room]({room}). If the match isn't settled by then, "
                "it goes back to the Admins."
            ),
            color=discord.Color.blurple(),
        )
        return embed, None

    if status == "active":
        hint = LOBBY_HINTS[m["game"]]
        if m["host"] == "you":
            how = f"**You're hosting.** Create {hint} and invite **{opp_name}**."
        else:
            how = f"**{opp_name} is hosting.** Wait for their invite to {hint}."
        embed = discord.Embed(title="Match on", description=f"{title_line}\n\n{how}", color=discord.Color.green())
        embed.add_field(name=f"Their {GAME_ID_LABELS[m['game']]}", value=f"`{opp['gameId'] or '?'}`")
        embed.add_field(name="Yours", value=f"`{you['gameId'] or '?'}`")
        embed.add_field(
            name="After each game", value=f"Report results in the [match room]({frontend_url.rstrip('/')}/match/live).", inline=False
        )
        return embed, None

    if status == "reported":
        winner = "you won" if m["winner"] == "you" else f"{opp_name} won"
        embed = discord.Embed(
            title="Confirm the result",
            description=(
                f"{title_line}\n\n**{opp_name}** reported {m['score']['you']}–{m['score']['opponent']} ({winner}). "
                f"You have {mm.CONFIRM_HOURS} hours to confirm or dispute it in the [match room]({room}). "
                f"If you don't, it confirms itself {_ts(m['confirmDeadline'])}."
            ),
            color=discord.Color.gold(),
        )
        return embed, None

    if status == "disputed" and m["replayNotFinished"]:
        embed = discord.Embed(
            title="Replay not finished",
            description=(
                f"{title_line}\n\nYour Replay against **{opp_name}** wasn't finished within {mm.REPLAY_HOURS} hours, "
                f"so an Admin will rule on it again. You're free to queue in the meantime. See the [match room]({room})."
            ),
            color=discord.Color.gold(),
        )
        return embed, None

    if status == "disputed":
        embed = discord.Embed(
            title="Result disputed",
            description=(
                f"{title_line}\n\nYour result was disputed. Add your side.\n\n"
                f"**{opp_name}** rejected the result you reported. Write what happened in the "
                f"[match room]({room}); an Admin will look at both sides."
            ),
            color=discord.Color.gold(),
        )
        return embed, None

    if status in ("completed", "voided") and m["ruling"]:
        r = m["ruling"]
        winner = "you win." if m["winner"] == "you" else f"**{opp_name}** wins."
        if r["outcome"] == "void":
            outcome = "The match is **void**: it counts for no one."
        elif r["outcome"] == "overturn":
            outcome = "The reported result is **overturned**: " + winner
        else:
            outcome = "The reported result **stands**: " + winner
        embed = discord.Embed(
            title="Ruling",
            description=(
                f"{title_line}\n\nAn Admin ruled on your disputed match against **{opp_name}**. {outcome}\n\n"
                f"Reason: {discord.utils.escape_markdown(r['reason'])}\n\nSee the [match room]({room})."
            ),
            color=discord.Color.blurple(),
        )
        return embed, None

    if status == "cancelled":
        if m["endedBy"] == "you":
            text = "Match cancelled. You declined or didn't accept in time, so you're out of the queue."
        elif m["endedBy"] == "opponent":
            text = "Your opponent didn't accept."
        else:
            text = "Nobody accepted in time."
        if player["requeued"]:
            text += " You're back in the queue, and keep your place."
        return discord.Embed(title="Match cancelled", description=text, color=discord.Color.dark_grey()), None

    return None


# ---------------------------------------------------------------- buttons


class MatchButton(discord.ui.DynamicItem[discord.ui.Button], template=r"arena:(?P<action>accept|decline):(?P<id>\d+)"):
    """Accept/Decline on a match DM. The custom_id carries everything, so no state is kept."""

    def __init__(self, action: str, match_id: int):
        accept = action == "accept"
        super().__init__(
            discord.ui.Button(
                label="Accept" if accept else "Decline",
                style=discord.ButtonStyle.success if accept else discord.ButtonStyle.secondary,
                custom_id=f"arena:{action}:{match_id}",
            )
        )
        self.action = action
        self.match_id = match_id

    @classmethod
    async def from_custom_id(cls, interaction: discord.Interaction, item: discord.ui.Button, match: re.Match[str], /):
        return cls(match["action"], int(match["id"]))

    async def callback(self, interaction: discord.Interaction) -> None:
        bot: ArenaBot = interaction.client  # type: ignore[assignment]
        fn = mm.accept if self.action == "accept" else mm.decline
        try:
            m = await bot.db(svc.match_action, interaction.user.id, self.match_id, fn)
        except mm.MatchmakingError as e:
            msg = "This match is over." if e.code == "bad_status" else e.message
            await interaction.response.send_message(msg, ephemeral=True)
            return
        if self.action == "decline":
            note = "You declined."
        elif m["status"] == "active":
            note = "Accepted. Match on, details below."
        else:
            note = "Accepted. Waiting for your opponent..."
        # Swap the buttons for a status line so they can't be pressed twice.
        await interaction.response.edit_message(content=note, view=None)


# ---------------------------------------------------------------- profile modal


class ProfileModal(discord.ui.Modal):
    """First /queue from Discord: ask for what the website's welcome page asks for."""

    def __init__(self, game: str, platform: str | None, region: str, game_id: str):
        super().__init__(title="Set up your Arena profile")
        self.game = game
        self.platform = platform
        self.game_id = discord.ui.TextInput(default=game_id or None, max_length=64, placeholder="So your opponent can find you")
        self.region = discord.ui.Select(
            options=[discord.SelectOption(label=r, value=r, default=r == region) for r in REGIONS]
        )
        self.add_item(discord.ui.Label(text=f"Your {GAME_ID_LABELS[game]}", component=self.game_id))
        self.add_item(discord.ui.Label(text="Region", component=self.region))

    async def on_submit(self, interaction: discord.Interaction) -> None:
        bot: ArenaBot = interaction.client  # type: ignore[assignment]
        try:
            await bot.db(svc.save_profile, profile_of(interaction.user), self.game, self.game_id.value, self.region.values[0])
        except mm.MatchmakingError as e:
            await interaction.response.send_message(e.message, ephemeral=True)
            return
        await do_queue(interaction, self.platform)


# ---------------------------------------------------------------- commands


async def do_queue(interaction: discord.Interaction, platform: str | None) -> None:
    bot: ArenaBot = interaction.client  # type: ignore[assignment]
    try:
        result = await bot.db(svc.join, profile_of(interaction.user), interaction.guild_id, platform)
    except mm.MatchmakingError as e:
        if e.code == "needs_profile" and not interaction.response.is_done():
            f = e.fields or {}
            await interaction.response.send_modal(ProfileModal(f["game"], platform, f["region"], f["gameId"]))
        else:
            await reply(interaction, e.message)
        return

    if result["matched"]:
        text = "Match found already! Check your DMs."
    else:
        others = result["searching"] - 1
        text = (
            f"You're in the {GAME_NAMES[result['game']]} queue ({result['platform']}, {result['region']}). "
            f"{others} other{'s' if others != 1 else ''} searching. I'll DM you when a match is found, "
            "so keep DMs from this server open. `/leave` to stop."
        )
    await reply(interaction, text)
    await bot.post_pings(result)


@app_commands.command(name="queue", description="Search for a ranked 1v1")
@app_commands.guild_only()
@app_commands.describe(platform="Dissidia NT only: PS4 or PC (there's no cross-play)")
@app_commands.choices(platform=[app_commands.Choice(name="PS4", value="PS4"), app_commands.Choice(name="PC", value="PC")])
async def queue_cmd(interaction: discord.Interaction, platform: app_commands.Choice[str] | None = None) -> None:
    await do_queue(interaction, platform.value if platform else None)


@app_commands.command(name="leave", description="Stop searching for a match")
async def leave_cmd(interaction: discord.Interaction) -> None:
    bot: ArenaBot = interaction.client  # type: ignore[assignment]
    left = await bot.db(svc.leave, interaction.user.id)
    await reply(interaction, "You've left the queue." if left else "You weren't in the queue.")


arena_group = app_commands.Group(
    name="arena",
    description="Dissidia Arena server settings",
    guild_only=True,
    default_permissions=discord.Permissions(manage_guild=True),  # hidden from non-admins by default
)


@arena_group.command(name="setup", description="Link this server to a game and choose where the bot posts")
@app_commands.describe(
    game="Which game this server is for",
    queue_channel="Where 'someone is searching' pings go (also the fallback for closed DMs)",
    ping_role="Opt-in role to ping when someone starts searching (leave empty for no pings)",
    mod_role="Role pinged when a result needs an Admin (it grants no powers on the site)",
)
@app_commands.choices(game=[app_commands.Choice(name=n, value=g) for g, n in GAME_NAMES.items()])
@app_commands.checks.has_permissions(manage_guild=True)
async def setup_cmd(
    interaction: discord.Interaction,
    game: app_commands.Choice[str],
    queue_channel: discord.TextChannel,
    ping_role: discord.Role | None = None,
    mod_role: discord.Role | None = None,
) -> None:
    bot: ArenaBot = interaction.client  # type: ignore[assignment]
    await bot.db(
        svc.setup_guild,
        interaction.guild_id,
        game.value,
        queue_channel.id,
        ping_role.id if ping_role else None,
        mod_role.id if mod_role else None,
    )
    lines = [f"This server is now the {game.name} Arena. `/queue` here queues for {game.name}."]
    if ping_role:
        lines.append(f"Pinging {ping_role.mention} in {queue_channel.mention} when someone searches (at most every 10 min).")
        if not ping_role.mentionable:
            lines.append("Note: that role isn't mentionable, so give the bot *Mention All Roles* or the ping won't notify anyone.")
    if mod_role:
        lines.append(
            f"Pinging {mod_role.mention} in {queue_channel.mention} when a result needs an Admin. "
            "The role grants no powers on the site: only the Master appoints Admins."
        )
    await reply(interaction, "\n".join(lines))


# ---------------------------------------------------------------- CLI


def register(app: Flask) -> None:
    @app.cli.command("bot")
    def run_bot() -> None:
        """Run the Discord bot (and the matchmaker loop)."""
        token = app.config["DISCORD_BOT_TOKEN"]
        if not token:
            raise click.ClickException("DISCORD_BOT_TOKEN isn't set. See .env.example.")
        ArenaBot(app).run(token, root_logger=True)
