"""Tests for the chat capability: provider adapters, context builder,
and the POST /api/chat surface.

Chat is optional machinery: every test proves the fail-honest path
(not_configured, unavailable) as well as the happy path with a fake
provider. No test touches a real model endpoint.
"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from personal_world.chat import (  # noqa: E402
    ChatContract,
    OllamaChat,
    OpenAICompatChat,
    build_chat_messages,
    build_chat_provider,
    chat_once,
    trim_context,
)
from personal_world.chat_context import build_world_context  # noqa: E402
from personal_world.envelope import Result  # noqa: E402
from personal_world.journal import Journal  # noqa: E402
from personal_world.world import World  # noqa: E402


class FakeChat(ChatContract):
    """Deterministic reference provider for tests."""

    def __init__(self, reply: str = "fake reply") -> None:
        self.reply = reply
        self.seen: list[list[dict]] = []

    def chat(self, messages):
        self.seen.append(messages)
        return Result(ok=True, status="healthy",
                      data={"reply": self.reply, "thinking": None,
                            "model": "fake"})


class TestTrimContext:
    def test_short_context_untouched(self):
        assert trim_context("hello") == "hello"

    def test_long_context_truncated_with_notice(self):
        out = trim_context("x" * 9001, limit=100)
        assert len(out) > 100  # includes the notice
        assert "truncated" in out

    def test_truncation_announced(self):
        out = trim_context("y" * 500, limit=10)
        assert "10" in out


class TestBuildChatMessages:
    def test_system_prompt_carries_context(self):
        msgs = build_chat_messages("how is my world?", "- cap: healthy")
        assert msgs[0]["role"] == "system"
        assert "- cap: healthy" in msgs[0]["content"]
        assert msgs[-1] == {"role": "user", "content": "how is my world?"}

    def test_history_capped_to_six(self):
        history = [{"role": "user", "content": f"m{i}"} for i in range(20)]
        msgs = build_chat_messages("go", "ctx", history)
        carried = [m for m in msgs if m["role"] == "user" and m["content"] != "go"]
        assert len(carried) <= 6

    def test_context_trimmed_to_bound(self):
        msgs = build_chat_messages("q", "z" * 20000)
        assert len(msgs[0]["content"]) < 20000


class TestChatOnce:
    def test_happy_path(self):
        r = chat_once(FakeChat(), [{"role": "user", "content": "hi"}])
        assert r.ok and r.data["reply"] == "fake reply"

    def test_provider_crash_becomes_unavailable(self):
        class Boom(ChatContract):
            def chat(self, messages):
                raise RuntimeError("socket exploded")

        r = chat_once(Boom(), [{"role": "user", "content": "hi"}])
        assert not r.ok
        assert r.status == "unavailable"
        assert any("chat provider failed" in w for w in r.warnings)


class TestProviderBuilders:
    def test_ollama_shape(self):
        built = build_chat_provider({
            "type": "ollama", "name": "local-qwen",
            "base_url": "http://127.0.0.1:11434", "model": "qwen3:8b",
        })
        assert built is not None
        name, impl = built
        assert name == "local-qwen"
        assert isinstance(impl, OllamaChat)

    def test_openai_compat_shape(self):
        built = build_chat_provider({
            "type": "openai_compat", "name": "llamacpp",
            "base_url": "http://127.0.0.1:8080", "model": "x",
            "api_key_env": "SOME_ENV",
        })
        assert built is not None
        name, impl = built
        assert isinstance(impl, OpenAICompatChat)

    def test_missing_model_rejected(self):
        assert build_chat_provider({
            "type": "ollama", "base_url": "http://127.0.0.1:11434",
        }) is None

    def test_unknown_type_rejected(self):
        assert build_chat_provider({
            "type": "wat", "base_url": "http://x", "model": "m",
        }) is None


class TestWorldContext:
    def test_private_lore_excluded(self, tmp_path):
        from personal_world.model import Classification, Lore, Provenance

        w = World()
        w.lore["secret-thing"] = Lore(
            key="secret-thing", value="private detail", state="confirmed",
            provenance=Provenance(source="test"),
            classification=Classification.PRIVATE,
        )
        w.lore["public-thing"] = Lore(
            key="public-thing", value="open detail", state="confirmed",
            provenance=Provenance(source="test"),
            classification=Classification.WORLD,
        )
        ctx = build_world_context(w, _empty_registry(), Journal(tmp_path / "j"))
        assert "private detail" not in ctx
        assert "open detail" in ctx

    def test_context_lists_capability_statuses(self, tmp_path):
        ctx = build_world_context(World(), _empty_registry(),
                                  Journal(tmp_path / "j"))
        assert "## Capability status" in ctx


def _empty_registry():
    from personal_world.app import build_registry
    from personal_world.providers.registry import Registry

    return build_registry(World(), Registry(), Path("/nonexistent"))


class TestChatEndpoint:
    @pytest.fixture
    def client(self, tmp_path, monkeypatch):
        from fastapi.testclient import TestClient

        from personal_world.api import create_app

        monkeypatch.setenv("PW_API_TOKEN", "t")
        app = create_app(tmp_path, tmp_path)
        return TestClient(app), tmp_path

    def _headers(self):
        return {"Authorization": "Bearer t"}

    def test_no_provider_is_not_configured(self, client):
        c, _ = client
        r = c.post("/api/chat", json={"message": "hi"}, headers=self._headers())
        assert r.status_code == 200
        body = r.json()
        assert body["ok"] is False
        assert body["status"] == "not_configured"

    def test_empty_message_rejected(self, client):
        c, _ = client
        r = c.post("/api/chat", json={"message": "  "}, headers=self._headers())
        assert r.status_code == 400

    def test_non_json_rejected(self, client):
        c, _ = client
        r = c.post("/api/chat", content=b"nope",
                   headers={**self._headers(),
                            "Content-Type": "application/json"})
        assert r.status_code == 400

    def test_auth_required(self, client):
        c, _ = client
        r = c.post("/api/chat", json={"message": "hi"})
        assert r.status_code in (401, 503)

    def test_provider_reply_flows_through(self, client, monkeypatch):
        """Full path with a registered fake provider: context built,
        provider called, reply returned, journal recorded."""
        c, tmp_path = client
        import personal_world.api as api_mod
        from personal_world.providers.registry import Registry

        fake = FakeChat(reply="all healthy, 0 facts")

        real_build_registry = api_mod.build_registry

        def patched_build_registry(world, registry, config_dir):
            reg = real_build_registry(world, registry, config_dir)
            reg.register("reasoning", "fake-chat", fake,
                         health_check=lambda: True, writes="none")
            return reg

        monkeypatch.setattr(api_mod, "build_registry",
                            patched_build_registry)
        # Recreate the app so create_app's closures bind the patch
        from fastapi.testclient import TestClient

        app = api_mod.create_app(tmp_path, tmp_path)
        c2 = TestClient(app)
        r = c2.post("/api/chat", json={"message": "how is my world?"},
                    headers=self._headers())
        assert r.status_code == 200
        body = r.json()
        assert body["ok"] is True
        assert body["data"]["reply"] == "all healthy, 0 facts"
        # The provider saw a system prompt with injected context
        assert fake.seen, "provider received no messages"
        assert "Capability status" in fake.seen[0][0]["content"]
        # The exchange is journaled
        events = Journal(tmp_path / "journal.ndjson").recent(5)
        assert any("chat exchange" in e.summary for e in events)

class TestChatUiContext:
    """Contextual chat (Finish Line): the UI may describe where the
    person is. Provenance, never authority: unknown sections degrade
    to honest `unknown`; absent context means global chat (no block)."""

    @pytest.fixture
    def client(self, tmp_path, monkeypatch):
        from fastapi.testclient import TestClient

        from personal_world.api import create_app
        import personal_world.api as api_mod

        monkeypatch.setenv("PW_API_TOKEN", "t")
        fake = FakeChat(reply="ctx ok")

        real_build_registry = api_mod.build_registry

        def patched_build_registry(world, registry, config_dir):
            reg = real_build_registry(world, registry, config_dir)
            reg.register("reasoning", "fake-chat", fake,
                         health_check=lambda: True, writes="none")
            return reg

        monkeypatch.setattr(api_mod, "build_registry", patched_build_registry)
        app = create_app(tmp_path, tmp_path)
        return TestClient(app), fake

    def _headers(self):
        return {"Authorization": "Bearer t"}

    def test_known_section_injected(self, client):
        c, fake = client
        r = c.post(
            "/api/chat",
            json={
                "message": "what needs attention here?",
                "context": {"route": "/journal", "section_id": "journal"},
            },
            headers=self._headers(),
        )
        assert r.status_code == 200 and r.json()["ok"] is True
        system = fake.seen[-1][0]["content"]
        assert "Where the person is" in system
        assert "route: /journal" in system
        assert "section: journal (Journal & Memory)" in system
        # The system still forbids inventing state
        assert "ONLY the context" in system

    def test_unknown_section_degrades_to_honest_unknown(self, client):
        c, fake = client
        r = c.post(
            "/api/chat",
            json={
                "message": "here?",
                "context": {"route": "/wat", "section_id": "not-a-section"},
            },
            headers=self._headers(),
        )
        assert r.status_code == 200 and r.json()["ok"] is True
        system = fake.seen[-1][0]["content"]
        assert "section: not-a-section (unknown section)" in system
        assert "section status: unknown" in system

    def test_no_context_means_global_chat(self, client):
        c, fake = client
        r = c.post("/api/chat", json={"message": "hi"},
                    headers=self._headers())
        assert r.status_code == 200 and r.json()["ok"] is True
        system = fake.seen[-1][0]["content"]
        assert "Where the person is" not in system

    def test_malformed_context_never_rejected(self, client):
        c, fake = client
        r = c.post("/api/chat",
                    json={"message": "hi", "context": "nonsense"},
                    headers=self._headers())
        assert r.status_code == 200 and r.json()["ok"] is True
        system = fake.seen[-1][0]["content"]
        assert "Where the person is" not in system


class TestBuildUiContext:
    def test_full_shape(self):
        from personal_world.chat_context import build_ui_context
        out = build_ui_context("/vault", "vault", "Vault", "healthy",
                               ["secrets"])
        assert "route: /vault" in out
        assert "section: vault (Vault)" in out
        assert "section status: healthy" in out
        assert "secrets" in out

    def test_empty_is_none(self):
        from personal_world.chat_context import build_ui_context
        assert build_ui_context(None, None, None, None, None) is None


class TestChatUiEntity:
    """The context envelope may carry the selected object (Finish Line
    context profile: "the currently selected object, project, repo")."""

    @pytest.fixture
    def client(self, tmp_path, monkeypatch):
        from fastapi.testclient import TestClient

        from personal_world.api import create_app
        import personal_world.api as api_mod

        monkeypatch.setenv("PW_API_TOKEN", "t")
        fake = FakeChat(reply="entity ok")

        real_build_registry = api_mod.build_registry

        def patched_build_registry(world, registry, config_dir):
            reg = real_build_registry(world, registry, config_dir)
            reg.register("reasoning", "fake-chat", fake,
                         health_check=lambda: True, writes="none")
            return reg

        monkeypatch.setattr(api_mod, "build_registry", patched_build_registry)
        app = create_app(tmp_path, tmp_path)
        return TestClient(app), fake

    def _headers(self):
        return {"Authorization": "Bearer t"}

    def test_entity_injected_as_selected(self, client):
        c, fake = client
        r = c.post(
            "/api/chat",
            json={
                "message": "what about this repo?",
                "context": {
                    "route": "/projects",
                    "section_id": "projects",
                    "entity": "personal-world",
                },
            },
            headers=self._headers(),
        )
        assert r.status_code == 200 and r.json()["ok"] is True
        system = fake.seen[-1][0]["content"]
        assert "selected: personal-world" in system

    def test_entity_without_section_degrades(self, client):
        c, fake = client
        r = c.post(
            "/api/chat",
            json={"message": "hi", "context": {"entity": "x"}},
            headers=self._headers(),
        )
        assert r.status_code == 200 and r.json()["ok"] is True
        system = fake.seen[-1][0]["content"]
        assert "Where the person is" not in system
