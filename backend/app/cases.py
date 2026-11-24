"""
Cases for the Admins (see GLOSSARY.md: Disputed match, Help request, Claim, Ruling, Void): the case
list and case pages, Claims, Rulings, closing Help requests, and Voiding open matches.

A case is a Disputed match or a Help request. Both are Claimed, released and taken over by the same
functions, which take either one.

Follows matchmaking.py's conventions: functions work on the current db.session and leave
committing to the caller, they take a match already locked (act() does this for routes), and they
raise MatchmakingError. Every Claim, release, takeover and Ruling writes an Admin log entry in the
same transaction.
"""

from collections import Counter
from collections.abc import Callable

from sqlalchemy import or_, select

from . import admin_log, clock, help_requests, screenshots, settlement
from . import admin
from .admin import is_master, require_reason
from . import matchmaking as mm
from .extensions import db
from .errors import MatchmakingError
from .models import HelpRequest, Match, User


def _name(user: User | None) -> str | None:
    return None if user is None else user.display_name or user.username


def _ref(user: User | None) -> dict | None:
    return None if user is None else {"id": user.id, "displayName": _name(user)}


def open_disputes(claimed: bool | None = None) -> list[Match]:
    """Disputed matches still waiting for a Ruling, oldest dispute first. claimed filters by Claim."""
    q = select(Match).where(Match.status == "disputed").order_by(Match.disputed_at, Match.id)
    if claimed is not None:
        q = q.where(Match.claimed_by_id.is_not(None) if claimed else Match.claimed_by_id.is_(None))
    return list(db.session.scalars(q))


# ---------------------------------------------------------------- Claims


Case = Match | HelpRequest  # what an Admin can Claim


def _match_of(case: Case) -> Match:
    return case.match if isinstance(case, HelpRequest) else case


def _record(case: Case, action: str, reason: str, actor: User, target_id: int | None = None, **details) -> None:
    """The Admin log entry for an action on a case. A Help request's entries carry its ID."""
    if isinstance(case, HelpRequest):
        details = {"helpRequestId": case.id, **details}
    admin_log.record(action, reason, actor=actor, match_id=_match_of(case).id, target_id=target_id, details=details)


def _require_open(case: Case) -> None:
    if isinstance(case, HelpRequest):
        if case.closed_at is not None:
            raise MatchmakingError("already_closed", "this Help request is already closed")
        return
    match = case
    if match.ruling is not None:
        raise MatchmakingError("already_ruled", "this case already has a Ruling")
    if match.status != "disputed":
        raise MatchmakingError("not_open", f"match is {match.status}")


_played_in = help_requests.played_in


def _forbid_own_match(case: Case, user: User) -> None:
    """No Admin acts on their own match. The Master can, so their cases never wait on an Admin."""
    if _played_in(_match_of(case), user) and not is_master(user):
        raise MatchmakingError("own_match", "you played in this match", 403)


def _holds_claim(case: Case, user: User) -> bool:
    return case.claimed_by_id == user.id


def can_act(case: Case, user: User) -> bool:
    """Whether the case page should offer this viewer the Ruling (or closing) controls."""
    if isinstance(case, HelpRequest):
        if case.closed_at is not None:
            return False
    elif case.status != "disputed":
        return False
    return is_master(user) or (_holds_claim(case, user) and not _played_in(_match_of(case), user))


def _set_claim(case: Case, user: User | None) -> None:
    case.claimed_by_id = user.id if user else None
    case.claimed_at = clock.now() if user else None


def claim(case: Case, user: User) -> None:
    """An Admin takes sole charge of a case. Claiming your own Claim again changes nothing."""
    _require_open(case)
    _forbid_own_match(case, user)
    if _holds_claim(case, user):
        return
    if case.claimed_by_id is not None:
        raise MatchmakingError("already_claimed", "another Admin is handling this case")
    _set_claim(case, user)
    _record(case, "claim", "Claimed the case.", user)


def release(case: Case, user: User) -> None:
    """The claiming Admin, or the Master, lets go of a Claim so someone else can take the case."""
    _require_open(case)
    if case.claimed_by_id is None or not (_holds_claim(case, user) or is_master(user)):
        raise MatchmakingError("not_claimed_by_you", "you don't hold the Claim on this case", 403)
    holder = case.claimed_by_id
    _set_claim(case, None)
    _record(case, "release_claim", "Released the Claim.", user, holder)


def release_all(user: User, actor: User, why: str) -> None:
    """An Admin leaving the role lets go of every open Claim, so their cases don't get stuck.
    Called by app.admin when an Admin is removed or steps down."""
    held: list[Case] = list(
        db.session.scalars(
            select(Match).where(Match.claimed_by_id == user.id, Match.status == "disputed").with_for_update()
        )
    )
    held += db.session.scalars(
        select(HelpRequest).where(HelpRequest.claimed_by_id == user.id, HelpRequest.closed_at.is_(None)).with_for_update()
    )
    for case in held:
        _set_claim(case, None)
        _record(case, "release_claim", why, actor, user.id, automatic=True)


