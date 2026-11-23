"""
The Admin log (see GLOSSARY.md): who acted, the action, an optional match and target player,
the reason, structured details, and the time.

Append-only by construction: this module can add entries and read them, and nothing else.
Like matchmaking.py, it works on the current db.session and leaves committing to the caller,
so an entry lands in the same transaction as the action it records.
"""

from sqlalchemy import select

from . import clock
from .extensions import db
from .models import AdminLogEntry, User

PAGE_SIZE = 50


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
    db.session.add(
        AdminLogEntry(
            actor_id=actor.id if actor else None,
            action=action,
            match_id=match_id,
            target_id=target_id,
            reason=reason,
            details=details or {},
            created_at=clock.now(),
        )
    )


def entries(limit: int = PAGE_SIZE, offset: int = 0) -> list[dict]:
    """Entries newest first, with the actor's and target's names (looked up in one query)."""
    q = select(AdminLogEntry).order_by(AdminLogEntry.id.desc()).limit(limit).offset(offset)
    rows = list(db.session.scalars(q))
    ids = {uid for e in rows for uid in (e.actor_id, e.target_id) if uid is not None}
    names = {
        u.id: u.display_name or u.username for u in db.session.scalars(select(User).where(User.id.in_(ids)))
    } if ids else {}
    return [_entry_dict(e, names) for e in rows]


def page(n: int) -> dict:
    """One page of the log, newest first. Pages count from 1."""
    rows = entries(PAGE_SIZE + 1, (n - 1) * PAGE_SIZE)
    return {"entries": rows[:PAGE_SIZE], "page": n, "hasMore": len(rows) > PAGE_SIZE}


def _entry_dict(e: AdminLogEntry, names: dict[int, str]) -> dict:
    def ref(uid: int | None) -> dict | None:
        return None if uid is None else {"id": uid, "displayName": names.get(uid, "Unknown player")}

    return {
        "id": e.id,
        "actor": ref(e.actor_id),  # null for a system action
        "action": e.action,
        "matchId": e.match_id,
        "target": ref(e.target_id),
        "reason": e.reason,
        "details": e.details,
        "at": clock.iso(e.created_at),
    }
