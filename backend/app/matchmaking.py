"""
The queue, pairing, match chat and how a match is shown, shared by the website API and (phase 2)
the Discord bot. Changes to a match's status are in app.lifecycle.

Every function works on the current db.session and leaves committing to the caller,
so a route can do several steps in one transaction.

Concurrency: functions that change a match take it already locked (see lock_match), and
pairing locks queue rows with SELECT ... FOR UPDATE SKIP LOCKED, so two requests can't
grab the same opponent. SQLite (tests) ignores the locking clauses.
"""

from collections.abc import Callable
from datetime import timedelta

from sqlalchemy import case, func, or_, select
from sqlalchemy.exc import IntegrityError

from . import clock, help_requests, lifecycle, rewards, screenshots, settlement
from .errors import MatchmakingError
from .extensions import db
from .models import DisputeStatement, Match, MatchMessage, QueueEntry, User

# Existing tests reach these through this module. New code uses app.lifecycle.
from .lifecycle import (  # noqa: F401
    ACCEPT_SECONDS,
    CONFIRM_SECONDS,
    REPLAY_HOURS,
    REPLAY_SECONDS,
    accept,
    confirm,
    decline,
    dispute,
    report_game,
)

MAX_MESSAGE_LEN = 500
# The community is small, so after this long a player will also take an opponent from
# another region. Both players must have waited this long, so a fresh joiner still gets a
# window to find someone local first.
REGION_WIDEN_SECONDS = 60
# What each game can be queued for. Phase 1 is 1v1 only (NT 3v3 needs parties).
# Ranked is Bo3 for both scenes (NT's in-game "first to 2"), so the queue isn't split by format.
# NT has no cross-play, so PS4 and PC stay separate pools.
GAME_RULES = {
    "012": {"modes": ("1v1",), "best_of": (3,), "platforms": ("PPSSPP",)},
    "nt": {"modes": ("1v1",), "best_of": (3,), "platforms": ("PS4", "PC")},
}


# ---------------------------------------------------------------- queue


def validate_settings(data: dict) -> dict:
    game = data.get("game")
    rules = GAME_RULES.get(game)
    if rules is None:
        raise MatchmakingError("validation", "invalid queue settings", 400, {"game": f"must be one of {list(GAME_RULES)}"})
    errors = {}
    if data.get("mode") not in rules["modes"]:
        errors["mode"] = f"must be one of {list(rules['modes'])}"
    best_of = data.get("bestOf")
    if isinstance(best_of, bool) or best_of not in rules["best_of"]:
        errors["bestOf"] = f"must be one of {list(rules['best_of'])}"
    if data.get("platform") not in rules["platforms"]:
        errors["platform"] = f"must be one of {list(rules['platforms'])}"
    if errors:
        raise MatchmakingError("validation", "invalid queue settings", 400, errors)
    return {"game": game, "mode": data["mode"], "best_of": best_of, "platform": data["platform"]}


def queue_entry(user: User) -> QueueEntry | None:
    return db.session.scalar(select(QueueEntry).where(QueueEntry.user_id == user.id))


def join_queue(user: User, data: dict, source: str = "web") -> QueueEntry:
    if not user.onboarded:
        raise MatchmakingError("not_onboarded", "finish account setup before queueing", 403)
    settings = validate_settings(data)
    if not user.game_ids.get(settings["game"]):
        raise MatchmakingError(
            "game_id_required", "add your in-game ID for this game so your opponent can find you", 403
        )
    if current_match(user):
        raise MatchmakingError("in_match", "you're already in a match")
    if queue_entry(user):
        raise MatchmakingError("already_queued", "you're already in the queue")

    entry = QueueEntry(user_id=user.id, region=user.region, source=source, joined_at=clock.now(), **settings)
    db.session.add(entry)
    try:
        db.session.flush()
    except IntegrityError:  # a second join from the same user raced this one
        db.session.rollback()
        raise MatchmakingError("already_queued", "you're already in the queue") from None
    return entry


def leave_queue(user: User) -> bool:
    entry = queue_entry(user)
    if entry is None:
        return False
    db.session.delete(entry)
    return True


