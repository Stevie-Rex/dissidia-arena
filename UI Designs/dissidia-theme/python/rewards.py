"""Dissidia Arena rewards and appearance validation (v1.0.0).

Framework-agnostic helpers for the Flask back end. Goals mirror tokens.json.
`db` in grant_unlocks() is any DB-API connection (e.g. mariadb / PyMySQL);
swap in SQLAlchemy calls if the project uses it.
"""
from __future__ import annotations

REWARDS = {
    "classic_interface": {"name": "Classic interface", "goal": 25},
    "font_8bit": {"name": "8-bit menu font", "goal": 50},
    "window_custom": {"name": "Custom window colour", "goal": 100},
}

ALLOWED = {
    "interface": {"rift", "classic"},
    "world": {"dissidia", "crystal", "magitek", "mako", "gaia", "ivalice"},
    "window_theme": {"classic", "crystal", "magitek", "midgar", "garden", "gaia", "spira", "ivalice", "custom"},
    "menu_font": {"auto", "bit16", "bit8", "story", "modern"},
    "cursor": {"glove", "arrow"},
}

DEFAULTS = {
    "interface": "rift",
    "world": "dissidia",
    "window_theme": "classic",
    "menu_font": "auto",
    "cursor": "glove",
    "window_rgb": [6, 10, 26],
}


class AppearanceError(Exception):
    def __init__(self, status: int, body: dict):
        super().__init__(body.get("error", "error"))
        self.status = status
        self.body = body


def required_reward(field: str, value) -> str | None:
    """The reward key a preference value needs, or None."""
    if field == "interface" and value == "classic":
        return "classic_interface"
    if field == "menu_font" and value == "bit8":
        return "font_8bit"
    if field == "window_theme" and value == "custom":
        return "window_custom"
    if field == "window_rgb":
        return "window_custom"
    return None


def rewards_for_wins(wins: int) -> list[str]:
    """Reward keys earned at this number of ranked wins."""
    return [k for k, r in REWARDS.items() if wins >= r["goal"]]


def reward_status(wins: int, unlocked: set[str]) -> list[dict]:
    """The `rewards` list for GET /api/me/appearance."""
    return [
        {"key": k, "name": r["name"], "goal": r["goal"], "unlocked": k in unlocked,
         "remaining": 0 if k in unlocked else max(0, r["goal"] - wins)}
        for k, r in REWARDS.items()
    ]


def validate_changes(changes: dict, unlocked: set[str], wins: int) -> dict:
    """Check a PATCH body. Returns the cleaned changes or raises AppearanceError (400 / 403)."""
    if not isinstance(changes, dict) or not changes:
        raise AppearanceError(400, {"error": "empty"})
    clean = {}
    for field, value in changes.items():
        if field == "window_rgb":
            if (not isinstance(value, (list, tuple)) or len(value) != 3
                    or not all(isinstance(c, int) and not isinstance(c, bool) and 0 <= c <= 31 for c in value)):
                raise AppearanceError(400, {"error": "invalid", "field": field})
            clean[field] = list(value)
        elif field in ALLOWED:
            if value not in ALLOWED[field]:
                raise AppearanceError(400, {"error": "invalid", "field": field})
            clean[field] = value
        else:
            raise AppearanceError(400, {"error": "unknown_field", "field": field})
        reward = required_reward(field, clean[field])
        if reward and reward not in unlocked:
            goal = REWARDS[reward]["goal"]
            raise AppearanceError(403, {"error": "locked", "reward": reward, "goal": goal,
                                        "remaining": max(0, goal - wins)})
    return clean


def grant_unlocks(db, user_id: int, wins: int) -> list[str]:
    """Insert any unlocks the player has earned but not yet received. Returns the new keys.

    Call inside the same transaction that records the ranked result and updates users.ranked_wins.
    INSERT IGNORE makes this safe if two results land at once.
    """
    earned = rewards_for_wins(wins)
    if not earned:
        return []
    cur = db.cursor()
    cur.execute("SELECT reward_key FROM user_unlocks WHERE user_id = %s", (user_id,))
    have = {row[0] for row in cur.fetchall()}
    new = [k for k in earned if k not in have]
    for key in new:
        cur.execute("INSERT IGNORE INTO user_unlocks (user_id, reward_key) VALUES (%s, %s)", (user_id, key))
    return new


# Example Flask route (adapt names, auth and DB access to the project):
#
# @bp.patch("/api/me/appearance")
# @login_required
# def patch_appearance():
#     unlocked = load_unlocks(current_user.id)          # set of reward keys
#     try:
#         changes = validate_changes(request.get_json(silent=True) or {}, unlocked, current_user.ranked_wins)
#     except AppearanceError as e:
#         return jsonify(e.body), e.status
#     save_preferences(current_user.id, changes)         # upsert user_preferences
#     return jsonify(load_appearance(current_user.id))
