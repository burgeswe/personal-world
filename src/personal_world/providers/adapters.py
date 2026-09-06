"""Concrete adapters. Each wraps an existing system WITHOUT modifying it.

- http_status: generic HTTP health probe (facts for any URL)
- gitea: real source_control provider over Gitea's HTTP API
- fake_source_control: reference provider proving substitution through
  the same SourceControlContract
- sops_broker: secret broker over the operator's SOPS store; values
  are piped to a consumer, never returned to callers
"""

import json
import os
import shutil
import subprocess
import urllib.request
from pathlib import Path

from ..envelope import Result, ok
from .registry import MemoryContract, SourceControlContract, StatusContract


class HttpStatus(StatusContract):
    """Observe any HTTP endpoint. Read-only, no secrets."""

    def __init__(self, name: str, url: str, expected: int = 200) -> None:
        self.name = name
        self.url = url
        self.expected = expected

    def probe(self) -> Result:
        try:
            req = urllib.request.Request(self.url, method="GET")
            with urllib.request.urlopen(req, timeout=5) as resp:
                code = resp.status
        except Exception as e:
            return Result(
                ok=False,
                status="unhealthy",
                warnings=[f"{self.name}: {e}"],
            )
        if code == self.expected:
            return ok("healthy", data={"url": self.url, "code": code})
        return Result(
            ok=False,
            status="unhealthy",
            data={"url": self.url, "code": code},
            warnings=[f"{self.name}: expected {self.expected}, got {code}"],
        )

    def observe(self) -> Result:
        return self.probe()


class Gitea(SourceControlContract):
    """Real source_control provider: read-only Gitea API.

    Token comes from env indirection (GITEA_TOKEN); if absent, only
    unauthenticated endpoints are used. Never writes.
    """

    def __init__(self, base_url: str, token_env: str = "GITEA_TOKEN") -> None:
        self.base_url = base_url.rstrip("/")
        self.token_env = token_env

    def _get(self, path: str):
        url = f"{self.base_url}/api/v1{path}"
        req = urllib.request.Request(url)
        token = os.environ.get(self.token_env)
        if token:
            req.add_header("Authorization", f"token {token}")
        with urllib.request.urlopen(req, timeout=5) as resp:
            return json.loads(resp.read().decode())

    def observe(self) -> Result:
        try:
            health = self._get("/healthz")
            version = health.get("version", "unknown")
            return ok("healthy", data={"version": version})
        except Exception:
            # /healthz may not exist on all Gitea versions; fall back to
            # the versioned endpoint
            try:
                self._get("/version")
                return ok("healthy", data={"version": "unknown"})
            except Exception as e:
                return Result(
                    ok=False,
                    status="unhealthy",
                    warnings=[f"gitea: {e}"],
                )


class FakeSourceControl(SourceControlContract):
    """Reference provider for the substitution proof: same contract,
    no external system. Deliberately deterministic."""

    def __init__(self, version: str = "fake-1.0") -> None:
        self.version = version

    def observe(self) -> Result:
        return ok("healthy", data={"version": self.version, "provider": "fake"})


class LangGraphMemory(MemoryContract):
    """Real memory provider over the langgraph HTTP API (read-only).

    Wraps the existing homelab memory service WITHOUT modifying it:
    GET /health for liveness, POST /search for semantic recall across
    KiloSession/RepoDoc/ObsidianNote collections. No writes.
    """

    def __init__(self, base_url: str, api_key_env: str | None = None) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key_env = api_key_env

    def _headers(self) -> dict:
        h = {"Content-Type": "application/json"}
        if self.api_key_env and os.environ.get(self.api_key_env):
            h["Authorization"] = f"Bearer {os.environ[self.api_key_env]}"
        return h

    def health(self) -> bool:
        try:
            with urllib.request.urlopen(
                f"{self.base_url}/health", timeout=5
            ) as resp:
                return resp.status == 200
        except Exception:
            return False

    def observe(self) -> Result:
        if not self.health():
            return Result(ok=False, status="unhealthy",
                           warnings=["langgraph: /health unreachable"])
        return ok("healthy", data={"url": self.base_url})

    def search(self, query: str, top_k: int = 5) -> Result:
        body = json.dumps({"query": query, "top_k": top_k}).encode()
        req = urllib.request.Request(
            f"{self.base_url}/search",
            data=body,
            headers=self._headers(),
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                payload = json.loads(resp.read().decode())
        except Exception as e:
            return Result(ok=False, status="unavailable",
                          warnings=[f"langgraph search: {e}"])
        hits = [
            {
                "text": r.get("text", ""),
                "source": r.get("source"),
                "path": r.get("path"),
            }
            for r in payload.get("results", [])
        ]
        return ok("healthy", data={"query": query, "results": hits})


class SopsBroker:
    """Secret broker over the operator's SOPS bundle. Values NEVER enter
    caller context: list() exposes key names only; use() pipes the
    decrypted value into a consumer command's stdin. No new crypto --
    SOPS is the crypto; this is policy over it."""

    def __init__(self, bundle_path: Path) -> None:
        self.bundle_path = Path(bundle_path)

    def available(self) -> bool:
        return shutil.which("sops") is not None and self.bundle_path.exists()

    def list_keys(self) -> list[str]:
        """Key NAMES only -- never values."""
        if not self.available():
            return []
        proc = subprocess.run(
            ["sops", "-d", "--output-type", "json", str(self.bundle_path)],
            capture_output=True,
            text=True,
            timeout=30,
        )
        if proc.returncode != 0:
            return []
        return sorted(json.loads(proc.stdout).keys())

    def use(self, consumer: list[str], timeout: int = 30) -> Result:
        """Pipe the decrypted bundle to a consumer command's stdin.
        The value never appears in this process's Python memory, argv,
        or logs."""
        if not self.available():
            return Result(
                ok=False,
                status="unavailable",
                warnings=["sops or bundle missing"],
            )
        try:
            proc = subprocess.Popen(consumer, stdin=subprocess.PIPE)
            subprocess.run(
                ["sops", "-d", str(self.bundle_path)],
                stdout=proc.stdin,
                timeout=timeout,
                check=True,
            )
            proc.stdin.close()
            rc = proc.wait(timeout=timeout)
        except Exception as e:
            return Result(ok=False, status="error", warnings=[f"sops broker: {e}"])
        if rc == 0:
            return ok("used", changed=False)
        return Result(
            ok=False, status="error",
            warnings=[f"consumer exited {rc}"],
        )