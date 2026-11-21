from datetime import timedelta

import pytest

from app import matchmaking as mm
from app.extensions import db
from app.models import Match, QueueEntry, User

NT_BO3 = {"game": "nt", "mode": "1v1", "bestOf": 3, "platform": "PS4"}


def matched_pair(make_player, settings=NT_BO3):
    (a, ca), (b, cb) = make_player(), make_player()
    assert ca.post("/api/queue", json=settings).status_code == 201
    res = cb.post("/api/queue", json=settings)
    assert res.status_code == 201
    match = res.get_json()["match"]
    assert match is not None
    return a, ca, b, cb, match["id"]


def started(make_player, settings=NT_BO3):
    a, ca, b, cb, mid = matched_pair(make_player, settings)
    ca.post(f"/api/matches/{mid}/accept")
    assert cb.post(f"/api/matches/{mid}/accept").get_json()["status"] == "active"
    return a, ca, b, cb, mid


def report(client, mid, n, winner):
    return client.post(f"/api/matches/{mid}/games", json={"gameNo": n, "winnerId": winner.id})


# ---------------------------------------------------------------- queue


def test_requires_auth(client):
    assert client.get("/api/queue").status_code == 401
    assert client.post("/api/queue", json=NT_BO3).status_code == 401
    assert client.post("/api/matches/1/accept").status_code == 401


def test_join_and_leave(make_player):
    _, c = make_player()
    body = c.post("/api/queue", json=NT_BO3).get_json()
    assert body["queue"]["game"] == "nt" and body["queue"]["region"] == "NA"
    assert body["match"] is None
    assert body["searching"]["nt"] == 1

    assert c.post("/api/queue", json=NT_BO3).get_json()["error"] == "already_queued"
    body = c.delete("/api/queue").get_json()
    assert body["queue"] is None and body["searching"]["nt"] == 0


@pytest.mark.parametrize(
    "settings, field",
    [
        ({**NT_BO3, "game": "ff7"}, "game"),
        ({**NT_BO3, "mode": "3v3"}, "mode"),  # phase 1 is 1v1 only
        ({**NT_BO3, "bestOf": 5}, "bestOf"),
        ({**NT_BO3, "bestOf": 1}, "bestOf"),  # ranked is Bo3 only
        ({**NT_BO3, "bestOf": True}, "bestOf"),
        ({**NT_BO3, "platform": "PPSSPP"}, "platform"),
    ],
)
def test_invalid_settings(make_player, settings, field):
    _, c = make_player()
    res = c.post("/api/queue", json=settings)
    assert res.status_code == 400
    assert field in res.get_json()["fields"]


def test_must_be_onboarded_with_game_id(make_player):
    _, c = make_player(onboarded=False)
    assert c.post("/api/queue", json=NT_BO3).get_json()["error"] == "not_onboarded"
    _, c = make_player(game_ids={"012": "x"})
    res = c.post("/api/queue", json=NT_BO3)
    assert res.status_code == 403 and res.get_json()["error"] == "game_id_required"


def test_requires_json(make_player):
    _, c = make_player()
    assert c.post("/api/queue", data="game=nt").status_code == 415


def test_pairs_compatible_players_only(make_player):
    (_, c1), (_, c2), (_, c3), (_, c4) = make_player(), make_player(region="EU"), make_player(), make_player()
    c1.post("/api/queue", json=NT_BO3)
    assert c2.post("/api/queue", json=NT_BO3).get_json()["match"] is None  # other region
    assert c3.post("/api/queue", json={**NT_BO3, "platform": "PC"}).get_json()["match"] is None  # no cross-play
    assert c4.post("/api/queue", json=NT_BO3).get_json()["match"] is not None
    assert db.session.query(QueueEntry).count() == 2


def test_longest_waiting_player_is_matched_and_hosts(make_player):
    (a, ca), (b, cb) = make_player(), make_player()
    ca.post("/api/queue", json=NT_BO3)
    # Simulate a race where both joined before either could pair: pairing happens on poll.
    db.session.add(QueueEntry(user_id=b.id, region="NA", joined_at=mm.now(), game="nt", mode="1v1", best_of=3, platform="PS4"))
    db.session.commit()
    match = cb.get("/api/queue").get_json()["match"]
    assert match["opponent"]["id"] == a.id
    assert match["host"] == "opponent"
    assert match["status"] == "pending"
    # And A sees the same match from their side.
    assert ca.get("/api/queue").get_json()["match"]["host"] == "you"


