"""Checks on the test suite itself, for mistakes that only show up later: on MariaDB in CI, or when
the next migration lands."""

import re
from pathlib import Path

TESTS = Path(__file__).parent


def offenders(pattern: str, files) -> list[str]:
    """Each match of pattern, as file:line. Matched against the whole file, so a call split over
    several lines is caught too."""
    rx = re.compile(pattern)
    out = []
    for f in files:
        text = f.read_text(encoding="utf-8")
        for m in rx.finditer(text):
            n = text.count("\n", 0, m.start()) + 1
            out.append(f"{f.name}:{n}: {' '.join(m.group(0).split())}")
    return out


def test_database_refusals_are_expected_with_db_refuses():
    """SQLite and MariaDB raise different errors for the same refusal (MariaDB reports a failed CHECK
    as an OperationalError), so tests expect one with conftest.db_refuses()."""
    files = [f for f in TESTS.glob("test_*.py") if f.name != Path(__file__).name]
    assert offenders(r"pytest\.raises\(\s*\(?\s*(sa\.exc\.|sqlalchemy\.exc\.)?(IntegrityError|OperationalError)", files) == []


def test_migration_tests_downgrade_to_a_named_revision():
    """A relative revision ("-1") moves with the head, so the next migration would change what the test
    checks. Name the revision the test means."""
    assert offenders(r"""revision\s*=\s*["'][-+]\d""", [TESTS / "test_migrations.py"]) == []
