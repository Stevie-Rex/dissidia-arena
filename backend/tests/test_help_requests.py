"""Help requests (see GLOSSARY.md: Help request): a player asks the Admins about one of their matches,
and the Admins Claim and close it."""

from datetime import timedelta

import pytest

from app import clock
from app.extensions import db
from tests.test_cases import disputed
from tests.test_disputes import reported
from tests.test_queue import matched_pair, started


def ask(client, mid, message="My opponent vanished mid-match."):
    return client.post(f"/api/matches/{mid}/help", json={"message": message})


def completed(make_player):
    a, ca, b, cb, mid = reported(make_player)
    assert cb.post(f"/api/matches/{mid}/confirm").get_json()["status"] == "completed"
    return a, ca, b, cb, mid


def days_later(monkeypatch, days, seconds=0):
    later = clock.now() + timedelta(days=days, seconds=seconds)
    monkeypatch.setattr(clock, "now", lambda: later)


# ---------------------------------------------------------------- asking


@pytest.mark.parametrize("make", [matched_pair, started, reported, completed])
def test_a_player_can_ask_an_admin_about_an_open_or_completed_match(make_player, make):
    a, ca, b, cb, mid = make(make_player)
    assert ca.get(f"/api/matches/{mid}").get_json()["canAskAdmin"] is True

    res = ask(ca, mid)
    assert res.status_code == 201
    body = res.get_json()
    assert body["canAskAdmin"] is False  # one at a time
    assert body["helpRequest"]["message"] == "My opponent vanished mid-match." and body["helpRequest"]["at"]
    assert cb.get(f"/api/matches/{mid}").get_json()["helpRequest"] is None  # the opponent's own view is unaffected
    assert cb.get(f"/api/matches/{mid}").get_json()["canAskAdmin"] is True


def test_a_second_request_waits_until_the_first_is_closed(make_player):
    *_, ca, _, _, mid = started(make_player)
    ask(ca, mid)
    res = ask(ca, mid, "Hello?")
    assert res.status_code == 409 and res.get_json()["error"] == "help_already_asked"


def test_the_opponent_can_ask_too(make_player):
    *_, cb, mid = started(make_player)
    assert ask(cb, mid).status_code == 201


@pytest.mark.parametrize("message", [None, "", "   ", "x" * 501, 7])
def test_the_message_is_short_and_required(make_player, message):
    *_, ca, _, _, mid = started(make_player)
    res = ask(ca, mid, message)
    assert res.status_code == 400 and "message" in res.get_json()["fields"]
    assert ca.get(f"/api/matches/{mid}").get_json()["canAskAdmin"] is True


def test_only_a_player_in_the_match_can_ask(make_player):
    *_, mid = started(make_player)
    _, stranger = make_player()
    assert ask(stranger, mid).status_code == 404


def test_you_cant_ask_about_a_disputed_voided_or_cancelled_match(make_player, make_admin):
    a, ca, b, cb, mid = disputed(make_player)
    res = ask(ca, mid)
    assert res.status_code == 409 and res.get_json()["error"] == "help_unavailable"
    assert ca.get(f"/api/matches/{mid}").get_json()["canAskAdmin"] is False

    a, ca, b, cb, mid = started(make_player)
    _, admin_client = make_admin()
    admin_client.post(f"/api/admin/matches/{mid}/void", json={"reason": "stuck"})
    assert ask(ca, mid).get_json()["error"] == "help_unavailable"

    a, ca, b, cb, mid = matched_pair(make_player)
    cb.post(f"/api/matches/{mid}/decline")
    assert ask(ca, mid).get_json()["error"] == "help_unavailable"


def test_a_completed_match_can_be_asked_about_for_90_days(make_player, monkeypatch):
    a, ca, b, cb, mid = completed(make_player)
    days_later(monkeypatch, 89, 23 * 3600)
    assert ca.get(f"/api/matches/{mid}").get_json()["canAskAdmin"] is True
    days_later(monkeypatch, 90, 1)
    assert ca.get(f"/api/matches/{mid}").get_json()["canAskAdmin"] is False
    res = ask(ca, mid)
    assert res.status_code == 409 and res.get_json()["error"] == "help_unavailable"


# ---------------------------------------------------------------- the Admins' side


