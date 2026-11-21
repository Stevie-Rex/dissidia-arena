from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, SmallInteger, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.extensions import db


class UserPreferences(db.Model):
    """A player's saved look. No row means the defaults (see app.rewards.DEFAULTS); created on first save."""

    __tablename__ = "user_preferences"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    interface: Mapped[str] = mapped_column(String(10), default="rift", nullable=False)
    world: Mapped[str] = mapped_column(String(20), default="dissidia", nullable=False)
    window_theme: Mapped[str] = mapped_column(String(20), default="classic", nullable=False)
    menu_font: Mapped[str] = mapped_column(String(10), default="auto", nullable=False)
    cursor_style: Mapped[str] = mapped_column(String(10), default="glove", nullable=False)
    window_r: Mapped[int] = mapped_column(SmallInteger, default=6, nullable=False)
    window_g: Mapped[int] = mapped_column(SmallInteger, default=10, nullable=False)
    window_b: Mapped[int] = mapped_column(SmallInteger, default=26, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )

    def to_dict(self) -> dict:
        return {
            "interface": self.interface,
            "world": self.world,
            "window_theme": self.window_theme,
            "menu_font": self.menu_font,
            "cursor": self.cursor_style,
            "window_rgb": [self.window_r, self.window_g, self.window_b],
        }


class UserUnlock(db.Model):
    """A reward a player has earned. Permanent: never deleted, even if a match is later voided."""

    __tablename__ = "user_unlocks"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    reward_key: Mapped[str] = mapped_column(String(40), primary_key=True)
    unlocked_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    # The match whose win earned it (null for backfilled unlocks). Lets the match room show the
    # reward card to the winner whichever player confirmed, and after a reload.
    match_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("matches.id", ondelete="SET NULL"), index=True
    )
