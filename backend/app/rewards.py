"""
Ranked-win rewards and appearance validation.

Ported from the theme package (`UI Designs/dissidia-theme/python/rewards.py`) with the owner's
reward ladder: Classic at 10 ranked wins, then one more unlock every 5 wins. The catalogue
lives here and is mirrored in `frontend/src/theme/tokens.json`; change a goal in both.

The server is the only judge of what is unlocked. Unlocks are permanent once granted.
Like matchmaking.py, nothing here commits; callers do.
"""

from __future__ import annotations

import click
from flask import Flask
from sqlalchemy import func, insert, or_, select, update

from .extensions import db
from .models import Match, User, UserPreferences, UserUnlock

# Ordered by goal. `unlocks` lists the preference values each reward opens up.
REWARDS: list[dict] = [
    {"key": "classic_interface", "name": "Classic interface", "goal": 10,
     "unlocks": {"interface": ["classic"], "window_theme": ["classic"]}},
    {"key": "window_crystal", "name": "Crystal window", "goal": 15, "unlocks": {"window_theme": ["crystal"]}},
    {"key": "window_magitek", "name": "Magitek window", "goal": 20, "unlocks": {"window_theme": ["magitek"]}},
    {"key": "window_midgar", "name": "Midgar window", "goal": 25, "unlocks": {"window_theme": ["midgar"]}},
    {"key": "window_garden", "name": "Garden window", "goal": 30, "unlocks": {"window_theme": ["garden"]}},
    {"key": "window_gaia", "name": "Gaia window", "goal": 35, "unlocks": {"window_theme": ["gaia"]}},
    {"key": "window_spira", "name": "Spira window", "goal": 40, "unlocks": {"window_theme": ["spira"]}},
    {"key": "window_ivalice", "name": "Ivalice window", "goal": 45, "unlocks": {"window_theme": ["ivalice"]}},
    {"key": "font_8bit", "name": "8-bit menu font", "goal": 50, "unlocks": {"menu_font": ["bit8"]}},
    {"key": "window_custom", "name": "Custom window colour", "goal": 60,
     "unlocks": {"window_theme": ["custom"], "window_rgb": ["any"]}},
]
REWARDS_BY_KEY = {r["key"]: r for r in REWARDS}

# (field, value) -> reward key. "any" means every value of that field needs the reward.
_REQUIRES: dict[tuple[str, str], str] = {
    (field, value): r["key"] for r in REWARDS for field, values in r["unlocks"].items() for value in values
}

ALLOWED = {
    "interface": {"rift", "classic"},
    "window_theme": {"classic", "crystal", "magitek", "midgar", "garden", "gaia", "spira", "ivalice", "custom"},
    "menu_font": {"auto", "bit16", "bit8", "story", "modern"},
    "cursor": {"glove", "arrow"},
    "rift_mode": {"chaos", "cosmos"},
}

DEFAULTS = {
    "interface": "rift",
    "window_theme": "classic",
    "menu_font": "auto",
    "cursor": "glove",
    "window_rgb": [6, 10, 26],
    "rift_mode": "chaos",
}

RGB_MAX = 31


class AppearanceError(Exception):
    def __init__(self, status: int, body: dict):
        super().__init__(body.get("message") or body.get("error", "error"))
        self.status = status
        self.body = body


# ---------------------------------------------------------------- pure helpers


def required_reward(field: str, value) -> str | None:
    """The reward key a preference value needs, or None if it's free."""
    if (field, "any") in _REQUIRES:
        return _REQUIRES[(field, "any")]
    return _REQUIRES.get((field, value)) if isinstance(value, str) else None


def rewards_for_wins(wins: int) -> list[str]:
    """Reward keys earned at this many ranked wins, in ladder order."""
    return [r["key"] for r in REWARDS if wins >= r["goal"]]


def reward_status(wins: int, unlocked: set[str]) -> list[dict]:
    """The `rewards` list for GET /api/me/appearance and the reward track."""
    out = []
    for r in REWARDS:
        have = r["key"] in unlocked
        out.append({
            "key": r["key"],
            "name": r["name"],
            "goal": r["goal"],
            "unlocks": r["unlocks"],
            "unlocked": have,
            "remaining": 0 if have else max(0, r["goal"] - wins),
            "percent": 100 if have else min(100, round(wins / r["goal"] * 100)),
        })
    return out


def catalogue() -> list[dict]:
    return [{"key": r["key"], "name": r["name"], "goal": r["goal"], "unlocks": r["unlocks"]} for r in REWARDS]


def locked_body(reward: str, wins: int) -> dict:
    r = REWARDS_BY_KEY[reward]
    remaining = max(0, r["goal"] - wins)
    return {
        "error": "locked",
        "message": f"{r['name']} unlocks at {r['goal']} ranked wins ({remaining} to go)",
        "reward": reward,
        "goal": r["goal"],
        "remaining": remaining,
    }


def validate_changes(changes, unlocked: set[str], wins: int) -> dict:
    """Check a PATCH body. Returns the cleaned changes or raises AppearanceError (400 / 403)."""
    if not isinstance(changes, dict) or not changes:
        raise AppearanceError(400, {"error": "empty", "message": "send at least one preference"})
    clean: dict = {}
    for field, value in changes.items():
        if field == "window_rgb":
            if (not isinstance(value, (list, tuple)) or len(value) != 3
                    or not all(isinstance(c, int) and not isinstance(c, bool) and 0 <= c <= RGB_MAX for c in value)):
                raise AppearanceError(400, {"error": "invalid", "field": field,
                                            "message": f"window_rgb must be three integers from 0 to {RGB_MAX}"})
            clean[field] = list(value)
        elif field in ALLOWED:
            if value not in ALLOWED[field]:
                raise AppearanceError(400, {"error": "invalid", "field": field,
                                            "message": f"{field} must be one of {sorted(ALLOWED[field])}"})
            clean[field] = value
        else:
            raise AppearanceError(400, {"error": "unknown_field", "field": field,
                                        "message": f"unknown preference {field!r}"})
    # Lock checks after shape checks, so a bad value is always a 400 whatever else is in the body.
    for field, value in clean.items():
        reward = required_reward(field, value)
        if reward and reward not in unlocked:
            raise AppearanceError(403, locked_body(reward, wins))
    return clean


