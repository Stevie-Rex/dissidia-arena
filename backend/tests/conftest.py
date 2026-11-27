import os
from datetime import timedelta

# Config reads these at import time; give tests safe defaults so they don't need a real .env.
os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("DATABASE_URL", "sqlite://")

import pytest

from app import create_app
from app.config import Config
from app.extensions import db
from app import clock
from app.models import Match, MatchGame, Settlement, User

MASTER_DISCORD_ID = 4242


class TestConfig(Config):
    TESTING = True
    # In-memory SQLite by default. CI also runs the suite on MariaDB, as production does, by setting
    # TEST_DATABASE_URL (see .github/workflows/tests.yml).
    SQLALCHEMY_DATABASE_URI = os.environ.get("TEST_DATABASE_URL", "sqlite://")
    SQLALCHEMY_ENGINE_OPTIONS = {}
    DISCORD_CLIENT_ID = "client-id"
    DISCORD_CLIENT_SECRET = "client-secret"
    DISCORD_REDIRECT_URI = "http://localhost:5173/api/auth/discord/callback"
    FRONTEND_URL = "http://localhost:5173"
    MASTER_DISCORD_ID = str(MASTER_DISCORD_ID)


@pytest.fixture
def app(tmp_path):
    app = create_app(TestConfig)
    app.config["UPLOAD_DIR"] = str(tmp_path / "uploads")  # never the real upload directory
    with app.app_context():
        db.create_all()
        yield app
        # End the test's transaction first: on MariaDB an open one holds table locks that DROP TABLE waits on.
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def make_player(app):
    """Returns (user, client) for a signed-in, onboarded player with its own session."""
    n = iter(range(1, 1000))

    def make(region="NA", game_ids=None, onboarded=True, discord_id=None):
        i = next(n)
        user = User(
            discord_id=discord_id or 1000 + i,
            username=f"p{i}",
            region=region,
            onboarded=onboarded,
            game_ids={"nt": f"psn_{i}", "012": f"ppsspp_{i}"} if game_ids is None else game_ids,
        )
        db.session.add(user)
        db.session.commit()
        client = app.test_client()
        with client.session_transaction() as s:
            s["user_id"] = user.id
        return user, client

    return make


# Each status's games, as each game's winner in order. A reports every game.
_GAMES = {
    "pending": "",
    "active": "a",
    "reported": "aa",
    "disputed": "aba",
    "completed": "aa",
    "voided": "a",
    "cancelled": "",
    "abandoned": "a",
}


@pytest.fixture
def make_match(make_player):
    """Returns (match, a, b): a ranked NT Bo3 between two fresh players, already in the given status,
    with the games, winner and deadlines a match in that status has. No deadline has passed."""

    def make(status):
        (a, _), (b, _) = make_player(), make_player()
        t = clock.now()
        accepted = status not in ("pending", "cancelled")
        match = Match(
            game="nt", mode="1v1", best_of=3, platform="PS4", region="NA", status=status,
            player_a_id=a.id, player_b_id=b.id, a_accepted=accepted, b_accepted=accepted,
            accept_deadline=t + timedelta(minutes=1), created_at=t,
        )
        for n, w in enumerate(_GAMES[status], start=1):
            match.games.append(MatchGame(game_no=n, winner_id={"a": a, "b": b}[w].id, reported_by_id=a.id, details={}))
        if status in ("reported", "disputed", "completed"):
            match.reported_by_id = match.winner_id = a.id
        if status == "reported":
            match.confirm_deadline = t + timedelta(hours=2)
        if status == "disputed":
            match.dispute_games, match.dispute_reason, match.ended_by_id = [3], "Game 3 was mine.", b.id
            match.disputed_at = t
        if status == "abandoned":
            match.ended_by_id = b.id
        if status not in ("pending", "active", "reported"):
            match.finished_at = t
        db.session.add(match)
        db.session.flush()
        if status in ("completed", "voided"):  # the row app.settlement would have written
            won = status == "completed"
            db.session.add(Settlement(
                match_id=match.id, outcome=status, winner_id=a.id if won else None, loser_id=b.id if won else None,
                ladder="nt/PS4", settled_at=t,
            ))
        db.session.commit()
        return match, a, b

    return make


@pytest.fixture
def master(make_player):
    """(user, client) for the Master: the player whose Discord ID is the configured MASTER_DISCORD_ID."""
    return make_player(discord_id=MASTER_DISCORD_ID)


@pytest.fixture
def make_admin(make_player):
    """Returns (user, client) for a signed-in Admin."""

    def make(**kwargs):
        user, client = make_player(**kwargs)
        user.admin_since = clock.now()
        db.session.commit()
        return user, client

    return make
