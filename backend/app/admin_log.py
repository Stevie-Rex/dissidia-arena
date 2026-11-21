"""
The Admin log (see GLOSSARY.md): who acted, the action, an optional match and target player,
the reason, structured details, and the time.

Append-only by construction: this module can add entries and read them, and nothing else.
Like matchmaking.py, it works on the current db.session and leaves committing to the caller,
so an entry lands in the same transaction as the action it records.
"""

from sqlalchemy import select

from .extensions import db
from .models import AdminLogEntry, User


def record(
    action: str,
    reason: str,
    *,
    actor: User | None = None,
    match_id: int | None = None,
    target_id: int | None = None,
    details: dict | None = None,
) -> None:
    """Append an entry. actor=None is a system action."""
    from .matchmaking import now  # one clock, so tests can move it

    db.session.add(
        AdminLogEntry(
            actor_id=actor.id if actor else None,
            action=action,
            match_id=match_id,
            target_id=target_id,
            reason=reason,
            details=details or {},
            created_at=now(),
        )
    )


def entries(limit: int = 50) -> list[dict]:
    """The latest entries, newest first."""
    q = select(AdminLogEntry).order_by(AdminLogEntry.id.desc()).limit(limit)
    return [_entry_dict(e) for e in db.session.scalars(q)]


def _entry_dict(e: AdminLogEntry) -> dict:
    from .matchmaking import iso

    return {
        "id": e.id,
        "actor": e.actor_id,
        "action": e.action,
        "matchId": e.match_id,
        "targetId": e.target_id,
        "reason": e.reason,
        "details": e.details,
        "at": iso(e.created_at),
    }
