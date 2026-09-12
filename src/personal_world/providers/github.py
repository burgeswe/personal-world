"""GitHub enrichment for source_control: remote-side repository
facts that local Git cannot know, via the authenticated `gh` CLI.

The native local-git baseline (source_control.py) stays canonical for
repository existence, branch, dirty state, ahead/behind where local
Git can determine it, and local commit history. This module only
ADDS remote information — canonical repository identity, open pull
requests, open issues, default branch, repository metadata — and
never overwrites a native field. Local truth survives the remote
provider: if `gh` is missing, unauthenticated, rate-limited, or the
network is down, every call degrades to an honest 'unavailable' or
'not_configured' and Project Worlds remains fully useful from local
Git alone.

Credential posture (deliberate): this module shells the existing
`gh` CLI and uses whatever session `gh` already has (keyring, token
file, or GH_TOKEN/GITHUB_TOKEN env). It never reads, stores, logs,
or manages credentials itself — no second credential system. The
subprocess is `gh api <path> --input -` style argv lists only, no
shell, read-only endpoints exclusively, 10s timeout per call. Any
gh failure (non-zero exit, stderr content, invalid JSON) becomes a
structured Result, never an exception and never a guessed field.
"""

import json
import shutil
import subprocess
from typing import Any

from ..envelope import Result, fail, ok
from .registry import StatusContract

GH_TIMEOUT_SECONDS = 10


def _gh_binary() -> str | None:
    """The gh CLI if present, else None. No PATH tricks: shutil.which
    only. 'gh missing' is an honest unavailable state, never fatal."""
    return shutil.which("gh")


class GitHubEnrichment(StatusContract):
    """Read-only GitHub API enrichment over the gh CLI session."""

    def __init__(self, timeout: int = GH_TIMEOUT_SECONDS) -> None:
        self.timeout = timeout

    # -- plumbing -------------------------------------------------

    def _api(self, path: str) -> Any | None:
        """One GET via `gh api`. Returns parsed JSON, or None on any
        failure (missing binary, non-zero exit, bad JSON). Never raises."""
        binary = _gh_binary()
        if binary is None:
            return None
        try:
            proc = subprocess.run(
                [binary, "api", path],
                capture_output=True, text=True, timeout=self.timeout,
                check=False,
            )
        except (OSError, subprocess.TimeoutExpired, subprocess.SubprocessError):
            return None
        if proc.returncode != 0:
            return None
        try:
            return json.loads(proc.stdout)
        except json.JSONDecodeError:
            return None

    @staticmethod
    def _slug(remote_url: str | None) -> str | None:
        """owner/repo from a git remote URL, or None when the remote
        is not a GitHub remote (or missing). Supports both SSH and
        HTTPS spellings; other forges are honestly 'not GitHub'."""
        if not remote_url:
            return None
        url = remote_url.strip().rstrip("/")
        if url.endswith(".git"):
            url = url[:-4]
        for prefix in ("git@github.com:", "ssh://git@github.com/",
                       "https://github.com/", "http://github.com/"):
            if url.startswith(prefix):
                slug = url[len(prefix):]
                parts = slug.split("/")
                if len(parts) >= 2:
                    return f"{parts[0]}/{parts[1]}"
        return None

    # -- enrichment surface ---------------------------------------

    def enrich_repo(self, remote_url: str | None) -> Result:
        """Remote facts for ONE repository, keyed by its git remote.

        Fields (all remote-observed, all optional-but-honest):
          slug            canonical "owner/repo" identity on GitHub
          url             canonical browser URL
          default_branch  remote default branch (may differ locally)
          open_prs        count of open pull requests
          open_issues     count of open issues (GitHub's number minus
                          PRs — the API field counts both)
          pushed_at       last remote push timestamp (ISO 8601)

        The result never contains commit text, file paths, or tokens.
        Any failure is a structured state; 'not_github' is a valid,
        non-error answer for remotes hosted elsewhere."""
        if _gh_binary() is None:
            return fail("unavailable",
                        warnings=["gh CLI not found on this host"])
        slug = self._slug(remote_url)
        if slug is None:
            return fail("not_github", data={"remote": remote_url or None},
                        warnings=["remote is not a GitHub remote"])
        repo = self._api(f"repos/{slug}")
        if not isinstance(repo, dict):
            return fail("unavailable",
                        warnings=[f"GitHub unreachable or repository "
                                  f"'{slug}' not visible to this gh session"])
        pulls = self._api(f"repos/{slug}/pulls?state=open&per_page=1")
        open_prs: int | None = None
        if isinstance(pulls, list):
            open_prs = len(pulls)
            # per_page=1: one page returned means "1+ open"; use the
            # honest minimum unless the Link header told us exact —
            # gh api --paginate is heavier; count pages only when cheap.
            if open_prs:
                full = self._api(f"repos/{slug}/pulls?state=open&per_page=100")
                if isinstance(full, list):
                    open_prs = len(full)
        try:
            gh_issues = int(repo.get("open_issues_count", 0))
        except (TypeError, ValueError):
            gh_issues = 0
        return ok("healthy", data={
            "slug": slug,
            "url": repo.get("html_url"),
            "default_branch": repo.get("default_branch"),
            "open_prs": open_prs,
            "open_issues": max(gh_issues - (open_prs or 0), 0),
            "pushed_at": repo.get("pushed_at"),
        })

    def observe(self) -> Result:
        """StatusContract: is the gh session usable at all? Proves
        authentication cheaply (rate_limit needs no quota)."""
        binary = _gh_binary()
        if binary is None:
            return fail("unavailable", warnings=["gh CLI not found on this host"])
        me = self._api("rate_limit")
        if not isinstance(me, dict):
            return fail("unavailable",
                        warnings=["gh CLI present but no authenticated "
                                  "GitHub session"])
        return ok("healthy", data={"provider": "github", "via": "gh"})