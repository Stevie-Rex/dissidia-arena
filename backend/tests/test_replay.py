"""The Replay Ruling: the match is played again from one game, with a 48-hour Replay deadline."""

from datetime import datetime, timedelta

import pytest

from app import clock
from app import matchmaking as mm
from app.extensions import db
from tests.test_cases import case, claim, claimed_by_admin
from tests.test_disputes import dispute, reported, statement
from tests.test_auto_confirm import after, parse, tick
from tests.test_queue import NT_BO3, report


def replay(client, mid, from_game=None, reason="The clip cuts out in game 3, so play it again."):
    body = {"outcome": "replay", "reason": reason}
    if from_game is not None:
        body["fromGame"] = from_game
    return client.post(f"/api/admin/disputes/{mid}/ruling", json=body)


def disputed_games(make_player, games):
    """A reported 2-1 (A, B, A) that B disputed, naming these games."""
    a, ca, b, cb, mid = reported(make_player)
    assert dispute(cb, mid, games=games).get_json()["status"] == "disputed"
    return a, ca, b, cb, mid


def test_replay_from_game_3_keeps_games_1_and_2_and_reopens_the_match(make_player, make_admin):
    a, ca, b, cb, mid, c = claimed_by_admin(make_player, make_admin)  # A reported 2-1: A, B, A

    res = replay(c, mid, from_game=3)
    assert res.status_code == 200, res.get_json()

    for client in (ca, cb):
        m = client.get(f"/api/matches/{mid}").get_json()
        assert m["status"] == "active"
        assert [g["n"] for g in m["games"]] == [1, 2]
        assert m["winner"] is None and m["reportedBy"] is None and m["confirmDeadline"] is None
        assert m["ruling"]["outcome"] == "replay"
    # Still their current match, in the same match room.
    assert ca.get("/api/queue").get_json()["match"]["id"] == mid


def test_replay_defaults_to_the_first_disputed_game(make_player, make_admin):
    a, ca, b, cb, mid = disputed_games(make_player, [3, 2])
    _, c = make_admin()
    claim(c, mid)
    assert replay(c, mid).status_code == 200
    assert [g["n"] for g in ca.get(f"/api/matches/{mid}").get_json()["games"]] == [1]


@pytest.mark.parametrize("from_game", [0, 4, "3", True])
def test_replay_must_start_from_a_reported_game(make_player, make_admin, from_game):
    *_, mid, c = claimed_by_admin(make_player, make_admin)
    res = replay(c, mid, from_game=from_game)
    assert res.status_code == 400 and "fromGame" in res.get_json()["fields"]
    assert case(c, mid).get_json()["status"] == "disputed"


def test_replayed_games_are_reported_and_confirmed_normally_and_the_win_counts_once(make_player, make_admin):
    a, ca, b, cb, mid, c = claimed_by_admin(make_player, make_admin)
    replay(c, mid, from_game=3)

    assert report(cb, mid, 3, b).get_json()["status"] == "reported"  # B wins the replayed game 3
    assert ca.post(f"/api/matches/{mid}/confirm").status_code == 200

    m = cb.get(f"/api/matches/{mid}").get_json()
    assert m["status"] == "completed" and m["winner"] == "you" and m["score"] == {"you": 2, "opponent": 1}
    assert m["replayDeadline"] is None
    assert cb.get("/api/me").get_json()["rankedWins"] == 1
    assert ca.get("/api/me").get_json()["rankedWins"] == 0
    # The Ruling stays on record for the players.
    assert m["ruling"]["outcome"] == "replay"


def test_replayed_results_confirm_automatically_too(make_player, make_admin, monkeypatch):
    a, ca, b, cb, mid, c = claimed_by_admin(make_player, make_admin)
    replay(c, mid, from_game=3)
    report(ca, mid, 3, a)
    after(monkeypatch, mm.CONFIRM_SECONDS + 1)
    assert [m.id for m in tick()["autoConfirmed"]] == [mid]
    assert ca.get("/api/me").get_json()["rankedWins"] == 1


def test_the_match_room_keeps_its_chat_and_says_what_happened(make_player, make_admin):
    a, ca, b, cb, mid = disputed_games(make_player, [3])
    before = ca.get(f"/api/matches/{mid}").get_json()["messages"]
    _, c = make_admin()
    claim(c, mid)
    replay(c, mid)

    m = ca.get(f"/api/matches/{mid}").get_json()
    assert m["messages"][: len(before)] == before
    last = m["messages"][-1]
    assert last["from"] == "system" and "replay from game 3" in last["text"] and "48 hours" in last["text"]
    deadline = parse(m["replayDeadline"])
    assert timedelta(hours=48) - timedelta(seconds=5) <= deadline - clock.now() <= timedelta(hours=48)
    assert ca.post(f"/api/matches/{mid}/messages", json={"text": "rematch?"}).status_code in (200, 201)


