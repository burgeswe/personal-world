"""Lab operator-packet provider: consume the homelab Lab CLI's lowbw
payload instead of re-deriving homelab state here.

The homelab repo's `lab lowbw --json` (schema lab-lowbw/1) is the
canonical operator packet: six rows (urgent / review / safe / unknown /
last_known_good / next), each with observations carrying evidence and
freshness timestamps. This provider shells that CLI read-only and maps
its output into this dashboard's status vocabulary. Nothing in this
module invents state: on any failure it returns 'unavailable' or
'unknown', never a guessed row.

Secrets posture: the packet is metadata + prose only. This module
passes the payload through structurally and performs no credential
lookup, so no secret material can enter via this path.
"""

import json
import subprocess
from datetime import datetime, timedelta, timezone
from pathlib import Path

from ..envelope import Result, fail, ok
from .registry import StatusContract

#: The lab CLI entry point on the stack VM. Overridable for tests and
#: for alternate checkouts via config; the list mirrors the real
#: checkouts (VM 145 serves the homelab repo at /opt/scripts; a
#: homelab-nested layout would use /opt/homelab/scripts).
LAB_CANDIDATES = (
    "/opt/scripts/lab",
    "/opt/homelab/scripts/lab",
)

DEFAULT_LAB = LAB_CANDIDATES[0]

#: Evidence older than this renders as 'stale' even when present.
FRESHNESS = timedelta(minutes=30)

#: lab-lowbw rows we understand. Unknown rows are preserved but flagged.
KNOWN_ROWS = (
    "urgent",
    "review",
    "safe",
    "unknown",
    "last_known_good",
    "next",
)


def _first_available_lab() -> str:
    """First lab CLI that exists on this host. Honest unknown if none:
    the caller renders 'unavailable' and the packet stays absent."""
    for candidate in LAB_CANDIDATES:
        if Path(candidate).exists():
            return candidate
    return DEFAULT_LAB


def _parse_ts(value: str) -> datetime | None:
    try:
        ts = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return ts if ts.tzinfo else ts.replace(tzinfo=timezone.utc)
    except (ValueError, AttributeError, TypeError):
        return None


class LabState(StatusContract):
    """Read-only operator packet over the homelab Lab CLI."""

    def __init__(self, lab_path: str | None = None, freshness: timedelta = FRESHNESS):
        self.lab_path = lab_path or _first_available_lab()
        self.freshness = freshness

    def observe(self) -> Result:
        packet = self._fetch()
        if packet is None:
            return fail(
                "unavailable",
                data={"rows": [], "reason": "lab CLI unavailable or invalid output"},
                warnings=["lab: could not fetch a valid lab-lowbw/1 packet"],
            )
        rows, stale = self._normalize(packet)
        status = "stale" if stale else "healthy"
        return ok(
            status,
            data={"rows": rows, "schema": packet.get("schema", "lab-lowbw/1"),
                  "generated_at": packet.get("generated_at", "")},
        )

    def _fetch(self) -> dict | None:
        try:
            proc = subprocess.run(
                (self.lab_path, "lowbw", "--cached", "--json"),
                capture_output=True, text=True, timeout=60, check=True,
            )
            packet = json.loads(proc.stdout)
        except (subprocess.SubprocessError, json.JSONDecodeError, OSError):
            return None
        if not isinstance(packet, dict) or packet.get("schema") != "lab-lowbw/1":
            return None
        return packet

    def _normalize(self, packet: dict) -> tuple[list[dict], bool]:
        """Map the packet into display rows. Returns (rows, any_stale)."""
        now = datetime.now(timezone.utc)
        raw_rows = packet.get("rows", {})
        rows: list[dict] = []
        any_stale = False
        for name in KNOWN_ROWS:
            body = raw_rows.get(name, {})
            obs = body.get("observations", []) if isinstance(body, dict) else []
            newest = None
            for o in obs:
                ts = _parse_ts(o.get("evidence", [{}])[0].get("observed_at", "")
                               if o.get("evidence") else None)
                if ts and (newest is None or ts > newest):
                    newest = ts
            # An empty row is empty, not stale; staleness is a claim
            # about evidence age, and only rows with evidence can age.
            is_stale = newest is not None and (now - newest) > self.freshness
            if is_stale:
                any_stale = True
            rows.append({
                "row": name,
                "count": len(obs),
                "stale": is_stale,
                "observations": [
                    {
                        "detail": o.get("detail", ""),
                        "action": o.get("action"),
                        "state": o.get("state", "unknown"),
                        "observed_at": (
                            (o.get("evidence") or [{}])[0].get("observed_at", "")
                            if o.get("evidence") else ""
                        ),
                    }
                    for o in obs
                ],
            })
        # Preserve unknown rows so schema growth is visible, never silent.
        for name, body in raw_rows.items():
            if name not in KNOWN_ROWS:
                rows.append({"row": name, "count": len(
                    body.get("observations", []) if isinstance(body, dict) else []
                ), "stale": False, "unrecognized": True, "observations": []})
        return rows, any_stale