"""The Alembic chain, run against a real (SQLite file) database rather than db.create_all()."""

import os

import sqlalchemy as sa
from flask_migrate import downgrade, upgrade

from app import create_app
from tests.conftest import TestConfig, db_refuses

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

        downgrade(directory=MIGRATIONS, revision="c7e9a1b3d5f8")
        assert "rift_mode" not in _preference_columns(app)

        upgrade(directory=MIGRATIONS)
        assert "rift_mode" in _preference_columns(app)


def _seed_players(conn):
    for uid in (1, 2):
        conn.execute(sa.text("INSERT INTO users (id, discord_id, username, ranked_wins, onboarded, region, games,"
                             " game_ids, created_at) VALUES (:id, :id, :name, 0, 1, 'NA', '[]', '{}',"
                             " '2026-11-01 09:00:00')"), {"id": uid, "name": f"p{uid}"})


def _seed_match(conn, mid, status, game="nt", platform="PS4", winner=None, finished=None):
    conn.execute(sa.text(
        "INSERT INTO matches (id, game, mode, best_of, platform, region, status, player_a_id, player_b_id,"
        " a_accepted, b_accepted, accept_deadline, winner_id, finished_at, created_at, replay_unfinished)"
        " VALUES (:id, :game, '1v1', 3, :platform, 'NA', :status, 1, 2, 1, 1, '2026-11-01 09:00:00',"
        " :winner, :finished, '2026-11-01 09:00:00', 0)"
    ), {"id": mid, "game": game, "platform": platform, "status": status, "winner": winner, "finished": finished})


def test_settlements_migration_adds_a_row_for_every_settled_match(tmp_path):
    class FileDb(TestConfig):
        SQLALCHEMY_DATABASE_URI = f"sqlite:///{tmp_path / 'migrations.db'}"

    app = create_app(FileDb)
    with app.app_context():
        from app.extensions import db

        upgrade(directory=MIGRATIONS, revision="d4f6a8c0e2b1")
        with db.engine.begin() as conn:
            _seed_players(conn)
            for mid, status, game, platform, winner, finished in [
                (1, "completed", "nt", "PS4", 2, "2026-11-01 10:00:00"),
                (2, "completed", "012", "PPSSPP", 1, "2026-11-02 10:00:00"),
                (3, "voided", "nt", "PC", None, "2026-11-03 10:00:00"),
                (4, "cancelled", "nt", "PS4", None, "2026-11-04 10:00:00"),
                (5, "active", "nt", "PS4", None, None),
            ]:
                _seed_match(conn, mid, status, game, platform, winner, finished)

        upgrade(directory=MIGRATIONS)
        with db.engine.connect() as conn:
            rows = conn.execute(sa.text(
                "SELECT match_id, outcome, winner_id, loser_id, ladder, settled_at, unsettled_at"
                " FROM settlements ORDER BY match_id"
            )).all()
        assert [tuple(r[:5]) for r in rows] == [
            (1, "completed", 2, 1, "nt/PS4"),
            (2, "completed", 1, 2, "012/PPSSPP"),
            (3, "voided", None, None, "nt/PC"),
        ]
        assert [str(r[5]).startswith(d) for r, d in zip(rows, ["2026-11-01 10", "2026-11-02 10", "2026-11-03 10"])] == [True] * 3
        assert all(r[6] is None for r in rows)

        downgrade(directory=MIGRATIONS, revision="d4f6a8c0e2b1")
        assert "settlements" not in sa.inspect(db.engine).get_table_names()


def test_unsettled_at_migration_keeps_every_row_and_the_one_live_row_rule(tmp_path):
    class FileDb(TestConfig):
        SQLALCHEMY_DATABASE_URI = f"sqlite:///{tmp_path / 'migrations.db'}"

    app = create_app(FileDb)
    with app.app_context():
        from app.extensions import db

        upgrade(directory=MIGRATIONS, revision="e8b1d3f5a7c9")
        with db.engine.begin() as conn:
            _seed_players(conn)
            _seed_match(conn, 1, "completed", winner=1, finished="2026-11-01 10:00:00")
            conn.execute(sa.text(  # the live settle of match 1, and an earlier one that was taken back
                "INSERT INTO settlements (match_id, outcome, winner_id, loser_id, ladder, settled_at, undone_at) VALUES"
                " (1, 'completed', 1, 2, 'nt/PS4', '2026-11-01 10:00:00', NULL),"
                " (1, 'completed', 2, 1, 'nt/PS4', '2026-10-30 10:00:00', '2026-10-31 10:00:00')"
            ))

        upgrade(directory=MIGRATIONS)
        with db.engine.connect() as conn:
            rows = conn.execute(sa.text(
                "SELECT winner_id, unsettled_at IS NULL FROM settlements WHERE match_id = 1 ORDER BY id"
            )).all()
        assert [tuple(r) for r in rows] == [(1, 1), (2, 0)]
        with db_refuses(), db.engine.begin() as conn:
            conn.execute(sa.text(
                "INSERT INTO settlements (match_id, outcome, ladder, settled_at) VALUES (1, 'voided', 'nt/PS4', '2026-11-02 10:00:00')"
            ))

        downgrade(directory=MIGRATIONS, revision="e8b1d3f5a7c9")
        with db.engine.connect() as conn:
            assert conn.execute(sa.text("SELECT count(*) FROM settlements WHERE undone_at IS NOT NULL")).scalar() == 1
