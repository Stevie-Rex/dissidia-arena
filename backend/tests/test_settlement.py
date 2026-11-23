"""The Settlement module: who won a series, and settling a match (completed with a winner, or Voided)."""

import pytest

from app import clock, rewards, settlement
from app.errors import MatchmakingError
from app.extensions import db
from app.models import Match, MatchGame


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
    refuses("not_open", settlement.complete, match, a, b)


def test_a_completed_match_is_never_settled_twice(make_player):
    match, a, b = build(make_player, "aa")
    settlement.complete(match, "Result confirmed.")
    refuses("not_open", settlement.complete, match, a, b)
    assert a.ranked_wins == 1


# ---------------------------------------------------------------- void


@pytest.mark.parametrize("status, games", [("pending", ""), ("active", "a"), ("reported", "aa"), ("disputed", "aba")])
def test_void_counts_for_no_one(make_player, status, games):
    match, a, b = build(make_player, games, status=status)
    match.winner_id = a.id if status in ("reported", "disputed") else None
    settlement.void(match, "Ruling: the match is void. It counts for no one.")
    assert (match.status, match.winner_id) == ("voided", None)
    assert match.finished_at is not None
    assert (a.ranked_wins, b.ranked_wins) == (0, 0)
    assert rewards.unlocked_keys(a.id) == rewards.unlocked_keys(b.id) == set()
    assert system_messages(match)[-1] == "Ruling: the match is void. It counts for no one."


@pytest.mark.parametrize("status", ["completed", "voided", "cancelled", "abandoned"])
def test_void_refuses_a_match_that_is_not_open(make_player, status):
    match, a, b = build(make_player, "aa", status=status)
    refuses("not_open", settlement.void, match, a, b)
