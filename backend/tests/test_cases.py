"""Admins working through Disputed matches: the case list and page, Claims, and Uphold, Overturn and Void Rulings."""

from datetime import timedelta

import pytest

from app import clock
from app.extensions import db
from app.models import Match, User
from tests.test_disputes import dispute, reported
from tests.test_queue import NT_BO3, report, started


def disputed(make_player):
    """A Bo3 that A reported 2-1 and B disputed (game 3). Returns (a, ca, b, cb, match id)."""
    a, ca, b, cb, mid = reported(make_player)
    assert dispute(cb, mid).get_json()["status"] == "disputed"
    return a, ca, b, cb, mid


def cases(client, **params):
    return client.get("/api/admin/cases", query_string=params)


def case(client, mid):
    return client.get(f"/api/admin/disputes/{mid}")


# ---------------------------------------------------------------- the case list


def test_only_admins_and_the_master_can_list_or_open_cases(make_player, make_admin, master):
    *_, ca, _, cb, mid = disputed(make_player)
    for player_client in (ca, cb):
        assert cases(player_client).get_json()["error"] == "forbidden"
        assert case(player_client, mid).get_json()["error"] == "forbidden"
    for _, c in (make_admin(), master):
        assert [x["matchId"] for x in cases(c).get_json()["cases"]] == [mid]
        assert case(c, mid).get_json()["matchId"] == mid


# ---------------------------------------------------------------- Claims


def claim(client, mid):
    return client.post(f"/api/admin/disputes/{mid}/claim")


def release(client, mid):
    return client.post(f"/api/admin/disputes/{mid}/release")


def takeover(client, mid):
    return client.post(f"/api/admin/disputes/{mid}/takeover")


def test_an_admin_claims_a_case_and_others_see_it_being_handled(make_player, make_admin):
    *_, mid = disputed(make_player)
    kefka, c1 = make_admin()
    _, c2 = make_admin()

    mine = claim(c1, mid).get_json()["claim"]
    assert mine["by"] == {"id": kefka.id, "displayName": kefka.username} and mine["byYou"] and mine["at"]

    res = claim(c2, mid)
    assert res.status_code == 409 and res.get_json()["error"] == "already_claimed"
    theirs = case(c2, mid).get_json()
    assert theirs["claim"]["byYou"] is False and theirs["canAct"] is False
    (row,) = cases(c2).get_json()["cases"]
    assert row["claim"]["by"]["id"] == kefka.id


def test_the_case_list_filters_by_claimed(make_player, make_admin):
    *_, m1 = disputed(make_player)
    *_, m2 = disputed(make_player)
    _, c = make_admin()
    claim(c, m1)
    assert [x["matchId"] for x in cases(c, claimed="yes").get_json()["cases"]] == [m1]
    assert [x["matchId"] for x in cases(c, claimed="no").get_json()["cases"]] == [m2]


def test_only_the_claiming_admin_can_release(make_player, make_admin):
    *_, mid = disputed(make_player)
    _, c1 = make_admin()
    _, c2 = make_admin()
    assert release(c1, mid).get_json()["error"] == "not_claimed_by_you"  # nobody holds it yet
    claim(c1, mid)
    res = release(c2, mid)
    assert res.status_code == 403 and res.get_json()["error"] == "not_claimed_by_you"
    assert release(c1, mid).get_json()["claim"] is None
    assert claim(c2, mid).status_code == 200


def test_the_master_can_take_over_or_release_any_claim(make_player, make_admin, master):
    *_, mid = disputed(make_player)
    _, c = make_admin()
    m, mc = master
    claim(c, mid)
    assert takeover(c, mid).get_json()["error"] == "forbidden"
    assert takeover(mc, mid).get_json()["claim"]["by"]["id"] == m.id
    assert case(c, mid).get_json()["claim"]["byYou"] is False

    claim(c, mid)  # still held by the Master
    assert release(mc, mid).get_json()["claim"] is None
    claim(c, mid)
    assert release(mc, mid).get_json()["claim"] is None


def test_claims_releases_and_takeovers_are_logged(make_player, make_admin, master):
    *_, mid = disputed(make_player)
    kefka, c = make_admin()
    m, mc = master
    claim(c, mid)
    takeover(mc, mid)
    release(mc, mid)
    entries = mc.get("/api/admin/log").get_json()["entries"]
    assert [(e["action"], e["actor"]["id"], e["matchId"]) for e in entries[:3]] == [
        ("release_claim", m.id, mid),
        ("take_over_claim", m.id, mid),
        ("claim", kefka.id, mid),
    ]
    assert entries[1]["target"]["id"] == kefka.id  # whose Claim the Master took


