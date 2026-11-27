from datetime import datetime

from sqlalchemy import Computed, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.extensions import db

# How a match was Settled. forfeit is allowed but nothing writes it until Forfeit lands.
OUTCOMES = ("completed", "voided", "forfeit")


def ladder_of(game: str, platform: str) -> str:
    """The Ladder a match counts on (see GLOSSARY.md): 012/PPSSPP, nt/PS4 or nt/PC."""
    return f"{game}/{platform}"


class Settlement(db.Model):
    """One settle of a match (see GLOSSARY.md: Settled match), written only by app.settlement.

    A settle with a winner is a ranked win for winner_id and a ranked loss for loser_id; a Void has
    neither. undone_at is set when the Master reopens the match, so the row stops counting.
    A match has at most one row whose undone_at is empty."""

    __tablename__ = "settlements"

    id: Mapped[int] = mapped_column(primary_key=True)
    # No ON DELETE CASCADE: MariaDB refuses one on a column a stored generated column is built from.
    match_id: Mapped[int] = mapped_column(ForeignKey("matches.id"), nullable=False, index=True)
    outcome: Mapped[str] = mapped_column(String(10), nullable=False)
    winner_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), index=True)
    loser_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), index=True)
    ladder: Mapped[str] = mapped_column(String(16), nullable=False)
    settled_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    undone_at: Mapped[datetime | None] = mapped_column(DateTime)
    # The match id while the row counts, NULL once undone. Its unique index is the "one live row per
    # match" rule: MariaDB has no partial unique indexes, but both it and SQLite allow many NULLs.
    live_match_id: Mapped[int | None] = mapped_column(
        Integer, Computed("CASE WHEN undone_at IS NULL THEN match_id END", persisted=True), unique=True
    )
