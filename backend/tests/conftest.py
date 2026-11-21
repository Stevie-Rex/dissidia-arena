import os

# Config reads these at import time; give tests safe defaults so they don't need a real .env.
os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("DATABASE_URL", "sqlite://")

import pytest

from app import create_app
from app.config import Config
from app.extensions import db
from app.models import User


class TestConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite://"
    SQLALCHEMY_ENGINE_OPTIONS = {}
    DISCORD_CLIENT_ID = "client-id"
    DISCORD_CLIENT_SECRET = "client-secret"
    DISCORD_REDIRECT_URI = "http://localhost:5173/api/auth/discord/callback"
    FRONTEND_URL = "http://localhost:5173"


@pytest.fixture
def app():
    app = create_app(TestConfig)
    with app.app_context():
        db.create_all()
        yield app
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def make_player(app):
    """Returns (user, client) for a signed-in, onboarded player with its own session."""
    n = iter(range(1, 1000))

    def make(region="NA", game_ids=None, onboarded=True):
        i = next(n)
        user = User(
            discord_id=1000 + i,
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
