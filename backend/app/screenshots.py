"""
Screenshot evidence on Disputed matches (see GLOSSARY.md: Screenshot).

While a match is Disputed, each player can upload up to MAX_PER_PLAYER screenshots beside their
statement. Every upload is decoded as a real image and re-saved from its pixels alone, which
strips metadata such as location and means a disguised file is never what gets served. Files sit
in config UPLOAD_DIR under random names; the database row says whose it is and which dispute.

Follows matchmaking.py's conventions: functions work on the current db.session, take the match
already locked, raise MatchmakingError, and leave committing to the caller. The one side effect
outside the transaction is the file, so it is written last, once nothing can refuse.
"""

import io
import logging
import secrets
from collections.abc import Callable
from datetime import timedelta
from pathlib import Path

from flask import current_app
from PIL import Image, ImageOps, UnidentifiedImageError
from sqlalchemy import select

from . import admin_log, clock
from .errors import MatchmakingError
from .extensions import db
from .models import DisputeScreenshot, Match, User

log = logging.getLogger("screenshots")

MAX_PER_PLAYER = 3
# Screenshots are deleted this long after the case closed. Statements and Rulings are kept.
RETENTION_DAYS = 90
MAX_BYTES = 5 * 1024 * 1024
# A screenshot of any real screen is far smaller; this stops a tiny file that decodes to a huge image.
MAX_PIXELS = 40_000_000
# What we accept and store: the format Pillow detects -> (content type, file extension).
ALLOWED = {"PNG": ("image/png", ".png"), "JPEG": ("image/jpeg", ".jpg"), "WEBP": ("image/webp", ".webp")}


def url(match: Match, shot: DisputeScreenshot) -> str:
    return f"/api/matches/{match.id}/screenshots/{shot.id}"


def screenshot_dict(match: Match, shot: DisputeScreenshot) -> dict:
    return {
        "id": shot.id,
        "url": None if shot.removed_at else url(match, shot),  # no file left to fetch
        "at": clock.iso(shot.created_at),
        "round": shot.round,
        "removed": shot.removed_at is not None,
    }


def for_players(match: Match, rel: Callable[[int | None], str | None]) -> dict[str, list[dict]]:
    """The live dispute's screenshots as the players see them: yours and your opponent's."""
    out: dict[str, list[dict]] = {"you": [], "opponent": []}
    for shot in match.screenshots:
        if shot.round == match.dispute_round:
            out[rel(shot.user_id)].append(screenshot_dict(match, shot))
    return out


def for_admins(match: Match) -> dict[str, list[dict]]:
    """Every screenshot on the case, from every dispute, keyed by the user who uploaded it."""
    out: dict[str, list[dict]] = {}
    for shot in match.screenshots:
        out.setdefault(str(shot.user_id), []).append(screenshot_dict(match, shot))
    return out


def path(shot: DisputeScreenshot) -> Path:
    return Path(current_app.config["UPLOAD_DIR"]) / shot.filename


def _invalid(message: str) -> MatchmakingError:
    return MatchmakingError("validation", message, 400, {"file": message})


def _clean_copy(data: bytes) -> tuple[bytes, str]:
    """Decode the upload as a real image and re-save it from its pixels alone, so no metadata
    (location, camera, text chunks, an embedded profile) and nothing hidden in the file survives.
    Returns the new bytes and the format, one of ALLOWED. Only the first frame of an animation is kept."""
    if not data:
        raise _invalid("choose an image to upload")
    if len(data) > MAX_BYTES:
        raise _invalid("each screenshot can be up to 5 MB")
    try:
        # Only try the formats we accept, so a file that claims to be anything else is never parsed.
        with Image.open(io.BytesIO(data), formats=list(ALLOWED)) as img:
            fmt = img.format
            if fmt not in ALLOWED:
                raise _invalid("screenshots must be PNG, JPEG or WebP images")
            if img.width * img.height > MAX_PIXELS:
                raise _invalid("that image is too large; resize it and try again")
            img.load()
            img = ImageOps.exif_transpose(img)  # keep a phone photo upright once the EXIF is gone
            has_alpha = "A" in img.getbands() or "transparency" in img.info
            mode = "RGBA" if has_alpha and fmt != "JPEG" else "RGB"
            img = img.convert(mode)
            clean = Image.frombytes(mode, img.size, img.tobytes())
    except (UnidentifiedImageError, OSError, SyntaxError, ValueError, Image.DecompressionBombError):
        raise _invalid("that file isn't a valid PNG, JPEG or WebP image") from None
    out = io.BytesIO()
    clean.save(out, fmt, **({"optimize": True} if fmt == "PNG" else {"quality": 90}))
    return out.getvalue(), fmt