def test_cannot_queue_while_in_match(make_player):
    _, ca, *_ = matched_pair(make_player)
    assert ca.post("/api/queue", json=NT_BO3).get_json()["error"] == "in_match"


# ---------------------------------------------------------------- accept / decline


def test_both_accept_starts_match(make_player):
    a, ca, b, cb, mid = matched_pair(make_player)
    body = ca.post(f"/api/matches/{mid}/accept").get_json()
    assert body["status"] == "pending" and body["you"]["accepted"] and not body["opponent"]["accepted"]
    body = cb.post(f"/api/matches/{mid}/accept").get_json()
    assert body["status"] == "active"
    assert body["opponent"]["gameId"] == a.game_ids["nt"]
    assert "hosts" in body["messages"][0]["text"]


def test_decline_requeues_the_other_player(make_player):
    a, ca, b, cb, mid = matched_pair(make_player)
    body = cb.post(f"/api/matches/{mid}/decline").get_json()
    assert body["status"] == "cancelled" and body["endedBy"] == "you"
    assert ca.get("/api/queue").get_json()["queue"]["game"] == "nt"
    assert cb.get("/api/queue").get_json()["queue"] is None


def test_accept_timeout_requeues_only_accepters(make_player, monkeypatch):
    a, ca, b, cb, mid = matched_pair(make_player)
    ca.post(f"/api/matches/{mid}/accept")
    later = mm.now() + timedelta(seconds=mm.ACCEPT_SECONDS + 1)
    monkeypatch.setattr(mm, "now", lambda: later)

    state_a = ca.get("/api/queue").get_json()
    assert state_a["match"] is None and state_a["queue"] is not None
    state_b = cb.get("/api/queue").get_json()
    assert state_b["match"] is None and state_b["queue"] is None
    m = db.session.get(Match, mid)
    assert m.status == "cancelled" and m.ended_by_id == b.id
    assert cb.post(f"/api/matches/{mid}/accept").status_code == 409


def test_outsiders_cannot_see_or_touch_match(make_player):
    *_, mid = matched_pair(make_player)
    _, outsider = make_player()
    assert outsider.get(f"/api/matches/{mid}").status_code == 404
    assert outsider.post(f"/api/matches/{mid}/accept").status_code == 404
    assert outsider.post("/api/matches/999/accept").status_code == 404


# ---------------------------------------------------------------- reporting


def test_full_series_report_and_confirm(make_player):
    a, ca, b, cb, mid = started(make_player)
    assert report(ca, mid, 1, a).status_code == 200
    assert report(cb, mid, 2, b).get_json()["score"] == {"you": 1, "opponent": 1}
    body = report(ca, mid, 3, a).get_json()
    assert body["status"] == "reported" and body["winner"] == "you" and body["reportedBy"] == "you"

    # The reporter can't confirm their own result.
    assert ca.post(f"/api/matches/{mid}/confirm").status_code == 403
    body = cb.post(f"/api/matches/{mid}/confirm").get_json()
    assert body["status"] == "completed" and body["winner"] == "opponent"
    # Finished matches don't block queueing again.
    assert ca.post("/api/queue", json=NT_BO3).status_code == 201


def test_stale_game_number_is_rejected(make_player):
    a, ca, b, cb, mid = started(make_player)
    report(ca, mid, 1, a)
    res = report(cb, mid, 1, b)  # both reported game 1 at once
    assert res.status_code == 409 and res.get_json()["error"] == "stale"


def test_report_validation(make_player):
    a, ca, b, cb, mid = started(make_player)
    outsider, _ = make_player()
    assert report(ca, mid, 1, outsider).status_code == 400
    assert ca.post(f"/api/matches/{mid}/games", json={"gameNo": "1", "winnerId": a.id}).status_code == 400


def test_report_details_are_filtered(make_player):
    a, ca, b, cb, mid = started(make_player)
    res = ca.post(
        f"/api/matches/{mid}/games",
        json={"gameNo": 1, "winnerId": a.id, "details": {"character": "Squall", "stage": "x" * 100, "evil": "y"}},
    )
    assert res.get_json()["games"][0]["details"] == {"character": "Squall", "stage": "x" * 64}


def test_cannot_report_before_accept(make_player):
    a, ca, *_, mid = matched_pair(make_player)
    assert report(ca, mid, 1, a).status_code == 409


