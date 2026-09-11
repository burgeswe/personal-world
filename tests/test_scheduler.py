"""P0.4: a firing reminder must land in the journal, not kill the thread.

Before this fix the scheduler called ``journal.append_raw`` — a method
that never existed — so the background thread died silently on the
first reminder that matched. Human Reliability contract: state must be
visible; a dead scheduler is a silent divergence between what the
person thinks is happening and what is.
"""
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from personal_world.journal import Journal  # noqa: E402
from personal_world.model import JournalKind  # noqa: E402
from personal_world.scheduler import Reminder, Scheduler  # noqa: E402


def _sched(tmp_path):
    journal = Journal(tmp_path / "journal.ndjson")
    return Scheduler(tmp_path / "reminders.json", journal=journal), journal


def test_fire_journals_an_observation(tmp_path):
    s, journal = _sched(tmp_path)
    # all-null cron == matches every tick
    s.add(Reminder(id="r1", text="drink water"))
    fired = s.check_and_fire()
    assert fired == ["drink water"]
    events = list(journal.events())
    assert len(events) == 1
    assert events[0].kind == JournalKind.OBSERVATION
    assert "drink water" in events[0].summary
    assert events[0].provenance.source == "scheduler"


def test_fire_dedupes_within_a_minute_and_persists_last_fired(tmp_path):
    s, journal = _sched(tmp_path)
    s.add(Reminder(id="r1", text="stretch"))
    assert s.check_and_fire() == ["stretch"]
    assert s.check_and_fire() == []          # same minute → no double fire
    assert len(list(journal.events())) == 1
    fresh = Scheduler(tmp_path / "reminders.json")
    assert fresh.list_reminders()[0].last_fired is not None


def test_disabled_reminders_do_not_fire(tmp_path):
    s, journal = _sched(tmp_path)
    s.add(Reminder(id="r1", text="nope", enabled=False))
    assert s.check_and_fire() == []
    assert list(journal.events()) == []


def test_background_thread_survives_a_failing_tick(tmp_path, monkeypatch):
    s, _ = _sched(tmp_path)
    calls = {"n": 0}

    def boom():
        calls["n"] += 1
        raise RuntimeError("bad tick")

    monkeypatch.setattr(s, "check_and_fire", boom)
    # make the loop tick quickly
    monkeypatch.setattr(s._stop, "wait", lambda _t: time.sleep(0.01))
    s.start()
    time.sleep(0.15)
    s.stop()
    s._thread.join(timeout=1)
    assert calls["n"] >= 2, "thread must keep ticking after an exception"
    assert s._last_error and "bad tick" in s._last_error
