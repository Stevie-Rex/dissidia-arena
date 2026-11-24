"""
Help requests (see GLOSSARY.md: Help request): a player asking the Admins to look at one of their
matches that isn't Disputed, such as a vanished opponent or evidence of cheating found later.

This module is the player's side: who can ask, and raising the request. Claiming and closing it is
Admin work and lives in app.cases beside the Disputed matches, which share the Claim rules.

Follows matchmaking.py's conventions: functions work on the current db.session, take the match
already locked, raise MatchmakingError, and leave committing to the caller.
"""

from datetime import timedelta

from . import clock
from .errors import MatchmakingError
from .extensions import db
from .models import HelpRequest, Match, User
from .models.match import OPEN_STATUSES

# A completed match can be asked about for this long after it finished.
WINDOW = timedelta(days=90)
MAX_MESSAGE_LEN = 500


def played_in(match: Match, user: User) -> bool:
    return user.id in (match.player_a_id, match.player_b_id)


def _askable(match: Match) -> bool:
    """Open, or completed within the last 90 days. Not Disputed (that is a case already), and not
    one that ended without being played."""
    if match.status in OPEN_STATUSES:
        return True
    return match.status == "completed" and match.finished_at is not None and clock.now() - match.finished_at < WINDOW


def open_by(match: Match, user: User) -> HelpRequest | None:
    """The player's request on this match that no Admin has closed yet."""
    return next((h for h in match.help_requests if h.user_id == user.id and h.closed_at is None), None)


def can_ask(match: Match, user: User) -> bool:
    """Whether the match page should offer this player the "Ask an Admin" button."""
    return played_in(match, user) and _askable(match) and open_by(match, user) is None


def ask(match: Match, user: User, message: object) -> HelpRequest:
    """A player asks the Admins for help with their match. One request at a time per player and match:
    ask again once an Admin has closed the last one."""
    if not played_in(match, user):
        raise MatchmakingError("not_found", "match not found", 404)
    if not _askable(match):
        raise MatchmakingError(
            "help_unavailable", "you can ask an Admin about a match that is open or was completed in the last 90 days"
        )
    if open_by(match, user) is not None:
        raise MatchmakingError("help_already_asked", "an Admin hasn't closed your last request on this match yet")
    text = message.strip() if isinstance(message, str) else ""
    if not text or len(text) > MAX_MESSAGE_LEN:
        raise MatchmakingError(
            "validation", "say what you need help with", 400, {"message": f"must be 1-{MAX_MESSAGE_LEN} characters"}
        )
    help_request = HelpRequest(user_id=user.id, message=text, created_at=clock.now())
    match.help_requests.append(help_request)
    db.session.flush()
    return help_request


def player_dict(help_request: HelpRequest | None) -> dict | None:
    """What the player who asked sees. The Admins' notes and reason for closing stay with the Admins."""
    if help_request is None:
        return None
    return {"id": help_request.id, "message": help_request.message, "at": clock.iso(help_request.created_at)}
