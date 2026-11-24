"""Screenshot evidence for Disputed matches: uploading, fetching, and how each viewer sees them."""

import io
from datetime import timedelta

from PIL import Image

from app import clock
from tests.test_disputes import dispute, reported

CSRF = {"X-Arena-Upload": "1"}


def image_bytes(fmt="PNG", size=(8, 8), **save_args) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, (200, 30, 30)).save(buf, fmt, **save_args)
    return buf.getvalue()


def upload(client, match_id, data=None, name="evidence.png", headers=CSRF):
    data = image_bytes() if data is None else data
    return client.post(
        f"/api/matches/{match_id}/screenshots",
        data={"file": (io.BytesIO(data), name)},
        content_type="multipart/form-data",
        headers=headers,
    )


def disputed(make_player):
    """A Bo3 that A reported 2-1 and B disputed."""
    a, ca, b, cb, mid = reported(make_player)
    assert dispute(cb, mid).get_json()["status"] == "disputed"
    return a, ca, b, cb, mid


def test_a_player_uploads_a_screenshot_and_both_players_can_fetch_it(make_player):
    a, ca, b, cb, mid = disputed(make_player)
    res = upload(cb, mid)
    assert res.status_code == 201
    mine = res.get_json()["dispute"]["screenshots"]["you"]
    assert len(mine) == 1 and mine[0]["removed"] is False
    # The opponent sees it as theirs-from-the-other-side, and can fetch the image.
    theirs = ca.get(f"/api/matches/{mid}").get_json()["dispute"]["screenshots"]["opponent"]
    assert [s["url"] for s in theirs] == [mine[0]["url"]]
    fetched = ca.get(theirs[0]["url"])
    assert fetched.status_code == 200 and fetched.mimetype == "image/png"
    assert Image.open(io.BytesIO(fetched.data)).size == (8, 8)


def stored_files(app):
    from pathlib import Path

    d = Path(app.config["UPLOAD_DIR"])
    return list(d.iterdir()) if d.exists() else []


def test_an_upload_without_the_custom_header_is_rejected(app, make_player):
    *_, cb, mid = disputed(make_player)
    res = upload(cb, mid, headers={})
    assert res.status_code == 403 and res.get_json()["error"] == "csrf"
    assert stored_files(app) == []


def test_uploads_are_only_for_disputed_matches(app, make_player):
    a, ca, b, cb, mid = reported(make_player)  # reported, not yet disputed
    res = upload(cb, mid)
    assert res.status_code == 409 and res.get_json()["error"] == "bad_status"
    assert stored_files(app) == []


def test_outsiders_cannot_upload(app, make_player):
    *_, mid = disputed(make_player)
    _, outsider = make_player()
    assert upload(outsider, mid).status_code == 404
    assert stored_files(app) == []


def test_signed_out_visitors_cannot_upload(app, make_player):
    *_, mid = disputed(make_player)
    assert upload(app.test_client(), mid).status_code == 401


def test_only_png_jpeg_and_webp_images_are_accepted(app, make_player):
    *_, cb, mid = disputed(make_player)
    for fmt in ("PNG", "JPEG", "WEBP"):
        assert upload(cb, mid, image_bytes(fmt)).status_code == 201
    # three accepted, so use a fresh match for the refusals
    *_, cb, mid = disputed(make_player)
    for data, name in [
        (b"just some text", "notes.png"),  # not an image at all, whatever its name says
        (image_bytes("GIF"), "evidence.gif"),  # a real image, but not an allowed type
        (image_bytes("BMP"), "evidence.bmp"),
        (b"<svg xmlns='http://www.w3.org/2000/svg'/>", "evidence.png"),
        (b"", "empty.png"),
    ]:
        res = upload(cb, mid, data, name)
        assert res.status_code == 400, name
        assert res.get_json()["error"] == "validation" and "file" in res.get_json()["fields"], name
    assert len(stored_files(app)) == 3  # only the three valid ones from the first match


