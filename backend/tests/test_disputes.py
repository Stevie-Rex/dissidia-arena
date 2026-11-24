"""Disputing a reported result: the dispute form, and both players' statements."""

import pytest

from app.extensions import db
from app.models import Match

from tests.test_queue import report, started


def reported(make_player):
    """A Bo3 that A reported 2-1 in A's favour. B is the one who can dispute."""
    a, ca, b, cb, mid = started(make_player)
    report(ca, mid, 1, a)
    report(ca, mid, 2, b)
    assert report(ca, mid, 3, a).get_json()["status"] == "reported"
    return a, ca, b, cb, mid


def dispute(client, mid, games=(3,), reason="Game 3 was mine, they misclicked."):
    return client.post(f"/api/matches/{mid}/dispute", json={"games": list(games), "reason": reason})


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"games": [3]},
        {"reason": "they lied"},
        {"games": [], "reason": "they lied"},
        {"games": [3], "reason": "   "},
        {"games": "3", "reason": "they lied"},
        {"games": [True], "reason": "they lied"},
    ],
)
def test_dispute_needs_games_and_a_reason(make_player, body):
    *_, cb, mid = reported(make_player)
    res = cb.post(f"/api/matches/{mid}/dispute", json=body)
    assert res.status_code == 400 and res.get_json()["error"] == "validation"
    assert cb.get(f"/api/matches/{mid}").get_json()["status"] == "reported"


@pytest.mark.parametrize("games", [[4], [0], [3, 4]])
def test_disputed_games_must_have_been_reported(make_player, games):
    *_, cb, mid = reported(make_player)
    res = dispute(cb, mid, games=games)
    assert res.status_code == 400 and "games" in res.get_json()["fields"]


def test_only_the_non_reporting_player_can_dispute(make_player):
    a, ca, b, cb, mid = reported(make_player)
    _, outsider = make_player()
    assert dispute(ca, mid).status_code == 403
    assert dispute(outsider, mid).status_code == 404
    assert dispute(cb, mid).get_json()["status"] == "disputed"


def test_both_players_see_the_disputed_games_and_reason(make_player):
    a, ca, b, cb, mid = reported(make_player)
    dispute(cb, mid, games=[3, 2, 3], reason="  I won game 2 and 3  ")
    for client, by in ((cb, "you"), (ca, "opponent")):
        d = client.get(f"/api/matches/{mid}").get_json()["dispute"]
        assert d["games"] == [2, 3]
        assert d["reason"] == "I won game 2 and 3"
        assert d["by"] == by
        assert d["statements"] == {"you": None, "opponent": None}


def test_undisputed_matches_have_no_dispute(make_player):
    *_, cb, mid = reported(make_player)
    assert cb.get(f"/api/matches/{mid}").get_json()["dispute"] is None


def statement(client, mid, text):
    return client.put(f"/api/matches/{mid}/statement", json={"text": text})


def test_each_player_adds_and_updates_their_statement(make_player):
    a, ca, b, cb, mid = reported(make_player)
    dispute(cb, mid)
    assert statement(ca, mid, "  I won game 3 fair and square. ").status_code == 200
    statement(cb, mid, "They pulled the cable.")
    statement(ca, mid, "Rewritten: game 3 was clean.")

    seen_by_a = ca.get(f"/api/matches/{mid}").get_json()["dispute"]["statements"]
    seen_by_b = cb.get(f"/api/matches/{mid}").get_json()["dispute"]["statements"]
    assert seen_by_a["you"]["text"] == "Rewritten: game 3 was clean."
    assert seen_by_a["opponent"]["text"] == "They pulled the cable."
    assert seen_by_b["opponent"] == seen_by_a["you"]
    assert seen_by_b["you"] == seen_by_a["opponent"]


def test_statements_only_while_disputed(make_player):
    a, ca, b, cb, mid = reported(make_player)
    res = statement(ca, mid, "early")
    assert res.status_code == 409 and res.get_json()["error"] == "bad_status"


@pytest.mark.parametrize("text", ["", "   ", "x" * 2001, None, 5])
def test_statement_validation(make_player, text):
    a, ca, b, cb, mid = reported(make_player)
    dispute(cb, mid)
    assert statement(ca, mid, text).status_code == 400


def test_outsiders_cannot_see_or_add_statements(make_player):
    a, ca, b, cb, mid = reported(make_player)
    dispute(cb, mid)
    _, outsider = make_player()
    assert statement(outsider, mid, "I saw it all").status_code == 404
    assert outsider.get(f"/api/matches/{mid}").status_code == 404
    assert ca.get(f"/api/matches/{mid}").get_json()["dispute"]["statements"] == {"you": None, "opponent": None}


def test_matches_disputed_before_the_form_still_load(make_player):
    a, ca, b, cb, mid = reported(make_player)
    # What the old dispute endpoint left behind: disputed, with no games or reason.
    m = db.session.get(Match, mid)
    m.status, m.ended_by_id = "disputed", b.id
    db.session.commit()

    res = ca.get(f"/api/matches/{mid}")
    assert res.status_code == 200
    assert res.get_json()["dispute"] == {
        "round": 0,
        "games": [],
        "reason": None,
        "by": "opponent",
        "statements": {"you": None, "opponent": None},
        "screenshots": {"you": [], "opponent": []},
    }
    # Players can still add their side.
    assert statement(ca, mid, "Here's what happened.").status_code == 200


def test_queue_state_lists_your_disputed_matches(make_player):
    a, ca, b, cb, mid = reported(make_player)
    assert ca.get("/api/queue").get_json()["disputes"] == []
    dispute(cb, mid)

    (d,) = ca.get("/api/queue").get_json()["disputes"]
    assert d == {"id": mid, "game": "nt", "opponent": b.username, "youReported": True, "statementAdded": False}
    statement(ca, mid, "My side.")
    assert ca.get("/api/queue").get_json()["disputes"][0]["statementAdded"] is True

    (d,) = cb.get("/api/queue").get_json()["disputes"]
    assert d["youReported"] is False
    _, outsider = make_player()
    assert outsider.get("/api/queue").get_json()["disputes"] == []
