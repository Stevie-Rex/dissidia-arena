"""Ranked wins and reward unlocks (Classic at 10, then one more every 5 wins)."""

import pytest

from app import rewards
from app.extensions import db
from app.models import Match, User, UserUnlock

NT = {"game": "nt", "mode": "1v1", "bestOf": 3, "platform": "PS4"}
R012 = {"game": "012", "mode": "1v1", "bestOf": 3, "platform": "PPSSPP"}


def play(winner_pair, loser_pair, settings=NT, winner_reports=True):
    """Queue, accept and finish a Bo3 2-0. Returns (match id, confirm response body)."""
    (w, cw), (l, cl) = winner_pair, loser_pair
    assert cw.post("/api/queue", json=settings).status_code == 201
    mid = cl.post("/api/queue", json=settings).get_json()["match"]["id"]
    cw.post(f"/api/matches/{mid}/accept")
    cl.post(f"/api/matches/{mid}/accept")
    reporter, confirmer = (cw, cl) if winner_reports else (cl, cw)
    for n in (1, 2):
        assert reporter.post(f"/api/matches/{mid}/games", json={"gameNo": n, "winnerId": w.id}).status_code == 200
    res = confirmer.post(f"/api/matches/{mid}/confirm")
    assert res.status_code == 200, res.get_json()
    return mid, res.get_json()


def set_wins(user: User, wins: int):
    user.ranked_wins = wins
    db.session.commit()


def keys(user: User) -> set[str]:
    return rewards.unlocked_keys(user.id)


# ---------------------------------------------------------------- catalogue


def test_ladder_is_classic_at_10_then_every_5():
    goals = [r["goal"] for r in rewards.REWARDS]
    assert goals == sorted(goals)
    assert rewards.REWARDS[0]["key"] == "classic_interface" and goals[0] == 10
    assert goals[:9] == [10, 15, 20, 25, 30, 35, 40, 45, 50]
    assert rewards.REWARDS_BY_KEY["window_custom"]["goal"] == 60


@pytest.mark.parametrize(
    "field, value, reward",
    [
        ("interface", "classic", "classic_interface"),
        ("interface", "rift", None),
        ("window_theme", "classic", "classic_interface"),
        ("window_theme", "crystal", "window_crystal"),
        ("window_theme", "ivalice", "window_ivalice"),
        ("window_theme", "custom", "window_custom"),
        ("window_rgb", [1, 2, 3], "window_custom"),
        ("menu_font", "bit8", "font_8bit"),
        ("menu_font", "bit16", None),
        ("world", "mako", None),
        ("cursor", "arrow", None),
    ],
)
def test_required_reward(field, value, reward):
    assert rewards.required_reward(field, value) == reward


def test_rewards_for_wins():
    assert rewards.rewards_for_wins(9) == []
    assert rewards.rewards_for_wins(10) == ["classic_interface"]
    assert rewards.rewards_for_wins(17) == ["classic_interface", "window_crystal"]
    assert len(rewards.rewards_for_wins(60)) == len(rewards.REWARDS)


# ---------------------------------------------------------------- granting on confirm


def test_win_counts_only_for_the_winner(make_player):
    w, l = make_player(), make_player()
    _, body = play(w, l)
    db.session.refresh(w[0])
    db.session.refresh(l[0])
    assert w[0].ranked_wins == 1 and l[0].ranked_wins == 0
    assert body["newlyUnlocked"] == []
    assert w[1].get("/api/me/appearance").get_json()["ranked_losses"] == 0
    loser = l[1].get("/api/me/appearance").get_json()
    assert (loser["ranked_wins"], loser["ranked_losses"]) == (0, 1)


def test_tenth_win_unlocks_classic_once(make_player):
    w, l = make_player(), make_player()
    set_wins(w[0], 9)
    mid, body = play(w, l, winner_reports=False)  # the winner confirms, so they get the response
    assert body["newlyUnlocked"] == ["classic_interface"]
    assert body["rewardsUnlocked"] == [{"key": "classic_interface", "name": "Classic interface", "goal": 10}]
    assert keys(w[0]) == {"classic_interface"}
    assert keys(l[0]) == set()

    # Replaying the confirm is refused and grants nothing new.
    assert w[1].post(f"/api/matches/{mid}/confirm").status_code == 409
    assert db.session.query(UserUnlock).filter_by(user_id=w[0].id).count() == 1

    # The 11th win grants nothing.
    _, body = play(w, l, winner_reports=False)
    assert body["newlyUnlocked"] == []


