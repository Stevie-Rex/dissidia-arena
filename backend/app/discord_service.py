"""
Database side of the Discord bot.

Plain synchronous functions on db.session, like matchmaking.py, so they're testable without
Discord. The bot runs each one in a worker thread inside an app context and commits after.
They return plain dicts, never ORM objects, because the session is gone by the time the
bot uses the result.
"""

from dataclasses import dataclass
from datetime import timedelta

from sqlalchemy import or_, select

from . import matchmaking as mm
from .extensions import db
from .models import GuildConfig, Match, User
from .models.user import REGIONS
from .routes.me import MAX_GAME_ID_LEN

# Don't ping a server's role more often than this, however many people queue.
PING_COOLDOWN = timedelta(minutes=10)
# Status changes older than this are never DM'd about, e.g. the backlog when the bot first starts.
NOTIFY_WINDOW = timedelta(minutes=10)
# Statuses players get a DM for. Reporting in Discord comes later.
NOTIFY_STATUSES = ("pending", "active", "reported", "disputed", "cancelled")
# Ends that only get a DM when they came from a Ruling (a normal confirm sends none).
RULING_STATUSES = ("completed", "voided")


def _notifies(match: Match) -> bool:
    return match.status in NOTIFY_STATUSES or (match.status in RULING_STATUSES and match.ruling is not None)


def _mod_pings(match: Match) -> list[dict]:
    """A new Disputed match pings the moderator role (from /arena setup) in each of that game's
    servers, unless an Admin has already Claimed it. The role grants no powers on the site."""
    if match.status != "disputed" or match.claimed_by_id is not None:
        return []
    return [
        {"channel_id": c.queue_channel_id, "role_id": c.mod_role_id}
        for c in db.session.scalars(
            select(GuildConfig)
            .where(GuildConfig.game == match.game, GuildConfig.mod_role_id.is_not(None))
            .order_by(GuildConfig.guild_id)
        )
    ]


def _recipients(match: Match) -> list[User]:
    """Who hears about this status: a reported result goes to the player who must answer it, a
    dispute to the player whose result was rejected."""
    if match.status == "reported":
        return [mm.non_reporter(match)]
    if match.status == "disputed":
        return [mm.reporter(match)]
    return [match.player_a, match.player_b]


@dataclass(frozen=True)
class DiscordProfile:
    id: int
    username: str
    display_name: str | None
    avatar_hash: str | None


# ---------------------------------------------------------------- users and servers


def upsert_user(p: DiscordProfile) -> User:
    """Same identity as website sign-in (discord_id), so bot and site share one account."""
    user = db.session.scalar(select(User).where(User.discord_id == p.id))
    if user is None:
        user = User(discord_id=p.id, onboarded=False, game_ids={})
        db.session.add(user)
    user.username = p.username
    user.display_name = p.display_name
    user.avatar_hash = p.avatar_hash
    db.session.flush()
    return user


def setup_guild(guild_id: int, game: str, queue_channel_id: int, ping_role_id: int | None, mod_role_id: int | None) -> dict:
    if game not in mm.GAME_RULES:
        raise mm.MatchmakingError("validation", f"game must be one of {list(mm.GAME_RULES)}", 400)
    cfg = db.session.get(GuildConfig, guild_id) or GuildConfig(guild_id=guild_id)
    cfg.game = game
    cfg.queue_channel_id = queue_channel_id
    cfg.ping_role_id = ping_role_id
    cfg.mod_role_id = mod_role_id
    db.session.add(cfg)
    return {"game": game}


def _guild(guild_id: int | None) -> GuildConfig:
    cfg = db.session.get(GuildConfig, guild_id) if guild_id else None
    if cfg is None:
        raise mm.MatchmakingError("not_configured", "This server isn't set up yet. An admin needs to run /arena setup.", 400)
    return cfg


def save_profile(p: DiscordProfile, game: str, game_id: str, region: str) -> None:
    """First-time setup from Discord: the same fields as the website's welcome page."""
    game_id = (game_id or "").strip()
    if not game_id or len(game_id) > MAX_GAME_ID_LEN:
        raise mm.MatchmakingError("validation", f"In-game ID must be 1-{MAX_GAME_ID_LEN} characters.", 400)
    if region not in REGIONS:
        raise mm.MatchmakingError("validation", f"Region must be one of {', '.join(REGIONS)}.", 400)
    user = upsert_user(p)
    user.game_ids = {**user.game_ids, game: game_id}  # reassign: JSON columns don't track mutation
    if game not in user.games:
        user.games = sorted({*user.games, game})
    user.region = region
    user.onboarded = True


