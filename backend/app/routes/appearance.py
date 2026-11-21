from flask import Blueprint, jsonify, request

from .. import rewards
from ..auth import current_user, login_required
from ..extensions import db

bp = Blueprint("appearance", __name__)


@bp.get("/me/appearance")
@login_required
def get_appearance():
    """Saved look, ranked wins, unlocks and progress toward every reward."""
    return jsonify(rewards.appearance(current_user()))


@bp.patch("/me/appearance")
@login_required
def patch_appearance():
    """Save one or more preferences. Locked values are refused with 403 and change nothing."""
    # Requiring JSON means a cross-site HTML form can't hit this endpoint.
    if not request.is_json:
        return jsonify({"error": "unsupported_media_type", "message": "expected application/json"}), 415
    user = current_user()
    try:
        changes = rewards.validate_changes(
            request.get_json(silent=True), rewards.unlocked_keys(user.id), user.ranked_wins
        )
    except rewards.AppearanceError as e:
        return jsonify(e.body), e.status
    rewards.save_preferences(user.id, changes)
    db.session.commit()
    return jsonify(rewards.appearance(user))


@bp.get("/rewards")
def get_rewards():
    """The public reward catalogue (keys, names, goals, what each unlocks)."""
    return jsonify({"rewards": rewards.catalogue()})
