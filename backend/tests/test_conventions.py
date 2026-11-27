"""Checks on the test suite itself, for mistakes that only show up later: on MariaDB in CI, or when
the next migration lands. They read each file's syntax tree, so line breaks, spacing and how a name
was imported don't matter."""

import ast
import re
from pathlib import Path

TESTS = Path(__file__).parent
REFUSALS = {"IntegrityError", "OperationalError"}
# What a named revision looks like here: every migration's id is 12 hex characters.
REVISION_ID = re.compile(r"[0-9a-f]{12}")


def calls(path: Path, name: str):
    """Every call in the file to a function whose name, or last attribute, is name."""
    for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
        if isinstance(node, ast.Call):
            f = node.func
            if (isinstance(f, ast.Name) and f.id == name) or (isinstance(f, ast.Attribute) and f.attr == name):
                yield node


def names_in(node) -> set[str]:
    """The bare names and last attributes anywhere in an expression: sa.exc.IntegrityError gives IntegrityError."""
    return {n.id for n in ast.walk(node) if isinstance(n, ast.Name)} | {
        n.attr for n in ast.walk(node) if isinstance(n, ast.Attribute)
    }


def test_database_refusals_are_expected_with_db_refuses():
    """SQLite and MariaDB raise different errors for the same refusal (MariaDB reports a failed CHECK
    as an OperationalError), so tests expect one with conftest.db_refuses()."""
    offenders = [
        f"{f.name}:{call.lineno}"
        for f in sorted(TESTS.glob("test_*.py"))
        for call in calls(f, "raises")
        if call.args and names_in(call.args[0]) & REFUSALS
    ]
    assert offenders == []


def test_migration_tests_downgrade_to_a_named_revision():
    """A relative revision ("-1", downgrade()'s default, "head-1", "base") moves as migrations are
    added, so the next one would change what the test checks. Name the revision id the test means."""
    offenders = []
    for call in calls(TESTS / "test_migrations.py", "downgrade"):
        kw = {k.arg: k.value for k in call.keywords}
        revision = kw.get("revision", call.args[1] if len(call.args) > 1 else None)
        named = (isinstance(revision, ast.Constant) and isinstance(revision.value, str)
                 and REVISION_ID.fullmatch(revision.value) is not None)
        if not named:
            offenders.append(f"test_migrations.py:{call.lineno}")
    assert offenders == []
