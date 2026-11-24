from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import db

from .match import Match
from .user import User


class HelpRequest(db.Model):
    """A player asking the Admins to look at one of their matches (see app.help_requests).

    It is claimed and closed like a Disputed match: the Claim columns work the same way, and closing
    it takes a reason, which goes in the Admin log and is not shown to the player."""

    __tablename__ = "help_requests"

    id: Mapped[int] = mapped_column(primary_key=True)
    match_id: Mapped[int] = mapped_column(ForeignKey("matches.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)

    claimed_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    claimed_at: Mapped[datetime | None] = mapped_column(DateTime)

    closed_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    closed_at: Mapped[datetime | None] = mapped_column(DateTime, index=True)
    close_reason: Mapped[str | None] = mapped_column(Text)

    # Set once the Discord bot has collected this request, so it pings the moderator role once.
    notified: Mapped[bool] = mapped_column(default=False, nullable=False)

    match: Mapped[Match] = relationship(back_populates="help_requests")
    user: Mapped[User] = relationship(foreign_keys=[user_id])
