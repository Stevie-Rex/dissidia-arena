"""The Master and Admin roles, the Master panel endpoints, stepping down, and reading the Admin log."""

import logging

import pytest

from app import admin_log, create_app
from app.extensions import db
from tests.conftest import TestConfig


def role(client):
    return client.get("/api/me").get_json()["role"]


def appoint(client, user_id, reason="Trusted regular"):
    return client.post("/api/admin/admins", json={"userId": user_id, "reason": reason})


def remove(client, user_id, reason="Inactive"):
    return client.post(f"/api/admin/admins/{user_id}/remove", json={"reason": reason})


def log(client, page=1):
    return client.get(f"/api/admin/log?page={page}")


# ---------------------------------------------------------------- roles


def test_the_configured_discord_id_is_the_master(master, make_player):
    _, master_client = master
    _, player_client = make_player()
    assert role(master_client) == "master"
    assert role(player_client) == "player"


def test_an_appointed_admin_has_the_admin_role(make_admin):
    _, client = make_admin()
    assert role(client) == "admin"


def test_startup_warns_when_no_master_is_configured(caplog):
    class NoMaster(TestConfig):
        MASTER_DISCORD_ID = ""

    with caplog.at_level(logging.WARNING):
        create_app(NoMaster)
    assert any("MASTER_DISCORD_ID" in r.getMessage() for r in caplog.records)


# ---------------------------------------------------------------- Master panel


def test_only_the_master_can_use_the_master_panel(master, make_admin, make_player, client):
    target, _ = make_player()
    admin, admin_client = make_admin()
    _, player_client = make_player()
    for c in (admin_client, player_client):
        assert c.get("/api/admin/players?q=p").get_json()["error"] == "forbidden"
        assert c.get("/api/admin/admins").status_code == 403
        assert appoint(c, target.id).get_json()["error"] == "forbidden"
        assert remove(c, admin.id).status_code == 403
    signed_out = client.get("/api/admin/admins")
    assert (signed_out.status_code, signed_out.get_json()["error"]) == (401, "unauthenticated")
    assert signed_out.get_json()["message"]
    assert master[1].get("/api/admin/admins").status_code == 200
    assert role(admin_client) == "admin"


def test_the_master_searches_players_by_discord_name(master, make_player):
    _, master_client = master
    ash, _ = make_player()
    ash.username, ash.display_name = "ashe", "Ashe of Light"
    other, _ = make_player()
    other.username = "kefka"
    db.session.commit()

    found = master_client.get("/api/admin/players?q=LIGHT").get_json()["players"]
    assert [(p["id"], p["displayName"], p["role"]) for p in found] == [(ash.id, "Ashe of Light", "player")]
    assert [p["id"] for p in master_client.get("/api/admin/players?q=ash").get_json()["players"]] == [ash.id]
    assert master_client.get("/api/admin/players?q=%20").get_json()["players"] == []


def test_the_master_appoints_an_admin_with_a_reason(master, make_player):
    _, master_client = master
    target, target_client = make_player()
    assert role(target_client) == "player"

    res = appoint(master_client, target.id, "Runs the NT community")
    assert res.status_code == 201
    assert [a["id"] for a in res.get_json()["admins"]] == [target.id]
    assert role(target_client) == "admin"
    assert [a["id"] for a in master_client.get("/api/admin/admins").get_json()["admins"]] == [target.id]

    (entry,) = log(master_client).get_json()["entries"]
    assert entry["action"] == "appoint_admin"
    assert entry["actor"]["id"] == master[0].id
    assert entry["target"]["id"] == target.id
    assert entry["reason"] == "Runs the NT community"


@pytest.mark.parametrize("body", [{}, {"reason": ""}, {"reason": "   "}, {"reason": None}])
def test_appointing_and_removing_need_a_reason(master, make_player, make_admin, body):
    _, master_client = master
    target, target_client = make_player()
    admin, admin_client = make_admin()

    res = master_client.post("/api/admin/admins", json={"userId": target.id, **body})
    assert (res.status_code, res.get_json()["error"]) == (400, "reason_required")
    res = master_client.post(f"/api/admin/admins/{admin.id}/remove", json=body)
    assert (res.status_code, res.get_json()["error"]) == (400, "reason_required")

    assert role(target_client) == "player"
    assert role(admin_client) == "admin"
    assert log(master_client).get_json()["entries"] == []


def test_only_players_who_exist_can_be_appointed(master):
    _, master_client = master
    res = appoint(master_client, 999_999)
    assert (res.status_code, res.get_json()["error"]) == (404, "not_found")
    res = master_client.post("/api/admin/admins", json={"userId": "1", "reason": "x"})
    assert res.status_code == 404


def test_appointing_an_admin_twice_is_refused(master, make_admin):
    admin, _ = make_admin()
    res = appoint(master[1], admin.id)
    assert (res.status_code, res.get_json()["error"]) == (409, "already_admin")