def take_over(case: Case, master: User) -> None:
    """The Master takes over a case, whoever holds it, so nothing waits on an absent Admin."""
    _require_open(case)
    if _holds_claim(case, master):
        return
    holder = case.claimed_by_id
    _set_claim(case, master)
    _record(case, "take_over_claim", "Took over the case.", master, holder)


# ---------------------------------------------------------------- Rulings

OUTCOMES = ("uphold", "overturn", "replay", "void")


def _is_int(v: object) -> bool:
    return isinstance(v, int) and not isinstance(v, bool)


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


def rule(
    match: Match, user: User, outcome: object, reason: object, games: object = None, from_game: object = None
) -> None:
    """Give the Ruling on a Disputed match. The first Ruling saved wins: the match row is locked,
    and once it has a Ruling every later attempt gets already_ruled."""
    _require_open(match)
    _forbid_own_match(match, user)
    if not (_holds_claim(match, user) or is_master(user)):
        raise MatchmakingError("not_claimed_by_you", "Claim the case before giving a Ruling", 403)
    if outcome not in OUTCOMES:
        raise MatchmakingError("validation", "invalid Ruling", 400, {"outcome": f"must be one of {list(OUTCOMES)}"})
    reason = require_reason(reason)

    details = {}
    if outcome == "uphold":
        # Settles just as a confirm does, so the ranked win and unlocks are credited the same way.
        settlement.complete(match, "Ruling: the reported result stands.")
    elif outcome == "overturn":
        details["corrections"] = _overturn(match, games)
    elif outcome == "replay":
        details["fromGame"] = _replay_from(match, from_game)
        mm.replay(match, details["fromGame"])
        details["deadline"] = clock.iso(match.replay_deadline)
    else:
        settlement.void(match, "Ruling: the match is void. It counts for no one.")
    match.ruling = outcome
    match.ruling_reason = reason
    match.ruled_by_id = user.id
    match.ruled_at = clock.now()
    claimed_by = match.claimed_by_id  # not the ruler when the Master rules on an Admin's Claim
    _set_claim(match, None)
    admin_log.record(
        "ruling",
        reason,
        actor=user,
        match_id=match.id,
        details={"outcome": outcome, "winnerId": match.winner_id, "claimedById": claimed_by, **details},
    )


# ---------------------------------------------------------------- Voiding open matches


def void_open(match: Match, user: User, reason: object) -> None:
    """An Admin Voids a match that is still open (pending, active or reported), for example one a
    player vanished from. Both players are free to queue again and nothing counts against anyone.
    Not a Ruling: a Disputed match is Voided by a Void Ruling, so it gets not_open here."""
    if match.status not in mm.OPEN_STATUSES:
        raise MatchmakingError("not_open", f"match is {match.status}")
    _forbid_own_match(match, user)
    reason = require_reason(reason)
    previous = match.status
    settlement.void(match, "An Admin voided this match. It counts for no one.")
    admin_log.record("void_match", reason, actor=user, match_id=match.id, details={"from": previous})


# ---------------------------------------------------------------- Help requests


def close_help_request(help_request: HelpRequest, user: User, reason: object) -> None:
    """Close a Help request with a reason, which can pass it to the Master as a note. Like a Ruling, it
    needs the Claim (or the Master) and is refused for the Admin's own match. The reason goes in the
    Admin log and is not shown to the player."""
    _require_open(help_request)
    _forbid_own_match(help_request, user)
    if not (_holds_claim(help_request, user) or is_master(user)):
        raise MatchmakingError("not_claimed_by_you", "Claim the request before closing it", 403)
    reason = require_reason(reason)
    claimed_by = help_request.claimed_by_id  # not the closer when the Master closes an Admin's Claim
    help_request.closed_by_id = user.id
    help_request.closed_at = clock.now()
    help_request.close_reason = reason
    _set_claim(help_request, None)
    _record(help_request, "close_help_request", reason, user, claimedById=claimed_by)


def open_help_requests(claimed: bool | None = None) -> list[HelpRequest]:
    """Help requests no Admin has closed, oldest first. claimed filters by Claim."""
    q = select(HelpRequest).where(HelpRequest.closed_at.is_(None)).order_by(HelpRequest.created_at, HelpRequest.id)
    if claimed is not None:
        q = q.where(HelpRequest.claimed_by_id.is_not(None) if claimed else HelpRequest.claimed_by_id.is_(None))
    return list(db.session.scalars(q))


