from unittest.mock import MagicMock, patch
from urllib.parse import parse_qs, urlparse

import pytest
import requests

from app.extensions import db
from app.models import User

DISCORD_PROFILE = {"id": "80351110224678912", "username": "nelly", "global_name": "Nelly", "avatar": "abc123"}


def _start_login(client, next_path="/queue"):
    res = client.get(f"/api/auth/discord/login?next={next_path}")
    assert res.status_code == 302
    return parse_qs(urlparse(res.headers["Location"]).query)["state"][0]


def _mock_discord(profile=DISCORD_PROFILE):
    token = MagicMock(json=lambda: {"access_token": "tok"}, raise_for_status=lambda: None)
    me = MagicMock(json=lambda: profile, raise_for_status=lambda: None)
    return patch("app.routes.auth.requests.post", return_value=token), patch(
        "app.routes.auth.requests.get", return_value=me
    )


def test_login_redirects_to_discord_with_state(client):
    res = client.get("/api/auth/discord/login")
    url = urlparse(res.headers["Location"])
    q = parse_qs(url.query)
    assert url.netloc == "discord.com"
    assert q["client_id"] == ["client-id"]
    assert q["scope"] == ["identify"]
    assert q["redirect_uri"] == ["http://localhost:5173/api/auth/discord/callback"]
    assert len(q["state"][0]) > 30


def test_login_503_when_not_configured(app, client):
    app.config["DISCORD_CLIENT_ID"] = ""
    assert client.get("/api/auth/discord/login").status_code == 503


def test_callback_creates_user_and_sends_new_users_to_welcome(client):
    state = _start_login(client)
    post, get = _mock_discord()
    with post, get:
        res = client.get(f"/api/auth/discord/callback?code=c&state={state}")
    assert res.status_code == 302
    assert res.headers["Location"] == "http://localhost:5173/welcome"

    me = client.get("/api/me").get_json()
    assert me["username"] == "nelly"
    assert me["displayName"] == "Nelly"
    assert me["discordId"] == "80351110224678912"
    assert me["avatarUrl"].endswith("/80351110224678912/abc123.png?size=128")
    assert me["onboarded"] is False


def test_returning_user_goes_to_next_and_profile_is_refreshed(client):
    db.session.add(User(discord_id=int(DISCORD_PROFILE["id"]), username="old", onboarded=True))
    db.session.commit()

    state = _start_login(client, "/nt/ladder")
    post, get = _mock_discord()
    with post, get:
        res = client.get(f"/api/auth/discord/callback?code=c&state={state}")
    assert res.headers["Location"] == "http://localhost:5173/nt/ladder"
    assert db.session.execute(db.select(User)).scalars().one().username == "nelly"


def test_callback_rejects_bad_state(client):
    _start_login(client)
    assert client.get("/api/auth/discord/callback?code=c&state=wrong").status_code == 400


def test_callback_rejects_missing_session_state(client):
    assert client.get("/api/auth/discord/callback?code=c&state=x").status_code == 400


def test_state_is_single_use(client):
    state = _start_login(client)
    post, get = _mock_discord()
    with post, get:
        client.get(f"/api/auth/discord/callback?code=c&state={state}")
        assert client.get(f"/api/auth/discord/callback?code=c&state={state}").status_code == 400


def test_user_denied_consent(client):
    _start_login(client, "/queue")
    res = client.get("/api/auth/discord/callback?error=access_denied")
    assert res.headers["Location"] == "http://localhost:5173/queue?auth_error=denied"
    assert client.get("/api/me").status_code == 401


def test_discord_failure_redirects_with_error(client):
    state = _start_login(client)
    with patch("app.routes.auth.requests.post", side_effect=requests.ConnectionError):
        res = client.get(f"/api/auth/discord/callback?code=c&state={state}")
    assert res.headers["Location"] == "http://localhost:5173/?auth_error=discord"


@pytest.mark.parametrize("bad", ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)"])
def test_next_cannot_redirect_off_site(client, bad):
    db.session.add(User(discord_id=int(DISCORD_PROFILE["id"]), username="x", onboarded=True))
    db.session.commit()
    state = _start_login(client, bad)
    post, get = _mock_discord()
    with post, get:
        res = client.get(f"/api/auth/discord/callback?code=c&state={state}")
    assert res.headers["Location"] == "http://localhost:5173/"


def test_logout(client):
    state = _start_login(client)
    post, get = _mock_discord()
    with post, get:
        client.get(f"/api/auth/discord/callback?code=c&state={state}")
    assert client.get("/api/me").status_code == 200
    assert client.post("/api/auth/logout").status_code == 204
    assert client.get("/api/me").status_code == 401