def test_a_request_with_no_file_is_rejected(make_player):
    *_, cb, mid = disputed(make_player)
    res = cb.post(f"/api/matches/{mid}/screenshots", data={}, content_type="multipart/form-data", headers=CSRF)
    assert res.status_code == 400 and "file" in res.get_json()["fields"]


def test_files_over_5_mb_are_rejected(app, make_player):
    *_, cb, mid = disputed(make_player)
    just_over = image_bytes() + b"\0" * (5 * 1024 * 1024)
    res = upload(cb, mid, just_over)
    assert res.status_code == 400 and "5 MB" in res.get_json()["fields"]["file"]
    # Far over: refused before it is read at all.
    res = upload(cb, mid, b"\0" * (7 * 1024 * 1024))
    assert res.status_code == 413 and res.get_json()["error"] == "too_large"
    assert stored_files(app) == []


def test_each_player_can_upload_three_screenshots_and_no_more(make_player):
    a, ca, b, cb, mid = disputed(make_player)
    for _ in range(3):
        assert upload(cb, mid).status_code == 201
    res = upload(cb, mid)
    assert res.status_code == 409 and res.get_json()["error"] == "too_many_screenshots"
    # The cap is per player: the opponent still has their own three.
    for _ in range(3):
        assert upload(ca, mid).status_code == 201
    body = cb.get(f"/api/matches/{mid}").get_json()["dispute"]["screenshots"]
    assert len(body["you"]) == 3 and len(body["opponent"]) == 3


def fetched_bytes(client, uploaded: dict) -> bytes:
    res = client.get(uploaded["dispute"]["screenshots"]["you"][-1]["url"])
    assert res.status_code == 200
    return res.data


def test_stored_images_have_no_camera_or_location_metadata(make_player):
    *_, cb, mid = disputed(make_player)

    exif = Image.Exif()
    exif[0x010F] = "SecretCameraMaker"  # Make
    exif.get_ifd(0x8825)[1] = "N"  # GPS latitude ref, so there is a GPS block
    jpeg = io.BytesIO()
    Image.new("RGB", (8, 8)).save(jpeg, "JPEG", exif=exif)
    assert b"SecretCameraMaker" in jpeg.getvalue()

    from PIL.PngImagePlugin import PngInfo

    info = PngInfo()
    info.add_text("Location", "51.5007N 0.1246W")
    png = io.BytesIO()
    Image.new("RGB", (8, 8)).save(png, "PNG", pnginfo=info)
    assert b"51.5007N" in png.getvalue()

    webp = io.BytesIO()
    Image.new("RGB", (8, 8)).save(webp, "WEBP", exif=exif)

    # One match allows three per player, but a fresh match per format keeps each check independent.
    for data, secret in ((jpeg.getvalue(), b"SecretCameraMaker"), (png.getvalue(), b"51.5007N"), (webp.getvalue(), b"SecretCameraMaker")):
        *_, c, m = disputed(make_player)
        stored = fetched_bytes(c, upload(c, m, data).get_json())
        assert secret not in stored
        assert not Image.open(io.BytesIO(stored)).getexif()


def test_a_file_disguised_as_an_image_is_not_served_as_uploaded(make_player):
    *_, cb, mid = disputed(make_player)
    disguised = image_bytes() + b"<script>alert(1)</script>"
    stored = fetched_bytes(cb, upload(cb, mid, disguised).get_json())
    assert b"<script>" not in stored
    assert Image.open(io.BytesIO(stored)).size == (8, 8)


def test_a_rotated_phone_photo_stays_the_right_way_up(make_player):
    *_, cb, mid = disputed(make_player)
    exif = Image.Exif()
    exif[0x0112] = 6  # Orientation: rotate 90 degrees to display
    buf = io.BytesIO()
    Image.new("RGB", (20, 10)).save(buf, "JPEG", exif=exif)
    stored = fetched_bytes(cb, upload(cb, mid, buf.getvalue()).get_json())
    assert Image.open(io.BytesIO(stored)).size == (10, 20)


