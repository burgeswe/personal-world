import { useCallback, useEffect, useRef, useState } from "react";
import "./chat-panel.css";
import { useAnnounce } from "../primitives/LiveRegion";
import { Disclosure, TechnicalDetails } from "../primitives/Disclosure";
import { StatusChip, type CanonicalStatus } from "../primitives/StatusChip";
import {
  ApiError,
  sendChatMessage,
  fetchChatProviders,
  getAuthToken,
  type ChatResult,
  type ChatProvidersData,
} from "../lib/api";
import { Loader2, Send, Sparkles } from "../lib/icons";

/**
 * ChatPanel (P1 T12, FOUNDATION-SPEC §6): the transitional standalone
 * chat. This component IS the chat — the /chat route only mounts it,
 * and the World Assistant Drawer (P4) hosts the same component with a
 * context profile. To stay hostable anywhere it is deliberately
 * CONTEXT-FREE: no react-router imports, no context consumers, no
 * assumptions about the page it lives on. The companion comes in as an
 * optional prop from the host, never from a context.
 *
 * Parity rows 7 (legacy chat): send, thinking status text, provenance
 * (Disclosure L4 TechnicalDetails), retry / keep writing on failure,
 * sessionStorage history, provider info — all against the real
 * /api/chat and /api/chat/providers.
 *
 * Live-region restraint (A11y §8, LiveRegion allow-list): one polite
 * announcement per turn — "Reply received" (action_completed) or the
 * failure (error). Thinking text is rendered visibly but NEVER
 * announced, so no per-poll chatter exists.
 *
 * Statuses are honest: not_configured renders the canonical status word
 * and names the knob (a reasoning connection in Settings); a failed
 * send keeps the typed message so the person can retry (HUMAN
 * RELIABILITY: the message is never silently lost).
 */

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
  /** Provider-reported model for the reply, when the server sent one. */
  model?: string | null;
  /** Provider reasoning text (progressive disclosure only). */
  thinking?: string | null;
}

export interface ChatPanelProps {
  /** Decorative companion icon + name from the host (default: none). */
  companionIcon?: string | null;
  /** Accessible heading level override for drawer hosting. */
  heading?: string;
  /**
   * Where this panel was opened (Finish Line "Contextual chat"): the
   * observed route/section, provided BY THE HOST as a prop — the
   * panel stays context-free (no router imports). Omitted = global
   * chat. Sent as provenance; shown so the person can see what the
   * assistant was told about their location.
   */
  sectionContext?: {
    route: string;
    sectionId: string;
    label: string;
    /** Selected object within the section, if any (e.g. ?repo=). */
    entity?: string | null;
  };
}

const HISTORY_STORAGE_PREFIX = "pw_chat_history_";
const HISTORY_MAX_TURNS = 6;
const SUGGESTIONS = [
  "How is my world today?",
  "What changed today?",
  "Does anything need me?",
] as const;
/** Context-aware starters replace the global ones when the host says
 * where the panel is: "here" questions must make sense section-locally. */
const SECTION_SUGGESTIONS = [
  "What needs attention here?",
  "What is this page about?",
  "What changed here recently?",
] as const;

/** FNV-1a pair scope of the token — the legacy storage-key derivation
 * (api.py chatTokenScope): sessionStorage never stores the token itself. */
function chatTokenScope(token: string): string {
  let first = 2166136261;
  let second = 2246822507;
  for (let index = 0; index < token.length; index += 1) {
    const code = token.charCodeAt(index);
    first = Math.imul(first ^ code, 16777619);
    second = Math.imul(second ^ code, 2246822507);
  }
  return (
    (first >>> 0).toString(16).padStart(8, "0") +
    (second >>> 0).toString(16).padStart(8, "0")
  );
}

function historyStorageKey(): string {
  return `${HISTORY_STORAGE_PREFIX}${chatTokenScope(getAuthToken())}`;
}

function loadStoredHistory(): ChatTurn[] {
  try {
    const raw = sessionStorage.getItem(historyStorageKey());
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const turns: ChatTurn[] = [];
    for (const t of parsed) {
      if (typeof t !== "object" || t === null) continue;
      const rec = t as { role?: unknown; content?: unknown; source?: { model?: unknown } };
      if (rec.role !== "user" && rec.role !== "assistant") continue;
      if (typeof rec.content !== "string") continue;
      const model =
        typeof rec.source?.model === "string" ? rec.source.model : null;
      turns.push({ role: rec.role, content: rec.content, model });
    }
    return turns.slice(-HISTORY_MAX_TURNS);
  } catch {
    return [];
  }
}

function persistHistory(turns: ChatTurn[]): void {
  try {
    sessionStorage.setItem(
      historyStorageKey(),
      JSON.stringify(
        turns.slice(-HISTORY_MAX_TURNS).map((t) => ({
          role: t.role,
          content: t.content,
          ...(t.role === "assistant" && t.model
            ? { source: { model: t.model } }
            : {}),
        }))
      )
    );
  } catch {
    // Conversation remains available in this page; storage may be full
    // or blocked (private mode) — never a reason to fail a turn.
  }
}

