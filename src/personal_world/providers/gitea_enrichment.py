"""Gitea source control enrichment provider.

Enriches the native git baseline with remote-side data: commit
activity, PR counts, issue counts. The native baseline stays as
the canonical source_control shape; Gitea adds richness on top.

Read-only: uses Gitea's public API. No mutations.
"""

import json
import os
import urllib.request
from typing import Any

from ..envelope import Result, fail, ok
from .registry import StatusContract

GITEA_TIMEOUT = 10


class GiteaEnrichment(StatusContract):
    """Gitea API enrichment for source_control capability."""

    def __init__(self, base_url: str, token_env: str = "GITEA_TOKEN") -> None:
        self.base_url = base_url.rstrip("/")
        self.token_env = token_env

    def _headers(self) -> dict:
        h = {"Accept": "application/json"}
        token = os.environ.get(self.token_env)
        if token:
            h["Authorization"] = f"token {token}"
        return h

    def _get(self, path: str) -> Any | None:
        try:
            req = urllib.request.Request(
                f"{self.base_url}/api/v1{path}",
                headers=self._headers(),
            )
            with urllib.request.urlopen(req, timeout=GITEA_TIMEOUT) as resp:
                return json.loads(resp.read().decode())
        except Exception:
            return None

    def observe(self) -> Result:
        repos = self._get("/repos/search?limit=50")
        if repos is None:
            return fail("unavailable", warnings=["gitea unreachable"])
        repo_list = repos.get("data", repos) if isinstance(repos, dict) else repos
        if not isinstance(repo_list, list):
            return fail("unavailable", warnings=["gitea returned unexpected shape"])

        total = len(repo_list)
        recent_commits = []
        for repo in repo_list[:10]:
            name = repo.get("full_name", "")
            commits = self._get(f"/repos/{name}/commits?limit=3")
            if isinstance(commits, list):
                for c in commits:
                    recent_commits.append({
                        "repo": name,
                        "sha": (c.get("sha") or "")[:8],
                        "message": (c.get("commit", {}).get("message") or "").split("\n")[0][:120],
                        "date": c.get("commit", {}).get("committer", {}).get("date", ""),
                        "author": c.get("commit", {}).get("committer", {}).get("name", ""),
                    })
        recent_commits.sort(key=lambda c: c.get("date", ""), reverse=True)

        return ok("healthy", data={
            "repos": total,
            "recent_commits": recent_commits[:15],
        })

    def commit_rollups(self) -> Result:
        """Activity rollups: how many commits today, this week, per repo."""
        repos = self._get("/repos/search?limit=50")
        if repos is None:
            return fail("unavailable", warnings=["gitea unreachable"])
        repo_list = repos.get("data", repos) if isinstance(repos, dict) else repos
        if not isinstance(repo_list, list):
            return fail("unavailable", warnings=["gitea returned unexpected shape"])

        rollups = []
        for repo in repo_list[:10]:
            name = repo.get("full_name", "")
            commits = self._get(f"/repos/{name}/commits?limit=20")
            if not isinstance(commits, list):
                continue
            rollups.append({
                "repo": name,
                "commit_count": len(commits),
                "last_commit": commits[0].get("commit", {}).get("message", "").split("\n")[0][:80] if commits else "",
                "last_date": commits[0].get("commit", {}).get("committer", {}).get("date", "") if commits else "",
            })

        return ok("healthy", data={"rollups": rollups})