# ---------------------------------------------------------------- who can see them


def test_players_admins_and_the_master_can_fetch_a_screenshot_and_outsiders_cannot(app, make_player, make_admin, master):
    a, ca, b, cb, mid = disputed(make_player)
    url = upload(cb, mid).get_json()["dispute"]["screenshots"]["you"][0]["url"]
    _, admin_client = make_admin()
    _, master_client = master
    _, outsider = make_player()

    for client in (ca, cb, admin_client, master_client):
        res = client.get(url)
        assert res.status_code == 200 and res.mimetype == "image/png"
        # Evidence is private: never sniffed into another type, never kept by a shared cache.
        assert res.headers["X-Content-Type-Options"] == "nosniff"
        assert "private" in res.headers["Cache-Control"]
    assert outsider.get(url).status_code == 404
    assert app.test_client().get(url).status_code == 401


def test_a_screenshot_whose_file_has_gone_missing_is_not_found_rather_than_an_error(app, make_player):
    a, ca, b, cb, mid = disputed(make_player)
    url = upload(cb, mid).get_json()["dispute"]["screenshots"]["you"][0]["url"]
    for f in stored_files(app):
        f.unlink()
    res = cb.get(url)
    assert res.status_code == 404 and res.get_json()["error"] == "not_found"


def test_an_upload_that_cannot_be_saved_leaves_no_file_behind(app, make_player, monkeypatch):
    import pytest

    from app.extensions import db

    *_, cb, mid = disputed(make_player)

    def failing_commit():
        raise RuntimeError("database went away")

    monkeypatch.setattr(db.session, "commit", failing_commit)
    with pytest.raises(RuntimeError):
        upload(cb, mid)
    assert stored_files(app) == []


def test_a_screenshot_is_only_served_under_its_own_match(make_player):
    a, ca, b, cb, mid = disputed(make_player)
    url = upload(cb, mid).get_json()["dispute"]["screenshots"]["you"][0]["url"]
    shot_id = url.rsplit("/", 1)[1]
    *_, cb2, other = disputed(make_player)
    assert cb2.get(f"/api/matches/{other}/screenshots/{shot_id}").status_code == 404
    assert cb.get(f"/api/matches/{mid}/screenshots/99999").status_code == 404


def test_admins_see_every_screenshot_on_the_case_page(make_player, make_admin):
    from tests.test_cases import case

    a, ca, b, cb, mid = disputed(make_player)
    upload(cb, mid)
    upload(cb, mid)
    upload(ca, mid)
    _, c = make_admin()
    shots = case(c, mid).get_json()["dispute"]["screenshots"]
    assert {uid: len(rows) for uid, rows in shots.items()} == {str(b.id): 2, str(a.id): 1}
    assert c.get(shots[str(a.id)][0]["url"]).status_code == 200


def test_a_new_dispute_after_a_replay_has_its_own_three_screenshots_each(make_player, make_admin):
    from tests.test_cases import case, claim
    from tests.test_queue import report
    from tests.test_replay import replay

    a, ca, b, cb, mid = disputed(make_player)
    for _ in range(3):
        upload(cb, mid)
    _, c = make_admin()
    claim(c, mid)
    replay(c, mid, from_game=3, reason="Play game 3 again.")
    report(ca, mid, 3, a)
    dispute(cb, mid, games=[3], reason="Lag again in the replay.")

    # The new dispute starts afresh for the players, who no longer see the old screenshots...
    for client in (ca, cb):
        assert client.get(f"/api/matches/{mid}").get_json()["dispute"]["screenshots"] == {"you": [], "opponent": []}
    for _ in range(3):
        assert upload(cb, mid).status_code == 201
    assert upload(cb, mid).status_code == 409
    # ...while Admins see all six, told apart by which dispute they belong to.
    page = case(c, mid).get_json()
    assert sorted(s["round"] for s in page["dispute"]["screenshots"][str(b.id)]) == [0, 0, 0, 1, 1, 1]
    assert page["dispute"]["round"] == 1


