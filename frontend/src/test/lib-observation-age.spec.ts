import { describe, expect, it } from "vitest";
import {
  STALE_AFTER_SECONDS,
  observationAge,
  observedSentence,
  parseObservedAt,
  staleSuffix,
} from "../lib/observation-age";

/*
 * Observation-age truth contract (mirrors the backend TestFreshness):
 * - age derives ONLY from agent-sync's observed_at — no invented clock
 * - threshold = the product-wide 30-minute convention (lab_state)
 * - exactly-at-threshold is still fresh (strictly greater than)
 * - missing/invalid timestamps are honestly UNKNOWN, never stale,
 *   never fresh, and never a fabricated age
 * - state and freshness are separate dimensions: this helper returns
 *   age only; it never rewrites project state
 */

const NOW = new Date("2026-09-12T15:00:00Z");

function minutesAgo(mins: number): string {
  return new Date(NOW.getTime() - mins * 60_000).toISOString();
}

describe("observationAge", () => {
  it("just-now under a minute", () => {
    const a = observationAge(minutesAgo(0.5), NOW);
    expect(a.freshness).toBe("fresh");
    expect(a.text).toBe("just now");
    expect(a.stale).toBe(false);
  });

  it("minutes age with pluralization", () => {
    expect(observationAge(minutesAgo(4), NOW).text).toBe("4 minutes");
    expect(observationAge(minutesAgo(1), NOW).text).toBe("1 minute");
  });

  it("hour-plus ages", () => {
    expect(observationAge(minutesAgo(60), NOW).text).toBe("1 hour");
    expect(observationAge(minutesAgo(180), NOW).text).toBe("3 hours");
    expect(observationAge(minutesAgo(60 * 26), NOW).text).toBe("1 day");
  });

  it("exact threshold is still fresh (strictly greater)", () => {
    const a = observationAge(minutesAgo(30), NOW);
    expect(a.freshness).toBe("fresh");
    expect(a.ageSeconds).toBe(1800);
  });

  it("stale above threshold", () => {
    const a = observationAge(minutesAgo(47), NOW);
    expect(a.freshness).toBe("stale");
    expect(a.text).toBe("47 minutes");
    expect(a.stale).toBe(true);
  });

  it("missing timestamp is unknown, not stale", () => {
    for (const value of [null, undefined, ""]) {
      const a = observationAge(value, NOW);
      expect(a.freshness).toBe("unknown");
      expect(a.ageSeconds).toBeNull();
      expect(a.stale).toBe(false);
    }
  });

  it("invalid timestamp is unknown, never a fabricated age", () => {
    for (const value of ["not-a-timestamp", "2026-13-99T99:99Z"]) {
      const a = observationAge(value, NOW);
      expect(a.freshness).toBe("unknown");
      expect(a.ageSeconds).toBeNull();
    }
  });

  it("threshold constant mirrors the product-wide 30-minute convention", () => {
    expect(STALE_AFTER_SECONDS).toBe(30 * 60);
  });
});

describe("observedSentence + staleSuffix", () => {
  it("fresh: plain sentence, no stale suffix", () => {
    const ts = minutesAgo(4);
    expect(observedSentence(ts, NOW)).toBe("Observed 4 minutes ago");
    expect(staleSuffix(ts, NOW)).toBe("");
    expect(`${observedSentence(ts, NOW)}${staleSuffix(ts, NOW)}`).toBe(
      "Observed 4 minutes ago",
    );
  });

  it("stale: calm provenance suffix, never error vocabulary", () => {
    const ts = minutesAgo(47);
    expect(`${observedSentence(ts, NOW)}${staleSuffix(ts, NOW)}`).toBe(
      "Observed 47 minutes ago · may be stale",
    );
  });

  it("just now composes to 'Observed just now'", () => {
    expect(observedSentence(minutesAgo(0.25), NOW)).toBe("Observed just now");
  });

  it("unknown timestamp is honest about it", () => {
    expect(observedSentence(null, NOW)).toBe("Observed at an unknown time");
    expect(observedSentence("garbage", NOW)).toBe("Observed at an unknown time");
  });
});

describe("parseObservedAt", () => {
  it("parses valid ISO and rejects garbage", () => {
    expect(parseObservedAt("2026-09-12T12:48:38Z")?.toISOString()).toBe(
      "2026-09-12T12:48:38.000Z",
    );
    expect(parseObservedAt("garbage")).toBeNull();
    expect(parseObservedAt(null)).toBeNull();
  });
});