def _claim_dict(case: Case, viewer: User) -> dict | None:
    if case.claimed_by_id is None:
        return None
    return {
        "by": _ref(db.session.get(User, case.claimed_by_id)),
        "at": clock.iso(case.claimed_at),
        "byYou": case.claimed_by_id == viewer.id,
    }


def help_summary_dict(help_request: HelpRequest, viewer: User) -> dict:
    """One Help request row of the case list."""
    match = help_request.match
    return {
        "kind": "help",
        "helpRequestId": help_request.id,
        "matchId": match.id,
        "game": match.game,
        "platform": match.platform,
        "players": [_name(match.player_a), _name(match.player_b)],
        "message": help_request.message,
        "askedBy": _ref(help_request.user),
        "askedAt": clock.iso(help_request.created_at),
        "claim": _claim_dict(help_request, viewer),
    }


def help_case_dict(help_request: HelpRequest, viewer: User) -> dict:
    """The Help request page: the request and enough of the match to act on it."""
    match = help_request.match
    s = settlement.score(match)
    can_void = match.status in mm.OPEN_STATUSES and (is_master(viewer) or not _played_in(match, viewer))
    return {
        **help_summary_dict(help_request, viewer),
        "match": {
            "id": match.id,
            "status": match.status,
            "players": [_player_dict(match, p) for p in (match.player_a, match.player_b)],
            "score": [s[match.player_a_id], s[match.player_b_id]],
            "winsNeeded": settlement.wins_needed(match),
            "winner": match.winner_id,
            "games": [{"n": g.game_no, "winner": g.winner_id, "reportedBy": g.reported_by_id} for g in match.games],
            "messages": [
                {"id": m.id, "from": m.user_id, "text": m.text, "at": clock.iso(m.created_at)} for m in match.messages
            ],
            "createdAt": clock.iso(match.created_at),
            "finishedAt": clock.iso(match.finished_at),
            "canVoid": can_void,
        },
        "closed": None
        if help_request.closed_at is None
        else {
            "by": _ref(db.session.get(User, help_request.closed_by_id)),
            "at": clock.iso(help_request.closed_at),
            "reason": help_request.close_reason,
        },
        "playedIn": _played_in(match, viewer),
        "canAct": can_act(help_request, viewer),
    }


def case_list(viewer: User, claimed: bool | None = None) -> list[dict]:
    """The Admins' case list: Disputed matches waiting for a Ruling and Help requests nobody has
    closed, oldest first."""
    rows = [(m.disputed_at, summary_dict(m, viewer)) for m in open_disputes(claimed)]
    rows += [(h.created_at, help_summary_dict(h, viewer)) for h in open_help_requests(claimed)]
    # Disputes from before filing times were kept have no time, so they come first, as the oldest.
    rows.sort(key=lambda r: (r[0] is not None, r[0] or clock.now()))
    return [row for _, row in rows]


def summary_dict(match: Match, viewer: User) -> dict:
    """One row of the case list."""
    return {
        "kind": "dispute",
        "matchId": match.id,
        "game": match.game,
        "platform": match.platform,
        "players": [_name(match.player_a), _name(match.player_b)],
        "disputedAt": clock.iso(match.disputed_at),
        # Back from a Replay whose players didn't settle it by the deadline.
        "replayNotFinished": match.replay_not_finished,
        "claim": _claim_dict(match, viewer),
    }


def _was_disputed():
    """Matches that were ever disputed: open ones (including those filed before the dispute form,
    which have no reason), and ruled ones."""
    return or_(Match.status == "disputed", Match.dispute_reason.is_not(None), Match.ruling.is_not(None))


def dispute_record(user: User) -> dict:
    """Disputes this player filed and how each was ruled, newest first, so an Admin can spot
    someone who disputes every loss."""
    current = db.session.scalars(select(Match).where(Match.ended_by_id == user.id, _was_disputed()))
    disputes = [{"matchId": m.id, "game": m.game, "at": clock.iso(m.disputed_at), "outcome": m.ruling} for m in current]
    # Disputes from before a Replay, whose games were disputed again (maybe by the other player).
    replayed = db.session.scalars(
        select(Match).where(
            Match.earlier_disputes.is_not(None), or_(Match.player_a_id == user.id, Match.player_b_id == user.id)
        )
    )
    disputes += [
        {"matchId": m.id, "game": m.game, "at": d["at"], "outcome": d["ruling"] and d["ruling"]["outcome"]}
        for m in replayed
        for d in m.earlier_disputes
        if d["by"] == user.id
    ]
    # Newest filing first: a Replay can bring a new dispute on an older match. Disputes filed before
    # filing times were kept have no time, so they sort last, by match.
    disputes.sort(key=lambda d: (d["at"] or "", d["matchId"]), reverse=True)
    return {
        "filed": len(disputes),
        "outcomes": dict(Counter(d["outcome"] or "pending" for d in disputes)),
        "disputes": disputes,
    }