# ---------------------------------------------------------------- retention: 90 days after the final Ruling


REAL_NOW = clock.now  # before any test patches it


def days_later(monkeypatch, days, extra_seconds=0):
    """Move clock.now() to this long after the real now (not after an already-moved now)."""
    later = REAL_NOW() + timedelta(days=days, seconds=extra_seconds)
    monkeypatch.setattr(clock, "now", lambda: later)


def run_purge():
    from app import screenshots
    from app.extensions import db

    purged = screenshots.purge()
    db.session.commit()
    return purged


def upheld(make_player, make_admin):
    """A Disputed match with 2 screenshots from B and 1 from A, then Upheld by an Admin.
    Returns (a, ca, b, cb, match id, admin client, [screenshot urls])."""
    from tests.test_cases import claim, rule

    a, ca, b, cb, mid = disputed(make_player)
    urls = [upload(c, mid).get_json()["dispute"]["screenshots"]["you"][-1]["url"] for c in (cb, cb, ca)]
    _, admin_client = make_admin()
    claim(admin_client, mid)
    assert rule(admin_client, mid, "uphold").status_code == 200
    return a, ca, b, cb, mid, admin_client, urls


def test_90_days_after_the_final_ruling_the_files_are_deleted_and_a_placeholder_shows(
    app, make_player, make_admin, monkeypatch
):
    from tests.test_cases import case

    a, ca, b, cb, mid, admin_client, urls = upheld(make_player, make_admin)
    assert len(stored_files(app)) == 3

    days_later(monkeypatch, 90, 1)
    run_purge()

    assert stored_files(app) == []
    for client in (ca, cb):
        shots = client.get(f"/api/matches/{mid}").get_json()["dispute"]["screenshots"]
        assert [s["removed"] for s in shots["you"] + shots["opponent"]] == [True, True, True]
        assert all(s["url"] is None for s in shots["you"] + shots["opponent"])
    for client in (ca, admin_client):
        res = client.get(urls[0])
        assert res.status_code == 410 and res.get_json()["error"] == "screenshot_removed"
    # Statements and the Ruling are kept, and Admins still see the placeholders.
    page = case(admin_client, mid).get_json()
    assert page["ruling"]["outcome"] == "uphold"
    assert [s["removed"] for rows in page["dispute"]["screenshots"].values() for s in rows] == [True, True, True]


def test_the_purge_is_a_system_action_in_the_admin_log(make_player, make_admin, monkeypatch):
    a, ca, b, cb, mid, admin_client, _ = upheld(make_player, make_admin)
    days_later(monkeypatch, 91)
    assert [m.id for m in run_purge()] == [mid]
    (entry,) = [e for e in admin_client.get("/api/admin/log").get_json()["entries"] if e["action"] == "purge_screenshots"]
    assert entry["actor"] is None and entry["matchId"] == mid and entry["details"] == {"count": 3}
    assert "90 days" in entry["reason"]


def test_nothing_is_deleted_before_90_days_and_running_it_again_does_nothing(app, make_player, make_admin, monkeypatch):
    a, ca, b, cb, mid, admin_client, urls = upheld(make_player, make_admin)
    days_later(monkeypatch, 89, 23 * 3600)
    assert run_purge() == []
    assert len(stored_files(app)) == 3 and ca.get(urls[0]).status_code == 200

    days_later(monkeypatch, 90, 1)
    assert [m.id for m in run_purge()] == [mid]
    assert run_purge() == []
    log = admin_client.get("/api/admin/log").get_json()["entries"]
    assert [e["action"] for e in log].count("purge_screenshots") == 1