def add(match: Match, user: User, data: bytes) -> DisputeScreenshot:
    """Store a player's screenshot on a Disputed match. Refuses, changing nothing, unless the
    match is Disputed, the player has room for another, and the file is a real image."""
    if user.id not in (match.player_a_id, match.player_b_id):
        raise MatchmakingError("not_found", "match not found", 404)
    if match.status != "disputed":
        raise MatchmakingError("bad_status", f"match is {match.status}: screenshots are for Disputed matches")
    # A locking read, so the count includes every upload already committed, not an older snapshot.
    mine = db.session.scalars(
        select(DisputeScreenshot.id)
        .where(
            DisputeScreenshot.match_id == match.id,
            DisputeScreenshot.user_id == user.id,
            DisputeScreenshot.round == match.dispute_round,
        )
        .with_for_update()
    ).all()
    if len(mine) >= MAX_PER_PLAYER:
        raise MatchmakingError(
            "too_many_screenshots", f"you can add up to {MAX_PER_PLAYER} screenshots to a dispute"
        )
    clean, fmt = _clean_copy(data)
    content_type, ext = ALLOWED[fmt]
    # Last, because it can't be rolled back with the transaction.
    name = secrets.token_hex(16) + ext
    directory = Path(current_app.config["UPLOAD_DIR"])
    directory.mkdir(parents=True, exist_ok=True)
    target = directory / name
    try:
        target.write_bytes(clean)
    except OSError:  # such as a full volume: don't leave half a file that no row points to
        target.unlink(missing_ok=True)
        raise
    shot = DisputeScreenshot(
        user_id=user.id,
        round=match.dispute_round,
        filename=name,
        content_type=content_type,
        created_at=clock.now(),
    )
    match.screenshots.append(shot)
    return shot


def purge() -> list[Match]:
    """The retention job: delete the files of every case that closed RETENTION_DAYS ago, mark each
    screenshot removed (so it shows the placeholder), and log one system action per match.

    A case closes when its match is settled after a Ruling. A Replay isn't final: the clock starts when
    the replayed match settles, so the later of the Ruling and the settling counts. Matches still
    open, Disputed or Replaying keep their screenshots. Safe to run as often as you like."""
    cutoff = clock.now() - timedelta(days=RETENTION_DAYS)
    waiting = select(DisputeScreenshot.match_id).where(DisputeScreenshot.removed_at.is_(None))
    due = db.session.scalars(
        select(Match)
        .where(
            Match.status.in_(("completed", "voided")),
            Match.ruled_at <= cutoff,
            Match.finished_at <= cutoff,
            Match.id.in_(waiting),
        )
        .order_by(Match.id)
        .with_for_update()
    ).all()
    purged = []
    for match in due:
        removed = 0
        for shot in match.screenshots:
            if shot.removed_at is not None:
                continue
            try:
                path(shot).unlink(missing_ok=True)
            except OSError:
                # Leave this one as it is (still eligible next run) and carry on with the rest.
                log.warning("match %s: could not delete screenshot %s", match.id, shot.id, exc_info=True)
                continue
            shot.filename = None
            shot.removed_at = clock.now()
            removed += 1
        if removed:
            admin_log.record(
                "purge_screenshots",
                f"Deleted {removed} dispute screenshots, {RETENTION_DAYS} days after the case closed.",
                match_id=match.id,
                details={"count": removed},
            )
            purged.append(match)
    return purged
