from flask import Blueprint, jsonify, request

from .. import admin
from ..auth import current_user, login_required
from ..extensions import db
from ..models.user import GAMES, REGIONS

bp = Blueprint("me", __name__)

MAX_GAME_ID_LEN = 64


def me_dict(user) -> dict:
    """The signed-in user, with their role (worked out on every request)."""
    return {**user.to_dict(), "role": admin.role(user)}


@bp.get("/me")
@login_required
def get_me():
    return jsonify(me_dict(current_user()))


@bp.patch("/me")
@login_required
def update_me():
    """First-time setup / settings: games, region, in-game IDs."""
    # Requiring JSON means a cross-site HTML form can't hit this endpoint.
    if not request.is_json:
        return jsonify({"error": "expected application/json"}), 415
    data = request.get_json(silent=True) or {}
    user = current_user()
    errors: dict[str, str] = {}

    if "games" in data:
        games = data["games"]
        if not isinstance(games, list) or not games or any(g not in GAMES for g in games):
            errors["games"] = f"must be a non-empty list of {list(GAMES)}"
        else:
            user.games = sorted(set(games))

    if "region" in data:
        if data["region"] not in REGIONS:
            errors["region"] = f"must be one of {list(REGIONS)}"
        else:
            user.region = data["region"]

    if "gameIds" in data:
        ids = data["gameIds"]
        if not isinstance(ids, dict) or any(
            k not in GAMES or not isinstance(v, str) or len(v) > MAX_GAME_ID_LEN for k, v in ids.items()
        ):
            errors["gameIds"] = f"must map {list(GAMES)} to strings up to {MAX_GAME_ID_LEN} chars"
        else:
            user.game_ids = {k: v.strip() for k, v in ids.items() if v.strip()}

    if "onboarded" in data:
        user.onboarded = bool(data["onboarded"])

    if errors:
        db.session.rollback()
        return jsonify({"error": "validation", "fields": errors}), 400

    db.session.commit()
    return jsonify(me_dict(user))
