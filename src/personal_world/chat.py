"""Chat capability: provider-neutral local-AI conversation.

Architecture target (docs/DESIGN-HANDOFF.md, ROADMAP "Now"):
Personal World UI -> Chat API -> small context builder ->
provider-neutral ChatContract -> local model endpoint.

The local AI is optional and replaceable. With no provider configured
the capability reports ``not_configured`` and the core still boots;
the dashboard degrades to an honest "AI not connected" state rather
than a fake conversation.

Adapters in this module never log or persist secret material; keys
arrive through env indirection (the framework's secret rule). Chat
context is built from safe read APIs only -- the chat path can observe
the world but never mutates privileged state.
"""

import json
import os
import urllib.request
from typing import Any

from .envelope import Result, fail, ok

CHAT_TIMEOUT_SECONDS = 120
"""Local models on modest hardware can take a while; cold start of a
quantized 8B model is commonly tens of seconds. Generous but bounded."""

MAX_CONTEXT_CHARS = 8000
"""Upper bound on the injected world-context block so a bloated world
state cannot silently exceed a small local model's context window."""


class ChatContract:
    """Provider-neutral conversation contract.

    Implementations accept an OpenAI-style message list
    (``[{"role": ..., "content": ...}]``) and return a Result whose
    data carries ``reply`` plus provider-specific diagnostics.
    """

    def chat(self, messages: list[dict[str, str]]) -> Result:
        raise NotImplementedError


