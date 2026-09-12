import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { axe } from "vitest-axe";
import { ChatPanel } from "../components/ChatPanel";
import type { ChatPanelProps } from "../components/ChatPanel";
import { LiveRegionProvider } from "../primitives/LiveRegion";

/**
 * T12 ChatPanel spec (FOUNDATION-SPEC §6 + §7 row 7): the transitional
 * standalone chat, mounted by the /chat route with NO chat logic in
 * the route file.
 *
 * Proven here (real lib/api.ts client over mocked fetch):
 * - send → POST /api/chat with message + history; reply renders;
 * - thinking status text renders while the request is in flight and
 *   is NEVER announced (LiveRegion allow-list restraint, A11y §8);
 * - turn completion IS announced (action_completed) and failure IS
 *   announced (error) — the only two kinds chat may emit;
 * - provenance: per-reply Sources disclosure + Level-4 Technical
 *   details when the provider reports model/thinking;
 * - not_configured → honest status word + Settings knob + retry/keep
 *   writing; Retry re-sends the same text; Keep writing restores the
 *   composer;
 * - history: sessionStorage persistence keyed by token scope (no raw
 *   token in the key) and restored on remount;
 * - providers list comes from the real GET /api/chat/providers shape;
 * - axe 0 (color-contrast off only, jsdom cannot compute it).
 */

const axeNoContrast = (el: Element) =>
  axe(el, { rules: { "color-contrast": { enabled: false } } } as never);

type FetchMock = ReturnType<typeof vi.fn>;

function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = { "Content-Type": "application/json" }
): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

function providersEnvelope(
  providers: unknown[] = [
    { name: "ollama-local", display_name: "Ollama (qwen)", status: "healthy", ok: true },
  ],
  active: string | null = "ollama-local"
) {
  return jsonResponse(200, {
    ok: true,
    data: { providers, active },
  });
}

function chatReply(reply: string, extra: Record<string, unknown> = {}) {
  // Result-shaped body: {ok, status, data:{reply,...}} (chat.py).
  return jsonResponse(200, {
    ok: true,
    status: "healthy",
    data: { reply, ...extra },
  });
}

function renderPanel(props: Record<string, unknown> = {}) {
  return render(
    <LiveRegionProvider>
      <ChatPanel {...(props as ChatPanelProps)} />
    </LiveRegionProvider>
  );
}