def raised(make_player, make=started, message="My opponent vanished mid-match."):
    """A Help request from player A on a match. Returns (a, ca, b, cb, match id, help request id)."""
    a, ca, b, cb, mid = make(make_player)
    hid = ask(ca, mid, message).get_json()["helpRequest"]["id"]
    return a, ca, b, cb, mid, hid


def cases(client, **params):
    return client.get("/api/admin/cases", query_string=params).get_json()["cases"]


def help_case(client, hid):
    return client.get(f"/api/admin/help-requests/{hid}")


def help_act(client, hid, what, **body):
    return client.post(f"/api/admin/help-requests/{hid}/{what}", json=body or None)


def test_help_requests_sit_in_the_case_list_beside_disputed_matches(make_player, make_admin):
    *_, dmid = disputed(make_player)
    a, ca, b, cb, mid, hid = raised(make_player)
    _, admin_client = make_admin()

    rows = cases(admin_client)
    assert [(r["kind"], r["matchId"]) for r in rows] == [("dispute", dmid), ("help", mid)]
    help_row = rows[1]
    assert help_row["helpRequestId"] == hid and help_row["message"] == "My opponent vanished mid-match."
    assert help_row["askedBy"] == {"id": a.id, "displayName": a.username} and help_row["askedAt"]
    assert help_row["players"] == [a.username, b.username] and help_row["claim"] is None


def test_players_cant_see_or_open_help_requests(make_player):
    a, ca, b, cb, mid, hid = raised(make_player)
    assert ca.get("/api/admin/cases").get_json()["error"] == "forbidden"
    assert help_case(ca, hid).get_json()["error"] == "forbidden"
    assert help_act(ca, hid, "claim").get_json()["error"] == "forbidden"


def test_the_help_request_page_shows_the_match_and_the_message(make_player, make_admin):
    a, ca, b, cb, mid, hid = raised(make_player)
    _, admin_client = make_admin()
    page = help_case(admin_client, hid).get_json()
    assert page["kind"] == "help" and page["helpRequestId"] == hid and page["message"].startswith("My opponent")
    assert page["match"]["id"] == mid and page["match"]["status"] == "active" and page["match"]["canVoid"] is True
    assert [p["id"] for p in page["match"]["players"]] == [a.id, b.id]
    assert page["canAct"] is False and page["closed"] is None
    assert help_case(admin_client, 9999).status_code == 404


def test_claim_release_and_takeover_work_as_they_do_for_disputes(make_player, make_admin, master):
    a, ca, b, cb, mid, hid = raised(make_player)
    kefka, c1 = make_admin()
    _, c2 = make_admin()
    m, mc = master

    mine = help_act(c1, hid, "claim").get_json()
    assert mine["claim"]["by"]["id"] == kefka.id and mine["claim"]["byYou"] and mine["canAct"]
    assert help_act(c1, hid, "claim").status_code == 200  # claiming your own Claim again changes nothing
    res = help_act(c2, hid, "claim")
    assert res.status_code == 409 and res.get_json()["error"] == "already_claimed"
    assert cases(c2)[0]["claim"]["by"]["id"] == kefka.id
    assert [r["helpRequestId"] for r in cases(c2, claimed="yes")] == [hid] and cases(c2, claimed="no") == []

    res = help_act(c2, hid, "release")
    assert res.status_code == 403 and res.get_json()["error"] == "not_claimed_by_you"
    assert help_act(c1, hid, "release").get_json()["claim"] is None

    help_act(c1, hid, "claim")
    assert help_act(c1, hid, "takeover").get_json()["error"] == "forbidden"
    assert help_act(mc, hid, "takeover").get_json()["claim"]["by"]["id"] == m.id
    assert help_act(mc, hid, "release").get_json()["claim"] is None
    help_act(c1, hid, "claim")
    assert help_act(mc, hid, "release").get_json()["claim"] is None  # the Master can release any Claim


def test_an_admin_cant_claim_or_close_a_request_about_their_own_match_but_the_master_can(
    make_player, make_admin, master
):
    a, ca, b, cb, mid, hid = raised(make_player)
    a.admin_since = clock.now()
    db.session.commit()
    res = help_act(ca, hid, "claim")
    assert res.status_code == 403 and res.get_json()["error"] == "own_match"
    res = help_act(ca, hid, "close", reason="it's fine now")
    assert res.status_code == 403 and res.get_json()["error"] == "own_match"

    _, mc = master
    assert help_act(mc, hid, "close", reason="Passed on.").status_code == 200


