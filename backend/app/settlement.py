"""
Settlement (see GLOSSARY.md: Settled match): a match's final result and its ranked effects.

Callers say *that* a match is settled and how the players are told. This module decides who won,
from the stored games, and applies every effect: the status, the winner, the finish time, the
match-room system message, the ranked win and the unlocks.

It knows nothing of Rulings, Claims, permissions or the Admin log; those stay with the callers.
Like matchmaking.py, it works on the current db.session and leaves committing to the caller, it
takes the match already locked, and it raises MatchmakingError.
"""

from collections.abc import Mapping
from dataclasses import dataclass

from . import clock, rewards
from .errors import MatchmakingError
from .match_room import post_system
from .models import Match, User

# A match can only be settled from these statuses, so a Settled match is never settled again.
COMPLETABLE = ("reported", "disputed")
VOIDABLE = ("pending", "active", "reported", "disputed")


@dataclass(frozen=True)
class Settled:
    """What settling a match with a winner did. Ratings (#14) add their changes here."""

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


def _require_status(match: Match, statuses: tuple[str, ...]) -> None:
    if match.status not in statuses:
        raise MatchmakingError("not_open", f"match is {match.status}")


def complete(match: Match, message: str) -> Settled:
    """Settle a match with the winner its stored games say: completed, ranked win credited, unlocks
    granted (tagged with the match), and message posted in the match room.

    Refuses (changing nothing) unless the match is reported or disputed (not_open), and when no
    player has reached the winning score (no_series_winner)."""
    _require_status(match, COMPLETABLE)
    winner = series_winner(match)
    if winner is None:
        raise MatchmakingError("no_series_winner", "nobody has won this series")
    match.status = "completed"
    match.winner_id = winner.id
    match.finished_at = clock.now()
    post_system(match, message)
    return Settled(unlocked=tuple(rewards.record_ranked_win(match)))


def void(match: Match, message: str) -> None:
    """Settle a match so it counts for no one: no winner, no ranked win, nothing against anyone.

    Refuses (changing nothing) unless the match is still open (not_open)."""
    _require_status(match, VOIDABLE)
    match.status = "voided"
    match.winner_id = None
    match.finished_at = clock.now()
    post_system(match, message)