def test_reporter_winner_sees_reward_on_match(make_player):
    """The loser confirms; the winner learns about the unlock from the match itself."""
    w, l = make_player(), make_player()
    set_wins(w[0], 9)
    mid, body = play(w, l, winner_reports=True)
    assert body["newlyUnlocked"] == [] and body["rewardsUnlocked"] == []  # loser's view
    mine = w[1].get(f"/api/matches/{mid}").get_json()
    assert [r["key"] for r in mine["rewardsUnlocked"]] == ["classic_interface"]


def test_fifteenth_win_unlocks_crystal_window(make_player):
    w, l = make_player(), make_player()
    set_wins(w[0], 14)
    rewards.grant_unlocks(w[0].id, 14)
    db.session.commit()
    _, body = play(w, l, winner_reports=False)
    assert body["newlyUnlocked"] == ["window_crystal"]


def test_wins_count_across_both_games(make_player):
    w, l = make_player(), make_player()
    set_wins(w[0], 8)
    play(w, l, NT)
    _, body = play(w, l, R012, winner_reports=False)
    db.session.refresh(w[0])
    assert w[0].ranked_wins == 10
    assert body["newlyUnlocked"] == ["classic_interface"]


@pytest.mark.parametrize("ending", ["dispute", "leave", "decline"])
def test_unfinished_matches_dont_count(make_player, ending):
    (w, cw), (l, cl) = make_player(), make_player()
    set_wins(w, 9)
    cw.post("/api/queue", json=NT)
    mid = cl.post("/api/queue", json=NT).get_json()["match"]["id"]
    if ending == "decline":
        cl.post(f"/api/matches/{mid}/decline")
    else:
        cw.post(f"/api/matches/{mid}/accept")
        cl.post(f"/api/matches/{mid}/accept")
        if ending == "dispute":
            for n in (1, 2):
                cw.post(f"/api/matches/{mid}/games", json={"gameNo": n, "winnerId": w.id})
            cl.post(f"/api/matches/{mid}/dispute")
        else:
            cl.post(f"/api/matches/{mid}/leave")
    db.session.refresh(w)
    assert w.ranked_wins == 9
    assert keys(w) == set()


def test_grant_unlocks_is_idempotent(make_player):
    (u, _) = make_player()
    assert rewards.grant_unlocks(u.id, 22) == ["classic_interface", "window_crystal", "window_magitek"]
    assert rewards.grant_unlocks(u.id, 22) == []
    db.session.commit()
    assert keys(u) == {"classic_interface", "window_crystal", "window_magitek"}


# ---------------------------------------------------------------- backfill


def test_backfill_recounts_and_grants(make_player, app):
    w, l = make_player(), make_player()
    for _ in range(3):
        play(w, l)
    # Simulate the pre-rewards world: counts and unlocks wiped.
    db.session.query(UserUnlock).delete()
    db.session.query(User).update({User.ranked_wins: 0})
    # Pretend the winner had 12 completed wins before this feature shipped.
    m = db.session.query(Match).first()
    for _ in range(12):
        db.session.add(Match(
            game="nt", mode="1v1", best_of=3, platform="PS4", region="NA", status="completed",
            player_a_id=w[0].id, player_b_id=l[0].id, accept_deadline=m.accept_deadline, winner_id=w[0].id,
        ))
    db.session.add(Match(
        game="nt", mode="1v1", best_of=3, platform="PS4", region="NA", status="disputed",
        player_a_id=w[0].id, player_b_id=l[0].id, accept_deadline=m.accept_deadline, winner_id=w[0].id,
    ))
    db.session.commit()

    result = app.test_cli_runner().invoke(args=["backfill-rewards"])
    assert result.exit_code == 0, result.output
    assert "2 unlocks granted" in result.output
    db.session.expire_all()
    assert db.session.get(User, w[0].id).ranked_wins == 15
    assert keys(w[0]) == {"classic_interface", "window_crystal"}
    assert keys(l[0]) == set()

    # Running it again changes nothing.
    result = app.test_cli_runner().invoke(args=["backfill-rewards"])
    assert "0 unlocks granted" in result.output


def test_backfill_never_removes_unlocks(make_player):
    (u, _) = make_player()
    rewards.grant_unlocks(u.id, 30)
    db.session.commit()
    rewards.backfill()  # u has no completed matches, so the recount is 0
    db.session.commit()
    assert "window_garden" in keys(u)
