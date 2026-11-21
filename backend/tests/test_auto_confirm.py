"""A reported result confirms itself if the opponent does nothing for 2 hours."""

from datetime import datetime, timedelta

from app import admin_log
from app import matchmaking as mm
from app.extensions import db
from tests.test_queue import NT_BO3, report, started


def reported_2_0(make_player):
    """A reports a 2-0 win over B. B can confirm or dispute."""
    a, ca, b, cb, mid = started(make_player)
    report(ca, mid, 1, a)
    body = report(ca, mid, 2, a).get_json()
    assert body["status"] == "reported"
    return a, ca, b, cb, mid, body


def parse(iso: str) -> datetime:
    return datetime.fromisoformat(iso.removesuffix("Z"))


def test_reporting_sets_a_confirm_deadline_2_hours_out(make_player):
    *_, cb, mid, body = reported_2_0(make_player)
    deadline = parse(body["confirmDeadline"])
    assert timedelta(hours=2) - timedelta(seconds=5) <= deadline - mm.now() <= timedelta(hours=2)
    assert cb.get(f"/api/matches/{mid}").get_json()["confirmDeadline"] == body["confirmDeadline"]


def test_active_matches_have_no_confirm_deadline(make_player):
    *_, cb, mid = started(make_player)
    assert cb.get(f"/api/matches/{mid}").get_json()["confirmDeadline"] is None


def after(monkeypatch, seconds):
    later = mm.now() + timedelta(seconds=seconds)
    monkeypatch.setattr(mm, "now", lambda: later)


def tick():
    result = mm.tick()
    db.session.commit()
    return result


def test_overdue_result_confirms_itself_on_tick(make_player, monkeypatch):
    a, ca, b, cb, mid, _ = reported_2_0(make_player)
    a.ranked_wins = 9  # this win reaches Classic
    db.session.commit()

    after(monkeypatch, mm.CONFIRM_SECONDS - 60)
    tick()
    assert ca.get(f"/api/matches/{mid}").get_json()["status"] == "reported"

    after(monkeypatch, 61)
    assert [m.id for m in tick()["autoConfirmed"]] == [mid]
    body = ca.get(f"/api/matches/{mid}").get_json()
    assert body["status"] == "completed" and body["winner"] == "you"
    assert body["confirmDeadline"] is None
    assert body["rewardsUnlocked"] == [{"key": "classic_interface", "name": "Classic interface", "goal": 10}]
    last = body["messages"][-1]
    assert (last["from"], last["text"]) == ("system", "Result confirmed automatically after 2 hours.")
    db.session.refresh(a)
    db.session.refresh(b)
    assert (a.ranked_wins, b.ranked_wins) == (10, 0)

    # Both players are free to queue again.
    assert ca.post("/api/queue", json=NT_BO3).status_code == 201
    assert cb.post("/api/queue", json=NT_BO3).status_code == 201


def test_disputed_before_the_deadline_is_left_alone(make_player, monkeypatch):
    a, ca, b, cb, mid, _ = reported_2_0(make_player)
    cb.post(f"/api/matches/{mid}/dispute", json={"games": [2], "reason": "I won game 2"})
    after(monkeypatch, mm.CONFIRM_SECONDS + 60)
    assert tick()["autoConfirmed"] == []
    assert ca.get(f"/api/matches/{mid}").get_json()["status"] == "disputed"
    db.session.refresh(a)
    assert a.ranked_wins == 0


def test_confirmed_by_hand_is_not_confirmed_twice(make_player, monkeypatch):
    a, ca, b, cb, mid, _ = reported_2_0(make_player)
    cb.post(f"/api/matches/{mid}/confirm")
    after(monkeypatch, mm.CONFIRM_SECONDS + 60)
    assert tick()["autoConfirmed"] == []
    db.session.refresh(a)
    assert a.ranked_wins == 1


def test_auto_confirm_writes_a_system_admin_log_entry(make_player, monkeypatch):
    a, ca, b, cb, mid, _ = reported_2_0(make_player)
    after(monkeypatch, mm.CONFIRM_SECONDS + 1)
    tick()
    (entry,) = admin_log.entries()
    assert entry["actor"] is None  # a system action
    assert entry["action"] == "auto_confirm"
    assert entry["matchId"] == mid
    assert entry["target"]["id"] == b.id  # the player who didn't respond
    assert "2 hours" in entry["reason"]
    assert entry["details"] == {"winnerId": a.id, "reportedById": a.id, "score": "2-0"}
    assert entry["at"] is not None
