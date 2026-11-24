"""
Matchmaker worker: runs matchmaking.tick() on a timer.

Pairing used to happen only when a player polled GET /api/queue, which never happens for
players who queue from Discord. Run this alongside the web server:

    FLASK_APP=run.py flask matchmaker
"""

import logging
import time

import click
from flask import Flask

from . import matchmaking as mm
from . import screenshots
from .extensions import db

log = logging.getLogger("matchmaker")


def run_once() -> dict[str, list]:
    try:
        result = mm.tick()
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise
    for m in result["created"]:
        log.info("match %s created: %s vs %s (%s %s)", m.id, m.player_a_id, m.player_b_id, m.game, m.platform)
    for m in result["expired"]:
        log.info("match %s expired: accept window passed", m.id)
    for m in result["autoConfirmed"]:
        log.info("match %s auto-confirmed: confirm deadline passed", m.id)
    for m in result["replayExpired"]:
        log.info("match %s back to the Admins: Replay not finished by the deadline", m.id)
    # Phase 2: hand result to the Discord bot so it can DM / thread the players.
    return result


# How often the matchmaker loop runs the screenshot retention job. It only looks for cases that
# closed 90 days ago, so once an hour is plenty.
PURGE_EVERY_SECONDS = 60 * 60


def purge_screenshots() -> list:
    """Delete dispute screenshots 90 days after the final Ruling (see screenshots.purge)."""
    try:
        purged = screenshots.purge()
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise
    for m in purged:
        log.info("match %s: screenshots deleted after %s days", m.id, screenshots.RETENTION_DAYS)
    return purged


def cycle(last_purge: float) -> float:
    """One pass of the matchmaker loop: a matchmaking tick, then the screenshot job if it is due.
    Each fails on its own, so a broken tick never stops retention. Returns when retention last ran
    (or was last tried: a failing purge waits its hour, it doesn't retry every tick)."""
    try:
        run_once()
    except Exception:
        log.exception("tick failed")  # keep going; the next tick retries
    finally:
        db.session.remove()  # fresh session each tick so we never see stale rows
    if time.monotonic() - last_purge >= PURGE_EVERY_SECONDS:
        last_purge = time.monotonic()
        try:
            purge_screenshots()
        except Exception:
            log.exception("screenshot purge failed")
        finally:
            db.session.remove()
    return last_purge


def register(app: Flask) -> None:
    @app.cli.command("purge-screenshots")
    def purge_screenshots_command() -> None:
        """Delete dispute screenshots whose case closed 90 or more days ago."""
        click.echo(f"{len(purge_screenshots())} matches had their screenshots deleted")

    @app.cli.command("matchmaker")
    @click.option("--interval", default=2.0, show_default=True, help="Seconds between ticks.")
    def matchmaker(interval: float) -> None:
        """Pair queued players and expire accept windows on a timer."""
        logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s")
        log.info("matchmaker running every %ss", interval)
        last_purge = float("-inf")  # so the first pass also runs it
        while True:
            last_purge = cycle(last_purge)
            time.sleep(interval)
