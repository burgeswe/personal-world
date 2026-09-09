"""Lab resources provider: consume VM resource data via the lab CLI.

Read-only: shells out to `lab resources --json`. No mutations.
"""

import json
import subprocess

from ..envelope import Result, fail, ok
from .registry import StatusContract

DEFAULT_LAB = "/opt/scripts/lab"


class LabResources(StatusContract):
    """VM resource observation via lab CLI."""

    def __init__(self, lab_path: str | None = None) -> None:
        self.lab_path = lab_path or DEFAULT_LAB

    def observe(self) -> Result:
        try:
            proc = subprocess.run(
                [self.lab_path, "resources", "--json"],
                capture_output=True, text=True, timeout=30, check=True,
            )
            data = json.loads(proc.stdout)
        except (subprocess.SubprocessError, json.JSONDecodeError, OSError) as e:
            return fail("unavailable", warnings=[f"lab resources: {e}"])

        return ok("healthy", data=data)
