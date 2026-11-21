"""Helpers shared by the routes that call the rules modules (matchmaking, admin)."""

from flask import jsonify, request

from .. import matchmaking as mm
from ..extensions import db


def matchmaking_error(e: mm.MatchmakingError):
    """The rules modules' structured error, as {"error": code, "message", "fields"?}. Register per blueprint."""
    db.session.rollback()
    body = {"error": e.code, "message": e.message}
    if e.fields:
        body["fields"] = e.fields
    return jsonify(body), e.status


def json_body() -> dict:
    # Requiring JSON means a cross-site HTML form can't hit these endpoints.
    if not request.is_json:
        raise mm.MatchmakingError("unsupported_media_type", "expected application/json", 415)
    data = request.get_json(silent=True)
    return data if isinstance(data, dict) else {}