def test_a_removed_admin_loses_access_on_their_next_request(master, make_admin):
    _, master_client = master
    admin, admin_client = make_admin()
    assert log(admin_client).status_code == 200

    res = remove(master_client, admin.id, "Stepped away from the scene")
    assert (res.status_code, res.get_json()["admins"]) == (200, [])

    assert role(admin_client) == "player"
    assert log(admin_client).get_json()["error"] == "forbidden"
    (entry,) = log(master_client).get_json()["entries"]
    assert (entry["action"], entry["target"]["id"], entry["reason"]) == (
        "remove_admin",
        admin.id,
        "Stepped away from the scene",
    )


def test_removing_someone_who_is_not_an_admin_is_refused(master, make_player):
    target, _ = make_player()
    res = remove(master[1], target.id)
    assert (res.status_code, res.get_json()["error"]) == (409, "not_admin")


def test_an_admin_can_step_down(make_admin, master):
    admin, admin_client = make_admin()
    res = admin_client.post("/api/admin/step-down", json={"reason": "Taking a break"})
    assert (res.status_code, res.get_json()["role"]) == (200, "player")
    assert log(admin_client).status_code == 403

    (entry,) = log(master[1]).get_json()["entries"]
    assert (entry["action"], entry["actor"]["id"], entry["target"]["id"], entry["reason"]) == (
        "step_down",
        admin.id,
        admin.id,
        "Taking a break",
    )


def test_stepping_down_needs_a_reason(make_admin):
    _, admin_client = make_admin()
    res = admin_client.post("/api/admin/step-down", json={})
    assert res.get_json()["error"] == "reason_required"
    assert role(admin_client) == "admin"


def test_players_cannot_step_down(make_player):
    _, client = make_player()
    assert client.post("/api/admin/step-down", json={"reason": "x"}).get_json()["error"] == "forbidden"


def test_the_master_cannot_be_removed_or_demoted(master):
    me, master_client = master
    for res in (
        remove(master_client, me.id),
        appoint(master_client, me.id),
        master_client.post("/api/admin/step-down", json={"reason": "x"}),
    ):
        assert (res.status_code, res.get_json()["error"]) == (403, "forbidden")
    assert role(master_client) == "master"
    assert log(master_client).get_json()["entries"] == []


def test_the_master_stays_master_even_if_once_appointed_as_admin(master):
    me, master_client = master
    me.admin_since = me.created_at
    db.session.commit()
    res = remove(master_client, me.id)
    assert (res.status_code, res.get_json()["error"]) == (403, "forbidden")
    assert role(master_client) == "master"
    assert master_client.get("/api/admin/admins").get_json()["admins"] == []


def test_master_panel_writes_need_json(master, make_player):
    target, _ = make_player()
    res = master[1].post("/api/admin/admins", data={"userId": target.id, "reason": "x"})
    assert res.status_code == 415


# ---------------------------------------------------------------- Admin log


def test_admins_and_the_master_read_the_admin_log_and_players_cannot(master, make_admin, make_player, client):
    _, admin_client = make_admin()
    _, player_client = make_player()
    assert log(admin_client).status_code == 200
    assert log(master[1]).status_code == 200
    assert log(player_client).get_json()["error"] == "forbidden"
    assert log(client).status_code == 401


def test_the_admin_log_is_paginated_newest_first(master):
    _, master_client = master
    for i in range(1, admin_log.PAGE_SIZE + 3):
        admin_log.record("auto_confirm", f"entry {i}")
    db.session.commit()

    first = log(master_client, 1).get_json()
    assert len(first["entries"]) == admin_log.PAGE_SIZE
    assert first["entries"][0]["reason"] == f"entry {admin_log.PAGE_SIZE + 2}"
    assert first["entries"][0]["actor"] is None  # a system action
    assert (first["page"], first["hasMore"]) == (1, True)

    second = log(master_client, 2).get_json()
    assert [e["reason"] for e in second["entries"]] == ["entry 2", "entry 1"]
    assert (second["page"], second["hasMore"]) == (2, False)

    assert log(master_client, 0).get_json()["page"] == 1
    assert master_client.get("/api/admin/log?page=abc").get_json()["page"] == 1


def test_the_admin_log_cannot_be_edited_or_deleted(master):
    _, master_client = master
    admin_log.record("auto_confirm", "keep me")
    db.session.commit()
    (entry,) = log(master_client).get_json()["entries"]
    for method in ("put", "patch", "delete"):
        for path in (f"/api/admin/log/{entry['id']}", "/api/admin/log"):
            res = getattr(master_client, method)(path, json={"reason": "changed"})
            assert res.status_code in (404, 405)
    assert log(master_client).get_json()["entries"][0]["reason"] == "keep me"
