from datetime import datetime

from sqlalchemy import JSON, BigInteger, Boolean, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.extensions import db

REGIONS = ("NA", "EU", "JP", "SA", "OCE")
GAMES = ("012", "nt")


class User(db.Model):
    """A player. Identity comes from Discord — there are no passwords."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    discord_id: Mapped[int] = mapped_column(BigInteger, unique=True, nullable=False, index=True)
    username: Mapped[str] = mapped_column(String(64), nullable=False)
    display_name: Mapped[str | None] = mapped_column(String(64))
    avatar_hash: Mapped[str | None] = mapped_column(String(64))

    # First-time setup (wireframe 1b)
    onboarded: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    region: Mapped[str] = mapped_column(String(3), default="NA", nullable=False)
    games: Mapped[list[str]] = mapped_column(JSON, default=lambda: list(GAMES), nullable=False)
    game_ids: Mapped[dict[str, str]] = mapped_column(JSON, default=dict, nullable=False)

    # Cached count of completed ranked matches won (both games). Updated in the same transaction
    # that confirms a result; drives appearance unlocks (app.rewards).
    ranked_wins: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime)
    # Set while the player is an Admin (appointed by the Master). The Master is never stored here:
    # that role comes from MASTER_DISCORD_ID (see app.admin.role).
    admin_since: Mapped[datetime | None] = mapped_column(DateTime)

    @property
    def avatar_url(self) -> str:
        if self.avatar_hash:
            ext = "gif" if self.avatar_hash.startswith("a_") else "png"
            return f"https://cdn.discordapp.com/avatars/{self.discord_id}/{self.avatar_hash}.{ext}?size=128"
        # Discord's default avatars for the new username system
        return f"https://cdn.discordapp.com/embed/avatars/{(self.discord_id >> 22) % 6}.png"

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "discordId": str(self.discord_id),  # string: JS can't hold a 64-bit int
            "username": self.username,
            "displayName": self.display_name or self.username,
            "avatarUrl": self.avatar_url,
            "onboarded": self.onboarded,
            "region": self.region,
            "games": self.games,
            "gameIds": self.game_ids,
            "rankedWins": self.ranked_wins,
        }
