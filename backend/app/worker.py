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


def register(app: Flask) -> None:
    @app.cli.command("matchmaker")
    @click.option("--interval", default=2.0, show_default=True, help="Seconds between ticks.")
    def matchmaker(interval: float) -> None:
        """Pair queued players and expire accept windows on a timer."""
        logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s")
        log.info("matchmaker running every %ss", interval)
        while True:
            try:
                run_once()
            except Exception:
                log.exception("tick failed")  # keep going; the next tick retries
            finally:
                db.session.remove()  # fresh session each tick so we never see stale rows
            time.sleep(interval)
