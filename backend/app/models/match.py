from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import db

from .user import User

# Where a queue entry came from. The bot (phase 2) will add "discord".
SOURCES = ("web", "discord")


class QueueEntry(db.Model):
    """A player currently searching. One row per player: you can only be in one queue."""

    __tablename__ = "queue_entries"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    game: Mapped[str] = mapped_column(String(8), nullable=False)
    mode: Mapped[str] = mapped_column(String(8), nullable=False)
    best_of: Mapped[int] = mapped_column(Integer, nullable=False)
    platform: Mapped[str] = mapped_column(String(16), nullable=False)
    region: Mapped[str] = mapped_column(String(3), nullable=False)
    source: Mapped[str] = mapped_column(String(8), default="web", nullable=False)
    joined_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)

    user: Mapped[User] = relationship()

    def settings(self) -> dict:
        return {"game": self.game, "mode": self.mode, "bestOf": self.best_of, "platform": self.platform}


class Match(db.Model):
    """
    Lifecycle:
      pending   -> both players must accept before accept_deadline
      active    -> games are being played and reported
      reported  -> one side reached the winning score; the other player confirms or disputes
                   before confirm_deadline, or it confirms itself
      disputed  -> the opponent rejected the result; an Admin Claims it and gives a Ruling
      completed | voided (no winner, counts for no one) | cancelled (accept failed) | abandoned (a player left)
    """

    __tablename__ = "matches"

    id: Mapped[int] = mapped_column(primary_key=True)
    game: Mapped[str] = mapped_column(String(8), nullable=False)
    mode: Mapped[str] = mapped_column(String(8), nullable=False)
    best_of: Mapped[int] = mapped_column(Integer, nullable=False)
    platform: Mapped[str] = mapped_column(String(16), nullable=False)
    region: Mapped[str] = mapped_column(String(3), nullable=False)
    status: Mapped[str] = mapped_column(String(12), nullable=False, index=True)

    player_a_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    player_b_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    a_accepted: Mapped[bool] = mapped_column(default=False, nullable=False)
    b_accepted: Mapped[bool] = mapped_column(default=False, nullable=False)
    accept_deadline: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    winner_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    # Player whose report ended the series; the *other* player confirms or disputes.
    reported_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    # Who declined, timed out or left; used later for penalties.
    ended_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime)
    # Reported results confirm themselves at this time unless the opponent acts first.
    confirm_deadline: Mapped[datetime | None] = mapped_column(DateTime, index=True)

    # The dispute form: which reported games the disputing player rejects, and why. Null on
    # matches disputed before the form existed.
    dispute_games: Mapped[list[int] | None] = mapped_column(JSON)
    dispute_reason: Mapped[str | None] = mapped_column(Text)
    # When the result was disputed. finished_at moves on when a Ruling settles the match.
    disputed_at: Mapped[datetime | None] = mapped_column(DateTime)

    # The Claim on a Disputed match: the Admin (or the Master) in sole charge of it, and since when.
    claimed_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    claimed_at: Mapped[datetime | None] = mapped_column(DateTime)

    # The current Ruling: outcome (uphold | overturn | void), the reason players see, who gave it and when.
    # Players are never shown ruled_by_id. Earlier Rulings live in the Admin log.
    ruling: Mapped[str | None] = mapped_column(String(12))
    ruling_reason: Mapped[str | None] = mapped_column(Text)
    ruled_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    ruled_at: Mapped[datetime | None] = mapped_column(DateTime)

    # Last status the Discord bot told the players about; differs from status = DM pending.
    notified_status: Mapped[str | None] = mapped_column(String(12))

    player_a: Mapped[User] = relationship(foreign_keys=[player_a_id])
    player_b: Mapped[User] = relationship(foreign_keys=[player_b_id])
    games: Mapped[list["MatchGame"]] = relationship(
        back_populates="match", order_by="MatchGame.game_no", cascade="all, delete-orphan"
    )
    messages: Mapped[list["MatchMessage"]] = relationship(
        back_populates="match", order_by="MatchMessage.id", cascade="all, delete-orphan"
    )
    statements: Mapped[list["DisputeStatement"]] = relationship(
        back_populates="match", order_by="DisputeStatement.id", cascade="all, delete-orphan"
    )


class MatchGame(db.Model):
    """One game within a series."""

    __tablename__ = "match_games"
    __table_args__ = (UniqueConstraint("match_id", "game_no"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    match_id: Mapped[int] = mapped_column(ForeignKey("matches.id", ondelete="CASCADE"), nullable=False)
    game_no: Mapped[int] = mapped_column(Integer, nullable=False)
    winner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    reported_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    # Reporter's picks (character, helper, stage); free-form for now.
    details: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)

    match: Mapped[Match] = relationship(back_populates="games")


class MatchMessage(db.Model):
    """Match-room chat. user_id is null for system messages."""

    __tablename__ = "match_messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    match_id: Mapped[int] = mapped_column(ForeignKey("matches.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    text: Mapped[str] = mapped_column(String(500), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    match: Mapped[Match] = relationship(back_populates="messages")


class DisputeStatement(db.Model):
    """A player's written side of a Disputed match. One per player, which they can update until a Ruling."""

    __tablename__ = "dispute_statements"
    __table_args__ = (UniqueConstraint("match_id", "user_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    match_id: Mapped[int] = mapped_column(ForeignKey("matches.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    match: Mapped[Match] = relationship(back_populates="statements")
