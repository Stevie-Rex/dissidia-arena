"""
The one clock every module reads the time through.

Call it as `clock.now()` (never `from .clock import now`), so the attribute is looked up at call
time and a test that patches `clock.now` moves every timestamp at once.
"""

from datetime import UTC, datetime


def now() -> datetime:
    """Naive UTC, which is what the DateTime columns store."""
    return datetime.now(UTC).replace(tzinfo=None)


def iso(dt: datetime | None) -> str | None:
    return dt.isoformat(timespec="seconds") + "Z" if dt else None
