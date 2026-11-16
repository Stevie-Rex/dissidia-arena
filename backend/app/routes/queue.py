from flask import Blueprint, jsonify, request

from .. import matchmaking as mm
from ..auth import current_user, login_required
from ..extensions import db

bp = Blueprint("queue", __name__)


@bp.errorhandler(mm.MatchmakingError)
def matchmaking_error(e: mm.MatchmakingError):
    db.session.rollback()
    body = {"error": e.code, "message": e.message}
    if e.fields:
        body["fields"] = e.fields
    return jsonify(body), e.status


def _json() -> dict:
    # Requiring JSON means a cross-site HTML form can't hit these endpoints.
    if not request.is_json:
        raise mm.MatchmakingError("unsupported_media_type", "expected application/json", 415)
    data = request.get_json(silent=True)
    return data if isinstance(data, dict) else {}


def _state():
    result = mm.state(current_user())
    db.session.commit()
    return jsonify(result)


@bp.get("/queue")
@login_required
def get_queue():
    """Poll this: returns your queue entry or current match, and pairs you if someone is waiting."""
    return _state()


@bp.post("/queue")
@login_required
def join_queue():
    mm.join_queue(current_user(), _json())
    resp = _state()
    resp.status_code = 201
    return resp


@bp.delete("/queue")
@login_required
def leave_queue():
    mm.leave_queue(current_user())
    return _state()


def _match_action(match_id: int, action, *args):
    match = mm.lock_match(match_id)
    user = current_user()
    if match is None:
        raise mm.MatchmakingError("not_found", "match not found", 404)
    action(match, user, *args)
    db.session.commit()
    return jsonify(mm.match_dict(match, user))


@bp.get("/matches/<int:match_id>")
@login_required
def get_match(match_id: int):
    """Participants only for now; public match pages come with ratings."""
    match = mm.lock_match(match_id)
    if match is None:
        raise mm.MatchmakingError("not_found", "match not found", 404)
    mm.expire_if_due(match)
    result = mm.match_dict(match, current_user())
    db.session.commit()
    return jsonify(result)


@bp.post("/matches/<int:match_id>/accept")
@login_required
def accept(match_id: int):
    return _match_action(match_id, mm.accept)


@bp.post("/matches/<int:match_id>/decline")
@login_required
def decline(match_id: int):
    return _match_action(match_id, mm.decline)


@bp.post("/matches/<int:match_id>/games")
@login_required
def report_game(match_id: int):
    data = _json()
    game_no, winner_id = data.get("gameNo"), data.get("winnerId")
    if not isinstance(game_no, int) or not isinstance(winner_id, int):
        raise mm.MatchmakingError("validation", "gameNo and winnerId must be integers", 400)
    return _match_action(match_id, mm.report_game, game_no, winner_id, data.get("details"))


@bp.post("/matches/<int:match_id>/confirm")
@login_required
def confirm(match_id: int):
    return _match_action(match_id, mm.confirm)


@bp.post("/matches/<int:match_id>/dispute")
@login_required
def dispute(match_id: int):
    return _match_action(match_id, mm.dispute)


@bp.post("/matches/<int:match_id>/leave")
@login_required
def leave(match_id: int):
    return _match_action(match_id, mm.leave)


@bp.post("/matches/<int:match_id>/messages")
@login_required
def post_message(match_id: int):
    return _match_action(match_id, mm.post_message, _json().get("text"))
