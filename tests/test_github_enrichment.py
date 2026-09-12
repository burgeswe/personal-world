"""GitHub enrichment tests (providers/github.py + the
/api/source-control/enrichment endpoint).

Contract under test:
- local Git stays canonical; enrichment only ADDS remote facts
- gh missing / unauthenticated / unreachable -> honest 'unavailable',
  never a crash, never a guessed field
- non-GitHub remotes -> honest 'not_github' (valid, non-error)
- slug parsing for ssh + https spellings; other forges are not ours
- no credential is read, stored, or logged by the module itself
- the endpoint degrades quietly: no search paths / repo missing /
  remote missing each return their own structured state
- read-only: only `gh api` GETs, argv lists, never a shell
"""

import subprocess
from pathlib import Path

import pytest

from personal_world.envelope import Result
from personal_world.providers.github import GitHubEnrichment, _gh_binary


def _real_gh() -> bool:
    return _gh_binary() is not None


class TestSlugParsing:
    """owner/repo extraction from every supported remote spelling."""

    def test_https(self):
        assert GitHubEnrichment._slug("https://github.com/acme/widgets.git") == "acme/widgets"

    def test_https_no_dotgit(self):
        assert GitHubEnrichment._slug("https://github.com/acme/widgets") == "acme/widgets"

    def test_ssh(self):
        assert GitHubEnrichment._slug("git@github.com:acme/widgets.git") == "acme/widgets"

    def test_ssh_scheme(self):
        assert GitHubEnrichment._slug("ssh://git@github.com/acme/widgets.git") == "acme/widgets"

    def test_trailing_slash(self):
        assert GitHubEnrichment._slug("https://github.com/acme/widgets/") == "acme/widgets"

    def test_other_forge_is_not_github(self):
        assert GitHubEnrichment._slug("https://gitlab.com/acme/widgets.git") is None
        assert GitHubEnrichment._slug("https://gitea.example.com/acme/widgets.git") is None

    def test_none_and_garbage(self):
        assert GitHubEnrichment._slug(None) is None
        assert GitHubEnrichment._slug("") is None
        assert GitHubEnrichment._slug("not a url") is None

    def test_deep_paths_keep_first_two_segments(self):
        assert GitHubEnrichment._slug("https://github.com/acme/widgets/subdir") == "acme/widgets"


class TestEnrichRepoHonestStates:
    """Every failure is a structured state, never an exception."""

    def test_not_github_remote(self):
        r = GitHubEnrichment().enrich_repo("https://gitlab.com/acme/widgets.git")
        assert r.ok is False
        assert r.status == "not_github"

    def test_missing_remote_is_not_github(self):
        r = GitHubEnrichment().enrich_repo(None)
        assert r.status == "not_github"

    @pytest.fixture
    def no_gh(self, monkeypatch):
        monkeypatch.setattr("personal_world.providers.github._gh_binary", lambda: None)

    def test_gh_missing_is_unavailable(self, no_gh):
        r = GitHubEnrichment().enrich_repo("https://github.com/acme/widgets.git")
        assert r.ok is False
        assert r.status == "unavailable"
        assert any("gh" in w.lower() for w in r.warnings)

    def test_observe_gh_missing(self, no_gh):
        r = GitHubEnrichment().observe()
        assert r.ok is False
        assert r.status == "unavailable"

    def test_api_never_raises_on_timeout(self, monkeypatch):
        def boom(*a, **kw):
            raise subprocess.TimeoutExpired(cmd="gh", timeout=1)
        monkeypatch.setattr(subprocess, "run", boom)
        r = GitHubEnrichment().enrich_repo("https://github.com/acme/widgets.git")
        assert r.status == "unavailable"

    def test_api_never_raises_bad_json(self, monkeypatch):
        class P:
            returncode = 0
            stdout = "not json"
            stderr = ""
        monkeypatch.setattr(subprocess, "run", lambda *a, **kw: P())
        r = GitHubEnrichment().enrich_repo("https://github.com/acme/widgets.git")
        assert r.status == "unavailable"

    def test_api_nonzero_exit_is_unavailable(self, monkeypatch):
        class P:
            returncode = 1
            stdout = ""
            stderr = "HTTP 404"
        monkeypatch.setattr(subprocess, "run", lambda *a, **kw: P())
        r = GitHubEnrichment().enrich_repo("https://github.com/acme/widgets.git")
        assert r.ok is False
        assert r.status == "unavailable"