def test_dispute(make_player):
    a, ca, b, cb, mid = started(make_player)
    report(ca, mid, 1, a)
    report(ca, mid, 2, a)
    assert ca.post(f"/api/matches/{mid}/dispute").status_code == 403
    assert cb.post(f"/api/matches/{mid}/dispute").get_json()["status"] == "disputed"


def test_leave_active_match(make_player):
    a, ca, b, cb, mid = started(make_player)
    body = ca.post(f"/api/matches/{mid}/leave").get_json()
    assert body["status"] == "abandoned" and body["endedBy"] == "you"
    assert cb.get("/api/queue").get_json()["match"] is None


# ---------------------------------------------------------------- chat


def test_chat(make_player):
    a, ca, b, cb, mid = matched_pair(make_player)
    assert ca.post(f"/api/matches/{mid}/messages", json={"text": "hi"}).status_code == 409  # not started
    ca.post(f"/api/matches/{mid}/accept")
    cb.post(f"/api/matches/{mid}/accept")
    ca.post(f"/api/matches/{mid}/messages", json={"text": "  lobby pw 1234 "})
    msgs = cb.get(f"/api/matches/{mid}").get_json()["messages"]
    assert msgs[-1]["from"] == "opponent" and msgs[-1]["text"] == "lobby pw 1234"
    assert ca.post(f"/api/matches/{mid}/messages", json={"text": "   "}).status_code == 400
    assert ca.post(f"/api/matches/{mid}/messages", json={"text": "x" * 501}).status_code == 400


# ---------------------------------------------------------------- region widening


def _age(user, seconds):
    """Pretend this player joined the queue `seconds` ago."""
    entry = db.session.scalar(db.select(QueueEntry).filter_by(user_id=user.id))
    entry.joined_at = mm.now() - timedelta(seconds=seconds)
    db.session.commit()


def test_cross_region_after_both_waited(make_player):
    (a, ca), (b, cb) = make_player(region="EU"), make_player(region="NA")
    ca.post("/api/queue", json=NT_BO3)
    cb.post("/api/queue", json=NT_BO3)
    _age(a, mm.REGION_WIDEN_SECONDS + 5)
    # B only just joined, so it still gets its window to find someone local.
    assert cb.get("/api/queue").get_json()["match"] is None
    _age(b, mm.REGION_WIDEN_SECONDS + 1)
    match = cb.get("/api/queue").get_json()["match"]
    assert match is not None
    assert match["opponent"]["region"] == "EU" and match["you"]["region"] == "NA"
    assert match["region"] == "EU"  # the host's (A waited longer)


def test_same_region_preferred_over_longer_waiting_foreigner(make_player):
    (eu, ceu), (na1, cna1), (na2, cna2) = make_player(region="EU"), make_player(), make_player()
    ceu.post("/api/queue", json=NT_BO3)
    cna1.post("/api/queue", json=NT_BO3)
    _age(eu, 300)
    _age(na1, 200)
    match = cna2.post("/api/queue", json=NT_BO3).get_json()["match"]
    assert match["opponent"]["id"] == na1.id


# ---------------------------------------------------------------- worker tick


def _enqueue(user, region="NA", **settings):
    s = {"game": "nt", "mode": "1v1", "best_of": 3, "platform": "PS4", **settings}
    db.session.add(QueueEntry(user_id=user.id, region=region, joined_at=mm.now(), source="discord", **s))
    db.session.commit()


def test_tick_pairs_players_who_never_poll(make_player):
    (a, _), (b, _), (c, _), (d, _), (e, _) = (make_player() for _ in range(5))
    for u in (a, b, c, d):
        _enqueue(u)
    _enqueue(e, platform="PC")
    result = mm.tick()
    db.session.commit()
    assert len(result["created"]) == 2
    assert db.session.query(QueueEntry).count() == 1  # e has no PC opponent


def test_tick_expires_accept_windows(make_player, monkeypatch):
    a, ca, b, cb, mid = matched_pair(make_player)
    ca.post(f"/api/matches/{mid}/accept")
    later = mm.now() + timedelta(seconds=mm.ACCEPT_SECONDS + 1)
    monkeypatch.setattr(mm, "now", lambda: later)
    result = mm.tick()
    db.session.commit()
    assert [m.id for m in result["expired"]] == [mid]
    assert db.session.get(Match, mid).status == "cancelled"
    # A accepted, so A is back in the queue; B didn't.
    assert [e.user_id for e in db.session.query(QueueEntry)] == [a.id]
