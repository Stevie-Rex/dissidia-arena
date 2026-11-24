"""Admin and Master endpoints. Thin: the rules live in app.admin."""

from flask import Blueprint, jsonify, request

from .. import admin, admin_log, cases
from .. import matchmaking as mm
from ..auth import admin_required, current_user, master_required
from ..extensions import db
from .common import json_body, matchmaking_error
from .me import me_dict

bp = Blueprint("admin", __name__)
bp.register_error_handler(mm.MatchmakingError, matchmaking_error)


def _admins():
    return jsonify({"admins": [admin.admin_dict(u) for u in admin.admins()]})


@bp.get("/admin/players")
@master_required
def search_players():
    return jsonify({"players": [admin.player_dict(u) for u in admin.search_players(request.args.get("q", ""))]})


@bp.get("/admin/admins")
@master_required
def list_admins():
    return _admins()


@bp.post("/admin/admins")
@master_required
def appoint():
    data = json_body()
    admin.appoint(current_user(), data.get("userId"), data.get("reason"))
    db.session.commit()
    resp = _admins()
    resp.status_code = 201
    return resp


# POST, not DELETE: the reason is required, and some proxies drop DELETE request bodies.
@bp.post("/admin/admins/<int:user_id>/remove")
@master_required
def remove(user_id: int):
    admin.remove(current_user(), user_id, json_body().get("reason"))
    db.session.commit()
    return _admins()


@bp.post("/admin/step-down")
@admin_required
def step_down():
    user = current_user()
    admin.step_down(user, json_body().get("reason"))
    db.session.commit()
    return jsonify(me_dict(user))


@bp.get("/admin/log")
@admin_required
def read_log():
    return jsonify(admin_log.page(max(1, request.args.get("page", 1, type=int))))


# ---------------------------------------------------------------- cases


@bp.get("/admin/cases")
@admin_required
def list_cases():
    user = current_user()
    claimed = {"yes": True, "no": False}.get(request.args.get("claimed", ""))
    return jsonify({"cases": cases.case_list(user, claimed)})


@bp.get("/admin/disputes/<int:match_id>")
@admin_required
def get_case(match_id: int):
    return jsonify(cases.case_dict(cases.find_case(match_id), current_user()))


def _case_action(match_id: int, action):
    """Run a case action (see cases.act for the locking), commit, and return the case page."""
    user = current_user()
    match = cases.act(match_id, user, action)
    db.session.commit()
    return jsonify(cases.case_dict(match, user))


@bp.post("/admin/disputes/<int:match_id>/claim")
@admin_required
def claim(match_id: int):
    return _case_action(match_id, cases.claim)


@bp.post("/admin/disputes/<int:match_id>/release")
@admin_required
def release(match_id: int):
    return _case_action(match_id, cases.release)


@bp.post("/admin/disputes/<int:match_id>/takeover")
@master_required
def take_over(match_id: int):
    return _case_action(match_id, cases.take_over)


@bp.post("/admin/disputes/<int:match_id>/ruling")
@admin_required
def rule(match_id: int):
    data = json_body()
    return _case_action(match_id, lambda m, u: cases.rule(m, u, data.get("outcome"), data.get("reason"), data.get("games"), data.get("fromGame")))


@bp.post("/admin/matches/<int:match_id>/void")
@admin_required
def void_match(match_id: int):
    """Void a match that is still open. Returns the case view of the match, as the Rulings do."""
    user = current_user()
    reason = json_body().get("reason")
    match = cases.act_on_match(match_id, user, lambda m, u: cases.void_open(m, u, reason))
    db.session.commit()
    return jsonify(cases.case_dict(match, user))


# ---------------------------------------------------------------- Help requests


@bp.get("/admin/help-requests/<int:help_request_id>")
@admin_required
def get_help_request(help_request_id: int):
    return jsonify(cases.help_case_dict(cases.find_help_request(help_request_id), current_user()))


def _help_action(help_request_id: int, action):
    """Run a Help request action (see cases.act_on_help_request for the locking), commit, and return its page."""
    user = current_user()
    help_request = cases.act_on_help_request(help_request_id, user, action)
    db.session.commit()
    return jsonify(cases.help_case_dict(help_request, user))


@bp.post("/admin/help-requests/<int:help_request_id>/claim")
@admin_required
def claim_help_request(help_request_id: int):
    return _help_action(help_request_id, cases.claim)


@bp.post("/admin/help-requests/<int:help_request_id>/release")
@admin_required
def release_help_request(help_request_id: int):
    return _help_action(help_request_id, cases.release)


@bp.post("/admin/help-requests/<int:help_request_id>/takeover")
@master_required
def take_over_help_request(help_request_id: int):
    return _help_action(help_request_id, cases.take_over)


@bp.post("/admin/help-requests/<int:help_request_id>/close")
@admin_required
def close_help_request(help_request_id: int):
    reason = json_body().get("reason")
    return _help_action(help_request_id, lambda h, u: cases.close_help_request(h, u, reason))
