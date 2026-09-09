"""Scheduler: reminders and scheduled observations.

The scheduler is a simple in-process timer that checks a JSON file
of reminders every minute. Reminders fire into the journal as
JournalKind.OBSERVATION entries. No external cron, no external deps.

Schema (from ROADMAP.md): the schema exists; this is the runner.
"""

import json
import time
import threading
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field

from .envelope import Result, fail, ok
from .journal import Journal
from .model import JournalKind, Provenance


class Reminder(BaseModel):
    """A scheduled reminder."""

    id: str
    text: str
    cron_hour: int | None = None
    cron_minute: int | None = None
    cron_day: str | None = None  # "mon", "tue", etc. or None for daily
    enabled: bool = True
    last_fired: float | None = None
    created_at: float = Field(default_factory=time.time)


class Scheduler:
    """Simple reminder engine backed by a JSON file."""

    def __init__(self, path: Path, journal: Journal | None = None) -> None:
        self.path = path
        self.journal = journal
        self._reminders: dict[str, Reminder] = {}
        self._loaded = False
        self._thread: threading.Thread | None = None
        self._stop = threading.Event()

    def _ensure_loaded(self) -> None:
        if self._loaded:
            return
        if self.path.exists():
            try:
                data = json.loads(self.path.read_text())
                for item in data.get("reminders", []):
                    r = Reminder.model_validate(item)
                    self._reminders[r.id] = r
            except Exception:
                pass
        self._loaded = True

    def _save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        data = {
            "reminders": [r.model_dump(mode="json") for r in self._reminders.values()]
        }
        self.path.write_text(json.dumps(data, indent=2))

    def add(self, reminder: Reminder) -> Result:
        self._ensure_loaded()
        self._reminders[reminder.id] = reminder
        self._save()
        return ok("healthy", data={"id": reminder.id})

    def remove(self, reminder_id: str) -> Result:
        self._ensure_loaded()
        if reminder_id not in self._reminders:
            return fail("not_found", warnings=[f"reminder '{reminder_id}' not found"])
        del self._reminders[reminder_id]
        self._save()
        return ok("healthy", data={"id": reminder_id})

    def list_reminders(self) -> list[Reminder]:
        self._ensure_loaded()
        return list(self._reminders.values())

    def toggle(self, reminder_id: str, enabled: bool) -> Result:
        self._ensure_loaded()
        r = self._reminders.get(reminder_id)
        if r is None:
            return fail("not_found", warnings=[f"reminder '{reminder_id}' not found"])
        r.enabled = enabled
        self._save()
        return ok("healthy", data={"id": reminder_id, "enabled": enabled})

    def check_and_fire(self) -> list[str]:
        """Check all reminders and fire any that match the current time."""
        self._ensure_loaded()
        now = datetime.now(UTC)
        fired = []
        for r in self._reminders.values():
            if not r.enabled:
                continue
            if r.cron_hour is not None and now.hour != r.cron_hour:
                continue
            if r.cron_minute is not None and now.minute != r.cron_minute:
                continue
            if r.cron_day is not None:
                day_names = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
                if day_names[now.weekday()] != r.cron_day:
                    continue
            # Don't fire twice in the same minute
            if r.last_fired and (time.time() - r.last_fired) < 60:
                continue
            r.last_fired = time.time()
            fired.append(r.text)
            if self.journal:
                self.journal.append_raw(
                    kind=JournalKind.OBSERVATION,
                    summary=f"Reminder: {r.text}",
                    source="scheduler",
                )
        if fired:
            self._save()
        return fired

    def start(self) -> None:
        """Start the background scheduler thread."""
        def run():
            while not self._stop.is_set():
                self.check_and_fire()
                self._stop.wait(60)

        self._thread = threading.Thread(target=run, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
