"""The matchmaker loop: a failing matchmaking tick must not stop the screenshot retention job."""

from app import worker


def test_retention_still_runs_when_the_matchmaking_tick_fails(app, monkeypatch):
    calls = []

    def failing_tick():
        raise RuntimeError("tick failed")

    monkeypatch.setattr(worker, "run_once", failing_tick)
    monkeypatch.setattr(worker, "purge_screenshots", lambda: calls.append("purge"))

    last = worker.cycle(last_purge=float("-inf"))
    assert calls == ["purge"]
    assert last != float("-inf")  # so it waits PURGE_EVERY_SECONDS before trying again


def test_retention_waits_for_its_hourly_turn_and_a_failing_purge_is_not_retried_every_tick(app, monkeypatch):
    calls = []
    monkeypatch.setattr(worker, "run_once", lambda: calls.append("tick"))

    def failing_purge():
        calls.append("purge")
        raise RuntimeError("purge failed")

    monkeypatch.setattr(worker, "purge_screenshots", failing_purge)
    last = worker.cycle(last_purge=float("-inf"))
    worker.cycle(last_purge=last)
    assert calls == ["tick", "purge", "tick"]
