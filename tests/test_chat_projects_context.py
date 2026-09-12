"""Personal World's read-only project-status context tests
(chat_context._projects_block).

Contract under test:
- the block is a BOUNDED compact projection: one line per non-quiet
  project, quiet projects as ONE count line, no SHAs ever
- unknown is preserved honestly ("remote unreachable"), never
  healthy or unhealthy
- sensor absent / failed -> NO block at all (estate unknown, not
  empty)
- the block carries no mutation authority: it is prose the
  assistant may explain, and the assistant's mutation verbs stay
  outside Project Worlds entirely (status observes; presentation
  presents)
"""

import json
import subprocess

import pytest

from personal_world.chat_context import build_world_context
from personal_world.envelope import ok
from personal_world.journal import Journal
from personal_world.world import World


def _estate(projects, observed_at="2026-09-12T12:48:38Z"):
    return ok("healthy", data={"observed_at": observed_at,
                               "projects": projects})


def _proj(project, publish_state="match", dirty=0, safe="yes"):
    return {
        "project": project, "path": f"/repos/{project}", "is_git_repo": True,
        "branch": "main", "local_head": "abc123def456789",
        "remote_name": "origin", "remote_url": f"https://x/{project}.git",
        "remote_head": "abc123def456789" if publish_state else None,
        "publish_state": publish_state,
        "working_tree": {"staged": 0, "modified": dirty, "untracked": 0,
                         "conflicted": 0},
        "play_nice": {"present": False, "revision": None,
                      "source_repository": None},
        "work_state": "unknown", "safe_to_leave": safe, "error": None,
    }


def _patch_sensor(monkeypatch, result):
    from personal_world.providers.agent_sync import AgentSyncProjectSensor
    monkeypatch.setattr(AgentSyncProjectSensor, "observe_projects",
                        lambda self: result)


def _ctx(tmp_path, monkeypatch, result):
    _patch_sensor(monkeypatch, result)
    from personal_world.app import build_registry
    from personal_world.providers.registry import Registry
    w = World()
    return build_world_context(
        w, build_registry(w, Registry(), tmp_path / "cfg"),
        Journal(tmp_path / "j"), include_journal=False,
        config_dir=tmp_path / "cfg",
    )


class TestProjectsContextBlock:
    def test_compact_projection_with_quiet_count(self, tmp_path, monkeypatch):
        ctx = _ctx(tmp_path, monkeypatch, _estate([
            _proj("split", publish_state="diverged", safe="no"),
            _proj("unshared", publish_state="ahead", safe="no"),
            _proj("wip", dirty=3, safe="published-with-local-work"),
            _proj("offline", publish_state=None, safe="unknown"),
            _proj("one", publish_state="match"),
            _proj("two", publish_state="match"),
        ]))
        assert "## Projects (agent-sync observation)" in ctx
        assert "- split: diverged; clean tree" in ctx
        assert "- unshared: unpublished (local ahead); clean tree" in ctx
        assert "- wip: published; local work; 3 uncommitted file(s)" in ctx
        assert "- offline: unknown (remote unreachable); clean tree" in ctx
        assert "- 2 quiet" in ctx
        assert "Observed: 2026-09-12T12:48:38Z" in ctx

    def test_no_shas_in_context(self, tmp_path, monkeypatch):
        ctx = _ctx(tmp_path, monkeypatch, _estate([_proj("demo")]))
        assert "abc123def456789" not in ctx

    def test_sensor_unavailable_means_no_block(self, tmp_path, monkeypatch):
        from personal_world.envelope import fail
        ctx = _ctx(tmp_path, monkeypatch, fail("unavailable"))
        assert "## Projects" not in ctx

    def test_empty_estate_means_no_block(self, tmp_path, monkeypatch):
        ctx = _ctx(tmp_path, monkeypatch, _estate([]))
        assert "## Projects" not in ctx

    def test_all_quiet_is_one_count_line(self, tmp_path, monkeypatch):
        ctx = _ctx(tmp_path, monkeypatch, _estate(
            [_proj("a"), _proj("b"), _proj("c")]))
        assert "- 3 quiet" in ctx
        assert "- a:" not in ctx  # quiet projects get no per-project line

    def test_sensor_exception_degrades_to_no_block(self, tmp_path, monkeypatch):
        from personal_world.providers.agent_sync import AgentSyncProjectSensor
        def boom(self):
            raise RuntimeError("boom")
        monkeypatch.setattr(AgentSyncProjectSensor, "observe_projects", boom)
        from personal_world.app import build_registry
        from personal_world.providers.registry import Registry
        w = World()
        cfg = tmp_path / "cfg"
        cfg.mkdir(parents=True, exist_ok=True)
        ctx = build_world_context(
            w, build_registry(w, Registry(), cfg),
            Journal(tmp_path / "j"), include_journal=False, config_dir=cfg,
        )
        assert "## Projects" not in ctx

    def test_block_is_bounded_by_project_count_constant(self):
        from personal_world.chat_context import PROJECTS_IN_CONTEXT
        assert PROJECTS_IN_CONTEXT <= 12