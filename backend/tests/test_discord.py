from datetime import timedelta

import pytest

from app import bot
from app import discord_service as svc
from app import matchmaking as mm
from app.extensions import db
from app.models import GuildConfig, Match, QueueEntry, User

NT_GUILD, G012_GUILD = 111, 222


def profile(i, name=None):
    return svc.DiscordProfile(id=9000 + i, username=name or f"d{i}", display_name=None, avatar_hash=None)


def call(fn, *args):
    """What ArenaBot.db does: run, then commit (or roll back on error)."""
    try:
        result = fn(*args)
        db.session.commit()
        return result
    except Exception:
        db.session.rollback()
        raise


@pytest.fixture
def guilds(app):
    call(svc.setup_guild, NT_GUILD, "nt", 1, 10, None)
    call(svc.setup_guild, G012_GUILD, "012", 2, None, None)


def ready(i, region="NA", game="nt"):
    p = profile(i)
    call(svc.save_profile, p, game, f"id_{i}", region)
    return p


# ---------------------------------------------------------------- setup and profile


def test_unconfigured_server(app):
    with pytest.raises(mm.MatchmakingError) as e:
        call(svc.join, profile(1), 999, "PS4")
    assert e.value.code == "not_configured"


def test_first_queue_asks_for_profile_then_works(guilds):
    with pytest.raises(mm.MatchmakingError) as e:
        call(svc.join, profile(1), NT_GUILD, "PS4")
    assert e.value.code == "needs_profile" and e.value.fields["game"] == "nt"
    # Rolled back: the account is created when they submit the profile modal.
    assert db.session.query(User).count() == 0

    call(svc.save_profile, profile(1), "nt", "  squall_psn ", "EU")
    result = call(svc.join, profile(1), NT_GUILD, "PS4")
    user = db.session.query(User).filter_by(discord_id=9001).one()
    assert user.onboarded and user.region == "EU" and user.game_ids == {"nt": "squall_psn"}
    assert result["game"] == "nt" and result["region"] == "EU" and not result["matched"]
    assert db.session.query(QueueEntry).one().source == "discord"


def test_save_profile_validation(guilds):
    with pytest.raises(mm.MatchmakingError):
        call(svc.save_profile, profile(1), "nt", "   ", "NA")
    with pytest.raises(mm.MatchmakingError):
        call(svc.save_profile, profile(1), "nt", "x", "MARS")


def test_existing_web_account_is_reused(guilds):
    db.session.add(User(discord_id=9001, username="old", onboarded=True, region="JP", game_ids={"nt": "web_id"}))
    db.session.commit()
    call(svc.join, profile(1, name="new"), NT_GUILD, "PC")
    user = db.session.query(User).one()
    assert user.username == "new" and user.region == "JP"


def test_nt_needs_platform_012_does_not(guilds):
    ready(1)
    with pytest.raises(mm.MatchmakingError) as e:
        call(svc.join, profile(1), NT_GUILD, None)
    assert "cross-play" in e.value.message
    ready(2, game="012")
    assert call(svc.join, profile(2), G012_GUILD, None)["platform"] == "PPSSPP"


def test_server_decides_the_game(guilds):
    ready(1, game="012")
    call(svc.join, profile(1), G012_GUILD, None)
    assert db.session.query(QueueEntry).one().game == "012"


def test_leave(guilds):
    ready(1)
    assert call(svc.leave, 9001) is False
    call(svc.join, profile(1), NT_GUILD, "PS4")
    assert call(svc.leave, 9001) is True
    assert call(svc.leave, 12345) is False  # never used the bot


# ---------------------------------------------------------------- pings


def test_ping_cooldown_and_no_ping_when_matched(guilds, monkeypatch):
    for i in (1, 2, 3):
        ready(i)
    first = call(svc.join, profile(1), NT_GUILD, "PS4")
    assert first["pings"] == [{"channel_id": 1, "role_id": 10}]
    # Instantly matched: nobody to advertise.
    assert call(svc.join, profile(2), NT_GUILD, "PS4")["pings"] == []
    # Within the cooldown: no ping.
    assert call(svc.join, profile(3), NT_GUILD, "PC")["pings"] == []
    call(svc.leave, 9003)
    later = mm.now() + svc.PING_COOLDOWN
    monkeypatch.setattr(mm, "now", lambda: later)
    assert call(svc.join, profile(3), NT_GUILD, "PC")["pings"] == [{"channel_id": 1, "role_id": 10}]


def test_server_without_ping_role_never_pings(guilds):
    ready(1, game="012")
    assert call(svc.join, profile(1), G012_GUILD, None)["pings"] == []


# ---------------------------------------------------------------- notifications and buttons


