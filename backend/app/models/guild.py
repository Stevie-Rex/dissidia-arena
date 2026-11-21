from datetime import datetime

from sqlalchemy import BigInteger, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.extensions import db


class GuildConfig(db.Model):
    """
    One row per Discord server the bot is in. Each community server is for one game, so
    /queue there means that game. Set with /arena setup.
    """

    __tablename__ = "guild_configs"

    guild_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=False)
    game: Mapped[str] = mapped_column(String(8), nullable=False, index=True)
    # Where "someone is searching" pings go, and the DM fallback for players with DMs closed.
    queue_channel_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    # Opt-in role to ping when someone starts searching. None = no pings.
    ping_role_id: Mapped[int | None] = mapped_column(BigInteger)
    # Moderators for this server's game (dispute review comes later).
    mod_role_id: Mapped[int | None] = mapped_column(BigInteger)
    last_ping_at: Mapped[datetime | None] = mapped_column(DateTime)