# ---------------------------------------------------------------- own matches


def test_an_admin_who_played_in_the_match_cant_claim_it(make_player):
    a, ca, b, cb, mid = disputed(make_player)

    a.admin_since = clock.now()
    db.session.commit()

    page = case(ca, mid).get_json()
    assert page["playedIn"] is True and page["canAct"] is False
    res = claim(ca, mid)
    assert res.status_code == 403 and res.get_json()["error"] == "own_match"


def test_the_master_can_claim_their_own_match(make_player, master):
    m, mc = master
    a, ca = make_player()

    mc.post("/api/queue", json=NT_BO3)
    mid = ca.post("/api/queue", json=NT_BO3).get_json()["match"]["id"]
    for c in (mc, ca):
        c.post(f"/api/matches/{mid}/accept")
    report(mc, mid, 1, m)
    report(mc, mid, 2, m)
    dispute(ca, mid, games=[1])

    assert case(mc, mid).get_json()["playedIn"] is True
    assert claim(mc, mid).get_json()["canAct"] is True


# ---------------------------------------------------------------- Rulings


def rule(client, mid, outcome, reason="Both clips show the reported result."):
    return client.post(f"/api/admin/disputes/{mid}/ruling", json={"outcome": outcome, "reason": reason})


def claimed_by_admin(make_player, make_admin):
    a, ca, b, cb, mid = disputed(make_player)
    _, c = make_admin()
    claim(c, mid)
    return a, ca, b, cb, mid, c


def test_uphold_credits_the_reported_winner_exactly_as_confirm_does(make_player, make_admin):
    a, ca, b, cb, mid, c = claimed_by_admin(make_player, make_admin)
    a.ranked_wins = 9  # the next win unlocks the Classic interface
    db.session.commit()

    assert rule(c, mid, "uphold").status_code == 200
    m = ca.get(f"/api/matches/{mid}").get_json()
    assert m["status"] == "completed" and m["winner"] == "you"
    assert ca.get("/api/me").get_json()["rankedWins"] == 10
    assert [r["key"] for r in m["rewardsUnlocked"]] == ["classic_interface"]
    assert cb.get("/api/me").get_json()["rankedWins"] == 0


def test_void_ends_the_match_with_no_winner_and_credits_nothing(make_player, make_admin):
    a, ca, b, cb, mid, c = claimed_by_admin(make_player, make_admin)
    assert rule(c, mid, "void").status_code == 200
    for client in (ca, cb):
        m = client.get(f"/api/matches/{mid}").get_json()
        assert m["status"] == "voided" and m["winner"] is None and m["rewardsUnlocked"] == []
        assert client.get("/api/me").get_json()["rankedWins"] == 0
        assert client.get("/api/queue").get_json()["match"] is None  # free to queue again


def test_a_ruling_needs_a_reason_and_a_known_outcome(make_player, make_admin):
    *_, mid, c = claimed_by_admin(make_player, make_admin)
    assert rule(c, mid, "uphold", reason="  ").get_json()["error"] == "reason_required"
    res = rule(c, mid, "banish")
    assert res.status_code == 400 and "outcome" in res.get_json()["fields"]
    assert case(c, mid).get_json()["status"] == "disputed"


def test_the_first_ruling_wins(make_player, make_admin, master):
    *_, mid, c = claimed_by_admin(make_player, make_admin)
    _, mc = master
    rule(c, mid, "void")
    for client in (c, mc):
        res = rule(client, mid, "uphold")
        assert res.status_code == 409 and res.get_json()["error"] == "already_ruled"
    assert case(c, mid).get_json()["status"] == "voided"


def test_only_the_claiming_admin_or_the_master_can_rule(make_player, make_admin, master):
    *_, mid = disputed(make_player)
    _, c1 = make_admin()
    _, c2 = make_admin()
    assert rule(c1, mid, "uphold").get_json()["error"] == "not_claimed_by_you"  # claim it first
    claim(c1, mid)
    res = rule(c2, mid, "uphold")
    assert res.status_code == 403 and res.get_json()["error"] == "not_claimed_by_you"
    _, mc = master
    assert rule(mc, mid, "uphold").get_json()["status"] == "completed"


