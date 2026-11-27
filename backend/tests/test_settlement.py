"""The Settlement module: who won a series, and settling a match (completed with a winner, or Voided)."""

import pytest

from app import clock, rewards, settlement
from app.errors import MatchmakingError
from app.extensions import db
from app.models import Match, MatchGame, Settlement, User
from tests.conftest import db_refuses


def build(make_player, games: str, status: str = "reported", reported_by: str = "a"):
    """A ranked NT Bo3 between two fresh players. games lists each game's winner in order, e.g.
    "aba". reported_by is who reported the series (if it was). Returns (match, a, b)."""
    a, _ = make_player()
    b, _ = make_player()
    players = {"a": a, "b": b}
    t = clock.now()
    match = Match(
        game="nt", mode="1v1", best_of=3, platform="PS4", region="NA", status=status,
        player_a_id=a.id, player_b_id=b.id, a_accepted=True, b_accepted=True,
        accept_deadline=t, created_at=t,
    )
    for n, w in enumerate(games, start=1):
        match.games.append(MatchGame(game_no=n, winner_id=players[w].id, reported_by_id=players[reported_by].id, details={}))
    if status in ("reported", "disputed"):
        match.reported_by_id = players[reported_by].id
    db.session.add(match)
    db.session.commit()
    return match, a, b


# ---------------------------------------------------------------- series_winner


@pytest.mark.parametrize(
    "games, winner",
    [("aa", "a"), ("bb", "b"), ("aba", "a"), ("bab", "b"), ("baa", "a"), ("abb", "b"), ("ab", None), ("ba", None), ("a", None), ("", None)],
)
def test_the_series_winner_is_whoever_reached_the_winning_score(make_player, games, winner):
    match, a, b = build(make_player, games, status="active")
    assert settlement.series_winner(match) == {"a": a, "b": b, None: None}[winner]


# ---------------------------------------------------------------- complete


def system_messages(match):
    return [m.text for m in match.messages if m.user_id is None]


def test_complete_credits_one_ranked_win_to_the_series_winner(make_player):
    match, a, b = build(make_player, "aba")
    result = settlement.complete(match, "Result confirmed.")
    assert (match.status, match.winner_id) == ("completed", a.id)
    assert match.finished_at is not None
    assert (a.ranked_wins, b.ranked_wins) == (1, 0)
    assert result.unlocked == ()
    assert system_messages(match)[-1] == "Result confirmed."


def test_the_winner_follows_the_games_not_the_reporter(make_player):
    match, a, b = build(make_player, "bb", reported_by="a")
    match.winner_id = a.id  # a stale or wrong winner on the row doesn't matter
    settlement.complete(match, "Result confirmed.")
    assert match.winner_id == b.id
    assert (a.ranked_wins, b.ranked_wins) == (0, 1)


def test_complete_grants_unlocks_tagged_with_the_match(make_player):
    match, a, _ = build(make_player, "aa")
    a.ranked_wins = 9
    db.session.commit()
    result = settlement.complete(match, "Result confirmed.")
    assert a.ranked_wins == 10
    assert result.unlocked == ("classic_interface",)
    assert [r["key"] for r in rewards.rewards_from_match(match, a.id)] == ["classic_interface"]


def snapshot(match, a, b):
    """Everything settling could change, as seen from outside."""
    return (match.status, match.winner_id, match.finished_at, a.ranked_wins, b.ranked_wins,
            rewards.unlocked_keys(a.id), rewards.unlocked_keys(b.id), system_messages(match))


def refuses(code, fn, match, a, b):
    before = snapshot(match, a, b)
    with pytest.raises(MatchmakingError) as e:
        fn(match, "Should not be posted.")
    assert e.value.code == code
    assert snapshot(match, a, b) == before


@pytest.mark.parametrize("status", ["reported", "disputed"])
def test_complete_refuses_a_series_with_no_winner(make_player, status):
    match, a, b = build(make_player, "ab", status=status)
    refuses("no_series_winner", settlement.complete, match, a, b)


@pytest.mark.parametrize("status", ["pending", "active", "completed", "voided", "cancelled", "abandoned"])
def test_complete_refuses_a_match_that_is_not_reported_or_disputed(make_player, status):
    match, a, b = build(make_player, "aa", status=status)
    refuses("bad_status", settlement.complete, match, a, b)


def test_a_completed_match_is_never_settled_twice(make_player):
    match, a, b = build(make_player, "aa")
    settlement.complete(match, "Result confirmed.")
    refuses("bad_status", settlement.complete, match, a, b)
    assert a.ranked_wins == 1


def rows(match):
    return db.session.query(Settlement).filter_by(match_id=match.id).all()


@pytest.mark.parametrize("game, platform, ladder", [("nt", "PS4", "nt/PS4"), ("nt", "PC", "nt/PC"), ("012", "PPSSPP", "012/PPSSPP")])
def test_complete_writes_one_row_with_the_winner_the_loser_and_the_ladder(make_player, game, platform, ladder):
    match, a, b = build(make_player, "bab")
    match.game, match.platform = game, platform
    settlement.complete(match, "Result confirmed.")
    db.session.commit()
    [row] = rows(match)
    assert (row.outcome, row.winner_id, row.loser_id, row.ladder) == ("completed", b.id, a.id, ladder)
    assert row.settled_at == match.finished_at
    assert row.unsettled_at is None


# ---------------------------------------------------------------- void