class TestEnrichRepoLive:
    """Against a REAL authenticated gh session only (skipped when gh is
    absent or the session cannot reach GitHub — e.g. CI containers).
    Uses the public octocat repo: real fields back, no private data."""

    @staticmethod
    def _session_works() -> bool:
        if not _real_gh():
            return False
        r = GitHubEnrichment().observe()
        return bool(r.ok)

    def test_public_repo_enriches(self):
        if not self._session_works():
            pytest.skip("gh session unavailable")
        r = GitHubEnrichment().enrich_repo("https://github.com/octocat/Hello-World.git")
        assert r.ok, r.warnings
        assert r.data["slug"] == "octocat/Hello-World"
        assert r.data["url"] == "https://github.com/octocat/Hello-World"
        assert r.data["default_branch"] in ("master", "main")
        assert isinstance(r.data["open_prs"], int)
        assert isinstance(r.data["open_issues"], int)
        assert r.data["pushed_at"]

    def test_observe_reports_healthy_session(self):
        if not self._session_works():
            pytest.skip("gh session unavailable")
        r = GitHubEnrichment().observe()
        assert r.ok and r.status == "healthy"
        assert r.data["provider"] == "github"

    def test_invisible_repo_is_unavailable_not_guessed(self):
        if not self._session_works():
            pytest.skip("gh session unavailable")
        r = GitHubEnrichment().enrich_repo(
            "https://github.com/definitely-not/does-not-exist-918273.git")
        assert r.ok is False
        assert r.status == "unavailable"
        # no field is invented on failure
        assert r.data is None or "slug" not in (r.data or {})


class TestEndpoint:
    """/api/source-control/enrichment through the real app factory."""

    @pytest.fixture
    def client(self, tmp_path, monkeypatch):
        monkeypatch.setenv("PW_API_TOKEN", "t")
        from fastapi.testclient import TestClient
        from personal_world.api import create_app
        repo = tmp_path / "someworld"
        repo.mkdir()
        subprocess.run(["git", "init", "-q", str(repo)], check=True)
        subprocess.run(["git", "-C", str(repo), "remote", "add", "origin",
                        "https://github.com/octocat/Hello-World.git"], check=True)
        subprocess.run(["git", "-C", str(repo), "commit", "-q", "--allow-empty",
                        "-m", "seed"], check=True,
                       env={"GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@t",
                            "GIT_COMMITTER_NAME": "t", "GIT_COMMITTER_EMAIL": "t@t",
                            "GIT_CONFIG_GLOBAL": "/dev/null", "GIT_CONFIG_SYSTEM": "/dev/null",
                            "PATH": "/usr/bin:/bin"})
        conn = tmp_path / "connections.json"
        conn.write_text(
            '{"source_control": {"search_paths": ["%s"]}}' % repo
        )
        c = TestClient(create_app(tmp_path, tmp_path))
        c.headers.update({"Authorization": "Bearer t"})
        return c

    def test_requires_auth(self, tmp_path, monkeypatch):
        monkeypatch.setenv("PW_API_TOKEN", "t")
        from fastapi.testclient import TestClient
        from personal_world.api import create_app
        c = TestClient(create_app(tmp_path, tmp_path))
        r = c.get("/api/source-control/enrichment?repo=x")
        assert r.status_code == 401

    def test_no_repo_param_is_not_configured(self, client):
        r = client.get("/api/source-control/enrichment")
        body = r.json()
        assert body["ok"] is False
        assert body["status"] == "not_configured"

    def test_unknown_repo_is_not_configured(self, client):
        r = client.get("/api/source-control/enrichment?repo=nope")
        body = r.json()
        assert body["status"] == "not_configured"

    def test_known_repo_answers_honestly(self, client):
        """With gh present this is healthy/not_github; without gh it is
        unavailable. All three are honest; the native status shape is
        never touched either way."""
        r = client.get("/api/source-control/enrichment?repo=someworld")
        assert r.status_code == 200
        body = r.json()
        assert body["ok"] in (True, False)
        assert body["status"] in ("healthy", "unavailable", "not_github")

    def test_native_status_shape_unchanged_by_enrichment(self, client):
        """The canonical local fields are exactly the native set —
        enrichment never mutates repository_status's shape."""
        r = client.get("/api/source-control/status")
        repos = r.json()["data"]["repos"]
        repo = repos[0]
        assert set(repo.keys()) == {
            "path", "name", "branch", "revision", "dirty", "ahead",
            "behind", "remote", "last_commit_date", "last_commit_subject",
            "error",
        }


class TestNoSecondCredentialSystem:
    """The module must not grow credential management: it only shells
    gh and reads nothing else. Structural proof on the module's CODE
    (docstrings may legitimately describe gh's own session handling)."""

    def _code_lines(self):
        import ast
        import inspect
        from personal_world.providers import github as mod
        tree = ast.parse(inspect.getsource(mod))
        docstrings = set()
        for node in ast.walk(tree):
            if isinstance(node, (ast.Module, ast.ClassDef, ast.FunctionDef,
                                 ast.AsyncFunctionDef)):
                d = ast.get_docstring(node)
                if d:
                    docstrings.update(d.splitlines())
        src = inspect.getsource(mod)
        code = "\n".join(
            line for line in src.splitlines()
            if line.strip() not in {d.strip() for d in docstrings}
        )
        return code

    def test_module_has_no_credential_io(self):
        code = self._code_lines()
        for banned in ("os.environ", "open(", ".netrc", "keyring", "getpass"):
            assert banned not in code, banned

    def test_module_calls_gh_api_readonly(self):
        code = self._code_lines()
        # the only subprocess invocation is the gh api argv list
        assert "subprocess.run" in code
        assert "shell=True" not in code
        # GET endpoints only: every gh api path we build is a read
        for call in ("repos/", "rate_limit"):
            assert call in code
        for verb in ("/commits/", " POST", " PATCH", " PUT", " DELETE"):
            assert verb not in code