def replaying(make_player, make_admin):
    """A Replay from game 3, with game 3 not yet played again."""
    a, ca, b, cb, mid, c = claimed_by_admin(make_player, make_admin)
    replay(c, mid, from_game=3)
    return a, ca, b, cb, mid, c


def test_an_unfinished_replay_goes_back_to_the_admins_at_the_deadline(make_player, make_admin, monkeypatch):
    a, ca, b, cb, mid, c = replaying(make_player, make_admin)

    after(monkeypatch, mm.REPLAY_SECONDS - 60)
    assert tick()["replayExpired"] == []
    assert ca.get(f"/api/matches/{mid}").get_json()["status"] == "active"

    after(monkeypatch, 61)
    assert [m.id for m in tick()["replayExpired"]] == [mid]
    page = case(c, mid).get_json()
    assert page["status"] == "disputed" and page["replayNotFinished"] is True
    assert page["claim"] is None and page["ruling"] is None and page["canAct"] is False
    (row,) = c.get("/api/admin/cases").get_json()["cases"]
    assert row["matchId"] == mid and row["replayNotFinished"] is True

    m = ca.get(f"/api/matches/{mid}").get_json()
    assert m["status"] == "disputed" and m["replayDeadline"] is None
    assert m["messages"][-1]["text"] == "The Replay wasn't finished within 48 hours. An Admin will rule again."

    # Both players are free to queue straight away.
    assert ca.post("/api/queue", json=NT_BO3).status_code == 201
    assert cb.post("/api/queue", json=NT_BO3).status_code == 201


def test_the_deadline_is_a_system_action_in_the_admin_log(make_player, make_admin, monkeypatch):
    a, ca, b, cb, mid, c = replaying(make_player, make_admin)
    after(monkeypatch, mm.REPLAY_SECONDS + 1)
    tick()
    entries = c.get("/api/admin/log").get_json()["entries"]
    assert entries[0]["action"] == "replay_not_finished"
    assert entries[0]["actor"] is None and entries[0]["matchId"] == mid
    assert "48 hours" in entries[0]["reason"]
    ruling = next(e for e in entries if e["action"] == "ruling")
    assert ruling["details"]["outcome"] == "replay" and ruling["details"]["fromGame"] == 3


def test_an_admin_rules_again_on_an_unfinished_replay(make_player, make_admin, monkeypatch):
    a, ca, b, cb, mid, c = replaying(make_player, make_admin)
    after(monkeypatch, mm.REPLAY_SECONDS + 1)
    tick()
    claim(c, mid)
    res = c.post(f"/api/admin/disputes/{mid}/ruling", json={"outcome": "void", "reason": "Nobody turned up."})
    assert res.get_json()["status"] == "voided" and res.get_json()["replayNotFinished"] is False


def test_a_settled_replay_is_left_alone_at_the_deadline(make_player, make_admin, monkeypatch):
    a, ca, b, cb, mid, c = replaying(make_player, make_admin)
    report(ca, mid, 3, a)
    cb.post(f"/api/matches/{mid}/confirm")
    after(monkeypatch, mm.REPLAY_SECONDS + 1)
    assert tick()["replayExpired"] == []
    assert ca.get(f"/api/matches/{mid}").get_json()["status"] == "completed"


def test_disputing_a_replayed_result_is_a_normal_dispute(make_player, make_admin, monkeypatch):
    a, ca, b, cb, mid, c = replaying(make_player, make_admin)
    report(ca, mid, 3, a)
    assert dispute(cb, mid, games=[3]).get_json()["status"] == "disputed"
    page = case(c, mid).get_json()
    assert page["replayNotFinished"] is False and page["ruling"] is None
    # The old deadline no longer applies.
    after(monkeypatch, mm.REPLAY_SECONDS + 1)
    assert tick()["replayExpired"] == []
    claim(c, mid)
    assert c.post(f"/api/admin/disputes/{mid}/ruling", json={"outcome": "uphold", "reason": "Clip."}).get_json()["status"] == "completed"
    assert ca.get("/api/me").get_json()["rankedWins"] == 1


def test_an_unfinished_replay_can_be_replayed_again_from_the_same_game(make_player, make_admin, monkeypatch):
    a, ca, b, cb, mid, c = replaying(make_player, make_admin)  # game 3 wiped, never replayed
    after(monkeypatch, mm.REPLAY_SECONDS + 1)
    tick()
    claim(c, mid)
    assert case(c, mid).get_json()["replayFrom"] == {"games": [1, 2, 3], "default": 3}

    assert replay(c, mid).status_code == 200  # by default, game 3 again: games 1-2 still stand
    m = ca.get(f"/api/matches/{mid}").get_json()
    assert m["status"] == "active" and [g["n"] for g in m["games"]] == [1, 2]
    assert m["replayNotFinished"] is False and m["replayDeadline"] is not None


