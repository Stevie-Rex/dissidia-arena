"""
Cases for the Admins (see GLOSSARY.md: Disputed match, Claim, Ruling, Void): the case list and
case page, Claims, and Rulings.

Follows matchmaking.py's conventions: functions work on the current db.session and leave
committing to the caller, they take a match already locked (matchmaking.lock_match), and they
raise MatchmakingError. Every Claim, release, takeover and Ruling writes an Admin log entry in the
same transaction.
"""

from collections import Counter

from sqlalchemy import or_, select

from . import admin_log
from .admin import is_master, require_reason
from .extensions import db
from . import matchmaking as mm
from .matchmaking import MatchmakingError, iso, now, score
from .models import Match, User


def _name(user: User | None) -> str | None:
    return None if user is None else user.display_name or user.username


def _ref(user: User | None) -> dict | None:
    return None if user is None else {"id": user.id, "displayName": _name(user)}


def open_disputes(claimed: bool | None = None) -> list[Match]:
    """Disputed matches still waiting for a Ruling, oldest dispute first. claimed filters by Claim."""
    q = select(Match).where(Match.status == "disputed").order_by(Match.finished_at, Match.id)
    if claimed is not None:
        q = q.where(Match.claimed_by_id.is_not(None) if claimed else Match.claimed_by_id.is_(None))
    return list(db.session.scalars(q))


# ---------------------------------------------------------------- Claims


def _require_open(match: Match) -> None:
    if match.ruling is not None:
        raise MatchmakingError("already_ruled", "this case already has a Ruling")
    if match.status != "disputed":
        raise MatchmakingError("not_open", f"match is {match.status}")


def _played_in(match: Match, user: User) -> bool:
    return user.id in (match.player_a_id, match.player_b_id)


def _forbid_own_match(match: Match, user: User) -> None:
    """No Admin rules in their own favour. The Master can, so their disputes never wait on an Admin."""
    if _played_in(match, user) and not is_master(user):
        raise MatchmakingError("own_match", "you played in this match", 403)


def _holds_claim(match: Match, user: User) -> bool:
    return match.claimed_by_id == user.id


def can_act(match: Match, user: User) -> bool:
    """Whether the case page should offer this viewer the Ruling controls."""
    if match.status != "disputed":
        return False
    return is_master(user) or (_holds_claim(match, user) and not _played_in(match, user))


def _set_claim(match: Match, user: User | None) -> None:
    match.claimed_by_id = user.id if user else None
    match.claimed_at = now() if user else None


def claim(match: Match, user: User) -> None:
    """An Admin takes sole charge of a case. Claiming your own Claim again changes nothing."""
    _require_open(match)
    _forbid_own_match(match, user)
    if _holds_claim(match, user):
        return
    if match.claimed_by_id is not None:
        raise MatchmakingError("already_claimed", "another Admin is handling this case")
    _set_claim(match, user)
    admin_log.record("claim", "Claimed the case.", actor=user, match_id=match.id)


def release(match: Match, user: User) -> None:
    """The claiming Admin, or the Master, lets go of a Claim so someone else can take the case."""
    _require_open(match)
    if match.claimed_by_id is None or not (_holds_claim(match, user) or is_master(user)):
        raise MatchmakingError("not_claimed_by_you", "you don't hold the Claim on this case", 403)
    holder = match.claimed_by_id
    _set_claim(match, None)
    admin_log.record("release_claim", "Released the Claim.", actor=user, match_id=match.id, target_id=holder)


def take_over(match: Match, master: User) -> None:
    """The Master takes over a case, whoever holds it, so nothing waits on an absent Admin."""
    _require_open(match)
    if _holds_claim(match, master):
        return
    holder = match.claimed_by_id
    _set_claim(match, master)
    admin_log.record("take_over_claim", "Took over the case.", actor=master, match_id=match.id, target_id=holder)


# ---------------------------------------------------------------- Rulings

