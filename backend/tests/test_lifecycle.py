"""The match lifecycle module: which action is allowed from which status, Rulings and deadlines."""

from datetime import timedelta

import pytest

from app import clock, lifecycle
from app.errors import MatchmakingError
from app.extensions import db

STATUSES = ("pending", "active", "reported", "disputed", "completed", "voided", "cancelled", "abandoned")

REASON = "The clip shows the result."


def ruling(outcome, **kwargs):
    return lambda match, a, b, admin: lifecycle.rule(match, admin, outcome, REASON, **kwargs)


def overturn(match, a, b, admin):
    lifecycle.rule(match, admin, "overturn", REASON, games=[{"n": 1, "winner": b.id}])


# action -> (how to take it, {status it is allowed from: status it leaves the match in}).
# Every status left out is refused. A makes the reports, so B answers them.
ACTIONS = {
    "accept": (lambda m, a, b, admin: lifecycle.accept(m, a), {"pending": "pending"}),
    "decline": (lambda m, a, b, admin: lifecycle.decline(m, a), {"pending": "cancelled"}),
    "report a game": (lambda m, a, b, admin: lifecycle.report_game(m, a, 2, a.id), {"active": "reported"}),
    "confirm": (lambda m, a, b, admin: lifecycle.confirm(m, b), {"reported": "completed"}),
    "dispute": (lambda m, a, b, admin: lifecycle.dispute(m, b, [1], "I won game 1."), {"reported": "disputed"}),
    "leave": (lambda m, a, b, admin: lifecycle.leave(m, b), {"pending": "cancelled", "active": "abandoned"}),
    "uphold": (ruling("uphold"), {"disputed": "completed"}),
    "overturn": (overturn, {"disputed": "completed"}),
    "replay": (ruling("replay"), {"disputed": "active"}),
    "void ruling": (ruling("void"), {"disputed": "voided"}),
    "void an open match": (
        lambda m, a, b, admin: lifecycle.void_open(m),
        {"pending": "voided", "active": "voided", "reported": "voided"},
    ),
}


def snapshot(match):
    """The match's columns, games and chat, to show that nothing changed."""
    columns = {c.name: getattr(match, c.name) for c in match.__table__.columns}
    games = [(g.game_no, g.winner_id) for g in match.games]
    return columns, games, len(match.messages)


@pytest.mark.parametrize("status", STATUSES)
@pytest.mark.parametrize("action", ACTIONS)
def test_each_action_is_allowed_only_from_its_statuses(make_match, make_admin, action, status):
    match, a, b = make_match(status)
    admin, _ = make_admin()
    take, allowed = ACTIONS[action]
    if status in allowed:
        take(match, a, b, admin)
        assert match.status == allowed[status]
        return
    before = snapshot(match)
    with pytest.raises(MatchmakingError) as e:
        take(match, a, b, admin)
    assert e.value.code == "bad_status"
    assert snapshot(match) == before


# ---------------------------------------------------------------- status sets


def test_open_and_settled_statuses():
    assert set(lifecycle.OPEN) == {"pending", "active", "reported"}
    assert set(lifecycle.SETTLED) == {"completed", "voided"}


@pytest.mark.parametrize("status", STATUSES)
def test_only_a_completed_match_is_completed_with_a_winner(make_match, status):
    match, *_ = make_match(status)
    assert match.completed_with_winner is (status == "completed")


# ---------------------------------------------------------------- Rulings


@pytest.mark.parametrize("outcome", ["uphold", "replay", "void"])
def test_a_ruling_is_written_on_the_match(make_match, make_admin, outcome):
    match, *_ = make_match("disputed")
    admin, _ = make_admin()
    lifecycle.rule(match, admin, outcome, REASON)
    db.session.commit()
    assert (match.ruling, match.ruling_reason, match.ruled_by_id) == (outcome, REASON, admin.id)
    assert match.ruled_at is not None


def test_an_overturn_returns_its_corrections_for_the_admin_log(make_match, make_admin):
    match, a, b = make_match("disputed")  # games won by A, B, A
    admin, _ = make_admin()
    done = lifecycle.rule(match, admin, "overturn", REASON, games=[{"n": 1, "winner": b.id}])
    assert done == {"corrections": [{"n": 1, "from": a.id, "to": b.id}]}
    assert (match.ruling, match.winner_id) == ("overturn", b.id)


def test_a_refused_ruling_changes_nothing(make_match, make_admin):
    match, *_ = make_match("disputed")
    admin, _ = make_admin()
    before = snapshot(match)
    with pytest.raises(MatchmakingError) as e:
        lifecycle.rule(match, admin, "replay", REASON, from_game=9)
    assert e.value.code == "validation"
    assert snapshot(match) == before


# ---------------------------------------------------------------- deadlines


def after(monkeypatch, **delta):
    later = clock.now() + timedelta(**delta)
    monkeypatch.setattr(clock, "now", lambda: later)


@pytest.mark.parametrize("status", STATUSES)
def test_advance_does_nothing_before_a_deadline(make_match, status):
    match, *_ = make_match(status)
    before = snapshot(match)
    assert lifecycle.advance(match) is None
    assert snapshot(match) == before


def test_advance_cancels_a_match_whose_accept_window_passed(make_match, monkeypatch):
    match, *_ = make_match("pending")
    after(monkeypatch, minutes=2)
    assert lifecycle.advance(match) == "expired"
    assert match.status == "cancelled"


def test_advance_confirms_an_overdue_result(make_match, monkeypatch):
    match, a, _ = make_match("reported")
    after(monkeypatch, hours=3)
    assert lifecycle.advance(match) == "autoConfirmed"
    assert (match.status, match.winner_id) == ("completed", a.id)


@pytest.mark.parametrize("status", ["active", "reported"])
def test_advance_sends_an_unfinished_replay_back_to_the_admins(make_match, monkeypatch, status):
    match, *_ = make_match(status)
    match.replay_deadline = clock.now() + timedelta(hours=1)
    after(monkeypatch, minutes=90)  # before the confirm deadline
    assert lifecycle.advance(match) == "replayExpired"
    assert match.status == "disputed" and match.replay_not_finished


def test_advance_confirms_before_it_expires_the_replay(make_match, monkeypatch):
    match, *_ = make_match("reported")
    match.replay_deadline = clock.now() + timedelta(hours=1)
    after(monkeypatch, hours=3)  # both deadlines have passed
    assert lifecycle.advance(match) == "autoConfirmed"
    assert match.status == "completed"