def test_an_admin_cant_rule_on_their_own_match_but_the_master_can(make_player, master):
    a, ca, b, cb, mid = disputed(make_player)
    a.admin_since = clock.now()
    db.session.commit()
    assert rule(ca, mid, "uphold").get_json()["error"] == "own_match"

    m, mc = master
    _, pc = make_player()
    mc.post("/api/queue", json=NT_BO3)
    mid = pc.post("/api/queue", json=NT_BO3).get_json()["match"]["id"]
    for client in (mc, pc):
        client.post(f"/api/matches/{mid}/accept")
    report(mc, mid, 1, m)
    report(mc, mid, 2, m)
    dispute(pc, mid, games=[2])
    assert rule(mc, mid, "uphold").get_json()["status"] == "completed"


def test_rulings_are_logged_with_the_admin_and_reason(make_player, make_admin):
    a, ca, b, cb, mid, c = claimed_by_admin(make_player, make_admin)
    rule(c, mid, "uphold", reason="Clip shows A won game 3.")
    (entry,) = [e for e in c.get("/api/admin/log").get_json()["entries"] if e["action"] == "ruling"]
    assert entry["matchId"] == mid and entry["reason"] == "Clip shows A won game 3."
    assert entry["details"]["outcome"] == "uphold" and entry["details"]["winnerId"] == a.id
    assert entry["actor"] is not None


# ---------------------------------------------------------------- Overturn


def overturn(client, mid, games, reason="Clip shows B won game 3."):
    body = {"outcome": "overturn", "reason": reason, "games": [{"n": n, "winner": w.id} for n, w in games]}
    return client.post(f"/api/admin/disputes/{mid}/ruling", json=body)


def test_overturn_correcting_game_3_flips_the_series_winner(make_player, make_admin):
    a, ca, b, cb, mid, c = claimed_by_admin(make_player, make_admin)  # A reported 2-1: A, B, A
    res = overturn(c, mid, [(3, b)])
    assert res.status_code == 200
    page = res.get_json()
    assert page["status"] == "completed" and page["winner"] == b.id
    assert [g["winner"] for g in page["games"]] == [a.id, b.id, b.id]
    assert page["ruling"]["outcome"] == "overturn"
    assert cb.get(f"/api/matches/{mid}").get_json()["winner"] == "you"


def test_overturn_that_leaves_nobody_on_the_winning_score_is_refused(make_player, make_admin):
    a, ca, b, cb, mid = started(make_player)
    report(ca, mid, 1, a)
    report(ca, mid, 2, a)
    dispute(cb, mid, games=[2])
    _, c = make_admin()
    claim(c, mid)

    res = overturn(c, mid, [(2, b)])  # 1-1: choose Replay instead
    assert res.status_code == 409 and res.get_json()["error"] == "no_series_winner"
    page = case(c, mid).get_json()
    assert page["status"] == "disputed" and page["ruling"] is None
    assert [g["winner"] for g in page["games"]] == [a.id, a.id]
    assert page["claim"]["byYou"] is True
    assert not [e for e in c.get("/api/admin/log").get_json()["entries"] if e["action"] == "ruling"]


@pytest.mark.parametrize(
    "games",
    [
        None,
        [],
        "3",
        [3],
        [{"n": 4, "winner": "B"}],  # not a reported game
        [{"n": 3, "winner": "outsider"}],  # not a player in the match
        [{"n": True, "winner": "B"}],
        [{"n": 3}],
        [{"n": 3, "winner": "B"}, {"n": 3, "winner": "A"}],  # the same game twice
    ],
)
def test_overturn_needs_valid_corrected_games(make_player, make_admin, games):
    a, ca, b, cb, mid, c = claimed_by_admin(make_player, make_admin)
    outsider, _ = make_player()
    ids = {"A": a.id, "B": b.id, "outsider": outsider.id}
    if isinstance(games, list):
        games = [{**g, "winner": ids[g["winner"]]} if isinstance(g, dict) and "winner" in g else g for g in games]
    res = c.post(f"/api/admin/disputes/{mid}/ruling", json={"outcome": "overturn", "reason": "r", "games": games})
    assert res.status_code == 400 and "games" in res.get_json()["fields"]
    assert case(c, mid).get_json()["status"] == "disputed"


def test_overturn_that_leaves_the_reported_winner_is_refused(make_player, make_admin):
    a, ca, b, cb, mid, c = claimed_by_admin(make_player, make_admin)  # A reported 2-1: A, B, A
    res = overturn(c, mid, [(2, a)])  # A still wins: that's an Uphold
    assert res.status_code == 400 and "games" in res.get_json()["fields"]
    assert case(c, mid).get_json()["status"] == "disputed"


