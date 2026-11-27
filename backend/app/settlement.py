"""
Settlement (see GLOSSARY.md: Settled match): a match's final result and its ranked effects.

Callers (app.lifecycle) say *that* a match is settled and how the players are told. This module
decides who won, from the stored games, and applies every effect: the status, the winner, the finish
time, the match-room system message, the settlements row, the ranked win and the unlocks.

It is the only module that changes ranked state: it alone writes settlements rows and
User.ranked_wins. app.rewards only says which rewards a win count unlocks, and grants them.

It knows nothing of Rulings, Claims, permissions or the Admin log; those stay with the callers.
Like matchmaking.py, it works on the current db.session and leaves committing to the caller, it
takes the match already locked, and it raises MatchmakingError.
"""

from collections.abc import Mapping
from dataclasses import dataclass

import click
from flask import Flask
from sqlalchemy import func, select, update

from . import clock, rewards
from .errors import MatchmakingError
from .extensions import db
from .match_room import post_system
from .models import Match, Settlement, User
from .models.match import OPEN
from .models.settlement import ladder_of

# A match can only be settled from these statuses, so a Settled match is never settled again.
COMPLETABLE = ("reported", "disputed")
VOIDABLE = (*OPEN, "disputed")


@dataclass(frozen=True)
class Settled:
    """What settling a match did. Ratings (#71) add their changes here."""

    winner_id: int | None  # None for a Void
    unlocked: tuple[str, ...]  # reward keys the winner just unlocked


def wins_needed(match: Match) -> int:
    return match.best_of // 2 + 1


def score(match: Match, corrections: Mapping[int, int] | None = None) -> dict[int, int]:
    """Games won so far, by player id, from the stored games. corrections ({game number: winner
    id}) overrides some of them, to see what a correction would do before saving it."""
    corrections = corrections or {}
    s = {match.player_a_id: 0, match.player_b_id: 0}
    for g in match.games:
        s[corrections.get(g.game_no, g.winner_id)] += 1
    return s


def series_winner(match: Match, corrections: Mapping[int, int] | None = None) -> User | None:
    """The player who has reached the winning score for the match's best-of, or None.
    corrections works as in score()."""
    s = score(match, corrections)
    needed = wins_needed(match)
    if s[match.player_a_id] >= needed:
        return match.player_a
    if s[match.player_b_id] >= needed:
        return match.player_b
    return None


def require_status(match: Match, *statuses: str) -> None:
    """Refuse (bad_status) an action the match's status doesn't allow."""
    if match.status not in statuses:
        raise MatchmakingError("bad_status", f"match is {match.status}")


def complete(match: Match, message: str) -> Settled:
    """Settle a match with the winner its stored games say: completed, ranked win credited, unlocks
    granted (tagged with the match), and message posted in the match room.

    Refuses (changing nothing) unless the match is reported or disputed (bad_status), and when no
    player has reached the winning score (no_series_winner)."""
    require_status(match, *COMPLETABLE)
    winner = series_winner(match)
    if winner is None:
        raise MatchmakingError("no_series_winner", "nobody has won this series")
    match.status = "completed"
    match.winner_id = winner.id
    match.finished_at = clock.now()
    post_system(match, message)
    loser_id = match.player_b_id if winner.id == match.player_a_id else match.player_a_id
    _record(match, "completed", winner.id, loser_id)
    return Settled(winner_id=winner.id, unlocked=tuple(_credit_win(winner, match)))


def void(match: Match, message: str) -> Settled:
    """Settle a match so it counts for no one: no winner, no ranked win, nothing against anyone.

    Refuses (changing nothing) unless the match is open or disputed (bad_status)."""
    require_status(match, *VOIDABLE)
    match.status = "voided"
    match.winner_id = None
    match.finished_at = clock.now()
    post_system(match, message)
    _record(match, "voided", None, None)
    return Settled(winner_id=None, unlocked=())


def _record(match: Match, outcome: str, winner_id: int | None, loser_id: int | None) -> None:
    """Write the settle's row. The unique live_match_id index refuses a second live row for the match."""
    db.session.add(Settlement(
        match_id=match.id, outcome=outcome, winner_id=winner_id, loser_id=loser_id,
        ladder=ladder_of(match.game, match.platform), settled_at=match.finished_at,
    ))
    db.session.flush()


def _credit_win(winner: User, match: Match) -> list[str]:
    """Add one to the winner's ranked wins and grant what they earned, tagged with the match."""
    # Atomic increment, so two of the same player's matches settling at once don't lose a win.
    db.session.execute(
        update(User).where(User.id == winner.id).values(ranked_wins=User.ranked_wins + 1),
        execution_options={"synchronize_session": False},
    )
    db.session.refresh(winner, ["ranked_wins"])
    return rewards.grant_unlocks(winner.id, winner.ranked_wins, match.id)


# ---------------------------------------------------------------- ranked counts


def _live():
    return Settlement.unsettled_at.is_(None)


def ranked_losses(user_id: int) -> int:
    """Settles with a winner that this player lost. Voids and settles the Master has unsettled don't count."""
    return db.session.scalar(
        select(func.count()).select_from(Settlement).where(_live(), Settlement.loser_id == user_id)
    ) or 0


def backfill() -> dict[str, int]:
    """Recount every player's ranked wins from the settlements rows and grant what they've earned.

    Idempotent. Unlocks are never removed, even if a recount comes out lower.
    """
    counts = dict(db.session.execute(
        select(Settlement.winner_id, func.count())
        .where(_live(), Settlement.winner_id.is_not(None))
        .group_by(Settlement.winner_id)
    ).all())
    users = granted = 0
    for user in db.session.scalars(select(User)):
        user.ranked_wins = counts.get(user.id, 0)
        granted += len(rewards.grant_unlocks(user.id, user.ranked_wins))
        users += 1
    return {"users": users, "granted": granted}


def register(app: Flask) -> None:
    @app.cli.command("backfill-rewards")
    def backfill_rewards() -> None:
        """Recount ranked wins and grant any unlocks players have already earned."""
        try:
            result = backfill()
            db.session.commit()
        except Exception:
            db.session.rollback()
            raise
        click.echo(f"{result['users']} players checked, {result['granted']} unlocks granted")
