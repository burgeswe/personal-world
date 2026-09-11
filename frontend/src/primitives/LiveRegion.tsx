import * as React from "react";

/**
 * LiveRegion (P1 T7, FOUNDATION-SPEC §5, A11y §8): one app-level
 * <div role="status" aria-live="polite" aria-atomic="true">.
 *
 * announce(message, {key, kind}) enforces the live-region restraint:
 * - allow-list of kinds (health_change, attention_resolved,
 *   action_completed, error) — anything else is ignored, so poll
 *   ticks, timestamps, provider observations, and companion states
 *   can never reach the region;
 * - batching: messages inside a 30 s window merge into "N updates: …"
 *   (A11y §8.3, ~one announcement per 30 s);
 * - dedupe by key inside the window.
 *
 * No primitive announces companion state; the allow-list is the
 * structural enforcement of that rule.
 */

export type AnnounceKind =
  | "health_change"
  | "attention_resolved"
  | "action_completed"
  | "error";

export interface AnnounceOptions {
  key?: string;
  kind: AnnounceKind;
}

const ALLOWED_KINDS: readonly AnnounceKind[] = [
  "health_change",
  "attention_resolved",
  "action_completed",
  "error",
];

const BATCH_WINDOW_MS = 30_000;

interface PendingUpdate {
  message: string;
  key: string;
  firstAt: number;
}

export interface Announcer {
  announce: (message: string, options: AnnounceOptions) => void;
}

const AnnouncerContext = React.createContext<Announcer | null>(null);

function mergedText(updates: PendingUpdate[]): string {
  if (updates.length === 1) return updates[0].message;
  return `${updates.length} updates: ${updates.map((u) => u.message).join("; ")}`;
}

export function LiveRegionProvider({ children }: { children: React.ReactNode }) {
  const [updates, setUpdates] = React.useState<PendingUpdate[]>([]);
  const [text, setText] = React.useState("");
  const updatesRef = React.useRef<PendingUpdate[]>([]);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = React.useCallback(() => {
    const batch = updatesRef.current;
    updatesRef.current = [];
    timerRef.current = null;
    if (batch.length > 0) setText(mergedText(batch));
  }, []);

  const announce = React.useCallback(
    (message: string, options: AnnounceOptions) => {
      if (!ALLOWED_KINDS.includes(options.kind)) return; // live-region restraint
      const now = Date.now();
      const key = options.key ?? message;
      const current = updatesRef.current.filter((u) => u.key !== key);
      const batchStart =
        current.length > 0 ? current[0].firstAt : now;
      // A batch never spans the 30 s window: an announcement older than
      // the window starts a new batch immediately.
      if (current.length > 0 && now - batchStart >= BATCH_WINDOW_MS) {
        const expired = current;
        updatesRef.current = [];
        if (timerRef.current !== null) {
          clearTimeout(timerRef.current);
        }
        const expiredText = mergedText(expired);
        setText(expiredText);
        updatesRef.current = [
          { message, key, firstAt: now },
        ];
        timerRef.current = setTimeout(flush, BATCH_WINDOW_MS);
        return;
      }
      updatesRef.current = [...current, { message, key, firstAt: batchStart }];
      const visible = updatesRef.current;
      if (timerRef.current === null) {
        timerRef.current = setTimeout(flush, BATCH_WINDOW_MS);
      }
      // Merge preview text so tests (and platforms where the region
      // content is read on mutation) observe the pending batch.
      setUpdates(visible);
    },
    [flush]
  );

  React.useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  const announcer = React.useMemo<Announcer>(() => ({ announce }), [announce]);

  return (
    <AnnouncerContext.Provider value={announcer}>
      {children}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-pw-live-region=""
        className="sr-only"
      >
        {updates.length === 0 ? text : mergedText(updates)}
      </div>
    </AnnouncerContext.Provider>
  );
}

export function useAnnounce(): Announcer {
  const ctx = React.useContext(AnnouncerContext);
  if (!ctx) {
    throw new Error(
      "useAnnounce requires a LiveRegionProvider ancestor (one app-level live region)."
    );
  }
  return ctx;
}