import { cn } from "../lib/utils";

/**
 * StatusChip (P1 T8, FOUNDATION-SPEC §5): a status chip whose ONLY job
 * is to carry the canonical status word. Rank is encoded by luminance
 * and border structure in CSS (index.css `.chip[data-status=…]`); the
 * meaning is never hue-only (A11y §1.3) because the word itself is the
 * content and `title` carries the raw status.
 *
 * The vocabulary is the closed set owned by `src/personal_world/status.py`
 * (`Status` enum). Callers pass `null`/nothing when there is no status
 * (e.g. a section with no capability dependency) and nothing renders —
 * invented statuses like "n/a" are rejected at runtime, not coerced.
 */

export const CANONICAL_STATUSES = [
  "healthy",
  "warning",
  "unknown",
  "needs_attention",
  "unavailable",
  "stale",
  "disabled",
  "not_configured",
] as const;

export type CanonicalStatus = (typeof CANONICAL_STATUSES)[number];

/**
 * The one humanizing map (mirrors the legacy dashboard's statusWord()
 * for the canonical vocabulary). Raw values stay available via `title`.
 */
const STATUS_WORDS: Record<CanonicalStatus, string> = {
  healthy: "healthy",
  warning: "warning",
  unknown: "unknown",
  needs_attention: "needs attention",
  unavailable: "unavailable",
  stale: "stale",
  disabled: "disabled",
  not_configured: "not configured",
};

export type StatusChipSize = "md" | "sm";

export interface StatusChipProps {
  /** Canonical status from status.py; null/undefined renders nothing. */
  status?: CanonicalStatus | null;
  /** Optional human label next to the status word (e.g. a section name). */
  label?: string;
  size?: StatusChipSize;
}

export function StatusChip({ status, label, size = "md" }: StatusChipProps) {
  if (status === null || status === undefined) return null;
  if (
    typeof status !== "string" ||
    !(CANONICAL_STATUSES as readonly string[]).includes(status)
  ) {
    throw new Error(
      `StatusChip: "${String(status)}" is not a canonical status ` +
        `(src/personal_world/status.py). Pass null instead of an invented status.`
    );
  }
  return (
    <span
      className={cn("chip", size === "sm" && "chip-sm")}
      data-status={status}
      title={status}
    >
      {STATUS_WORDS[status]}
      {label ? <span className="chip-label"> · {label}</span> : null}
    </span>
  );
}