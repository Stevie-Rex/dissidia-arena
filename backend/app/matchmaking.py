"""
Queue and match logic, shared by the website API and (phase 2) the Discord bot.

Every function works on the current db.session and leaves committing to the caller,
so a route can do several steps in one transaction.

Concurrency: functions that change a match take it already locked (see lock_match), and
pairing locks queue rows with SELECT ... FOR UPDATE SKIP LOCKED, so two requests can't
grab the same opponent. SQLite (tests) ignores the locking clauses.
"""

from datetime import UTC, datetime, timedelta

from sqlalchemy import case, func, or_, select
from sqlalchemy.exc import IntegrityError

from .extensions import db
from .models import Match, MatchGame, MatchMessage, QueueEntry, User

# Long enough to notice a Discord DM, not so long a no-show stalls the queue.
ACCEPT_SECONDS = 60
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

OPEN_STATUSES = ("pending", "active", "reported")


class MatchmakingError(Exception):
    def __init__(self, code: str, message: str, status: int = 409, fields: dict | None = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status
        self.fields = fields


def now() -> datetime:
    """Naive UTC, which is what the DateTime columns store."""
    return datetime.now(UTC).replace(tzinfo=None)


def iso(dt: datetime | None) -> str | None:
    return dt.isoformat(timespec="seconds") + "Z" if dt else None


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

    entry = QueueEntry(user_id=user.id, region=user.region, source=source, joined_at=now(), **settings)
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
    cutoff = now() - timedelta(seconds=REGION_WIDEN_SECONDS)
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
    t = now()
    match = Match(
        game=mine.game,
        mode=mine.mode,
        best_of=mine.best_of,
        platform=mine.platform,
        region=first.region,  # the host's; each player's own region is in match_dict
        status="pending",
        player_a_id=first.user_id,
        player_b_id=second.user_id,
        accept_deadline=t + timedelta(seconds=ACCEPT_SECONDS),
        created_at=t,
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
    }


def tick() -> dict[str, list[Match]]:
    """
    Advance matchmaking for everyone, not just whoever happens to be polling: expire
    overdue accept windows (re-queueing accepters), then pair everyone who can be paired.
    Run on a timer by the matchmaker worker so bot-only players get matched too.
    Returns what changed so the caller can notify players.
    """
    expired = []
    due = db.session.scalars(
        select(Match.id).where(Match.status == "pending", Match.accept_deadline <= now())
    ).all()
    for match_id in due:
        match = lock_match(match_id)
        if match and match.status == "pending":
            expire_if_due(match)
            if match.status != "pending":
                expired.append(match)
    db.session.flush()

    created = []
    for entry_id in db.session.scalars(select(QueueEntry.id).order_by(QueueEntry.joined_at, QueueEntry.id)).all():
        entry = db.session.get(QueueEntry, entry_id)
        if entry is None:  # paired earlier in this loop
            continue
        if match := try_match(entry):
            created.append(match)
    return {"created": created, "expired": expired}


def entry_dict(entry: QueueEntry) -> dict:
    return {**entry.settings(), "region": entry.region, "joinedAt": iso(entry.joined_at), "source": entry.source}


# ---------------------------------------------------------------- matches


def lock_match(match_id: int) -> Match | None:
    return db.session.get(Match, match_id, with_for_update=True, populate_existing=True)


def current_match(user: User) -> Match | None:
    match = db.session.scalar(
        select(Match)
        .where(
            Match.status.in_(OPEN_STATUSES),
            (Match.player_a_id == user.id) | (Match.player_b_id == user.id),
        )
        .order_by(Match.id.desc())
        .limit(1)
    )
    if match and match.status == "pending" and now() >= match.accept_deadline:
        match = lock_match(match.id)
        expire_if_due(match)
        return None if match.status not in OPEN_STATUSES else match
    return match


def expire_if_due(match: Match) -> None:
    """Accept window over: cancel, and put anyone who did accept back in the queue."""
    if match.status != "pending" or now() < match.accept_deadline:
        return
    no_shows = [p for p, ok in ((match.player_a, match.a_accepted), (match.player_b, match.b_accepted)) if not ok]
    _cancel(match, ended_by=no_shows[0] if len(no_shows) == 1 else None)
    for player, accepted in ((match.player_a, match.a_accepted), (match.player_b, match.b_accepted)):
        if accepted:
            _requeue(match, player)


def _cancel(match: Match, ended_by: User | None) -> None:
    match.status = "cancelled"
    match.ended_by_id = ended_by.id if ended_by else None
    match.finished_at = now()


def _requeue(match: Match, player: User) -> None:
    db.session.add(
        QueueEntry(
            user_id=player.id,
            game=match.game,
            mode=match.mode,
            best_of=match.best_of,
            platform=match.platform,
            region=match.region,
            joined_at=now(),
        )
    )


def _side(match: Match, user: User) -> str:
    if user.id == match.player_a_id:
        return "a"
    if user.id == match.player_b_id:
        return "b"
    raise MatchmakingError("not_found", "match not found", 404)


def _opponent(match: Match, user: User) -> User:
    return match.player_b if _side(match, user) == "a" else match.player_a


def _require_status(match: Match, *statuses: str) -> None:
    if match.status not in statuses:
        raise MatchmakingError("bad_status", f"match is {match.status}")


def _system(match: Match, text: str) -> None:
    match.messages.append(MatchMessage(user_id=None, text=text, created_at=now()))


def accept(match: Match, user: User) -> None:
    side = _side(match, user)
    expire_if_due(match)
    _require_status(match, "pending")
    setattr(match, f"{side}_accepted", True)
    if match.a_accepted and match.b_accepted:
        match.status = "active"
        _system(match, f"Match started. {match.player_a.display_name or match.player_a.username} hosts.")


def decline(match: Match, user: User) -> None:
    _side(match, user)
    expire_if_due(match)
    _require_status(match, "pending")
    _cancel(match, ended_by=user)
    _requeue(match, _opponent(match, user))


def wins_needed(match: Match) -> int:
    return match.best_of // 2 + 1


def score(match: Match) -> dict[int, int]:
    s = {match.player_a_id: 0, match.player_b_id: 0}
    for g in match.games:
        s[g.winner_id] += 1
    return s


def report_game(match: Match, user: User, game_no: int, winner_id: int, details: dict | None = None) -> None:
    _side(match, user)
    _require_status(match, "active")
    expected = len(match.games) + 1
    if game_no != expected:
        # Usually both players reported the same game at once; the client should refresh.
        raise MatchmakingError("stale", f"game {expected} is next", 409)
    if winner_id not in (match.player_a_id, match.player_b_id):
        raise MatchmakingError("validation", "winner must be a player in this match", 400)

    match.games.append(
        MatchGame(game_no=game_no, winner_id=winner_id, reported_by_id=user.id, details=_clean_details(details))
    )
    winner = match.player_a if winner_id == match.player_a_id else match.player_b
    _system(match, f"Game {game_no}: {winner.display_name or winner.username} wins (reported by {user.display_name or user.username}).")

    s = score(match)
    if max(s.values()) >= wins_needed(match):
        match.status = "reported"
        match.winner_id = max(s, key=s.get)
        match.reported_by_id = user.id


def _clean_details(details: dict | None) -> dict:
    if not isinstance(details, dict):
        return {}
    return {k: v[:64] for k, v in details.items() if k in ("character", "helper", "stage") and isinstance(v, str)}


def confirm(match: Match, user: User) -> None:
    _side(match, user)
    _require_status(match, "reported")
    if user.id == match.reported_by_id:
        raise MatchmakingError("not_your_turn", "your opponent needs to confirm the result", 403)
    match.status = "completed"
    match.finished_at = now()
    _system(match, "Result confirmed.")


def dispute(match: Match, user: User) -> None:
    _side(match, user)
    _require_status(match, "reported")
    if user.id == match.reported_by_id:
        raise MatchmakingError("not_your_turn", "only the other player can dispute", 403)
    match.status = "disputed"
    match.ended_by_id = user.id
    match.finished_at = now()
    _system(match, "Result disputed. A moderator will review it.")


def leave(match: Match, user: User) -> None:
    """Pending: same as declining. Active: abandon (counts against you later)."""
    _side(match, user)
    if match.status == "pending":
        decline(match, user)
        return
    _require_status(match, "active")
    match.status = "abandoned"
    match.ended_by_id = user.id
    match.finished_at = now()
    _system(match, f"{user.display_name or user.username} left the match.")


def post_message(match: Match, user: User, text: str) -> MatchMessage:
    _side(match, user)
    _require_status(match, "active", "reported")
    text = (text or "").strip() if isinstance(text, str) else ""
    if not text or len(text) > MAX_MESSAGE_LEN:
        raise MatchmakingError("validation", f"message must be 1-{MAX_MESSAGE_LEN} characters", 400)
    msg = MatchMessage(user_id=user.id, text=text, created_at=now())
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


def match_dict(match: Match, viewer: User) -> dict:
    """Seen from one player's side: 'you' and 'opponent', which suits both the site and DMs."""
    side = _side(match, viewer)
    me, opp = (match.player_a, match.player_b) if side == "a" else (match.player_b, match.player_a)
    my_ok, opp_ok = (match.a_accepted, match.b_accepted) if side == "a" else (match.b_accepted, match.a_accepted)

    def rel(uid: int | None) -> str | None:
        return None if uid is None else "you" if uid == me.id else "opponent"

    s = score(match)
    return {
        "id": match.id,
        "game": match.game,
        "mode": match.mode,
        "bestOf": match.best_of,
        "platform": match.platform,
        "region": match.region,
        "status": match.status,
        "acceptDeadline": iso(match.accept_deadline),
        "createdAt": iso(match.created_at),
        "finishedAt": iso(match.finished_at),
        "host": rel(match.player_a_id),
        "you": _player_dict(match, me, my_ok),
        "opponent": _player_dict(match, opp, opp_ok),
        "winsNeeded": wins_needed(match),
        "score": {"you": s[me.id], "opponent": s[opp.id]},
        "games": [
            {"n": g.game_no, "winner": rel(g.winner_id), "reportedBy": rel(g.reported_by_id), "details": g.details}
            for g in match.games
        ],
        "winner": rel(match.winner_id),
        "reportedBy": rel(match.reported_by_id),
        "endedBy": rel(match.ended_by_id),
        "messages": [
            {"id": m.id, "from": "system" if m.user_id is None else rel(m.user_id), "text": m.text, "at": iso(m.created_at)}
            for m in match.messages
        ],
    }