class OllamaChat(ChatContract):
    """Chat over Ollama's native /api/chat (OpenAI-style messages in).

    Thinking-model diagnostics (qwen3 et al.) are returned separately
    in ``thinking`` and never concatenated into the visible reply.
    """

    def __init__(self, base_url: str, model: str, timeout: int = CHAT_TIMEOUT_SECONDS) -> None:
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout = timeout

    def observe(self) -> Result:
        try:
            with urllib.request.urlopen(
                f"{self.base_url}/api/tags", timeout=5
            ) as resp:
                payload = json.loads(resp.read().decode())
            models = [m.get("name", "") for m in payload.get("models", [])]
            present = any(m == self.model or m.split(":")[0] == self.model
                          for m in models)
            if not present:
                return fail(
                    "unhealthy",
                    data={"base_url": self.base_url, "model": self.model},
                    warnings=[f"model '{self.model}' not in local library"],
                )
            return ok("healthy", data={
                "base_url": self.base_url,
                "model": self.model,
                "models": models,
            })
        except Exception as e:
            return Result(
                ok=False,
                status="unavailable",
                warnings=[f"ollama: {e}"],
            )

    def chat(self, messages: list[dict[str, str]]) -> Result:
        body = json.dumps({
            "model": self.model,
            "messages": messages,
            "stream": False,
        }).encode()
        req = urllib.request.Request(
            f"{self.base_url}/api/chat",
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                payload = json.loads(resp.read().decode())
        except Exception as e:
            return Result(
                ok=False,
                status="unavailable",
                warnings=[f"ollama chat: {e}"],
            )
        message = payload.get("message") or {}
        content = (message.get("content") or "").strip()
        if not content:
            return Result(
                ok=False,
                status="unavailable",
                warnings=["ollama returned an empty reply"],
            )
        return ok("healthy", data={
            "reply": content,
            "thinking": message.get("thinking"),
            "model": payload.get("model", self.model),
            "eval_count": payload.get("eval_count"),
            "prompt_eval_count": payload.get("prompt_eval_count"),
        })


class OpenAICompatChat(ChatContract):
    """Chat over any OpenAI-compatible /v1/chat/completions endpoint
    (llama.cpp server, LiteLLM, vLLM, OpenWebUI's API bridge)."""

    def __init__(
        self,
        base_url: str,
        model: str,
        api_key_env: str | None = None,
        timeout: int = CHAT_TIMEOUT_SECONDS,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.api_key_env = api_key_env
        self.timeout = timeout

    def _headers(self) -> dict:
        h = {"Content-Type": "application/json"}
        if self.api_key_env and os.environ.get(self.api_key_env):
            h["Authorization"] = f"Bearer {os.environ[self.api_key_env]}"
        return h

    def observe(self) -> Result:
        try:
            req = urllib.request.Request(
                f"{self.base_url}/v1/models", headers=self._headers()
            )
            with urllib.request.urlopen(req, timeout=5) as resp:
                payload = json.loads(resp.read().decode())
            ids = [m.get("id", "") for m in payload.get("data", [])]
            present = self.model in ids if ids else True
            if not present:
                return fail(
                    "unhealthy",
                    data={"base_url": self.base_url, "model": self.model},
                    warnings=[f"model '{self.model}' not offered by endpoint"],
                )
            return ok("healthy", data={
                "base_url": self.base_url,
                "model": self.model,
                "models": ids,
            })
        except Exception as e:
            return Result(
                ok=False,
                status="unavailable",
                warnings=[f"openai-compat: {e}"],
            )

    def chat(self, messages: list[dict[str, str]]) -> Result:
        body = json.dumps({
            "model": self.model,
            "messages": messages,
            "stream": False,
        }).encode()
        req = urllib.request.Request(
            f"{self.base_url}/v1/chat/completions",
            data=body,
            headers=self._headers(),
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                payload = json.loads(resp.read().decode())
        except Exception as e:
            return Result(
                ok=False,
                status="unavailable",
                warnings=[f"openai-compat chat: {e}"],
            )
        choices = payload.get("choices") or []
        content = ""
        if choices:
            content = ((choices[0].get("message") or {}).get("content") or "").strip()
        if not content:
            return Result(
                ok=False,
                status="unavailable",
                warnings=["endpoint returned an empty reply"],
            )
        return ok("healthy", data={
            "reply": content,
            "thinking": None,
            "model": payload.get("model", self.model),
            "eval_count": payload.get("usage", {}).get("completion_tokens"),
            "prompt_eval_count": payload.get("usage", {}).get("prompt_tokens"),
        })


def build_chat_provider(connection: dict[str, Any]) -> tuple[str, ChatContract] | None:
    """Construct a chat provider from one connections.json entry.

    Returns (name, impl) or None for unknown/under-specified entries.
    Supported shapes::

        {"type": "ollama", "name": "local-qwen",
         "base_url": "http://127.0.0.1:11434", "model": "qwen3:8b"}
        {"type": "openai_compat", "name": "llamacpp",
         "base_url": "http://127.0.0.1:8080", "model": "...",
         "api_key_env": "MY_KEY_ENV"}
    """
    ptype = connection.get("type")
    name = connection.get("name")
    base = connection.get("base_url")
    model = connection.get("model")
    if not base or not model:
        return None
    if ptype == "ollama":
        timeout = int(connection.get("timeout") or CHAT_TIMEOUT_SECONDS)
        return name or "ollama", OllamaChat(base, model, timeout=timeout)
    if ptype == "openai_compat":
        timeout = int(connection.get("timeout") or CHAT_TIMEOUT_SECONDS)
        impl = OpenAICompatChat(base, model, connection.get("api_key_env"),
                                timeout=timeout)
        return name or "openai-compat", impl
    return None


def trim_context(context: str, limit: int = MAX_CONTEXT_CHARS) -> str:
    """Bound the world-context block. Truncation is announced in the
    block itself so the model (and the human) can see it happened."""
    if len(context) <= limit:
        return context
    kept = context[:limit]
    return kept + f"\n[…context truncated at {limit} chars…]"


def build_chat_messages(
    user_message: str,
    world_context: str,
    history: list[dict[str, str]] | None = None,
) -> list[dict[str, str]]:
    """System prompt + optional short history + the new user message.

    The system prompt establishes the Personal World persona, injects
    the trimmed world-context block, and forbids the model from
    inventing state it was not shown. History is capped to the last six
    turns to stay inside small local-model context windows.
    """
    system = (
        "You are the Personal World assistant: a calm, factual companion "
        "embedded in Rylee's personal control plane. You answer questions "
        "about the state of her world using ONLY the context block below. "
        "If the context does not contain the answer, say so plainly "
        "instead of inventing status, names, or numbers. Status vocabulary "
        "is fixed: healthy, warning, unknown, needs_attention, unavailable, "
        "stale, disabled, not_configured. Keep replies short, warm, and "
        "structured; prefer lists over prose paragraphs when listing.\n\n"
        "--- Personal World context (observed, read-only) ---\n"
        f"{trim_context(world_context)}\n"
        "--- end context ---"
    )
    messages: list[dict[str, str]] = [{"role": "system", "content": system}]
    if history:
        for m in history[-6:]:
            if m.get("role") in ("user", "assistant") and m.get("content"):
                messages.append({"role": m["role"], "content": m["content"]})
    messages.append({"role": "user", "content": user_message})
    return messages


def chat_once(
    provider: ChatContract,
    messages: list[dict[str, str]],
) -> Result:
    """One provider round-trip with fail-closed error mapping."""
    try:
        return provider.chat(messages)
    except Exception as e:  # provider crash must never reach the API surface
        return Result(ok=False, status="unavailable",
                      warnings=[f"chat provider failed: {e}"])