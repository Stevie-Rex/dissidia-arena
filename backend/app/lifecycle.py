"""
The match lifecycle: every change to a match's status, from its pairing to its end.

  pending  -> active (both accepted) | cancelled (declined, or the accept window passed)
  active   -> reported (a player reached the winning score) | abandoned (a player left)
  reported -> completed (confirmed, by the opponent or at the deadline) | disputed
  disputed -> completed (Uphold, Overturn) | active (Replay) | voided (Void)
  a Replay that isn't finished (its deadline passed, or a player left) -> disputed again
  open     -> voided (an Admin frees the players)

advance() applies whichever deadline has passed. settlement.py is the step that completes or voids a
match and applies its ranked effects. Who may rule on or void a match, Claims and the Admin log of
Admin actions stay in app.cases; the system's own actions are logged here.

Like matchmaking.py, it works on the current db.session and leaves committing to the caller, it
takes the match already locked (matchmaking.lock_match), and it raises MatchmakingError. An action
the match's status doesn't allow is refused with bad_status.
"""

from datetime import timedelta
from typing import Literal

from sqlalchemy import or_, select

from . import admin_log, clock, settlement
from .errors import MatchmakingError
from .extensions import db
from .match_room import post_system
from .models import Match, MatchGame, QueueEntry, User
from .models.match import OPEN, SETTLED  # noqa: F401  (the status sets: beside the model so settlement and rewards can read them)
from .settlement import require_status

# Long enough to notice a Discord DM, not so long a no-show stalls the queue.
ACCEPT_SECONDS = 60
# How long the opponent has to confirm or dispute a reported result before it confirms itself,
# so a no-show can't hold the winner's ranked win (or both players' queue) hostage.
CONFIRM_HOURS = 2
CONFIRM_SECONDS = CONFIRM_HOURS * 60 * 60
# How long players have to finish a match an Admin ruled must be replayed, before it goes back
# to the Admins as Disputed ("Replay not finished").
REPLAY_HOURS = 48
REPLAY_SECONDS = REPLAY_HOURS * 60 * 60
# Dispute reasons and players' statements.
MAX_STATEMENT_LEN = 2000
# The Rulings an Admin can give.
OUTCOMES = ("uphold", "overturn", "replay", "void")


# ---------------------------------------------------------------- the players


def side(match: Match, user: User) -> str:
    """"a" or "b". Refuses (not_found) someone who isn't playing."""
    if user.id == match.player_a_id:
        return "a"
    if user.id == match.player_b_id:
        return "b"
    raise MatchmakingError("not_found", "match not found", 404)


def opponent(match: Match, user: User) -> User:
    return match.player_b if side(match, user) == "a" else match.player_a


def reporter(match: Match) -> User:
    """The player whose report ended the series (only set once a match is reported)."""
    return match.player_a if match.reported_by_id == match.player_a_id else match.player_b


def non_reporter(match: Match) -> User:
    """The player who confirms or disputes the reported result."""
    return match.player_b if match.reported_by_id == match.player_a_id else match.player_a


# ---------------------------------------------------------------- deadlines


Deadline = Literal["expired", "autoConfirmed", "replayExpired"]


def advance(match: Match) -> Deadline | None:
    """Apply whichever deadline has passed, and say which: the accept window ("expired"), then the
    confirm deadline ("autoConfirmed"), then the Replay deadline ("replayExpired"). A result whose
    confirm and Replay deadlines have both passed therefore settles. None if nothing was due."""
    if _expire_accept(match):
        return "expired"
    if _auto_confirm(match):
        return "autoConfirmed"
    if _expire_replay(match):
        return "replayExpired"
    return None


def _expire_accept(match: Match) -> bool:
    """Accept window over: cancel, and put anyone who did accept back in the queue."""
    if match.status != "pending" or clock.now() < match.accept_deadline:
        return False
    no_shows = [p for p, ok in ((match.player_a, match.a_accepted), (match.player_b, match.b_accepted)) if not ok]
    _cancel(match, ended_by=no_shows[0] if len(no_shows) == 1 else None)
    for player, accepted in ((match.player_a, match.a_accepted), (match.player_b, match.b_accepted)):
        if accepted:
            _requeue(match, player)
    return True


def _auto_confirm(match: Match) -> bool:
    """The opponent neither confirmed nor disputed in time: the reported result stands."""
    if match.status != "reported" or match.confirm_deadline is None or clock.now() < match.confirm_deadline:
        return False
    settlement.complete(match, f"Result confirmed automatically after {CONFIRM_HOURS} hours.")
    s = settlement.score(match)
    admin_log.record(
        "auto_confirm",
        f"The opponent didn't confirm or dispute the reported result within {CONFIRM_HOURS} hours.",
        match_id=match.id,
        target_id=non_reporter(match).id,
        details={
            "winnerId": match.winner_id,
            "reportedById": match.reported_by_id,
            "score": f"{s[match.winner_id]}-{sum(s.values()) - s[match.winner_id]}",
        },
    )
    return True