def test_a_case_still_waiting_for_a_ruling_keeps_its_screenshots(app, make_player, monkeypatch):
    a, ca, b, cb, mid = disputed(make_player)
    upload(cb, mid)
    days_later(monkeypatch, 400)
    assert run_purge() == []
    assert len(stored_files(app)) == 1


def test_a_replay_is_not_final_so_the_90_days_run_from_when_it_settles(app, make_player, make_admin, monkeypatch):
    from tests.test_cases import claim
    from tests.test_queue import report
    from tests.test_replay import replay

    a, ca, b, cb, mid = disputed(make_player)
    upload(cb, mid)
    _, admin_client = make_admin()
    claim(admin_client, mid)
    replay(admin_client, mid, from_game=3, reason="Play game 3 again.")

    days_later(monkeypatch, 100)  # long past the Ruling, but the match is still open
    assert run_purge() == []
    assert len(stored_files(app)) == 1

    report(ca, mid, 3, a)
    assert cb.post(f"/api/matches/{mid}/confirm").status_code == 200  # the replay settles the match now
    days_later(monkeypatch, 100 + 89)
    assert run_purge() == []
    days_later(monkeypatch, 100 + 90, 1)
    assert [m.id for m in run_purge()] == [mid]
    assert stored_files(app) == []


# ---------------------------------------------------------------- failures along the way


def test_a_failed_write_leaves_no_partial_file(app, make_player, monkeypatch):
    from pathlib import Path

    import pytest

    *_, cb, mid = disputed(make_player)
    real = Path.write_bytes

    def disk_full(self, data):
        real(self, data[:10])  # a partial file lands before the volume runs out
        raise OSError(28, "No space left on device")

    monkeypatch.setattr(Path, "write_bytes", disk_full)
    with pytest.raises(OSError):
        upload(cb, mid)
    assert stored_files(app) == []


def test_a_screenshot_deleted_while_being_served_is_not_found(make_player, monkeypatch):
    from app.routes import screenshots as routes

    a, ca, b, cb, mid = disputed(make_player)
    url = upload(cb, mid).get_json()["dispute"]["screenshots"]["you"][0]["url"]

    def vanished(*args, **kwargs):
        raise FileNotFoundError

    monkeypatch.setattr(routes, "send_file", vanished)
    res = cb.get(url)
    assert res.status_code == 404 and res.get_json()["error"] == "not_found"


def test_one_file_that_cannot_be_deleted_does_not_stop_the_other_cases(app, make_player, make_admin, monkeypatch):
    from pathlib import Path

    first = upheld(make_player, make_admin)
    second = upheld(make_player, make_admin)
    days_later(monkeypatch, 91)
    real = Path.unlink
    stuck = {"name": None}

    def unlink(self, missing_ok=False):
        if stuck["name"] is None and self.parent == Path(app.config["UPLOAD_DIR"]):
            stuck["name"] = self.name  # the first file we try is stuck (a permissions problem)
        if self.name == stuck["name"]:
            raise PermissionError(13, "Permission denied")
        return real(self, missing_ok=missing_ok)

    monkeypatch.setattr(Path, "unlink", unlink)
    purged = run_purge()
    # Every other screenshot was deleted and marked removed; only the stuck one is left to retry.
    assert [f.name for f in stored_files(app)] == [stuck["name"]]
    assert len(purged) == 2
    pages = [
        c.get(f"/api/matches/{m[4]}").get_json()["dispute"]["screenshots"] for m in (first, second) for c in (m[1],)
    ]
    removed = [s["removed"] for p in pages for s in p["you"] + p["opponent"]]
    assert removed.count(True) == 5 and removed.count(False) == 1

    monkeypatch.setattr(Path, "unlink", real)
    assert len(run_purge()) == 1  # the next run retries just the one that failed
    assert stored_files(app) == []
