import pytest

from app.extensions import db
from app.models import User


@pytest.fixture
def signed_in(client):
    user = User(discord_id=1234, username="p")
    db.session.add(user)
    db.session.commit()
    with client.session_transaction() as s:
        s["user_id"] = user.id
    return user


def test_me_requires_auth(client):
    assert client.get("/api/me").status_code == 401
    assert client.patch("/api/me", json={}).status_code == 401


def test_onboarding(client, signed_in):
    res = client.patch(
        "/api/me",
        json={"games": ["nt"], "region": "EU", "gameIds": {"nt": " psn_me ", "012": ""}, "onboarded": True},
    )
    assert res.status_code == 200
    body = res.get_json()
    assert body["games"] == ["nt"]
    assert body["region"] == "EU"
    assert body["gameIds"] == {"nt": "psn_me"}
    assert body["onboarded"] is True


@pytest.mark.parametrize(
    "payload",
    [
        {"games": []},
        {"games": ["ff7"]},
        {"region": "MOON"},
        {"gameIds": {"nt": 5}},
        {"gameIds": {"nt": "x" * 65}},
        {"gameIds": {"halo": "x"}},
    ],
)
def test_validation(client, signed_in, payload):
    res = client.patch("/api/me", json=payload)
    assert res.status_code == 400
    assert db.session.get(User, signed_in.id).region == "NA"


def test_patch_requires_json(client, signed_in):
    assert client.patch("/api/me", data="region=EU").status_code == 415


def test_health(client):
    assert client.get("/api/health").get_json() == {"status": "healthy"}
