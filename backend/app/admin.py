"""
Admin rules (see GLOSSARY.md: Master, Admin, Admin log): roles, appointing and removing Admins,
and stepping down. Cases, Claims and Rulings live in app.cases.

Follows matchmaking.py's conventions: functions work on the current db.session and leave
committing to the caller, and they raise MatchmakingError (code, message, HTTP status).
Every change of role writes an Admin log entry in the same transaction.
"""

from flask import current_app
from sqlalchemy import func, or_, select

from . import admin_log, clock
from .extensions import db
from .matchmaking import MatchmakingError
from .models import User

MAX_REASON_LEN = 2000
SEARCH_LIMIT = 20


def is_master(user: User) -> bool:
    master_id = current_app.config.get("MASTER_DISCORD_ID")
    return bool(master_id) and str(user.discord_id) == master_id


def role(user: User) -> str:
    """'master', 'admin' or 'player'. Worked out from the config and the database every time."""
    if is_master(user):
        return "master"
    return "admin" if user.admin_since is not None else "player"


def require_reason(reason: object) -> str:
    """Every Admin and Master action needs a reason, for the Admin log."""
    reason = reason.strip() if isinstance(reason, str) else ""
    if not reason:
        raise MatchmakingError("reason_required", "give a reason", 400)
    if len(reason) > MAX_REASON_LEN:
        raise MatchmakingError(
            "validation", "reason is too long", 400, {"reason": f"must be at most {MAX_REASON_LEN} characters"}
        )
    return reason


def _forbid_master(user: User, message: str) -> None:
    if is_master(user):
        raise MatchmakingError("forbidden", message, 403)


def _existing_user(user_id: object) -> User:
    """Only players who have signed in to the site or used the bot (so have a user row) qualify."""
    user = db.session.get(User, user_id) if isinstance(user_id, int) and not isinstance(user_id, bool) else None
    if user is None:
        raise MatchmakingError("not_found", "no player with that ID has signed in or used the bot", 404)
    return user


def search_players(q: str) -> list[User]:
    """Existing players whose Discord username or display name contains q (any case)."""
    q = q.strip().lower()
    if not q:
        return []
    pattern = f"%{q}%"
    return list(
        db.session.scalars(
            select(User)
            .where(or_(func.lower(User.username).like(pattern), func.lower(User.display_name).like(pattern)))
            .order_by(User.username, User.id)
            .limit(SEARCH_LIMIT)
        )
    )


def admins() -> list[User]:
    """Current Admins, longest-serving first. Never the Master, even if they were appointed before
    MASTER_DISCORD_ID pointed at them."""
    rows = db.session.scalars(select(User).where(User.admin_since.is_not(None)).order_by(User.admin_since, User.id))
    return [u for u in rows if not is_master(u)]


def _release_claims(user: User, actor: User, why: str) -> None:
    from . import cases  # cases imports this module for the roles

    # Write the role change first: that locks the user row before their Claimed matches, the same
    # order cases.act takes, so a Claim made at the same moment can't outlive the role.
    db.session.flush()
    cases.release_all(user, actor, why)


def appoint(master: User, user_id: object, reason: object) -> User:
    reason = require_reason(reason)
    user = _existing_user(user_id)
    _forbid_master(user, "the Master already has every Admin power")
    if user.admin_since is not None:
        raise MatchmakingError("already_admin", "that player is already an Admin")
    user.admin_since = clock.now()
    admin_log.record("appoint_admin", reason, actor=master, target_id=user.id)
    return user


def remove(master: User, user_id: int, reason: object) -> None:
    """The Master removes an Admin. Their past Rulings stand; access ends on their next request."""
    reason = require_reason(reason)
    user = _existing_user(user_id)
    _forbid_master(user, "the Master can't be removed")
    if user.admin_since is None:
        raise MatchmakingError("not_admin", "that player isn't an Admin")
    user.admin_since = None
    admin_log.record("remove_admin", reason, actor=master, target_id=user.id)
    _release_claims(user, master, "Released automatically: the Admin was removed.")


def step_down(user: User, reason: object) -> None:
    """An Admin gives up the role themselves."""
    reason = require_reason(reason)
    _forbid_master(user, "the Master can't step down")
    user.admin_since = None
    admin_log.record("step_down", reason, actor=user, target_id=user.id)
    _release_claims(user, user, "Released automatically: the Admin stepped down.")


def player_dict(user: User) -> dict:
    """A search result in the Master panel (Master only, so showing the role is no badge)."""
    return {
        "id": user.id,
        "discordId": str(user.discord_id),
        "username": user.username,
        "displayName": user.display_name or user.username,
        "avatarUrl": user.avatar_url,
        "role": role(user),
    }


def admin_dict(user: User) -> dict:
    return {**player_dict(user), "since": clock.iso(user.admin_since)}