def _expire_replay(match: Match) -> bool:
    """The Replay deadline passed before the match settled: back to the Admins as Disputed, marked
    "Replay not finished", and both players are free to queue. A reported result the opponent
    hadn't confirmed yet is dropped: the game whose report ended the series is wiped."""
    if match.status not in OPEN or match.replay_deadline is None or clock.now() < match.replay_deadline:
        return False
    dropped = None
    if match.status == "reported":
        last = match.games[-1]
        dropped = {"n": last.game_no, "winnerId": last.winner_id, "reportedById": last.reported_by_id}
        match.games.remove(last)
        match.winner_id = match.reported_by_id = match.confirm_deadline = None
    note = " The reported result was dropped, as it wasn't confirmed in time." if dropped else ""
    _replay_not_finished(
        match,
        f"The Replay wasn't finished within {REPLAY_HOURS} hours.{note}",
        f"The match wasn't settled within {REPLAY_HOURS} hours of the Replay Ruling.",
        droppedReport=dropped,
    )
    return True


# ---------------------------------------------------------------- the players' actions


def propose(**settings) -> Match:
    """A newly paired match: pending until both players accept it. The caller adds it to the session."""
    t = clock.now()
    return Match(status="pending", created_at=t, accept_deadline=t + timedelta(seconds=ACCEPT_SECONDS), **settings)


def accept(match: Match, user: User) -> None:
    mine = side(match, user)
    _expire_accept(match)
    require_status(match, "pending")
    setattr(match, f"{mine}_accepted", True)
    if match.a_accepted and match.b_accepted:
        match.status = "active"
        post_system(match, f"Match started. {match.player_a.display_name or match.player_a.username} hosts.")


def decline(match: Match, user: User) -> None:
    side(match, user)
    _expire_accept(match)
    require_status(match, "pending")
    _cancel(match, ended_by=user)
    _requeue(match, opponent(match, user))


def report_game(match: Match, user: User, game_no: int, winner_id: int, details: dict | None = None) -> None:
    side(match, user)
    require_status(match, "active")
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
    post_system(match, f"Game {game_no}: {winner.display_name or winner.username} wins (reported by {user.display_name or user.username}).")

    if (series_winner := settlement.series_winner(match)) is not None:
        match.status = "reported"
        match.winner_id = series_winner.id
        match.reported_by_id = user.id
        match.confirm_deadline = clock.now() + timedelta(seconds=CONFIRM_SECONDS)


def confirm(match: Match, user: User) -> settlement.Settled:
    """The opponent accepts the reported result, which settles the match."""
    side(match, user)
    require_status(match, "reported")
    if user.id == match.reported_by_id:
        raise MatchmakingError("not_your_turn", "your opponent needs to confirm the result", 403)
    return settlement.complete(match, "Result confirmed.")


def dispute(match: Match, user: User, games: object = None, reason: object = None) -> None:
    """The non-reporting player rejects the result: which games they dispute, and why."""
    side(match, user)
    require_status(match, "reported")
    if user.id == match.reported_by_id:
        raise MatchmakingError("not_your_turn", "only the other player can dispute", 403)
    reported = {g.game_no for g in match.games}
    errors = {}
    if (
        not isinstance(games, list)
        or not games
        or not all(_is_int(n) and n in reported for n in games)
    ):
        errors["games"] = f"pick one or more of the reported games {sorted(reported)}"
    reason = reason.strip() if isinstance(reason, str) else ""
    if not reason or len(reason) > MAX_STATEMENT_LEN:
        errors["reason"] = f"must be 1-{MAX_STATEMENT_LEN} characters"
    if errors:
        raise MatchmakingError("validation", "say which games you dispute and why", 400, errors)
    if match.disputed_at is not None:  # the replayed games: the earlier dispute goes to the record
        _archive_dispute(match)
    match.dispute_games = sorted(set(games))
    match.dispute_reason = reason
    match.ended_by_id = user.id
    _back_to_the_admins(match)
    post_system(match, "Result disputed. An Admin will review it.")


def leave(match: Match, user: User) -> None:
    """Pending: same as declining. Active: abandon (counts against you later). Leaving a Replay
    sends it back to the Admins, as if its deadline had passed, so they rule on it."""
    side(match, user)
    if match.status == "pending":
        decline(match, user)
        return
    require_status(match, "active")
    if match.replay_deadline is not None:
        name = user.display_name or user.username
        _replay_not_finished(match, f"{name} left the Replay.", f"{name} left the match during the Replay.", left_by=user)
        return
    match.status = "abandoned"
    match.ended_by_id = user.id
    match.finished_at = clock.now()
    post_system(match, f"{user.display_name or user.username} left the match.")


