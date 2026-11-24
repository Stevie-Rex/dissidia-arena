"""Admins Voiding a match that is still open (see GLOSSARY.md: Void), apart from the Void Ruling on a Disputed match."""

import pytest

from app import clock
from app.extensions import db
from tests.test_cases import disputed
from tests.test_disputes import reported
from tests.test_queue import NT_BO3, matched_pair, report, started


def void(client, mid, reason="Their opponent never showed up."):
    return client.post(f"/api/admin/matches/{mid}/void", json={"reason": reason})


def pending(make_player):
    return matched_pair(make_player)


def active(make_player):
    return started(make_player)


@pytest.mark.parametrize("make", [pending, active, reported])
def test_an_admin_voids_any_open_match_and_both_players_can_queue_again(make_player, make_admin, make):
    a, ca, b, cb, mid = make(make_player)
    _, admin_client = make_admin()

    res = void(admin_client, mid)
    assert res.status_code == 200 and res.get_json()["status"] == "voided"

    for player_client in (ca, cb):
        body = player_client.get("/api/queue").get_json()
        assert body["match"] is None
        assert player_client.post("/api/queue", json=NT_BO3).status_code == 201
    view = ca.get(f"/api/matches/{mid}").get_json()
    assert view["status"] == "voided" and view["winner"] is None


def test_the_void_is_logged_with_its_reason(make_player, make_admin):
    *_, mid = active(make_player)
    kefka, admin_client = make_admin()
    void(admin_client, mid, "Opponent vanished.")
    (entry, *_) = admin_client.get("/api/admin/log").get_json()["entries"]
    assert (entry["action"], entry["actor"]["id"], entry["matchId"], entry["reason"]) == (
        "void_match",
        kefka.id,
        mid,
        "Opponent vanished.",
    )


def test_voiding_needs_a_reason(make_player, make_admin):
    *_, mid = active(make_player)
    _, admin_client = make_admin()
    res = admin_client.post(f"/api/admin/matches/{mid}/void", json={"reason": "  "})
    assert res.status_code == 400 and res.get_json()["error"] == "reason_required"


def test_a_match_that_isnt_open_cant_be_voided(make_player, make_admin):
    *_, mid = disputed(make_player)  # a Void Ruling is how a Disputed match is voided
    _, admin_client = make_admin()
    res = void(admin_client, mid)
    assert res.status_code == 409 and res.get_json()["error"] == "not_open"

    *_, mid = active(make_player)
    void(admin_client, mid)
    assert void(admin_client, mid).get_json()["error"] == "not_open"  # already voided


def test_players_cant_void_and_unknown_matches_are_not_found(make_player, make_admin):
    a, ca, b, cb, mid = active(make_player)
    assert void(ca, mid).get_json()["error"] == "forbidden"
    _, admin_client = make_admin()
    res = void(admin_client, 9999)
    assert res.status_code == 404 and res.get_json()["error"] == "not_found"


def test_an_admin_cant_void_their_own_match_but_the_master_can(make_player, make_admin, master):
    a, ca, b, cb, mid = active(make_player)
    a.admin_since = clock.now()
    db.session.commit()
    res = void(ca, mid)
    assert res.status_code == 403 and res.get_json()["error"] == "own_match"
    assert ca.get(f"/api/matches/{mid}").get_json()["status"] == "active"

    a2, ca2, b2, cb2, mid2 = active(make_player)
    _, master_client = master
    assert void(master_client, mid2).status_code == 200
