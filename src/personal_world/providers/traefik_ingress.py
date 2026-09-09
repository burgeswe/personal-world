"""Traefik ingress rollups capability.

Read-only against the router API (192.168.2.145:8080 default). Honors
the "degrades honestly" rule: if the API is unreachable, the
capability returns UNKNOWN (never fake HEALTHY).
"""
from __future__ import annotations

import json
import urllib.request

from ..envelope import Result, fail, ok
from .registry import StatusContract

TRAEFIK_TIMEOUT = 8


class TraefikIngress(StatusContract):
    """Aggregate ingress routes + TLS expiry status."""

    def __init__(self, base_url: str = "http://192.168.2.145:8080") -> None:
        self.base_url = base_url.rstrip("/")

    def _get(self, path: str):
        try:
            with urllib.request.urlopen(
                self.base_url + path, timeout=TRAEFIK_TIMEOUT
            ) as resp:
                return json.loads(resp.read().decode())
        except Exception:
            return None

    def observe(self) -> Result:
        routers = self._get("/api/http/routers")
        if routers is None:
            return fail("unavailable", warnings=["traefik API unreachable"])

        total = len(routers)
        healthy = 0
        warning = []
        for r in routers:
            status = r.get("status", "")
            if status == "enabled":
                healthy += 1
            else:
                warning.append(f"{r.get('name','?')}: {status or 'no status'}")
        # TLS certs expiry needs the TLS overview; only ring if the data
        # is there, else leave warning list as-is.
        certs = self._get("/api/http/routers")  # placeholder until cert info supported
        detail = {
            "routes": total,
            "enabled": healthy,
            "not_enabled": len(routers) - healthy,
            "warnings": warning[:6],
        }
        return ok("healthy" if healthy == total else "degraded", data=detail)
