from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.extensions import db


class AdminLogEntry(db.Model):
    """
    The Admin log: a permanent record of every Admin, Master and system action.
    Append-only. Nothing updates or deletes these rows; write them through app.admin_log.
    """

    __tablename__ = "admin_log"

    id: Mapped[int] = mapped_column(primary_key=True)
    # Who acted; null for system actions (such as auto-confirm).
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    match_id: Mapped[int | None] = mapped_column(ForeignKey("matches.id"), index=True)
    target_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    details: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
