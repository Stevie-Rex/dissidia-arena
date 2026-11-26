"""The Alembic chain, run against a real (SQLite file) database rather than db.create_all()."""

import os

import sqlalchemy as sa
from flask_migrate import downgrade, upgrade

from app import create_app
from tests.conftest import TestConfig

MIGRATIONS = os.path.join(os.path.dirname(__file__), "..", "migrations")


def _preference_columns(app):
    from app.extensions import db

    return {c["name"] for c in sa.inspect(db.engine).get_columns("user_preferences")}


def test_drop_world_migration_runs_up_and_down(tmp_path):
    class FileDb(TestConfig):
        SQLALCHEMY_DATABASE_URI = f"sqlite:///{tmp_path / 'migrations.db'}"

    app = create_app(FileDb)
    with app.app_context():
        upgrade(directory=MIGRATIONS)
        assert "world" not in _preference_columns(app)

        downgrade(directory=MIGRATIONS, revision="b3d5f7a9c1e4")
        assert "world" in _preference_columns(app)

        upgrade(directory=MIGRATIONS)
        assert "world" not in _preference_columns(app)


def test_rift_mode_migration_runs_up_and_down(tmp_path):
    class FileDb(TestConfig):
        SQLALCHEMY_DATABASE_URI = f"sqlite:///{tmp_path / 'migrations.db'}"

    app = create_app(FileDb)
    with app.app_context():
        upgrade(directory=MIGRATIONS)
        assert "rift_mode" in _preference_columns(app)

        downgrade(directory=MIGRATIONS, revision="-1")
        assert "rift_mode" not in _preference_columns(app)

        upgrade(directory=MIGRATIONS)
        assert "rift_mode" in _preference_columns(app)