@pytest.mark.parametrize("status, games", [("pending", ""), ("active", "a"), ("reported", "aa"), ("disputed", "aba")])
def test_void_counts_for_no_one(make_player, status, games):
    match, a, b = build(make_player, games, status=status)
    match.winner_id = a.id if status in ("reported", "disputed") else None
    result = settlement.void(match, "Ruling: the match is void. It counts for no one.")
    assert result == settlement.Settled(winner_id=None, unlocked=())
    assert (match.status, match.winner_id) == ("voided", None)
    assert match.finished_at is not None
    assert (a.ranked_wins, b.ranked_wins) == (0, 0)
    assert rewards.unlocked_keys(a.id) == rewards.unlocked_keys(b.id) == set()
    assert system_messages(match)[-1] == "Ruling: the match is void. It counts for no one."


@pytest.mark.parametrize("status", ["completed", "voided", "cancelled", "abandoned"])
def test_void_refuses_a_match_that_is_not_open(make_player, status):
    match, a, b = build(make_player, "aa", status=status)
    refuses("bad_status", settlement.void, match, a, b)


def test_void_writes_one_row_with_no_winner_or_loser(make_player):
    match, a, b = build(make_player, "aba", status="disputed")
    settlement.void(match, "Ruling: the match is void. It counts for no one.")
    db.session.commit()
    [row] = rows(match)
    assert (row.outcome, row.winner_id, row.loser_id, row.ladder) == ("voided", None, None, "nt/PS4")
    assert row.settled_at == match.finished_at


# ---------------------------------------------------------------- one live row per match


def add_row(match, unsettled_at=None):
    db.session.add(Settlement(match_id=match.id, outcome="voided", ladder="nt/PS4",
                              settled_at=clock.now(), unsettled_at=unsettled_at))
    db.session.commit()


def test_the_database_refuses_a_second_live_row_for_a_match(make_player):
    match, a, b = build(make_player, "aa")
    settlement.complete(match, "Result confirmed.")
    db.session.commit()
    with db_refuses():
        add_row(match)
    assert len(rows(match)) == 1


def test_an_unsettled_row_leaves_room_for_the_next_settle(make_player):
    match, a, b = build(make_player, "aa")
    add_row(match, unsettled_at=clock.now())
    add_row(match, unsettled_at=clock.now())
    settlement.complete(match, "Result confirmed.")
    db.session.commit()
    assert sorted(r.unsettled_at is None for r in rows(match)) == [False, False, True]


def test_the_database_refuses_an_unknown_outcome(make_player):
    match, a, b = build(make_player, "aa")
    db.session.add(Settlement(match_id=match.id, outcome="void", ladder="nt/PS4", settled_at=clock.now()))
    with db_refuses():
        db.session.commit()


# ---------------------------------------------------------------- ranked wins and losses


def settle(make_player, games, how="complete"):
    match, a, b = build(make_player, games, status="disputed")
    getattr(settlement, how)(match, "Settled.")
    db.session.commit()
    return match, a, b


def test_a_settle_with_a_winner_is_a_ranked_loss_for_the_other_player(make_player):
    _, a, b = settle(make_player, "aa")
    assert (settlement.ranked_losses(a.id), settlement.ranked_losses(b.id)) == (0, 1)


def test_a_void_is_a_ranked_loss_for_no_one(make_player):
    _, a, b = settle(make_player, "aa", how="void")
    assert (settlement.ranked_losses(a.id), settlement.ranked_losses(b.id)) == (0, 0)


def test_unsettling_a_match_takes_back_its_ranked_loss(make_player):
    match, a, b = settle(make_player, "aa")
    rows(match)[0].unsettled_at = clock.now()
    db.session.commit()
    assert settlement.ranked_losses(b.id) == 0


def test_backfill_recounts_ranked_wins_from_the_rows_and_grants(make_player, app):
    w, l = make_player(), make_player()
    t = clock.now()

    def settled(**row):
        m = Match(game="nt", mode="1v1", best_of=3, platform="PS4", region="NA", status="completed",
                  player_a_id=w[0].id, player_b_id=l[0].id, accept_deadline=t, winner_id=w[0].id)
        db.session.add(m)
        db.session.flush()
        db.session.add(Settlement(match_id=m.id, ladder="nt/PS4", settled_at=t, **row))

    for _ in range(15):
        settled(outcome="completed", winner_id=w[0].id, loser_id=l[0].id)
    settled(outcome="completed", winner_id=w[0].id, loser_id=l[0].id, unsettled_at=t)  # reopened: doesn't count
    settled(outcome="voided")
    db.session.commit()

    result = app.test_cli_runner().invoke(args=["backfill-rewards"])
    assert result.exit_code == 0, result.output
    assert "2 unlocks granted" in result.output
    db.session.expire_all()
    assert (db.session.get(User, w[0].id).ranked_wins, db.session.get(User, l[0].id).ranked_wins) == (15, 0)
    assert rewards.unlocked_keys(w[0].id) == {"classic_interface", "window_crystal"}
    assert settlement.ranked_losses(l[0].id) == 15

    # Running it again changes nothing.
    result = app.test_cli_runner().invoke(args=["backfill-rewards"])
    assert "0 unlocks granted" in result.output


def test_backfill_never_removes_unlocks(make_player):
    (u, _) = make_player()
    rewards.grant_unlocks(u.id, 30)
    db.session.commit()
    settlement.backfill()  # u has no settles, so the recount is 0
    db.session.commit()
    assert "window_garden" in rewards.unlocked_keys(u.id)