# ---------------------------------------------------------------- Rulings


def require_outcome(outcome: object) -> None:
    if outcome not in OUTCOMES:
        raise MatchmakingError("validation", "invalid Ruling", 400, {"outcome": f"must be one of {list(OUTCOMES)}"})


def rule(
    match: Match, ruler: User, outcome: object, reason: str, games: object = None, from_game: object = None
) -> dict:
    """Apply a Ruling to a Disputed match and write it on the match. games are an Overturn's
    corrections, from_game where a Replay starts. Returns what the Ruling did, for the Admin log:
    an Overturn's corrections, or a Replay's first game and deadline.

    The caller checks that this Admin may rule, and the reason (see cases.rule)."""
    require_status(match, "disputed")
    require_outcome(outcome)
    done = {}
    if outcome == "uphold":
        # Settles just as a confirm does, so the ranked win and unlocks are credited the same way.
        settlement.complete(match, "Ruling: the reported result stands.")
    elif outcome == "overturn":
        done["corrections"] = _overturn(match, games)
    elif outcome == "replay":
        done["fromGame"] = _replay_from(match, from_game)
        _replay(match, done["fromGame"])
        done["deadline"] = clock.iso(match.replay_deadline)
    else:
        settlement.void(match, "Ruling: the match is void. It counts for no one.")
    match.ruling = outcome
    match.ruling_reason = reason
    match.ruled_by_id = ruler.id
    match.ruled_at = clock.now()
    return done


def ruling_dict(match: Match) -> dict | None:
    """The Ruling as players see it: the outcome and reason, never which Admin gave it."""
    if match.ruling is None:
        return None
    return {"outcome": match.ruling, "reason": match.ruling_reason, "at": clock.iso(match.ruled_at)}


def _corrections(match: Match, games: object) -> dict[int, int]:
    """The Overturn's corrected games, as {game number: winner id}. Any reported game can be
    corrected, once, to either player."""
    reported = {g.game_no for g in match.games}
    players = (match.player_a_id, match.player_b_id)
    if (
        isinstance(games, list)
        and games
        and all(
            isinstance(g, dict) and _is_int(g.get("n")) and g["n"] in reported and _is_int(g.get("winner")) and g["winner"] in players
            for g in games
        )
        and len({g["n"] for g in games}) == len(games)
    ):
        return {g["n"]: g["winner"] for g in games}
    raise MatchmakingError(
        "validation",
        "correct the winner of one or more reported games",
        400,
        {"games": f"give each corrected game once, from {sorted(reported)}, won by one of the players"},
    )


def _overturn(match: Match, games: object) -> list[dict]:
    """Save the corrected games and settle the match with the winner they give. Returns the
    corrections that changed a game, for the Admin log.

    Refuses, changing nothing, when the corrections leave nobody on the winning score
    (no_series_winner: that's a Replay) or leave the reported winner (that's an Uphold)."""
    corrected = _corrections(match, games)
    winner = settlement.series_winner(match, corrected)
    if winner is None:
        raise MatchmakingError("no_series_winner", "nobody wins with these corrections: choose Replay")
    if winner is settlement.series_winner(match):
        raise MatchmakingError(
            "validation", "the reported winner still wins: choose Uphold", 400, {"games": "these corrections don't change the winner"}
        )
    changes = []
    for g in match.games:
        if corrected.get(g.game_no, g.winner_id) != g.winner_id:
            changes.append({"n": g.game_no, "from": g.winner_id, "to": corrected[g.game_no]})
            g.winner_id = corrected[g.game_no]
    settlement.complete(match, "Ruling: the result is overturned.")
    return changes


def replay_choices(match: Match) -> dict:
    """The games a Replay can start from, and the default: the first disputed game still played.

    Any reported game can be replayed. While nobody has won the series (a Replay that wasn't
    finished), so can the next unplayed game, which keeps every played game standing."""
    games = sorted(g.game_no for g in match.games)
    if settlement.series_winner(match) is None:
        games.append(len(games) + 1)
    disputed = [n for n in sorted(match.dispute_games or []) if n in games]
    return {"games": games, "default": disputed[0] if disputed else games[0]}


def _replay_from(match: Match, from_game: object) -> int:
    choices = replay_choices(match)
    if from_game is None:
        return choices["default"]
    if not _is_int(from_game) or from_game not in choices["games"]:
        raise MatchmakingError(
            "validation", "pick the game to replay from", 400, {"fromGame": f"must be one of {choices['games']}"}
        )
    return from_game