def try_match(entry: QueueEntry) -> Match | None:
    """
    Pair this entry with a compatible player, if there is one: same region first, then
    (once both have waited REGION_WIDEN_SECONDS) anyone. Longest-waiting wins ties.
    """
    # Lock our own row first so a concurrent request can't pair us at the same time.
    mine = db.session.scalar(select(QueueEntry).where(QueueEntry.id == entry.id).with_for_update())
    if mine is None:  # someone else already matched us
        return None
    cutoff = clock.now() - timedelta(seconds=REGION_WIDEN_SECONDS)
    region_ok = QueueEntry.region == mine.region
    if mine.joined_at <= cutoff:
        region_ok = or_(region_ok, QueueEntry.joined_at <= cutoff)
    other = db.session.scalar(
        select(QueueEntry)
        .where(
            QueueEntry.id != mine.id,
            QueueEntry.game == mine.game,
            QueueEntry.mode == mine.mode,
            QueueEntry.best_of == mine.best_of,
            QueueEntry.platform == mine.platform,
            region_ok,
        )
        .order_by(case((QueueEntry.region == mine.region, 0), else_=1), QueueEntry.joined_at, QueueEntry.id)
        .limit(1)
        .with_for_update(skip_locked=True)
    )
    if other is None:
        return None

    # Whoever waited longer is player A (and the default host).
    first, second = sorted([mine, other], key=lambda e: (e.joined_at, e.id))
    match = lifecycle.propose(
        game=mine.game,
        mode=mine.mode,
        best_of=mine.best_of,
        platform=mine.platform,
        region=first.region,  # the host's; each player's own region is in match_dict
        player_a_id=first.user_id,
        player_b_id=second.user_id,
    )
    db.session.add(match)
    db.session.delete(mine)
    db.session.delete(other)
    db.session.flush()
    return match


def searching_counts(region: str) -> dict[str, int]:
    rows = db.session.execute(
        select(QueueEntry.game, func.count()).where(QueueEntry.region == region).group_by(QueueEntry.game)
    )
    counts = {g: 0 for g in GAME_RULES}
    counts.update({g: n for g, n in rows})
    return counts


def state(user: User) -> dict:
    """Everything the queue UI needs; also advances matchmaking (pairs, expires)."""
    match = current_match(user)  # first: expiring a match can put the user back in the queue
    entry = queue_entry(user)
    if entry and not match:
        match = try_match(entry)
        if match:
            entry = None
    return {
        "queue": entry_dict(entry) if entry else None,
        "match": match_dict(match, user) if match else None,
        "searching": searching_counts(user.region),
        "disputes": disputes(user),
    }


def disputes(user: User) -> list[dict]:
    """The player's Disputed matches, so the site can ask the reporting player for their side."""
    rows = db.session.scalars(
        select(Match)
        .where(Match.status == "disputed", (Match.player_a_id == user.id) | (Match.player_b_id == user.id))
        .order_by(Match.id)
    )
    return [
        {
            "id": m.id,
            "game": m.game,
            "opponent": (opp := lifecycle.opponent(m, user)).display_name or opp.username,
            "youReported": m.reported_by_id == user.id,
            "statementAdded": any(st.user_id == user.id for st in m.statements),
        }
        for m in rows
    ]


def tick() -> dict[str, list[Match]]:
    """
    Advance matchmaking for everyone, not just whoever happens to be polling: apply every passed
    deadline (see lifecycle.advance), then pair everyone who can be paired.
    Run on a timer by the matchmaker worker so bot-only players get matched too.
    Returns what changed so the caller can notify players.
    """
    changed: dict[str, list[Match]] = {"expired": [], "autoConfirmed": [], "replayExpired": []}
    # The matches with a passed deadline, in the order advance() applies the deadlines.
    for statuses, deadline in (
        (("pending",), Match.accept_deadline),
        (("reported",), Match.confirm_deadline),
        (("active", "reported"), Match.replay_deadline),
    ):
        due = db.session.scalars(select(Match.id).where(Match.status.in_(statuses), deadline <= clock.now())).all()
        for match_id in due:
            match = lock_match(match_id)
            if match and (applied := lifecycle.advance(match)):
                changed[applied].append(match)
        db.session.flush()

    created = []
    for entry_id in db.session.scalars(select(QueueEntry.id).order_by(QueueEntry.joined_at, QueueEntry.id)).all():
        entry = db.session.get(QueueEntry, entry_id)
        if entry is None:  # paired earlier in this loop
            continue
        if match := try_match(entry):
            created.append(match)
    return {"created": created, **changed}


def entry_dict(entry: QueueEntry) -> dict:
    return {**entry.settings(), "region": entry.region, "joinedAt": clock.iso(entry.joined_at), "source": entry.source}


# ---------------------------------------------------------------- matches


def lock_match(match_id: int) -> Match | None:
    return db.session.get(Match, match_id, with_for_update=True, populate_existing=True)


def current_match(user: User) -> Match | None:
    match = db.session.scalar(
        select(Match)
        .where(
            Match.status.in_(lifecycle.OPEN),
            (Match.player_a_id == user.id) | (Match.player_b_id == user.id),
        )
        .order_by(Match.id.desc())
        .limit(1)
    )
    if match and match.status == "pending" and clock.now() >= match.accept_deadline:
        match = lock_match(match.id)
        lifecycle.advance(match)
        return None if match.status not in lifecycle.OPEN else match
    return match