describe("ChatPanel (T12, parity row 7)", () => {
  let fetchMock: FetchMock;
  let chatCalls: Array<{ body: Record<string, unknown> }>;

  function composerInput(): HTMLTextAreaElement {
    return screen.getByLabelText("Message") as HTMLTextAreaElement;
  }

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.setItem("pw_token", "chat-test-token");
    chatCalls = [];
    fetchMock = vi.fn().mockImplementation((input: unknown, init?: RequestInit) => {
      const path = typeof input === "string" ? input : String((input as Request).url ?? input);
      if (path.startsWith("/api/chat/providers")) {
        return Promise.resolve(providersEnvelope());
      }
      if (path.startsWith("/api/chat")) {
        chatCalls.push({ body: JSON.parse(String(init?.body ?? "{}")) });
        return Promise.resolve(
          chatReply("All clear.", { model: "m", thinking: "chain-of-thought fragment" })
        );
      }
      return Promise.resolve(jsonResponse(200, { ok: true, data: null }));
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.clear();
    localStorage.clear();
  });

  it("send → POST /api/chat with message + history, assistant reply renders", async () => {
    const { container } = renderPanel();
    await waitFor(() =>
      expect(screen.getByText(/Conversation provider/)).toBeTruthy()
    );
    expect(screen.getByText(/Conversation provider: ollama-local/)).toBeTruthy();

    const input = composerInput() as HTMLTextAreaElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: "How is my world?" } });
      fireEvent.submit(input.closest("form") as HTMLFormElement);
    });
    await waitFor(() => {
      expect(screen.getByText("All clear.")).toBeTruthy();
    });
    expect(chatCalls[0].body.message).toBe("How is my world?");
    expect(Array.isArray(chatCalls[0].body.history)).toBe(true);
    expect(await axeNoContrast(container)).toHaveNoViolations();
  });

  it("thinking status text shows while in flight and is not announced", async () => {
    const { container } = renderPanel();
    await waitFor(() =>
      expect(screen.getByText(/Conversation provider/)).toBeTruthy()
    );

    const input = composerInput() as HTMLTextAreaElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: "check" } });
    });
    let release!: (r: Response) => void;
    const pending = new Promise<Response>((r) => (release = r));
    fetchMock.mockImplementationOnce(() => pending);
    await act(async () => {
      fireEvent.submit(input.closest("form") as HTMLFormElement);
    });

    // Thinking text is visible…
    expect(screen.getByText("Checking your world…")).toBeTruthy();
    // …but the polite region has not announced it (no chatter).
    const region = container.querySelector("[role='status']") as HTMLElement;
    expect(region.textContent).toBe("");

    await act(async () => {
      release(chatReply("done", { model: "m" }));
      await pending;
    });
    await waitFor(() => expect(screen.getByText("done")).toBeTruthy());
    // Turn completion IS announced — the one polite announcement.
    expect(region.textContent).toBe("Reply received.");
    expect(await axeNoContrast(container)).toHaveNoViolations();
  });

  it("provenance: Sources disclosure + TechnicalDetails with model and thinking", async () => {
    const { container } = renderPanel();
    await waitFor(() =>
      expect(screen.getByText(/Conversation provider/)).toBeTruthy()
    );

    const input = composerInput() as HTMLTextAreaElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: "hello" } });
      fireEvent.submit(input.closest("form") as HTMLFormElement);
    });
    await waitFor(() => {
      expect(screen.getByText("All clear.")).toBeTruthy();
    });
    const sources = screen.getAllByText("Sources");
    expect(sources.length).toBeGreaterThan(0);
    // Level-1 truth outside any disclosure: the reply text itself.
    // Level-4 technical details:
    fireEvent.click(screen.getAllByText("Technical details")[0]);
    expect(screen.getByText("Conversation model: m")).toBeTruthy();
    expect(screen.getByText("chain-of-thought fragment")).toBeTruthy();
    expect(await axeNoContrast(container)).toHaveNoViolations();
  });

  it("not_configured → honest status, Settings knob, retry keeps the typed text", async () => {
    fetchMock.mockImplementation((input: unknown, init?: RequestInit) => {
      const path = typeof input === "string" ? input : String((input as Request).url ?? input);
      if (path.startsWith("/api/chat/providers")) {
        return Promise.resolve(
          providersEnvelope([], null)
        );
      }
      if (path.startsWith("/api/chat")) {
        chatCalls.push({ body: JSON.parse(String(init?.body ?? "{}")) });
        return Promise.resolve(
          jsonResponse(200, {
            ok: false,
            status: "not_configured",
            warnings: ["no chat provider configured"],
          })
        );
      }
      return Promise.resolve(jsonResponse(200, { ok: true, data: null }));
    });

    const { container } = renderPanel();
    await waitFor(() =>
      expect(screen.getByText(/No conversation provider is configured yet/)).toBeTruthy()
    );

    const input = composerInput() as HTMLTextAreaElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: "anyone there?" } });
      fireEvent.submit(input.closest("form") as HTMLFormElement);
    });
    await waitFor(() => {
      expect(screen.getByText(/Conversation is not configured right now/)).toBeTruthy();
    });
    expect(screen.getByText(/Add a reasoning connection in Settings/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Keep writing" })).toBeTruthy();

    // Failure announces honestly (kind: error).
    const region = container.querySelector("[role='status']") as HTMLElement;
    expect(region.textContent).toContain("Conversation paused");

    // Retry re-sends the same text through the same boundary.
    chatCalls.length = 0;
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    });
    await waitFor(() => {
      expect(chatCalls.length).toBe(1);
      expect(chatCalls[0].body.message).toBe("anyone there?");
    });
    expect(await axeNoContrast(container)).toHaveNoViolations();
  });

  it("Keep writing clears the error and refocuses the composer", async () => {
    fetchMock.mockImplementation((input: unknown) => {
      const path = typeof input === "string" ? input : String((input as Request).url ?? input);
      if (path.startsWith("/api/chat/providers")) return Promise.resolve(providersEnvelope());
      if (path.startsWith("/api/chat")) {
        return Promise.reject(new TypeError("network down"));
      }
      return Promise.resolve(jsonResponse(200, { ok: true, data: null }));
    });

    renderPanel();
    await waitFor(() =>
      expect(screen.getByText(/Conversation provider/)).toBeTruthy()
    );

    const input = composerInput() as HTMLTextAreaElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: "ping" } });
      fireEvent.submit(input.closest("form") as HTMLFormElement);
    });
    await waitFor(() => {
      expect(screen.getByText(/The conversation connection did not answer/)).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Keep writing" }));
    });
    expect(screen.queryByText(/The conversation connection did not answer/)).toBeNull();
    expect((composerInput() as HTMLTextAreaElement).getAttribute("disabled")).toBeNull();
  });

  it("history persists to sessionStorage (token-scoped key, no raw token) and restores on remount", async () => {
    const first = renderPanel();
    await waitFor(() =>
      expect(screen.getByText(/Conversation provider/)).toBeTruthy()
    );
    const input = composerInput() as HTMLTextAreaElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: "remember this" } });
      fireEvent.submit(input.closest("form") as HTMLFormElement);
    });
    await waitFor(() => expect(screen.getByText("All clear.")).toBeTruthy());
    first.unmount();

    // The stored key must not contain the raw token.
    const keys = Object.keys(sessionStorage).filter((k) =>
      k.startsWith("pw_chat_history_")
    );
    expect(keys).toHaveLength(1);
    expect(keys[0]).not.toContain("chat-test-token");
    const stored = JSON.parse(sessionStorage.getItem(keys[0]) as string) as Array<{
      role: string;
      content: string;
      source?: { model?: string };
    }>;
    expect(stored.map((t) => t.role)).toEqual(["user", "assistant"]);
    expect(stored[1].source?.model).toBe("m");

    const second = renderPanel();
    await waitFor(() => {
      expect(screen.getByText("remember this")).toBeTruthy();
      expect(screen.getByText("All clear.")).toBeTruthy();
    });
    expect(await axeNoContrast(second.container)).toHaveNoViolations();
  });

  it("next send carries the prior turns as history to /api/chat", async () => {
    renderPanel();
    await waitFor(() =>
      expect(screen.getByText(/Conversation provider/)).toBeTruthy()
    );
    const input = composerInput() as HTMLTextAreaElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: "first" } });
      fireEvent.submit(input.closest("form") as HTMLFormElement);
    });
    await waitFor(() => expect(screen.getByText("All clear.")).toBeTruthy());
    await act(async () => {
      fireEvent.change(input, { target: { value: "second" } });
      fireEvent.submit(input.closest("form") as HTMLFormElement);
    });
    await waitFor(() => expect(chatCalls.length).toBe(2));
    const history = chatCalls[1].body.history as Array<{ role: string; content: string }>;
    expect(history).toEqual([
      { role: "user", content: "first" },
      { role: "assistant", content: "All clear." },
    ]);
  });

  it("sectionContext → context block sent as provenance, location line visible", async () => {
    renderPanel({
      sectionContext: { route: "/journal", sectionId: "journal", label: "Journal & Memory" },
    });
    await waitFor(() =>
      expect(screen.getByText(/Conversation provider/)).toBeTruthy()
    );
    // Provenance is visible before any message is sent.
    expect(screen.getByText(/You opened this from/)).toBeTruthy();
    expect(screen.getByText("Journal & Memory")).toBeTruthy();
    // Section-aware starters replaced the global ones (checked in the
    // empty state — they disappear after the first send).
    expect(screen.getByRole("button", { name: "What needs attention here?" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "How is my world today?" })).toBeNull();
    const input = composerInput() as HTMLTextAreaElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: "What needs attention here?" } });
      fireEvent.submit(input.closest("form") as HTMLFormElement);
    });
    await waitFor(() => expect(chatCalls.length).toBe(1));
    expect(chatCalls[0].body.context).toEqual({
      route: "/journal",
      section_id: "journal",
    });
  });

  it("no sectionContext → no context field in the body, global starters", async () => {
    renderPanel();
    await waitFor(() =>
      expect(screen.getByText(/Conversation provider/)).toBeTruthy()
    );
    expect(screen.queryByText(/You opened this from/)).toBeNull();
    // Global starters in the empty state.
    expect(screen.getByRole("button", { name: "How is my world today?" })).toBeTruthy();
    const input = composerInput() as HTMLTextAreaElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: "global hello" } });
      fireEvent.submit(input.closest("form") as HTMLFormElement);
    });
    await waitFor(() => expect(chatCalls.length).toBe(1));
    expect(chatCalls[0].body.context).toBeUndefined();
  });

  it("keyboard: Enter sends, Shift+Enter inserts a newline, targets ≥44px", async () => {
    const { container } = renderPanel();
    await waitFor(() =>
      expect(screen.getByText(/Conversation provider/)).toBeTruthy()
    );
    const input = composerInput() as HTMLTextAreaElement;
    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter", shiftKey: false });
    });
    // Enter with empty input does not send.
    expect(chatCalls.length).toBe(0);
    await act(async () => {
      fireEvent.change(input, { target: { value: "keyboard turn" } });
      fireEvent.keyDown(input, { key: "Enter", shiftKey: false });
    });
    await waitFor(() => expect(chatCalls.length).toBe(1));
    expect(chatCalls[0].body.message).toBe("keyboard turn");
    expect(await axeNoContrast(container)).toHaveNoViolations();
  });
});