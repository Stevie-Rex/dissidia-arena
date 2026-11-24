"""Screenshot upload and fetch for Disputed matches. Thin: the rules live in app.screenshots."""

from flask import Blueprint, jsonify, request, send_file
from werkzeug.exceptions import RequestEntityTooLarge

from .. import admin
from .. import matchmaking as mm
from .. import screenshots
from ..auth import current_user, login_required
from ..extensions import db
from ..models import DisputeScreenshot, Match
from .common import matchmaking_error

bp = Blueprint("screenshots", __name__)
bp.register_error_handler(mm.MatchmakingError, matchmaking_error)

# The one non-JSON POST, so a cross-site HTML form must not be able to send it. A form can't set
# a custom header, and a cross-site script that sets one is stopped by the browser's CORS check.
UPLOAD_HEADER = "X-Arena-Upload"


@bp.errorhandler(RequestEntityTooLarge)
def too_large(_e):
    return jsonify({"error": "too_large", "message": "that upload is too large; screenshots can be up to 5 MB"}), 413


@bp.post("/matches/<int:match_id>/screenshots")
@login_required
def upload(match_id: int):
    if not request.headers.get(UPLOAD_HEADER):
        raise mm.MatchmakingError("csrf", f"uploads need the {UPLOAD_HEADER} header", 403)
    file = request.files.get("file")
    if file is None:
        raise mm.MatchmakingError("validation", "choose an image to upload", 400, {"file": "choose an image to upload"})
    match = mm.lock_match(match_id)
    user = current_user()
    if match is None:
        raise mm.MatchmakingError("not_found", "match not found", 404)
    screenshots.add(match, user, file.read(screenshots.MAX_BYTES + 1))
    db.session.commit()
    resp = jsonify(mm.match_dict(match, user))
    resp.status_code = 201
    return resp


@bp.get("/matches/<int:match_id>/screenshots/<int:shot_id>")
@login_required
def fetch(match_id: int, shot_id: int):
    shot = db.session.get(DisputeScreenshot, shot_id)
    match = db.session.get(Match, match_id)
    user = current_user()
    # Only the two players, Admins and the Master. Everyone else gets the same answer as for a
    # screenshot that doesn't exist, so a guessed ID tells them nothing.
    allowed = match is not None and (user.id in (match.player_a_id, match.player_b_id) or admin.role(user) != "player")
    if shot is None or not allowed or shot.match_id != match.id:
        raise mm.MatchmakingError("not_found", "screenshot not found", 404)
    if shot.removed_at is not None:
        raise mm.MatchmakingError("screenshot_removed", "Screenshot removed after 90 days", 410)
    resp = send_file(screenshots.path(shot), mimetype=shot.content_type, max_age=0)
    resp.headers["X-Content-Type-Options"] = "nosniff"
    resp.headers["Cache-Control"] = "private, no-cache"  # evidence: revalidate every time, never shared
    return resp
