"""Journal: one append-oriented event stream, many renderers.

V0 persistence: newline-delimited JSON in a volume-backed file. The file
is append-only; renderers (audit log, daily digest, story export) read it.
"""

import json
from collections.abc import Iterator
from pathlib import Path

from .classification import Classification
from .model import JournalEvent, JournalKind, Provenance


class Journal:
    def __init__(self, path: Path) -> None:
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def append(self, event: JournalEvent) -> JournalEvent:
        with self.path.open("a", encoding="utf-8") as f:
            f.write(event.model_dump_json() + "\n")
        return event

    def record(
        self,
        kind: JournalKind,
        summary: str,
        source: str,
        classification: Classification = Classification.PRIVATE,
    ) -> JournalEvent:
        return self.append(
            JournalEvent(
                kind=kind,
                summary=summary,
                provenance=Provenance(source=source),
                classification=classification,
            )
        )

    def events(self) -> Iterator[JournalEvent]:
        if not self.path.exists():
            return
        with self.path.open("r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    yield JournalEvent.model_validate_json(line)

    def recent(self, n: int = 20) -> list[JournalEvent]:
        return list(self.events())[-n:]

    def for_story(
        self,
        include_private: bool = False,
        kinds: set[JournalKind] | None = None,
    ) -> list[JournalEvent]:
        """Story renderings use disclosure rules: PRIVATE events are
        excluded unless explicitly included; existence in the journal
        never automatically grants story inclusion."""
        out = []
        for e in self.events():
            if e.classification == Classification.PRIVATE and not include_private:
                continue
            if kinds is not None and e.kind not in kinds:
                continue
            out.append(e)
        return out


class AuditRenderer:
    """Technical audit log: provenance on every line."""

    def render(self, journal: Journal) -> str:
        lines = []
        for e in journal.events():
            lines.append(
                f"{e.ts.isoformat()} {e.kind.value} [{e.provenance.source}] "
                f"({e.classification.value}) {e.summary}"
            )
        return "\n".join(lines)


class StoryRenderer:
    """Human-readable journal rendering with disclosure/redaction."""

    NARRATIVE_KINDS = {
        JournalKind.OBSERVATION,
        JournalKind.DISCOVERY,
        JournalKind.HEALTH,
        JournalKind.RECONCILIATION,
        JournalKind.APPROVAL,
    }

    def render(self, journal: Journal, include_private: bool = False) -> str:
        events = journal.for_story(
            include_private=include_private, kinds=self.NARRATIVE_KINDS
        )
        lines = []
        for e in events:
            marker = "" if e.classification != Classification.PRIVATE else "(private) "
            lines.append(f"- {marker}{e.summary}")
        return "\n".join(lines) or "Nothing worth telling yet."