import os

# Config reads these at import time; give tests safe defaults so they don't need a real .env.
os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("DATABASE_URL", "sqlite://")

import pytest

from app import create_app
from app.config import Config
from app.extensions import db
from app import clock
from app.models import User

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