def test_a_finished_series_cant_be_replayed_from_after_its_last_game(make_player, make_admin):
    *_, mid, c = claimed_by_admin(make_player, make_admin)  # reported 2-1 in 3 games
    assert case(c, mid).get_json()["replayFrom"] == {"games": [1, 2, 3], "default": 3}
    assert replay(c, mid, from_game=4).status_code == 400


def test_a_replayed_result_still_unconfirmed_at_the_deadline_is_dropped(make_player, make_admin, monkeypatch):
    a, ca, b, cb, mid, c = replaying(make_player, make_admin)  # games 1-2 stand: 1-1
    after(monkeypatch, mm.REPLAY_SECONDS - mm.CONFIRM_SECONDS + 60)
    assert report(ca, mid, 3, a).get_json()["status"] == "reported"  # B never confirms

    after(monkeypatch, mm.CONFIRM_SECONDS - 59)  # the Replay deadline passes first
    assert [m.id for m in tick()["replayExpired"]] == [mid]
    page = case(c, mid).get_json()
    assert page["status"] == "disputed" and page["replayNotFinished"] is True
    assert [g["n"] for g in page["games"]] == [1, 2]  # the unconfirmed game 3 is gone
    assert page["winner"] is None and page["reportedBy"] is None
    m = ca.get(f"/api/matches/{mid}").get_json()
    assert m["confirmDeadline"] is None and m["score"] == {"you": 1, "opponent": 1}
    assert "The reported result was dropped" in m["messages"][-1]["text"]

    after(monkeypatch, mm.CONFIRM_SECONDS)
    assert tick()["autoConfirmed"] == []
    assert ca.get("/api/me").get_json()["rankedWins"] == 0
    entry = c.get("/api/admin/log").get_json()["entries"][0]
    assert entry["action"] == "replay_not_finished" and entry["details"]["droppedReport"] == {"n": 3, "winnerId": a.id, "reportedById": a.id}


def test_during_a_replay_players_see_the_old_dispute_but_cant_change_it(make_player, make_admin):
    a, ca, b, cb, mid = disputed_games(make_player, [3])
    statement(ca, mid, "Game 3 was clean.")
    _, c = make_admin()
    claim(c, mid)
    replay(c, mid)

    d = cb.get(f"/api/matches/{mid}").get_json()["dispute"]
    assert d["games"] == [3] and d["statements"]["opponent"]["text"] == "Game 3 was clean."
    res = statement(cb, mid, "Late addition.")
    assert res.status_code == 409 and res.get_json()["error"] == "bad_status"
    assert cb.get(f"/api/matches/{mid}").get_json()["dispute"]["statements"]["you"] is None


def test_a_new_dispute_after_a_replay_starts_afresh_and_only_admins_see_the_old_one(make_player, make_admin):
    a, ca, b, cb, mid = disputed_games(make_player, [3])
    statement(ca, mid, "Game 3 was clean.")
    statement(cb, mid, "They pulled my cable.")
    _, c = make_admin()
    claim(c, mid)
    replay(c, mid, reason="Play game 3 again.")
    report(ca, mid, 3, a)
    dispute(cb, mid, games=[3], reason="Lag again in the replay.")

    for client in (ca, cb):
        m = client.get(f"/api/matches/{mid}").get_json()
        assert m["dispute"]["reason"] == "Lag again in the replay."
        assert m["dispute"]["statements"] == {"you": None, "opponent": None}
        assert "earlierDisputes" not in m
    assert statement(ca, mid, "The replay was clean too.").status_code == 200

    page = case(c, mid).get_json()
    assert page["dispute"]["reason"] == "Lag again in the replay."
    assert list(page["dispute"]["statements"]) == [str(a.id)]
    (old,) = page["earlierDisputes"]
    assert old["games"] == [3] and old["reason"] == "Game 3 was mine, they misclicked." and old["by"] == b.id
    assert {k: v["text"] for k, v in old["statements"].items()} == {
        str(a.id): "Game 3 was clean.",
        str(b.id): "They pulled my cable.",
    }
    assert old["ruling"]["outcome"] == "replay" and old["ruling"]["reason"] == "Play game 3 again."
    assert old["at"]


def test_an_unfinished_replay_keeps_its_dispute_and_statements(make_player, make_admin, monkeypatch):
    a, ca, b, cb, mid = disputed_games(make_player, [3])
    statement(ca, mid, "Game 3 was clean.")
    _, c = make_admin()
    claim(c, mid)
    replay(c, mid)
    after(monkeypatch, mm.REPLAY_SECONDS + 1)
    tick()
    d = ca.get(f"/api/matches/{mid}").get_json()["dispute"]
    assert d["reason"] == "Game 3 was mine, they misclicked." and d["statements"]["you"]["text"] == "Game 3 was clean."
    assert case(c, mid).get_json()["earlierDisputes"] == []