def add_statement(match: Match, user: User, text: object) -> None:
    """Either player writes (or rewrites) their side of a Disputed match, until there's a Ruling."""
    lifecycle.side(match, user)
    lifecycle.require_status(match, "disputed")
    text = text.strip() if isinstance(text, str) else ""
    if not text or len(text) > lifecycle.MAX_STATEMENT_LEN:
        raise MatchmakingError("validation", f"statement must be 1-{lifecycle.MAX_STATEMENT_LEN} characters", 400)
    mine = next((st for st in match.statements if st.user_id == user.id), None)
    if mine is None:
        mine = DisputeStatement(user_id=user.id, text=text, updated_at=clock.now())
        match.statements.append(mine)
    else:
        mine.text = text
        mine.updated_at = clock.now()


def post_message(match: Match, user: User, text: str) -> MatchMessage:
    lifecycle.side(match, user)
    lifecycle.require_status(match, "active", "reported")
    text = (text or "").strip() if isinstance(text, str) else ""
    if not text or len(text) > MAX_MESSAGE_LEN:
        raise MatchmakingError("validation", f"message must be 1-{MAX_MESSAGE_LEN} characters", 400)
    msg = MatchMessage(user_id=user.id, text=text, created_at=clock.now())
    match.messages.append(msg)
    return msg


# ---------------------------------------------------------------- serialisation


def _player_dict(match: Match, player: User, accepted: bool) -> dict:
    return {
        "id": player.id,
        "displayName": player.display_name or player.username,
        "avatarUrl": player.avatar_url,
        "region": player.region,
        "gameId": player.game_ids.get(match.game),
        "accepted": accepted,
    }


def _dispute_dict(match: Match, rel: Callable[[int | None], str | None]) -> dict | None:
    """Both players see the whole dispute: the games, the reason and each side's statement.

    Matches disputed before the dispute form have no games or reason (shown as "No details").
    """
    # A Replay keeps showing the dispute it settled, even one filed before the dispute form.
    if match.status != "disputed" and match.dispute_reason is None and match.ruling != "replay":
        return None
    statements = {"you": None, "opponent": None}
    for st in match.statements:
        statements[rel(st.user_id)] = {"text": st.text, "updatedAt": clock.iso(st.updated_at)}
    return {
        # Counts disputes from before a Replay, so the site can tell a new dispute from the same one.
        "round": match.dispute_round,
        "games": match.dispute_games or [],
        "reason": match.dispute_reason,
        "by": rel(match.ended_by_id),
        "statements": statements,
        "screenshots": screenshots.for_players(match, rel),
    }


def match_dict(match: Match, viewer: User) -> dict:
    """Seen from one player's side: 'you' and 'opponent', which suits both the site and DMs."""
    side = lifecycle.side(match, viewer)
    me, opp = (match.player_a, match.player_b) if side == "a" else (match.player_b, match.player_a)
    my_ok, opp_ok = (match.a_accepted, match.b_accepted) if side == "a" else (match.b_accepted, match.a_accepted)

    def rel(uid: int | None) -> str | None:
        return None if uid is None else "you" if uid == me.id else "opponent"

    s = settlement.score(match)
    return {
        "id": match.id,
        "game": match.game,
        "mode": match.mode,
        "bestOf": match.best_of,
        "platform": match.platform,
        "region": match.region,
        "status": match.status,
        "acceptDeadline": clock.iso(match.accept_deadline),
        "confirmDeadline": clock.iso(match.confirm_deadline) if match.status == "reported" else None,
        # While a Replay is being played: when it goes back to the Admins if it hasn't settled.
        "replayDeadline": clock.iso(match.replay_deadline) if match.status in lifecycle.OPEN else None,
        "replayNotFinished": match.replay_not_finished,
        "createdAt": clock.iso(match.created_at),
        "finishedAt": clock.iso(match.finished_at),
        "host": rel(match.player_a_id),
        "you": _player_dict(match, me, my_ok),
        "opponent": _player_dict(match, opp, opp_ok),
        "winsNeeded": settlement.wins_needed(match),
        "score": {"you": s[me.id], "opponent": s[opp.id]},
        "games": [
            {"n": g.game_no, "winner": rel(g.winner_id), "reportedBy": rel(g.reported_by_id), "details": g.details}
            for g in match.games
        ],
        "winner": rel(match.winner_id),
        "reportedBy": rel(match.reported_by_id),
        "endedBy": rel(match.ended_by_id),
        # Rewards this match earned for the viewer (only ever non-empty for the winner of a completed match).
        "dispute": _dispute_dict(match, rel),
        "rewardsUnlocked": rewards.rewards_from_match(match, me.id) if match.completed_with_winner else [],
        "ruling": lifecycle.ruling_dict(match),
        "canAskAdmin": help_requests.can_ask(match, viewer),
        "helpRequest": help_requests.player_dict(help_requests.open_by(match, viewer)),
        "messages": [
            {"id": m.id, "from": "system" if m.user_id is None else rel(m.user_id), "text": m.text, "at": clock.iso(m.created_at)}
            for m in match.messages
        ],
    }
