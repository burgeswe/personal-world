/*
 * Observation age — the ONE shared relative-age computation for
 * project-status observations (Projects, Today, and any other
 * agent-sync surface). Never duplicate date math per screen.
 *
 * Truth contract:
 * - age is derived ONLY from agent-sync's own observed_at; no other
 *   clock is invented
 * - missing/invalid timestamps -> null age, rendered as "unknown";
 *   no age is ever fabricated from a bad clock reading
 * - staleness is PROVENANCE, not failure: a stale observation of
 *   "diverged" is still a diverged observation, just not current
 *   evidence. State and freshness are separate dimensions; this
 *   helper never rewrites state.
 * - threshold mirrors the backend's STALE_AFTER (30 minutes), which
 *   itself mirrors lab_state's product-wide FRESHNESS convention.
 */

export const STALE_AFTER_SECONDS = 30 * 60;

export type ObservationFreshness = "fresh" | "stale" | "unknown";

export type ObservationAge = {
  ageSeconds: number | null;
  freshness: ObservationFreshness;
  text: string;
  stale: boolean;
};

export function parseObservedAt(
  value: string | null | undefined,
): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export function observationAge(
  observedAt: string | null | undefined,
  now: Date = new Date(),
): ObservationAge {
  const parsed = parseObservedAt(observedAt);
  if (!parsed) {
    return { ageSeconds: null, freshness: "unknown", text: "unknown", stale: false };
  }
  const ageSeconds = Math.max(
    0,
    Math.floor((now.getTime() - parsed.getTime()) / 1000),
  );
  const stale = ageSeconds > STALE_AFTER_SECONDS;
  return {
    ageSeconds,
    freshness: stale ? "stale" : "fresh",
    text: ageText(ageSeconds),
    stale,
  };
}

function ageText(seconds: number): string {
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}

/*
 * Calm human sentence: "Observed 4 minutes ago" /
 * "Observed 47 minutes ago · may be stale" / "Observed just now".
 * Plain words carry the meaning — no color-only signal, no error
 * vocabulary; staleness is provenance, not failure. `now` is
 * injectable so tests pin the clock; screens use wall time.
 */
export function observedSentence(
  observedAt: string | null | undefined,
  now: Date = new Date(),
): string {
  const { ageSeconds, text } = observationAge(observedAt, now);
  if (ageSeconds === null) return "Observed at an unknown time";
  if (text === "just now") return "Observed just now";
  return `Observed ${text} ago`;
}

export function staleSuffix(
  observedAt: string | null | undefined,
  now: Date = new Date(),
): string {
  const { stale } = observationAge(observedAt, now);
  return stale ? " · may be stale" : "";
}