# ---------------------------------------------------------------- queue


def join(p: DiscordProfile, guild_id: int | None, platform: str | None) -> dict:
    cfg = _guild(guild_id)
    rules = mm.GAME_RULES[cfg.game]
    user = upsert_user(p)

    if not user.onboarded or not user.game_ids.get(cfg.game):
        # The bot answers this with the profile modal, prefilled from these fields.
        raise mm.MatchmakingError(
            "needs_profile",
            "Set up your profile first.",
            403,
            {"game": cfg.game, "region": user.region, "gameId": user.game_ids.get(cfg.game, "")},
        )
    if platform is None:
        if len(rules["platforms"]) > 1:
            raise mm.MatchmakingError(
                "validation",
                f"Pick a platform: {' or '.join(rules['platforms'])} (there's no cross-play).",
                400,
            )
        platform = rules["platforms"][0]

    mm.join_queue(user, {"game": cfg.game, "mode": "1v1", "bestOf": rules["best_of"][0], "platform": platform}, "discord")
    state = mm.state(user)
    return {
        "game": cfg.game,
        "platform": platform,
        "region": user.region,
        "name": user.display_name or user.username,
        "searching": state["searching"][cfg.game],
        "matched": state["match"] is not None,
        # Only advertise if they're actually waiting.
        "pings": [] if state["match"] else _claim_pings(cfg.game),
    }


def _claim_pings(game: str) -> list[dict]:
    """Servers for this game whose ping cooldown has passed; marks them as pinged."""
    t = mm.now()
    out = []
    for cfg in db.session.scalars(
        select(GuildConfig).where(GuildConfig.game == game, GuildConfig.ping_role_id.is_not(None))
    ):
        if cfg.last_ping_at is None or t - cfg.last_ping_at >= PING_COOLDOWN:
            cfg.last_ping_at = t
            out.append({"channel_id": cfg.queue_channel_id, "role_id": cfg.ping_role_id})
    return out


def leave(discord_id: int) -> bool:
    user = db.session.scalar(select(User).where(User.discord_id == discord_id))
    return bool(user) and mm.leave_queue(user)


# ---------------------------------------------------------------- matches


def match_action(discord_id: int, match_id: int, action) -> dict:
    """Run an mm action (accept, decline, ...) for the player behind a Discord button."""
    user = db.session.scalar(select(User).where(User.discord_id == discord_id))
    match = mm.lock_match(match_id)
    if user is None or match is None:
        raise mm.MatchmakingError("not_found", "That match isn't yours.", 404)
    action(match, user)
    return mm.match_dict(match, user)


def collect_notifications() -> list[dict]:
    """
    Advance matchmaking, then return every match whose status the players haven't been
    told about, marking them told. At-most-once: if a DM fails we don't retry, which beats
    spamming. Covers matches made by the website too, so web players get DMs as well.
    """
    mm.tick()
    db.session.flush()
    t = mm.now()
    rows = db.session.scalars(
        select(Match)
        .where(
            or_(Match.notified_status.is_(None), Match.notified_status != Match.status),
            # When the status last changed: creation (pending, active), the report (the confirm
            # deadline is a fixed time after it), or the end of the match.
            or_(
                Match.created_at >= t - NOTIFY_WINDOW,
                Match.confirm_deadline >= t - NOTIFY_WINDOW + timedelta(seconds=mm.CONFIRM_SECONDS),
                Match.finished_at >= t - NOTIFY_WINDOW,
            ),
        )
        .order_by(Match.id)
    ).all()

    events = []
    for match in rows:
        match.notified_status = match.status
        if not _notifies(match):
            continue
        events.append(
            {
                "matchId": match.id,
                "game": match.game,
                "status": match.status,
                "modPings": _mod_pings(match),
                "fallbackChannels": [
                    c.queue_channel_id for c in db.session.scalars(select(GuildConfig).where(GuildConfig.game == match.game))
                ],
                "players": [
                    {
                        "discordId": p.discord_id,
                        "match": mm.match_dict(match, p),
                        "requeued": mm.queue_entry(p) is not None,
                    }
                    for p in _recipients(match)
                ],
            }
        )
    return events