def _player_dict(match: Match, player: User) -> dict:
    return {
        "id": player.id,
        "displayName": _name(player),
        "avatarUrl": player.avatar_url,
        "region": player.region,
        "gameId": player.game_ids.get(match.game),
    }


def case_dict(match: Match, viewer: User) -> dict:
    """The case page: everything an Admin needs in one place. Unlike the players' view, it names
    players by ID and shows who gave the Ruling."""
    s = settlement.score(match)
    players = (match.player_a, match.player_b)
    return {
        **summary_dict(match, viewer),
        "status": match.status,
        "players": [_player_dict(match, p) for p in players],
        "score": [s[match.player_a_id], s[match.player_b_id]],
        "winsNeeded": settlement.wins_needed(match),
        "reportedBy": match.reported_by_id,
        "winner": match.winner_id,
        "games": [
            {"n": g.game_no, "winner": g.winner_id, "reportedBy": g.reported_by_id, "details": g.details}
            for g in match.games
        ],
        "dispute": {
            "games": match.dispute_games or [],
            "reason": match.dispute_reason,  # None: filed before the dispute form
            "by": match.ended_by_id,
            "statements": {
                str(st.user_id): {"text": st.text, "updatedAt": clock.iso(st.updated_at)} for st in match.statements
            },
            # Every screenshot from every dispute on this match, each marked with its round. This
            # dispute's is `round`; a Replay that was disputed again leaves the earlier ones behind.
            "round": match.dispute_round,
            "screenshots": screenshots.for_admins(match),
        },
        "messages": [{"id": m.id, "from": m.user_id, "text": m.text, "at": clock.iso(m.created_at)} for m in match.messages],
        "earlierDisputes": [
            {**d, "ruling": d["ruling"] and {**d["ruling"], "by": _ref(db.session.get(User, d["ruling"]["byId"]))}}
            for d in match.earlier_disputes or []
        ],
        "records": {str(p.id): dispute_record(p) for p in players},
        "ruling": None
        if match.ruling is None
        else {**mm.ruling_dict(match), "by": _ref(db.session.get(User, match.ruled_by_id))},
        "replayFrom": replay_choices(match),
        "playedIn": _played_in(match, viewer),
        "canAct": can_act(match, viewer),
    }


def act(match_id: int, user: User, action: Callable[[Match, User], None]) -> Match:
    """Run a case action (claim, release, take_over, a Ruling) for an Admin or the Master.

    Locks the acting user's row, checks their role again, then locks the match. Removing an Admin
    takes the same locks in the same order (their user row, then their Claimed matches), so an
    action at the same moment as a removal either finishes first (and its Claim is released) or
    sees the role gone. Neither can deadlock the other."""
    _lock_admin(user)
    match = find_case(match_id, lock=True)
    action(match, user)
    return match


def _lock_admin(user: User) -> None:
    db.session.get(User, user.id, with_for_update=True, populate_existing=True)
    if admin.role(user) == "player":
        raise MatchmakingError("forbidden", "you don't have access to this", 403)


def act_on_match(match_id: int, user: User, action: Callable[[Match, User], None]) -> Match:
    """Like act(), for an action on any match, not only one that was disputed (Voiding an open match)."""
    _lock_admin(user)
    match = mm.lock_match(match_id)
    if match is None:
        raise MatchmakingError("not_found", "match not found", 404)
    action(match, user)
    return match


def act_on_help_request(help_request_id: int, user: User, action: Callable[[HelpRequest, User], None]) -> HelpRequest:
    """Like act(), for a Help request: lock the Admin's row, check their role again, then lock the
    request (the same order act() takes, so removing an Admin can't deadlock against a Claim)."""
    _lock_admin(user)
    help_request = find_help_request(help_request_id, lock=True)
    action(help_request, user)
    return help_request


def find_help_request(help_request_id: int, lock: bool = False) -> HelpRequest:
    """A Help request, open or closed. lock=True locks its row, as every action that changes it needs."""
    help_request = db.session.get(
        HelpRequest, help_request_id, with_for_update=lock or None, populate_existing=lock or None
    )
    if help_request is None:
        raise MatchmakingError("not_found", "help request not found", 404)
    return help_request


def find_case(match_id: int, lock: bool = False) -> Match:
    """The case for a match that was ever disputed (open or already ruled). lock=True locks the
    match row, as every action that changes a case needs (see matchmaking.lock_match)."""
    q = select(Match).where(Match.id == match_id, _was_disputed())
    if lock:
        q = q.with_for_update().execution_options(populate_existing=True)
    match = db.session.scalar(q)
    if match is None:
        raise MatchmakingError("not_found", "case not found", 404)
    return match
