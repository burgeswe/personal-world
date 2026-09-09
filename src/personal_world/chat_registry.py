"""Chat provider registry: multiple LLM providers with switching.

Supports:
  - Ollama (local, any model)
  - OpenAI-compatible (llama.cpp, vLLM, LiteLLM, OpenWebUI)
  - OpenAI direct (GPT-4, GPT-4o, etc.)
  - Anthropic Claude (via messages API)
  - Any future provider that speaks OpenAI-style chat

Providers are configured in connections.json under the "reasoning"
capability. The active provider can be switched at runtime via the
API. Preferences persist per-user.
"""

import json
import os
import subprocess
import urllib.request
from typing import Any

from .envelope import Result, fail, ok

CHAT_TIMEOUT_SECONDS = 120


class ChatContract:
    """Provider-neutral conversation contract."""

    def chat(self, messages: list[dict[str, str]]) -> Result:
        raise NotImplementedError

    def observe(self) -> Result:
        raise NotImplementedError


class OllamaChat(ChatContract):
    """Chat over Ollama's native /api/chat."""

    def __init__(self, base_url: str, model: str, timeout: int = CHAT_TIMEOUT_SECONDS) -> None:
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout = timeout
        self.display_name = f"Ollama ({model})"

    def observe(self) -> Result:
        try:
            with urllib.request.urlopen(f"{self.base_url}/api/tags", timeout=5) as resp:
                payload = json.loads(resp.read().decode())
            models = [m.get("name", "") for m in payload.get("models", [])]
            present = any(m == self.model or m.split(":")[0] == self.model for m in models)
            if not present:
                return fail("unhealthy", data={"base_url": self.base_url, "model": self.model},
                            warnings=[f"model '{self.model}' not in local library"])
            return ok("healthy", data={"base_url": self.base_url, "model": self.model, "models": models})
        except Exception as e:
            return Result(ok=False, status="unavailable", warnings=[f"ollama: {e}"])

    def chat(self, messages: list[dict[str, str]]) -> Result:
        body = json.dumps({"model": self.model, "messages": messages, "stream": False}).encode()
        req = urllib.request.Request(f"{self.base_url}/api/chat", data=body,
                                     headers={"Content-Type": "application/json"}, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                payload = json.loads(resp.read().decode())
        except Exception as e:
            return Result(ok=False, status="unavailable", warnings=[f"ollama chat: {e}"])
        message = payload.get("message") or {}
        content = (message.get("content") or "").strip()
        if not content:
            return Result(ok=False, status="unavailable", warnings=["ollama returned an empty reply"])
        return ok("healthy", data={"reply": content, "thinking": message.get("thinking"),
                                    "model": payload.get("model", self.model)})


class OpenAICompatChat(ChatContract):
    """Chat over any OpenAI-compatible /v1/chat/completions endpoint."""

    def __init__(self, base_url: str, model: str, api_key_env: str | None = None,
                 timeout: int = CHAT_TIMEOUT_SECONDS, display_name: str | None = None) -> None:
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.api_key_env = api_key_env
        self.timeout = timeout
        self.display_name = display_name or f"OpenAI-compat ({model})"

    def _headers(self) -> dict:
        h = {"Content-Type": "application/json"}
        if self.api_key_env and os.environ.get(self.api_key_env):
            h["Authorization"] = f"Bearer {os.environ[self.api_key_env]}"
        return h

    def observe(self) -> Result:
        try:
            req = urllib.request.Request(f"{self.base_url}/v1/models", headers=self._headers())
            with urllib.request.urlopen(req, timeout=5) as resp:
                payload = json.loads(resp.read().decode())
            ids = [m.get("id", "") for m in payload.get("data", [])]
            present = self.model in ids if ids else True
            if not present:
                return fail("unhealthy", data={"base_url": self.base_url, "model": self.model},
                            warnings=[f"model '{self.model}' not offered by endpoint"])
            return ok("healthy", data={"base_url": self.base_url, "model": self.model, "models": ids})
        except Exception as e:
            return Result(ok=False, status="unavailable", warnings=[f"openai-compat: {e}"])

    def chat(self, messages: list[dict[str, str]]) -> Result:
        body = json.dumps({"model": self.model, "messages": messages, "stream": False}).encode()
        req = urllib.request.Request(f"{self.base_url}/v1/chat/completions", data=body,
                                     headers=self._headers(), method="POST")
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                payload = json.loads(resp.read().decode())
        except Exception as e:
            return Result(ok=False, status="unavailable", warnings=[f"openai-compat chat: {e}"])
        choices = payload.get("choices") or []
        content = ""
        if choices:
            content = ((choices[0].get("message") or {}).get("content") or "").strip()
        if not content:
            return Result(ok=False, status="unavailable", warnings=["endpoint returned an empty reply"])
        return ok("healthy", data={"reply": content, "thinking": None,
                                    "model": payload.get("model", self.model)})


class OpenAIChat(ChatContract):
    """Chat with OpenAI's API directly (GPT-4, GPT-4o, etc.)."""

    def __init__(self, model: str, api_key_env: str = "OPENAI_API_KEY",
                 timeout: int = CHAT_TIMEOUT_SECONDS) -> None:
        self.model = model
        self.api_key_env = api_key_env
        self.timeout = timeout
        self.display_name = f"OpenAI ({model})"

    def _headers(self) -> dict:
        h = {"Content-Type": "application/json"}
        key = os.environ.get(self.api_key_env)
        if key:
            h["Authorization"] = f"Bearer {key}"
        return h

    def observe(self) -> Result:
        key = os.environ.get(self.api_key_env)
        if not key:
            return fail("unavailable", warnings=[f"{self.api_key_env} not set"])
        try:
            req = urllib.request.Request("https://api.openai.com/v1/models", headers=self._headers())
            with urllib.request.urlopen(req, timeout=10) as resp:
                payload = json.loads(resp.read().decode())
            ids = [m.get("id", "") for m in payload.get("data", [])]
            present = any(self.model in m for m in ids)
            if not present:
                return fail("unhealthy", warnings=[f"model '{self.model}' not available"])
            return ok("healthy", data={"model": self.model, "available_models": len(ids)})
        except Exception as e:
            return Result(ok=False, status="unavailable", warnings=[f"openai: {e}"])

    def chat(self, messages: list[dict[str, str]]) -> Result:
        body = json.dumps({"model": self.model, "messages": messages, "stream": False}).encode()
        req = urllib.request.Request("https://api.openai.com/v1/chat/completions", data=body,
                                     headers=self._headers(), method="POST")
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                payload = json.loads(resp.read().decode())
        except Exception as e:
            return Result(ok=False, status="unavailable", warnings=[f"openai chat: {e}"])
        choices = payload.get("choices") or []
        content = ""
        if choices:
            content = ((choices[0].get("message") or {}).get("content") or "").strip()
        if not content:
            return Result(ok=False, status="unavailable", warnings=["openai returned an empty reply"])
        return ok("healthy", data={"reply": content, "thinking": None,
                                    "model": payload.get("model", self.model)})


class AnthropicChat(ChatContract):
    """Chat with Anthropic's Claude API."""

    def __init__(self, model: str, api_key_env: str = "ANTHROPIC_API_KEY",
                 timeout: int = CHAT_TIMEOUT_SECONDS) -> None:
        self.model = model
        self.api_key_env = api_key_env
        self.timeout = timeout
        self.display_name = f"Claude ({model})"

    def _headers(self) -> dict:
        h = {
            "Content-Type": "application/json",
            "anthropic-version": "2023-06-01",
        }
        key = os.environ.get(self.api_key_env)
        if key:
            h["x-api-key"] = key
        return h

    def observe(self) -> Result:
        key = os.environ.get(self.api_key_env)
        if not key:
            return fail("unavailable", warnings=[f"{self.api_key_env} not set"])
        return ok("healthy", data={"model": self.model, "provider": "anthropic"})

    def chat(self, messages: list[dict[str, str]]) -> Result:
        # Anthropic uses a different message format
        system = ""
        claude_messages = []
        for m in messages:
            if m["role"] == "system":
                system = m["content"]
            else:
                claude_messages.append({"role": m["role"], "content": m["content"]})

        body: dict[str, Any] = {
            "model": self.model,
            "max_tokens": 2048,
            "messages": claude_messages,
        }
        if system:
            body["system"] = system

        data = json.dumps(body).encode()
        req = urllib.request.Request("https://api.anthropic.com/v1/messages", data=data,
                                     headers=self._headers(), method="POST")
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                payload = json.loads(resp.read().decode())
        except Exception as e:
            return Result(ok=False, status="unavailable", warnings=[f"claude chat: {e}"])

        content_blocks = payload.get("content", [])
        text_parts = [b.get("text", "") for b in content_blocks if b.get("type") == "text"]
        reply = "\n".join(text_parts).strip()
        if not reply:
            return Result(ok=False, status="unavailable", warnings=["claude returned an empty reply"])
        return ok("healthy", data={"reply": reply, "thinking": None,
                                    "model": payload.get("model", self.model)})


class OpenCodeChat(ChatContract):
    """Chat via OpenCode Go CLI (opencode run).

    Uses the opencode CLI to send messages to any model available
    through OpenCode Go's provider system. This is the simplest
    integration — no API server needed, just the CLI binary.
    """

    def __init__(self, model: str = "opencode-go/mimo-v2.5",
                 timeout: int = CHAT_TIMEOUT_SECONDS) -> None:
        self.model = model
        self.timeout = timeout
        self.display_name = f"OpenCode ({model.split('/')[-1]})"

    def observe(self) -> Result:
        try:
            proc = subprocess.run(
                ["opencode", "models"],
                capture_output=True, text=True, timeout=10,
            )
            if proc.returncode != 0:
                return fail("unavailable", warnings=["opencode CLI not working"])
            models = proc.stdout.strip().split("\n")
            present = any(self.model in m for m in models)
            if not present:
                return fail("unhealthy", warnings=[f"model '{self.model}' not found in opencode"])
            return ok("healthy", data={"model": self.model, "available": len(models)})
        except FileNotFoundError:
            return fail("unavailable", warnings=["opencode CLI not installed"])
        except Exception as e:
            return Result(ok=False, status="unavailable", warnings=[f"opencode: {e}"])

    def chat(self, messages: list[dict[str, str]]) -> Result:
        # Build the prompt from messages
        prompt_parts = []
        for m in messages:
            if m["role"] == "system":
                prompt_parts.append(f"System: {m['content']}")
            elif m["role"] == "user":
                prompt_parts.append(m["content"])
            elif m["role"] == "assistant":
                prompt_parts.append(f"Assistant: {m['content']}")
        prompt = "\n\n".join(prompt_parts)

        try:
            proc = subprocess.run(
                ["opencode", "run", "--model", self.model, "--format", "json"],
                input=prompt,
                capture_output=True, text=True, timeout=self.timeout,
            )
        except subprocess.TimeoutExpired:
            return Result(ok=False, status="unavailable",
                          warnings=["opencode timed out"])
        except FileNotFoundError:
            return Result(ok=False, status="unavailable",
                          warnings=["opencode CLI not installed"])
        except Exception as e:
            return Result(ok=False, status="unavailable",
                          warnings=[f"opencode run failed: {e}"])

        if proc.returncode != 0:
            return Result(ok=False, status="unavailable",
                          warnings=[f"opencode exited {proc.returncode}: {proc.stderr[:200]}"])

        # Parse JSON events from stdout
        reply = ""
        thinking = None
        model_used = self.model
        for line in proc.stdout.strip().split("\n"):
            if not line.strip():
                continue
            try:
                event = json.loads(line)
            except json.JSONDecodeError:
                continue
            if event.get("type") == "text":
                text = event.get("part", {}).get("text", "")
                if text:
                    reply += text
            elif event.get("type") == "step_finish":
                tokens = event.get("part", {}).get("tokens", {})

        reply = reply.strip()
        if not reply:
            return Result(ok=False, status="unavailable",
                          warnings=["opencode returned no text"])

        return ok("healthy", data={
            "reply": reply,
            "thinking": thinking,
            "model": model_used,
        })


# --- Provider registry ---

_PROVIDER_BUILDERS: dict[str, type[ChatContract]] = {
    "ollama": OllamaChat,
    "openai_compat": OpenAICompatChat,
    "openai": OpenAIChat,
    "anthropic": AnthropicChat,
    "opencode": OpenCodeChat,
}


def build_chat_provider(connection: dict[str, Any]) -> tuple[str, ChatContract] | None:
    """Construct a chat provider from one connections.json entry."""
    ptype = connection.get("type")
    name = connection.get("name")
    base = connection.get("base_url")
    model = connection.get("model")

    if ptype == "ollama":
        if not base or not model:
            return None
        timeout = int(connection.get("timeout") or CHAT_TIMEOUT_SECONDS)
        return name or "ollama", OllamaChat(base, model, timeout=timeout)

    if ptype == "openai_compat":
        if not base or not model:
            return None
        timeout = int(connection.get("timeout") or CHAT_TIMEOUT_SECONDS)
        impl = OpenAICompatChat(base, model, connection.get("api_key_env"),
                                timeout=timeout, display_name=connection.get("display_name"))
        return name or "openai-compat", impl

    if ptype == "openai":
        if not model:
            return None
        timeout = int(connection.get("timeout") or CHAT_TIMEOUT_SECONDS)
        impl = OpenAIChat(model, connection.get("api_key_env", "OPENAI_API_KEY"), timeout=timeout)
        return name or "openai", impl

    if ptype == "anthropic":
        if not model:
            return None
        timeout = int(connection.get("timeout") or CHAT_TIMEOUT_SECONDS)
        impl = AnthropicChat(model, connection.get("api_key_env", "ANTHROPIC_API_KEY"), timeout=timeout)
        return name or "anthropic", impl

    if ptype == "opencode":
        model = connection.get("model", "opencode-go/mimo-v2.5")
        timeout = int(connection.get("timeout") or CHAT_TIMEOUT_SECONDS)
        impl = OpenCodeChat(model, timeout=timeout)
        return name or "opencode", impl

    return None


class ChatProviderRegistry:
    """Manages multiple chat providers with runtime switching."""

    def __init__(self) -> None:
        self._providers: dict[str, ChatContract] = {}
        self._active: str | None = None

    def register(self, name: str, provider: ChatContract) -> None:
        self._providers[name] = provider
        if self._active is None:
            self._active = name

    def set_active(self, name: str) -> Result:
        if name not in self._providers:
            return fail("not_found", warnings=[f"provider '{name}' not registered"])
        self._active = name
        return ok("healthy", data={"active": name})

    def get_active(self) -> ChatContract | None:
        if self._active:
            return self._providers.get(self._active)
        return None

    def get(self, name: str) -> ChatContract | None:
        return self._providers.get(name)

    def list_providers(self) -> list[dict[str, Any]]:
        result = []
        for name, impl in self._providers.items():
            r = impl.observe()
            result.append({
                "name": name,
                "display_name": getattr(impl, "display_name", name),
                "active": name == self._active,
                "status": r.status,
                "ok": r.ok,
            })
        return result