def test_overturn_credits_the_new_winner_and_not_the_reporter(make_player, make_admin):
    a, ca, b, cb, mid, c = claimed_by_admin(make_player, make_admin)
    b.ranked_wins = 9  # the next win unlocks the Classic interface
    db.session.commit()

    overturn(c, mid, [(3, b)])
    assert cb.get("/api/me").get_json()["rankedWins"] == 10
    assert [r["key"] for r in cb.get(f"/api/matches/{mid}").get_json()["rewardsUnlocked"]] == ["classic_interface"]
    assert ca.get("/api/me").get_json()["rankedWins"] == 0
    assert ca.get(f"/api/matches/{mid}").get_json()["rewardsUnlocked"] == []


def test_overturn_is_logged_with_the_corrected_games_and_reason(make_player, make_admin):
    a, ca, b, cb, mid, c = claimed_by_admin(make_player, make_admin)
    overturn(c, mid, [(2, b), (3, b)], reason="Clip shows B won game 3.")  # game 2 was already B's
    (entry,) = [e for e in c.get("/api/admin/log").get_json()["entries"] if e["action"] == "ruling"]
    assert entry["reason"] == "Clip shows B won game 3."
    assert entry["details"]["outcome"] == "overturn" and entry["details"]["winnerId"] == b.id
    assert entry["details"]["corrections"] == [{"n": 3, "from": a.id, "to": b.id}]


# ---------------------------------------------------------------- what players see


def test_players_see_the_ruling_and_reason_but_not_the_admin(make_player, make_admin):
    a, ca, b, cb, mid, c = claimed_by_admin(make_player, make_admin)
    admin = db.session.get(User, c.get("/api/me").get_json()["id"])
    rule(c, mid, "void", reason="Neither clip shows game 3.")
    for client in (ca, cb):
        m = client.get(f"/api/matches/{mid}").get_json()
        assert m["ruling"]["outcome"] == "void" and m["ruling"]["reason"] == "Neither clip shows game 3."
        assert set(m["ruling"]) == {"outcome", "reason", "at"}  # no Admin
        assert admin.username not in str(m)


def test_matches_without_a_ruling_have_none(make_player):
    *_, cb, mid = disputed(make_player)
    assert cb.get(f"/api/matches/{mid}").get_json()["ruling"] is None


# ---------------------------------------------------------------- the case page


def test_the_case_page_has_the_evidence(make_player, make_admin):
    a, ca, b, cb, mid = disputed(make_player)
    cb.put(f"/api/matches/{mid}/statement", json={"text": "I won game 3, clip in chat."})
    ca.put(f"/api/matches/{mid}/statement", json={"text": "They quit game 3."})
    _, c = make_admin()
    page = case(c, mid).get_json()

    assert [p["id"] for p in page["players"]] == [a.id, b.id]
    assert page["reportedBy"] == a.id and page["winner"] == a.id
    assert [(g["n"], g["winner"]) for g in page["games"]] == [(1, a.id), (2, b.id), (3, a.id)]
    assert page["dispute"]["games"] == [3] and page["dispute"]["by"] == b.id
    assert page["dispute"]["reason"] == "Game 3 was mine, they misclicked."
    assert page["dispute"]["statements"] == {
        str(a.id): {"text": "They quit game 3.", "updatedAt": page["dispute"]["statements"][str(a.id)]["updatedAt"]},
        str(b.id): {"text": "I won game 3, clip in chat.", "updatedAt": page["dispute"]["statements"][str(b.id)]["updatedAt"]},
    }
    assert page["messages"][-1] == {**page["messages"][-1], "from": None, "text": "Result disputed. An Admin will review it."}


def test_a_dispute_filed_before_the_form_is_still_a_case(make_player, make_admin):
    a, ca, b, cb, mid = reported(make_player)
    m = db.session.get(Match, mid)
    m.status = "disputed"  # what the old dispute endpoint did: no games, no reason
    db.session.commit()
    _, c = make_admin()
    assert [x["matchId"] for x in cases(c).get_json()["cases"]] == [mid]
    assert case(c, mid).get_json()["dispute"]["reason"] is None


def test_matches_never_disputed_are_not_cases(make_player, make_admin):
    *_, mid = reported(make_player)
    _, c = make_admin()
    assert case(c, mid).status_code == 404