def _replay(match: Match, from_game: int) -> None:
    """A Replay Ruling: games before from_game stand, that game and the ones after are wiped, and
    the same match goes back to active (same room, chat kept) until the Replay deadline."""
    players = (match.player_a_id, match.player_b_id)
    # Lock their queue rows first, so pairing (which locks them too) can't match either player
    # while this runs; a pairing that got there first shows up in the check below.
    queued = list(db.session.scalars(select(QueueEntry).where(QueueEntry.user_id.in_(players)).with_for_update()))
    busy = db.session.scalar(
        select(Match).where(
            Match.id != match.id,
            Match.status.in_(OPEN),
            or_(Match.player_a_id.in_(players), Match.player_b_id.in_(players)),
        )
    )
    if busy is not None:
        who = busy.player_a if busy.player_a_id in players else busy.player_b
        raise MatchmakingError(
            "player_busy", f"{who.display_name or who.username} is in another match. Rule once it's over.", 409
        )
    for entry in queued:
        db.session.delete(entry)
    match.games[:] = [g for g in match.games if g.game_no < from_game]
    match.status = "active"
    match.winner_id = match.reported_by_id = match.confirm_deadline = match.finished_at = None
    match.replay_deadline = clock.now() + timedelta(seconds=REPLAY_SECONDS)
    match.replay_unfinished = False
    post_system(match, f"Ruling: replay from game {from_game}. Finish the match within {REPLAY_HOURS} hours.")


# ---------------------------------------------------------------- Voiding an open match


def void_open(match: Match) -> None:
    """Void a match that is still open, outside a Ruling: it counts for no one and both players are
    free to queue again. A Disputed match is Voided by a Void Ruling instead. The caller checks that
    this Admin may, and logs it (see cases.void_open)."""
    require_status(match, *OPEN)
    settlement.void(match, "An Admin voided this match. It counts for no one.")


# ---------------------------------------------------------------- shared steps


def _is_int(v: object) -> bool:
    return isinstance(v, int) and not isinstance(v, bool)


def _clean_details(details: dict | None) -> dict:
    if not isinstance(details, dict):
        return {}
    return {k: v[:64] for k, v in details.items() if k in ("character", "helper", "stage") and isinstance(v, str)}


def _cancel(match: Match, ended_by: User | None) -> None:
    match.status = "cancelled"
    match.ended_by_id = ended_by.id if ended_by else None
    match.finished_at = clock.now()


def _requeue(match: Match, player: User) -> None:
    db.session.add(
        QueueEntry(
            user_id=player.id,
            game=match.game,
            mode=match.mode,
            best_of=match.best_of,
            platform=match.platform,
            region=match.region,
            joined_at=clock.now(),
        )
    )


def _archive_dispute(match: Match) -> None:
    """Move the current dispute, its statements and its Replay Ruling to earlier_disputes, so a
    new dispute starts afresh: players write new statements and only Admins see the old ones."""
    ruling = None
    if match.ruling is not None:
        ruling = {**ruling_dict(match), "byId": match.ruled_by_id}
    earlier = {
        "games": match.dispute_games or [],
        "reason": match.dispute_reason,
        "by": match.ended_by_id,
        "at": clock.iso(match.disputed_at),
        "statements": {
            str(st.user_id): {"text": st.text, "updatedAt": clock.iso(st.updated_at)} for st in match.statements
        },
        "ruling": ruling,
    }
    match.earlier_disputes = [*(match.earlier_disputes or []), earlier]  # reassign: JSON doesn't track mutation
    match.statements.clear()


def _back_to_the_admins(match: Match, replay_unfinished: bool = False) -> None:
    """The match is Disputed, waiting for a Ruling. A match that was being replayed starts a new
    case: the Replay Ruling is cleared from the match (it stays in the Admin log)."""
    match.status = "disputed"
    match.finished_at = match.disputed_at = clock.now()
    match.replay_unfinished = replay_unfinished
    match.ruling = match.ruling_reason = match.ruled_by_id = match.ruled_at = None
    # A new case, so the bot tells everyone again even if it never saw the Replay in between.
    match.notified_status = None


def _replay_not_finished(match: Match, chat: str, reason: str, left_by: User | None = None, **details) -> None:
    """A Replay ended without settling (its deadline passed, or a player left): back to the Admins
    as Disputed, marked "Replay not finished", with a system entry in the Admin log."""
    _back_to_the_admins(match, replay_unfinished=True)
    post_system(match, f"{chat} An Admin will rule again.")
    admin_log.record(
        "replay_not_finished",
        reason,
        match_id=match.id,
        target_id=left_by.id if left_by else None,
        details={"deadline": clock.iso(match.replay_deadline), "gamesPlayed": len(match.games), **details},
    )
