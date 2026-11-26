"""GET/PATCH /api/me/appearance and GET /api/rewards."""

import pytest

from app import rewards
from app.extensions import db
from app.models import UserPreferences


@pytest.fixture
def player(make_player):
    """A signed-in player, plus a helper that sets their wins and grants what those wins earn."""
    user, client = make_player()

    def with_wins(n: int):
        user.ranked_wins = n
        rewards.grant_unlocks(user.id, n)
        db.session.commit()

    return user, client, with_wins


def patch(client, body):
    return client.patch("/api/me/appearance", json=body)


def test_requires_auth(client):
    assert client.get("/api/me/appearance").status_code == 401
    assert client.patch("/api/me/appearance", json={"cursor": "arrow"}).status_code == 401


def test_rewards_catalogue_is_public(client):
    body = client.get("/api/rewards").get_json()
    assert [r["key"] for r in body["rewards"]][:2] == ["classic_interface", "window_crystal"]
    assert body["rewards"][0]["goal"] == 10


def test_new_player_gets_defaults(player):
    _, c, _ = player
    body = c.get("/api/me/appearance").get_json()
    assert body["preferences"] == {
        "interface": "rift", "window_theme": "classic",
        "menu_font": "auto", "cursor": "glove", "window_rgb": [6, 10, 26],
        "rift_mode": "chaos",
    }
    assert body["ranked_wins"] == 0 and body["unlocks"] == []
    assert len(body["rewards"]) == len(rewards.REWARDS)
    assert body["rewards"][0] == {
        "key": "classic_interface", "name": "Classic interface", "goal": 10,
        "unlocks": {"interface": ["classic"], "window_theme": ["classic"]},
        "unlocked": False, "remaining": 10, "percent": 0,
    }
    assert body["next"]["key"] == "classic_interface"
    # Nothing is written until the first save.
    assert db.session.query(UserPreferences).count() == 0


def test_free_choices_save_and_persist(player, make_player):
    user, c, _ = player
    body = patch(c, {"cursor": "arrow", "menu_font": "story"}).get_json()
    assert body["preferences"]["menu_font"] == "story"
    assert body["preferences"]["cursor"] == "arrow"
    # A fresh session for the same user (another device) sees the same choices.
    other = c.application.test_client()
    with other.session_transaction() as s:
        s["user_id"] = user.id
    assert other.get("/api/me/appearance").get_json()["preferences"]["menu_font"] == "story"


def test_classic_locked_at_9_and_open_at_10(player):
    _, c, with_wins = player
    with_wins(9)
    res = patch(c, {"interface": "classic"})
    assert res.status_code == 403
    assert res.get_json() | {"message": None} == {
        "error": "locked", "reward": "classic_interface", "goal": 10, "remaining": 1, "message": None,
    }
    assert c.get("/api/me/appearance").get_json()["preferences"]["interface"] == "rift"

    with_wins(10)
    res = patch(c, {"interface": "classic"})
    assert res.status_code == 200
    assert res.get_json()["preferences"]["interface"] == "classic"
    # Switching back to Rift keeps the Classic choices for next time.
    patch(c, {"menu_font": "modern"})
    body = patch(c, {"interface": "rift"}).get_json()
    assert body["preferences"]["menu_font"] == "modern" and body["preferences"]["window_theme"] == "classic"


@pytest.mark.parametrize(
    "wins, body, reward",
    [
        (14, {"window_theme": "crystal"}, "window_crystal"),
        (44, {"window_theme": "ivalice"}, "window_ivalice"),
        (49, {"menu_font": "bit8"}, "font_8bit"),
        (59, {"window_theme": "custom"}, "window_custom"),
        (59, {"window_rgb": [1, 2, 3]}, "window_custom"),
    ],
)
def test_each_skin_is_locked_until_its_goal(player, wins, body, reward):
    _, c, with_wins = player
    with_wins(wins)
    res = patch(c, body)
    assert res.status_code == 403
    assert res.get_json()["reward"] == reward and res.get_json()["remaining"] == 1
    with_wins(wins + 1)
    assert patch(c, body).status_code == 200


def test_locked_value_in_a_batch_changes_nothing(player):
    _, c, with_wins = player
    with_wins(10)
    assert patch(c, {"cursor": "arrow", "window_theme": "spira"}).status_code == 403
    assert c.get("/api/me/appearance").get_json()["preferences"]["cursor"] == "glove"


def test_lock_is_by_unlock_not_by_win_count(player):
    """The server trusts granted unlocks. Wins without a grant (pre-backfill) don't open anything."""
    user, c, _ = player
    user.ranked_wins = 40
    db.session.commit()
    assert patch(c, {"interface": "classic"}).status_code == 403


def test_custom_rgb_round_trip(player):
    _, c, with_wins = player
    with_wins(60)
    body = patch(c, {"window_theme": "custom", "window_rgb": [31, 0, 12]}).get_json()
    assert body["preferences"]["window_theme"] == "custom"
    assert body["preferences"]["window_rgb"] == [31, 0, 12]
    assert body["next"] is None


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"interface": "nocturne"},
        {"cursor": None},
        {"window_rgb": [0, 0, 32]},
        {"window_rgb": [0, 0, -1]},
        {"window_rgb": [0, 0]},
        {"window_rgb": [True, 0, 0]},
        {"window_rgb": "6,10,26"},
        {"window_rgb": [1.5, 0, 0]},
        {"theme": "dark"},
        {"rift_mode": "dark"},
        {"rift_mode": "light"},
        {"rift_mode": None},
        {"rift_mode": []},
        {"rift_mode": {}},
        {"cursor": ["arrow"]},
    ],
)
def test_bad_values_are_400(player, body):
    _, c, with_wins = player
    with_wins(60)  # everything unlocked, so only shape can fail
    res = patch(c, body)
    assert res.status_code == 400, res.get_json()
    assert res.get_json()["error"] in ("empty", "invalid", "unknown_field")


def test_bad_value_wins_over_locked_value(player):
    _, c, _ = player
    assert patch(c, {"interface": "classic", "cursor": "nope"}).status_code == 400


def test_requires_json(player):
    _, c, _ = player
    res = c.patch("/api/me/appearance", data="cursor=arrow", content_type="application/x-www-form-urlencoded")
    assert res.status_code == 415


def test_world_is_no_longer_a_preference(player):
    """Rift worlds were removed (ADR 0001): the API neither returns nor accepts one."""
    _, c, _ = player
    assert "world" not in c.get("/api/me/appearance").get_json()["preferences"]
    res = patch(c, {"world": "dissidia"})
    assert res.status_code == 400
    assert res.get_json()["error"] == "unknown_field"


def test_rift_mode_is_free_and_persists(player):
    """Chaos mode is the default; Cosmos mode is free for everyone and survives a fresh session."""
    user, c, _ = player
    res = patch(c, {"rift_mode": "cosmos"})
    assert res.status_code == 200
    assert res.get_json()["preferences"]["rift_mode"] == "cosmos"
    other = c.application.test_client()
    with other.session_transaction() as s:
        s["user_id"] = user.id
    assert other.get("/api/me/appearance").get_json()["preferences"]["rift_mode"] == "cosmos"
    assert patch(c, {"rift_mode": "chaos"}).get_json()["preferences"]["rift_mode"] == "chaos"
