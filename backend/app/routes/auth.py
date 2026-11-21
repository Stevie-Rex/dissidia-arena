"""Discord OAuth2 (authorization code grant) sign-in.

Flow:
  1. GET  /api/auth/discord/login?next=/queue  -> redirect to Discord's consent screen
  2. GET  /api/auth/discord/callback?code&state -> exchange code, upsert user, set session,
                                                  redirect to the frontend
  3. POST /api/auth/logout                     -> clear session
"""

import secrets
from datetime import datetime, timezone
from urllib.parse import urlencode

import requests
from flask import Blueprint, abort, current_app, jsonify, redirect, request, session

from ..extensions import db
from ..models import User

bp = Blueprint("auth", __name__)

DISCORD_AUTHORIZE_URL = "https://discord.com/oauth2/authorize"
DISCORD_TOKEN_URL = "https://discord.com/api/oauth2/token"
DISCORD_ME_URL = "https://discord.com/api/users/@me"
SCOPES = "identify"  # username + avatar only, as promised on the sign-in modal
HTTP_TIMEOUT = 10


def _safe_next(value: str | None) -> str:
    """Only allow same-site relative paths, to avoid an open redirect."""
    if value and value.startswith("/") and not value.startswith("//") and "\\" not in value:
        return value
    return "/"


def _frontend(path: str) -> str:
    return current_app.config["FRONTEND_URL"].rstrip("/") + path


@bp.get("/discord/login")
def discord_login():
    cfg = current_app.config
    if not cfg["DISCORD_CLIENT_ID"] or not cfg["DISCORD_CLIENT_SECRET"]:
        return jsonify({"error": "Discord OAuth is not configured"}), 503

    state = secrets.token_urlsafe(32)
    session["oauth_state"] = state
    session["oauth_next"] = _safe_next(request.args.get("next"))

    params = {
        "client_id": cfg["DISCORD_CLIENT_ID"],
        "redirect_uri": cfg["DISCORD_REDIRECT_URI"],
        "response_type": "code",
        "scope": SCOPES,
        "state": state,
        "prompt": "none",  # skip the consent screen if already authorised
    }
    return redirect(f"{DISCORD_AUTHORIZE_URL}?{urlencode(params)}")


@bp.get("/discord/callback")
def discord_callback():
    expected_state = session.pop("oauth_state", None)
    next_path = session.pop("oauth_next", "/")

    # User pressed "Cancel" on Discord's consent screen.
    if request.args.get("error"):
        return redirect(_frontend(f"{next_path}{'&' if '?' in next_path else '?'}auth_error=denied"))

    state = request.args.get("state", "")
    code = request.args.get("code")
    if not expected_state or not secrets.compare_digest(state, expected_state) or not code:
        abort(400, "Invalid OAuth state")

    try:
        profile = _fetch_discord_profile(code)
    except requests.RequestException:
        current_app.logger.exception("Discord OAuth exchange failed")
        return redirect(_frontend("/?auth_error=discord"))

    user = _upsert_user(profile)

    # Fresh session on login (prevents session fixation).
    session.clear()
    session["user_id"] = user.id
    session.permanent = True

    return redirect(_frontend("/welcome" if not user.onboarded else next_path))


@bp.post("/logout")
def logout():
    session.clear()
    return "", 204


def _fetch_discord_profile(code: str) -> dict:
    cfg = current_app.config
    token_res = requests.post(
        DISCORD_TOKEN_URL,
        data={
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": cfg["DISCORD_REDIRECT_URI"],
        },
        auth=(cfg["DISCORD_CLIENT_ID"], cfg["DISCORD_CLIENT_SECRET"]),
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=HTTP_TIMEOUT,
    )
    token_res.raise_for_status()
    access_token = token_res.json()["access_token"]

    me_res = requests.get(
        DISCORD_ME_URL,
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=HTTP_TIMEOUT,
    )
    me_res.raise_for_status()
    return me_res.json()


def _upsert_user(profile: dict) -> User:
    discord_id = int(profile["id"])
    user = db.session.execute(db.select(User).filter_by(discord_id=discord_id)).scalar_one_or_none()
    if user is None:
        user = User(discord_id=discord_id)
        db.session.add(user)

    # Keep name/avatar in sync with Discord on every login.
    user.username = profile["username"]
    user.display_name = profile.get("global_name")
    user.avatar_hash = profile.get("avatar")
    user.last_login_at = datetime.now(timezone.utc).replace(tzinfo=None)
    db.session.commit()
    return user