# Overturn and Replay come in later tickets.
OUTCOMES = ("uphold", "void")


def rule(match: Match, user: User, outcome: object, reason: object) -> None:
    """Give the Ruling on a Disputed match. The first Ruling saved wins: the match row is locked,
    and once it has a Ruling every later attempt gets already_ruled."""
    _require_open(match)
    _forbid_own_match(match, user)
    if not (_holds_claim(match, user) or is_master(user)):
        raise MatchmakingError("not_claimed_by_you", "Claim the case before giving a Ruling", 403)
    if outcome not in OUTCOMES:
        raise MatchmakingError("validation", "invalid Ruling", 400, {"outcome": f"must be one of {list(OUTCOMES)}"})
    reason = require_reason(reason)

    if outcome == "uphold":
        # Through the same step as confirm, so the ranked win and unlocks are credited just the same.
        mm.complete(match, match.winner_id, "Ruling: the reported result stands.")
    else:
        mm.void(match, "Ruling: the match is void. It counts for no one.")
    match.ruling = outcome
    match.ruling_reason = reason
    match.ruled_by_id = user.id
    match.ruled_at = now()
    _set_claim(match, None)
    admin_log.record(
        "ruling", reason, actor=user, match_id=match.id, details={"outcome": outcome, "winnerId": match.winner_id}
    )


def summary_dict(match: Match, viewer: User) -> dict:
    """One row of the case list."""
    return {
        "kind": "dispute",
        "matchId": match.id,
        "game": match.game,
        "platform": match.platform,
        "players": [_name(match.player_a), _name(match.player_b)],
        "disputedAt": iso(match.finished_at),
        "claim": None
        if match.claimed_by_id is None
        else {
            "by": _ref(db.session.get(User, match.claimed_by_id)),
            "at": iso(match.claimed_at),
            "byYou": match.claimed_by_id == viewer.id,
        },
    }


def _was_disputed():
    """Matches that were ever disputed: open ones (including those filed before the dispute form,
    which have no reason), and ruled ones."""
    return or_(Match.status == "disputed", Match.dispute_reason.is_not(None), Match.ruling.is_not(None))


def dispute_record(user: User) -> dict:
    """Disputes this player filed and how each was ruled, newest first, so an Admin can spot
    someone who disputes every loss."""
    rows = list(
        db.session.scalars(select(Match).where(Match.ended_by_id == user.id, _was_disputed()).order_by(Match.id.desc()))
    )
    outcomes = Counter(m.ruling or "pending" for m in rows)
    return {
        "filed": len(rows),
        "outcomes": dict(outcomes),
        "disputes": [{"matchId": m.id, "game": m.game, "at": iso(m.finished_at), "outcome": m.ruling} for m in rows],
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
    s = score(match)
    players = (match.player_a, match.player_b)
    return {
        **summary_dict(match, viewer),
        "status": match.status,
        "players": [_player_dict(match, p) for p in players],
        "score": [s[match.player_a_id], s[match.player_b_id]],
        "winsNeeded": mm.wins_needed(match),
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
                str(st.user_id): {"text": st.text, "updatedAt": iso(st.updated_at)} for st in match.statements
            },
        },
        "messages": [{"id": m.id, "from": m.user_id, "text": m.text, "at": iso(m.created_at)} for m in match.messages],
        "records": {str(p.id): dispute_record(p) for p in players},
        "ruling": None
        if match.ruling is None
        else {**mm.ruling_dict(match), "by": _ref(db.session.get(User, match.ruled_by_id))},
        "playedIn": _played_in(match, viewer),
        "canAct": can_act(match, viewer),
    }


def get(match: Match | None) -> Match:
    """The case for a match that was disputed (open or already ruled)."""
    if match is None or (match.status != "disputed" and match.dispute_reason is None and match.ruling is None):
        raise MatchmakingError("not_found", "case not found", 404)
    return match