# ---------------------------------------------------------------- database


def unlocked_keys(user_id: int) -> set[str]:
    return set(db.session.scalars(select(UserUnlock.reward_key).where(UserUnlock.user_id == user_id)))


def _insert_ignore():
    stmt = insert(UserUnlock)
    dialect = db.session.get_bind().dialect.name
    if dialect == "sqlite":
        return stmt.prefix_with("OR IGNORE")
    if dialect in ("mysql", "mariadb"):
        return stmt.prefix_with("IGNORE")
    raise RuntimeError(f"grant_unlocks: no insert-ignore for dialect {dialect!r}")


def grant_unlocks(user_id: int, wins: int, match_id: int | None = None) -> list[str]:
    """Insert any unlocks earned at `wins` that the player doesn't hold yet. Returns the new keys.

    Call in the same transaction that updates users.ranked_wins. INSERT IGNORE means two
    results landing at once can't double-grant or fail on the primary key.
    """
    earned = rewards_for_wins(wins)
    if not earned:
        return []
    have = unlocked_keys(user_id)
    new = []
    for key in earned:
        if key in have:
            continue
        res = db.session.execute(_insert_ignore().values(user_id=user_id, reward_key=key, match_id=match_id))
        if res.rowcount:
            new.append(key)
    return new


def record_ranked_win(match: Match) -> list[str]:
    """A ranked match just completed: credit the winner and grant what they earned.
    Called only by app.settlement, which owns settling a match.

    Every match is ranked for now (the site only has ranked 1v1 Bo3). Only `completed`
    counts; disputed, cancelled and abandoned matches never reach here.
    """
    if match.winner_id is None:
        return []
    # Atomic increment, so two of the same player's matches confirming at once don't lose a win.
    db.session.execute(
        update(User).where(User.id == match.winner_id).values(ranked_wins=User.ranked_wins + 1),
        execution_options={"synchronize_session": False},
    )
    wins = db.session.scalar(select(User.ranked_wins).where(User.id == match.winner_id))
    winner = db.session.get(User, match.winner_id)
    if winner is not None:
        db.session.refresh(winner, ["ranked_wins"])
    return grant_unlocks(match.winner_id, wins, match.id)


def rewards_from_match(match: Match, user_id: int) -> list[dict]:
    """Rewards this match earned for this player (for the victory card)."""
    keys = db.session.scalars(
        select(UserUnlock.reward_key).where(UserUnlock.match_id == match.id, UserUnlock.user_id == user_id)
    )
    order = {r["key"]: i for i, r in enumerate(REWARDS)}
    return [
        {"key": k, "name": REWARDS_BY_KEY[k]["name"], "goal": REWARDS_BY_KEY[k]["goal"]}
        for k in sorted(keys, key=lambda k: order.get(k, 99))
        if k in REWARDS_BY_KEY
    ]


def preferences(user_id: int) -> dict:
    row = db.session.get(UserPreferences, user_id)
    return row.to_dict() if row else {**DEFAULTS, "window_rgb": list(DEFAULTS["window_rgb"])}


def save_preferences(user_id: int, changes: dict) -> None:
    row = db.session.get(UserPreferences, user_id)
    if row is None:
        row = UserPreferences(user_id=user_id)
        db.session.add(row)
    for field, value in changes.items():
        if field == "window_rgb":
            row.window_r, row.window_g, row.window_b = value
        elif field == "cursor":
            row.cursor_style = value
        else:
            setattr(row, field, value)


def ranked_losses(user_id: int) -> int:
    return db.session.scalar(
        select(func.count()).select_from(Match).where(
            Match.status == "completed",
            or_(Match.player_a_id == user_id, Match.player_b_id == user_id),
            Match.winner_id != user_id,
        )
    ) or 0


def appearance(user: User) -> dict:
    """Body of GET/PATCH /api/me/appearance."""
    unlocked = unlocked_keys(user.id)
    status = reward_status(user.ranked_wins, unlocked)
    return {
        "preferences": preferences(user.id),
        "ranked_wins": user.ranked_wins,
        # For the Cycle of War gauge (your ranked record as Cosmos vs Chaos) until seasons exist.
        "ranked_losses": ranked_losses(user.id),
        "unlocks": [r["key"] for r in REWARDS if r["key"] in unlocked],
        "rewards": status,
        "next": next((r for r in status if not r["unlocked"]), None),
    }


def backfill() -> dict[str, int]:
    """Recount every player's ranked wins from completed matches and grant what they've earned.

    Idempotent. Unlocks are never removed, even if a recount comes out lower.
    """
    counts = dict(db.session.execute(
        select(Match.winner_id, func.count()).where(Match.status == "completed", Match.winner_id.is_not(None))
        .group_by(Match.winner_id)
    ).all())
    users = granted = 0
    for user in db.session.scalars(select(User)):
        user.ranked_wins = counts.get(user.id, 0)
        granted += len(grant_unlocks(user.id, user.ranked_wins))
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