# ---------------------------------------------------------------- dispute records


def test_dispute_records_count_disputes_filed_and_how_each_was_ruled(make_player, make_admin):
    a, ca = make_player()
    b, cb = make_player()
    _, c = make_admin()

    def disputed_by_b(outcome=None):
        ca.post("/api/queue", json=NT_BO3)
        mid = cb.post("/api/queue", json=NT_BO3).get_json()["match"]["id"]
        ca.post(f"/api/matches/{mid}/accept")
        cb.post(f"/api/matches/{mid}/accept")
        report(ca, mid, 1, a)
        report(ca, mid, 2, a)
        dispute(cb, mid, games=[1])
        if outcome:
            claim(c, mid)
            rule(c, mid, outcome)
        return mid

    disputed_by_b("uphold")
    disputed_by_b("uphold")
    disputed_by_b("void")
    mid = disputed_by_b()

    records = case(c, mid).get_json()["records"]
    assert records[str(b.id)]["filed"] == 4
    assert records[str(b.id)]["outcomes"] == {"uphold": 2, "void": 1, "pending": 1}
    assert [r["outcome"] for r in records[str(b.id)]["disputes"]] == [None, "void", "uphold", "uphold"]
    assert records[str(a.id)] == {"filed": 0, "outcomes": {}, "disputes": []}


# ---------------------------------------------------------------- leaving the role


def test_removing_an_admin_releases_their_claims(make_player, make_admin, master):
    *_, m1 = disputed(make_player)
    *_, m2 = disputed(make_player)
    kefka, c = make_admin()
    m, mc = master
    claim(c, m1)
    claim(c, m2)
    mc.post(f"/api/admin/admins/{kefka.id}/remove", json={"reason": "Inactive"})
    assert [x["claim"] for x in cases(mc).get_json()["cases"]] == [None, None]
    released = [e for e in mc.get("/api/admin/log").get_json()["entries"] if e["action"] == "release_claim"]
    assert sorted(e["matchId"] for e in released) == [m1, m2]
    assert all(e["actor"]["id"] == m.id and e["target"]["id"] == kefka.id for e in released)


def test_stepping_down_releases_your_claims(make_player, make_admin, master):
    *_, mid = disputed(make_player)
    _, c = make_admin()
    _, mc = master
    claim(c, mid)
    c.post("/api/admin/step-down", json={"reason": "Taking a break"})
    assert case(mc, mid).get_json()["claim"] is None


def test_the_masters_claims_are_not_touched_when_an_admin_leaves(make_player, make_admin, master):
    *_, mid = disputed(make_player)
    kefka, c = make_admin()
    m, mc = master
    claim(mc, mid)
    mc.post(f"/api/admin/admins/{kefka.id}/remove", json={"reason": "Inactive"})
    assert case(mc, mid).get_json()["claim"]["by"]["id"] == m.id


def test_dispute_records_show_when_each_dispute_was_filed_not_when_it_was_ruled(make_player, make_admin, monkeypatch):
    a, ca, b, cb, mid = disputed(make_player)
    _, c = make_admin()
    filed = case(c, mid).get_json()["records"][str(b.id)]["disputes"][0]["at"]
    later = clock.now() + timedelta(days=1)
    monkeypatch.setattr(clock, "now", lambda: later)
    claim(c, mid)
    rule(c, mid, "void")
    page = case(c, mid).get_json()
    assert page["records"][str(b.id)]["disputes"][0]["at"] == filed
    assert page["disputedAt"] == filed


def test_the_master_ruling_on_an_admins_claim_is_logged_with_whose_claim_it_was(make_player, make_admin, master):
    *_, mid = disputed(make_player)
    kefka, c = make_admin()
    _, mc = master
    claim(c, mid)
    rule(mc, mid, "uphold")
    (entry,) = [e for e in mc.get("/api/admin/log").get_json()["entries"] if e["action"] == "ruling"]
    assert entry["details"]["claimedById"] == kefka.id


def test_claims_and_rulings_record_the_time_on_the_clock(make_player, make_admin, monkeypatch):
    *_, mid = disputed(make_player)
    _, c = make_admin()
    later = clock.now() + timedelta(days=3)
    monkeypatch.setattr(clock, "now", lambda: later)
    claim(c, mid)
    assert case(c, mid).get_json()["claim"]["at"] == clock.iso(later)
    rule(c, mid, "void")
    assert case(c, mid).get_json()["ruling"]["at"] == clock.iso(later)