function statusWord(status: string | null | undefined): string {
  if (status == null) return "unknown";
  const t = String(status).toLowerCase();
  if (t === "healthy" || t === "ok") return "healthy";
  if (t === "unavailable") return "unavailable";
  if (t === "needs_attention") return "needs attention";
  if (t === "not_configured") return "not configured";
  return t;
}

const CANONICAL = new Set([
  "healthy",
  "warning",
  "unknown",
  "needs_attention",
  "unavailable",
  "stale",
  "disabled",
  "not_configured",
]);

export function ChatPanel({
  companionIcon = null,
  heading = "Talk with your world",
  sectionContext,
}: ChatPanelProps) {
  const { announce } = useAnnounce();
  const [turns, setTurns] = useState<ChatTurn[]>(() => loadStoredHistory());
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{
    text: string;
    /** The typed text of the failed turn, for Retry. */
    retryText: string | null;
  } | null>(null);
  const [providers, setProviders] = useState<ChatProvidersData | null>(null);
  const [providersError, setProvidersError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const refreshProviders = useCallback(async () => {
    try {
      setProviders(await fetchChatProviders());
      setProvidersError(null);
    } catch (e) {
      // Providers info is supplementary; the conversation still works
      // whenever /api/chat has a provider behind it.
      setProvidersError(
        e instanceof ApiError ? e.message : "Could not load provider info."
      );
    }
  }, []);

  useEffect(() => {
    void refreshProviders();
  }, [refreshProviders]);

  useEffect(() => {
    persistHistory(turns);
  }, [turns]);

  // Keep the latest turn in view without stealing focus from the
  // composer (a Drawer-hosted panel must never move focus on refresh).
  useEffect(() => {
    const log = logRef.current;
    if (!log) return;
    // jsdom has no layout/scroll APIs; real browsers scroll the log.
    if (typeof log.scrollTo === "function") {
      log.scrollTo({ top: log.scrollHeight });
    }
  }, [turns, error, busy]);

  const send = useCallback(
    async (rawText: string) => {
      const text = rawText.trim();
      if (!text || busy) return;
      setTurns((prev) => [...prev, { role: "user", content: text }]);
      setInput("");
      setBusy(true);
      setError(null);
      try {
        const history = turns
          .slice(-HISTORY_MAX_TURNS)
          .map((t) => ({ role: t.role, content: t.content }));
        const data: ChatResult = await sendChatMessage(
          text,
          history,
          sectionContext
            ? {
                route: sectionContext.route,
                section_id: sectionContext.sectionId,
                ...(sectionContext.entity
                  ? { entity: sectionContext.entity }
                  : {}),
              }
            : undefined
        );
        if (data.ok === false) {
          // Result-shaped honest failure (not_configured / unavailable).
          const word = statusWord(data.status);
          setError({
            text:
              data.status === "not_configured"
                ? "Conversation is not configured right now. Add a reasoning connection in Settings — your world and journal still work."
                : `Conversation is ${word} right now. Your world and journal still work.`,
            retryText: text,
          });
          announce("Conversation paused. Nothing else was interrupted.", {
            kind: "error",
            key: "chat-paused",
          });
          return;
        }
        const reply = (data.reply ?? "").trim();
        setTurns((prev) => [
          ...prev,
          {
            role: "assistant",
            content: reply || "I did not receive a readable reply.",
            model: data.model ?? null,
            thinking: data.thinking ?? null,
          },
        ]);
        announce("Reply received.", { kind: "action_completed", key: "chat-reply" });
      } catch (e) {
        // Network failure (status 0) gets the legacy chat wording — it
        // names what failed (the conversation connection) and what
        // still works (A11y §4.5). A real HTTP error keeps the
        // server-provided detail, which is the specific truth.
        const apiErr = e instanceof ApiError ? e : null;
        const failureText =
          apiErr && apiErr.status !== 0
            ? apiErr.detail ?? apiErr.message
            : "The conversation connection did not answer. Your world and journal still work.";
        setError({
          text: failureText,
          retryText: text,
        });
        announce("Conversation unavailable. Nothing else was interrupted.", {
          kind: "error",
          key: "chat-unavailable",
        });
      } finally {
        setBusy(false);
        inputRef.current?.focus();
      }
    },
    [announce, busy, turns, sectionContext]
  );

  const retry = useCallback(() => {
    const text = error?.retryText;
    if (!text) return;
    // The failed turn is not in history (only user text was appended —
    // remove it so the retry does not duplicate it).
    setTurns((prev) => {
      const next = [...prev];
      if (next.length > 0 && next[next.length - 1].role === "user") {
        next.pop();
      }
      return next;
    });
    setError(null);
    void send(text);
  }, [error, send]);

  const keepWriting = useCallback(() => {
    setError(null);
    inputRef.current?.focus();
  }, []);

  const activeProvider = providers?.active ?? null;
  const isEmpty = turns.length === 0 && error === null && !busy;

  return (
    <div className="pw-chat" data-pw-chat="">
      <h2>{heading}</h2>
      {sectionContext ? (
        <p className="pw-chat-context-line">
          You opened this from{" "}
          <strong>{sectionContext.label}</strong>
          {sectionContext.entity ? (
            <>
              {" "}
              looking at <strong>{sectionContext.entity}</strong>
            </>
          ) : null}{" "}
          — questions about “here” mean that page
          {sectionContext.entity ? " and that repository" : ""}.
        </p>
      ) : null}
      <Disclosure summary="Conversation details" level={2}>
        <p>
          Chat is read-only conversation over a snapshot of your world.
          Nothing you say here changes it.
        </p>
        {providersError ? (
          <p className="pw-chat-provider-line">
            Provider info could not be loaded: {providersError}
          </p>
        ) : activeProvider ? (
          <p className="pw-chat-provider-line">
            Conversation provider: {activeProvider}
          </p>
        ) : providers ? (
          <p className="pw-chat-provider-line">
            No conversation provider is configured yet.
          </p>
        ) : (
          <p className="pw-chat-provider-line">Checking provider…</p>
        )}
        {providers && providers.providers.length > 0 ? (
          <ul className="pw-chat-provider-list">
            {providers.providers.map((p) => (
              <li key={p.name}>
                {p.display_name}{" "}
                <StatusChip
                  status={
                    CANONICAL.has(p.status) ? (p.status as CanonicalStatus) : "unknown"
                  }
                  size="sm"
                />
              </li>
            ))}
          </ul>
        ) : null}
      </Disclosure>

      <div
        ref={logRef}
        className="pw-chat-log"
        role="log"
        aria-label="Conversation"
        aria-live="off"
      >
        {isEmpty ? (
          <div className="pw-chat-empty">
            {companionIcon ? (
              <img src={companionIcon} alt="" aria-hidden="true" />
            ) : null}
            <p>
              {sectionContext
                ? `Ask about ${sectionContext.label.toLowerCase()} — health, changes, what needs attention here.`
                : "Ask about your world — health, changes, what needs attention."}
            </p>
            <div className="pw-chat-starters" role="group" aria-label="Conversation starters">
              {(sectionContext ? SECTION_SUGGESTIONS : SUGGESTIONS).map((s) => (
                <button
                  key={s}
                  type="button"
                  className="pw-chat-chip"
                  onClick={() => void send(s)}
                  disabled={busy}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {turns.map((turn, i) =>
          turn.role === "user" ? (
            <div key={`u${i}`} className="pw-chat-msg pw-chat-msg-user">
              <p>{turn.content}</p>
            </div>
          ) : (
            <div key={`a${i}`} className="pw-chat-msg pw-chat-msg-assistant">
              <p>{turn.content}</p>
              <Disclosure summary="Sources" level={3}>
                <p>Read-only Project Worlds snapshot</p>
                {turn.model ? <p>Conversation model: {turn.model}</p> : null}
                {turn.thinking ? (
                  <TechnicalDetails
                    provider={turn.model ?? undefined}
                    raw={turn.thinking}
                  />
                ) : null}
              </Disclosure>
            </div>
          )
        )}

        {busy ? (
          <div className="pw-chat-msg pw-chat-msg-assistant" data-pw-thinking="">
            <p className="pw-chat-thinking">Checking your world…</p>
          </div>
        ) : null}

        {error ? (
          <div className="pw-chat-msg pw-chat-msg-error" data-pw-chat-error="">
            <p>{error.text}</p>
            <div className="pw-chat-actions">
              {error.retryText ? (
                <button type="button" className="pw-chat-chip" onClick={retry}>
                  Retry
                </button>
              ) : null}
              <button type="button" className="pw-chat-chip" onClick={keepWriting}>
                Keep writing
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <form
        className="pw-chat-composer"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <textarea
          ref={inputRef}
          className="pw-chat-input"
          aria-label="Message"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(input);
            }
          }}
          rows={2}
          disabled={busy}
          placeholder="Ask about your world…"
        />
        <button
          type="submit"
          className="pw-chat-send"
          disabled={busy || !input.trim()}
          aria-label="Send"
        >
          {busy ? (
            <Loader2 className="loader-static" size={18} aria-hidden={true} />
          ) : (
            <Send size={18} aria-hidden={true} />
          )}
        </button>
      </form>
      <p className="pw-chat-footnote">
        <Sparkles size={12} aria-hidden={true} /> Powered by your Project Worlds
      </p>
    </div>
  );
}

export default ChatPanel;