def _pair(guilds_):
    a, b = ready(1), ready(2, region="EU")
    call(svc.join, a, NT_GUILD, "PS4")
    call(svc.join, b, NT_GUILD, "PS4")  # NA vs EU: not paired yet
    for i, entry in enumerate(db.session.query(QueueEntry).order_by(QueueEntry.id)):
        entry.joined_at = mm.now() - timedelta(seconds=mm.REGION_WIDEN_SECONDS + 10 - i)
    db.session.commit()
    return a, b


def test_notifies_each_status_once(guilds):
    a, b = _pair(guilds)
    events = call(svc.collect_notifications)  # the tick pairs them (cross-region, both waited)
    assert [e["status"] for e in events] == ["pending"]
    ev = events[0]
    assert {p["discordId"] for p in ev["players"]} == {a.id, b.id}
    assert ev["fallbackChannels"] == [1]
    assert call(svc.collect_notifications) == []  # already told

    mid = ev["matchId"]
    call(svc.match_action, a.id, mid, mm.accept)
    assert call(svc.collect_notifications) == []  # still pending
    m = call(svc.match_action, b.id, mid, mm.accept)
    assert m["status"] == "active"
    events = call(svc.collect_notifications)
    assert [e["status"] for e in events] == ["active"]


def test_decline_notifies_cancel_and_requeue(guilds):
    a, b = _pair(guilds)
    mid = call(svc.collect_notifications)[0]["matchId"]
    call(svc.match_action, b.id, mid, mm.decline)
    (ev,) = call(svc.collect_notifications)
    by_id = {p["discordId"]: p for p in ev["players"]}
    assert ev["status"] == "cancelled"
    assert by_id[a.id]["requeued"] and by_id[a.id]["match"]["endedBy"] == "opponent"
    assert not by_id[b.id]["requeued"] and by_id[b.id]["match"]["endedBy"] == "you"


def test_old_matches_are_not_notified(guilds, monkeypatch):
    _pair(guilds)
    call(mm.tick)
    later = mm.now() + svc.NOTIFY_WINDOW + timedelta(minutes=1)
    monkeypatch.setattr(mm, "now", lambda: later)
    events = call(svc.collect_notifications)
    assert all(e["status"] != "pending" for e in events)


def test_buttons_reject_outsiders(guilds):
    _pair(guilds)
    mid = call(svc.collect_notifications)[0]["matchId"]
    ready(3)
    with pytest.raises(mm.MatchmakingError) as e:
        call(svc.match_action, profile(3).id, mid, mm.accept)
    assert e.value.code == "not_found"
    assert db.session.get(Match, mid).status == "pending"


# ---------------------------------------------------------------- rendering


def test_render_messages(guilds):
    a, b = _pair(guilds)
    ev = call(svc.collect_notifications)[0]
    pa = next(p for p in ev["players"] if p["discordId"] == a.id)

    embed, view = bot.render_match("pending", pa, "http://x")
    assert embed.title == "Match found" and "(EU)" in embed.description and "<t:" in embed.description
    assert [c.custom_id for c in view.children] == [f"arena:accept:{ev['matchId']}", f"arena:decline:{ev['matchId']}"]

    call(svc.match_action, a.id, ev["matchId"], mm.accept)
    call(svc.match_action, b.id, ev["matchId"], mm.accept)
    (ev,) = call(svc.collect_notifications)
    for p in ev["players"]:
        embed, view = bot.render_match("active", p, "http://x/")
        assert view is None and "first to 2" in embed.description
        assert "http://x/match/live" in embed.fields[-1].value
        hosting = p["match"]["host"] == "you"
        assert ("You're hosting" in embed.description) == hosting


def test_button_custom_id_round_trip():
    btn = bot.MatchButton("decline", 42)
    m = bot.MatchButton.__discord_ui_compiled_template__.fullmatch(btn.custom_id)
    assert m["action"] == "decline" and m["id"] == "42"


# ---------------------------------------------------------------- results and disputes


def _user(p):
    return db.session.query(User).filter_by(discord_id=p.id).one()


def _reported(guilds_, monkeypatch, minutes_later=30):
    """A starts, then (a realistic while later) A reports a 2-0 win. Returns (a, b, match id)."""
    a, b = _pair(guilds_)
    mid = call(svc.collect_notifications)[0]["matchId"]
    call(svc.match_action, a.id, mid, mm.accept)
    call(svc.match_action, b.id, mid, mm.accept)
    call(svc.collect_notifications)
    # A Bo3 takes longer than NOTIFY_WINDOW, which mustn't stop result DMs.
    later = mm.now() + timedelta(minutes=minutes_later)
    monkeypatch.setattr(mm, "now", lambda: later)
    for n in (1, 2):
        call(lambda n=n: mm.report_game(mm.lock_match(mid), _user(a), n, _user(a).id))
    return a, b, mid


