import os

# Config reads these at import time; give tests safe defaults so they don't need a real .env.
os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("DATABASE_URL", "sqlite://")

import pytest

from app import create_app
from app.config import Config
from app.extensions import db


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