def test_closing_needs_the_claim_and_a_reason(make_player, make_admin, master):
    a, ca, b, cb, mid, hid = raised(make_player)
    _, c1 = make_admin()
    _, c2 = make_admin()
    _, mc = master

    res = help_act(c1, hid, "close", reason="Sorted out.")
    assert res.status_code == 403 and res.get_json()["error"] == "not_claimed_by_you"
    help_act(c1, hid, "claim")
    res = help_act(c2, hid, "close", reason="Sorted out.")
    assert res.status_code == 403 and res.get_json()["error"] == "not_claimed_by_you"
    for reason in (None, "", "  "):
        assert help_act(c1, hid, "close", reason=reason).get_json()["error"] == "reason_required"
    assert cases(c1)[0]["helpRequestId"] == hid  # still open

    done = help_act(c1, hid, "close", reason="Told them to rematch. Passing the cheating claim to the Master.")
    assert done.status_code == 200 and done.get_json()["closed"]["reason"].startswith("Told them")
    assert cases(c1) == []

    for what in ("claim", "release", "takeover"):
        res = help_act(mc, hid, what)
        assert res.status_code == 409 and res.get_json()["error"] == "already_closed"
    assert help_act(c1, hid, "close", reason="again").get_json()["error"] == "already_closed"


def test_the_master_can_close_a_request_nobody_claimed(make_player, master):
    a, ca, b, cb, mid, hid = raised(make_player)
    _, mc = master
    assert help_act(mc, hid, "close", reason="Handled it myself.").status_code == 200


def test_a_closed_request_lets_the_player_ask_again_and_the_reason_stays_private(make_player, make_admin):
    a, ca, b, cb, mid, hid = raised(make_player)
    _, c = make_admin()
    help_act(c, hid, "claim")
    help_act(c, hid, "close", reason="Private note for the Master.")
    view = ca.get(f"/api/matches/{mid}").get_json()
    assert view["helpRequest"] is None and view["canAskAdmin"] is True
    assert "Private note" not in str(view)
    assert ask(ca, mid, "Another problem.").status_code == 201


def test_every_help_request_action_is_in_the_admin_log(make_player, make_admin, master):
    a, ca, b, cb, mid, hid = raised(make_player)
    kefka, c = make_admin()
    m, mc = master
    help_act(c, hid, "claim")
    help_act(mc, hid, "takeover")
    help_act(mc, hid, "release")
    help_act(c, hid, "claim")
    help_act(c, hid, "close", reason="Done.")
    entries = mc.get("/api/admin/log").get_json()["entries"]
    assert [(e["action"], e["actor"]["id"], e["matchId"], e["details"]["helpRequestId"]) for e in entries[:5]] == [
        ("close_help_request", kefka.id, mid, hid),
        ("claim", kefka.id, mid, hid),
        ("release_claim", m.id, mid, hid),
        ("take_over_claim", m.id, mid, hid),
        ("claim", kefka.id, mid, hid),
    ]
    assert entries[0]["reason"] == "Done."


def test_removing_an_admin_releases_their_help_request_claims(make_player, make_admin, master):
    a, ca, b, cb, mid, hid = raised(make_player)
    kefka, c = make_admin()
    _, mc = master
    help_act(c, hid, "claim")
    assert mc.post(f"/api/admin/admins/{kefka.id}/remove", json={"reason": "Inactive."}).status_code == 200
    assert help_case(mc, hid).get_json()["claim"] is None


def test_an_admin_can_void_the_match_from_its_help_request(make_player, make_admin):
    a, ca, b, cb, mid, hid = raised(make_player)
    _, c = make_admin()
    res = c.post(f"/api/admin/matches/{mid}/void", json={"reason": "Opponent vanished."})
    assert res.status_code == 200
    page = help_case(c, hid).get_json()
    assert page["match"]["status"] == "voided" and page["match"]["canVoid"] is False
    assert page["closed"] is None  # voiding doesn't close the request: that is the Admin's call