def test_disputed_result_dms_the_reporter_once(guilds, monkeypatch):
    a, b, mid = _reported(guilds, monkeypatch)
    call(svc.collect_notifications)  # whatever reporting sends
    call(lambda: mm.dispute(mm.lock_match(mid), _user(b), [2], "I won game 2"))

    events = call(svc.collect_notifications)
    assert [(e["matchId"], e["status"]) for e in events] == [(mid, "disputed")]
    assert [p["discordId"] for p in events[0]["players"]] == [a.id]
    assert call(svc.collect_notifications) == []

    embed, view = bot.render_match("disputed", events[0]["players"][0], "http://x")
    assert view is None
    assert "Your result was disputed. Add your side." in embed.description
    assert f"http://x/match/live?match={mid}" in embed.description


def test_reported_result_reminds_the_opponent_once(guilds, monkeypatch):
    a, b, mid = _reported(guilds, monkeypatch)
    events = call(svc.collect_notifications)
    assert [(e["matchId"], e["status"]) for e in events] == [(mid, "reported")]
    assert [p["discordId"] for p in events[0]["players"]] == [b.id]
    assert call(svc.collect_notifications) == []

    embed, view = bot.render_match("reported", events[0]["players"][0], "http://x")
    assert view is None
    assert "2 hours to confirm or dispute" in embed.description
    assert "<t:" in embed.description  # the deadline, in the reader's timezone
    assert f"http://x/match/live?match={mid}" in embed.description


# ---------------------------------------------------------------- Admin alerts and Rulings


def _disputed(guilds_, monkeypatch):
    a, b, mid = _reported(guilds_, monkeypatch)
    call(svc.collect_notifications)
    call(lambda: mm.dispute(mm.lock_match(mid), _user(b), [2], "I won game 2"))
    return a, b, mid


def _with_mod_roles():
    call(svc.setup_guild, NT_GUILD, "nt", 1, 10, 77)
    call(svc.setup_guild, G012_GUILD, "012", 2, None, 88)


def test_a_new_dispute_pings_the_games_moderator_role_with_a_link_to_the_case(guilds, monkeypatch):
    _with_mod_roles()
    a, b, mid = _disputed(guilds, monkeypatch)
    (ev,) = call(svc.collect_notifications)
    assert ev["modPings"] == [{"channel_id": 1, "role_id": 77}]  # the NT server only
    assert bot.mod_ping_text(ev, ev["modPings"][0], "http://x/") == (
        f"<@&77> A result needs an Admin: Dissidia NT match #{mid} was disputed. http://x/admin/cases/{mid}"
    )
    assert call(svc.collect_notifications) == []  # no re-ping


def test_no_ping_once_the_case_is_claimed(guilds, monkeypatch, app):
    from app import cases

    _with_mod_roles()
    a, b, mid = _disputed(guilds, monkeypatch)
    admin = User(discord_id=5555, username="kefka", admin_since=mm.now())
    db.session.add(admin)
    call(lambda: cases.claim(mm.lock_match(mid), admin))
    (ev,) = call(svc.collect_notifications)
    assert ev["status"] == "disputed" and ev["modPings"] == []


def test_servers_without_a_moderator_role_get_no_ping(guilds, monkeypatch):
    a, b, mid = _disputed(guilds, monkeypatch)
    (ev,) = call(svc.collect_notifications)
    assert ev["modPings"] == []


@pytest.mark.parametrize("outcome, status", [("uphold", "completed"), ("void", "voided")])
def test_a_ruling_dms_both_players_without_the_admins_name(guilds, monkeypatch, outcome, status):
    from app import cases

    a, b, mid = _disputed(guilds, monkeypatch)
    call(svc.collect_notifications)
    admin = User(discord_id=5555, username="kefka", admin_since=mm.now())
    db.session.add(admin)
    call(lambda: cases.claim(mm.lock_match(mid), admin))
    call(lambda: cases.rule(mm.lock_match(mid), admin, outcome, "Clip shows the result."))

    (ev,) = call(svc.collect_notifications)
    assert ev["status"] == status and ev["modPings"] == []
    assert sorted(p["discordId"] for p in ev["players"]) == sorted([a.id, b.id])
    for p in ev["players"]:
        embed, view = bot.render_match(status, p, "http://x")
        assert view is None and embed.title == "Ruling"
        assert "Clip shows the result." in embed.description and "kefka" not in embed.description
        assert f"http://x/match/live?match={mid}" in embed.description
    assert call(svc.collect_notifications) == []


def test_a_normal_confirm_sends_no_dm(guilds, monkeypatch):
    a, b, mid = _reported(guilds, monkeypatch)
    call(svc.collect_notifications)
    call(lambda: mm.confirm(mm.lock_match(mid), _user(b)))
    assert call(svc.collect_notifications) == []
