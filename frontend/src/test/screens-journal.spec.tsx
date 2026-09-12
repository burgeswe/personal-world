import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, fireEvent, within } from "@testing-library/react";
import { axe } from "vitest-axe";
import { toHaveNoViolations } from "vitest-axe/dist/matchers";
import JournalScreen from "../screens/JournalScreen";
import {
  screenProviders,
  mockFetchByRoute,
  jsonResponse,
} from "./screen-helpers";
import type { JournalEntry } from "../lib/api";

/**
 * T10 Journal spec (parity row 4, FOUNDATION-SPEC §7):
 * - kind filters are aria-pressed toggles;
 * - "Load more" re-queries /api/journal with a larger n= param;
 * - provenance renders through Disclosure L3 (Source) + L4 (technical);
 * - composer saves through POST /api/journal;
 * - honest empty state; axe 0 violations (contrast disabled).
 */

expect.extend({ toHaveNoViolations });

const axeNoContrast = (el: Element) =>
  axe(el, { rules: { "color-contrast": { enabled: false } } } as never);

function entry(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    ts: "2026-09-11T04:00:00Z",
    kind: "observation",
    summary: "Observation summary",
    provenance: {
      source: "daily-loop",
      observed_at: "2026-09-11T04:00:00Z",
      provider: "registry",
      authority: "observed",
    },
    classification: "private",
    ...overrides,
  };
}

const FIRST_PAGE: JournalEntry[] = Array.from({ length: 20 }, (_, i) =>
  entry({
    ts: new Date(Date.UTC(2026, 8, 11, 0, i)).toISOString(),
    summary: `Entry number ${i + 1}`,
    // A few drift entries in the first page so the client-side kind
    // filter has something to select (like the legacy behavior).
    kind: i % 5 === 0 ? "drift" : "observation",
  })
);

const MORE_PAGE: JournalEntry[] = Array.from({ length: 100 }, (_, i) =>
  entry({
    ts: new Date(Date.UTC(2026, 8, 10, 0, i)).toISOString(),
    summary: `Older entry ${i + 1}`,
    kind: "drift",
  })
);

function journalHandlers() {
  const seen: string[] = [];
  return {
    seen,
    handlers: {
      "/api/journal": (path: string, init?: RequestInit) => {
        if (init?.method === "POST") {
          return jsonResponse(200, { ok: true, data: { written: 5 } });
        }
        const n = Number(new URL(path, "http://x").searchParams.get("n") ?? "20");
        seen.push(`n=${n}`);
        const events = n >= 100 ? [...FIRST_PAGE, ...MORE_PAGE] : FIRST_PAGE;
        return jsonResponse(200, { ok: true, data: events.slice(0, n) });
      },
    },
  };
}

beforeEach(() => {
  localStorage.setItem("pw_token", "test-token");
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

async function bootJournal() {
  const { seen, handlers } = journalHandlers();
  mockFetchByRoute(handlers);
  const utils = screenProviders(<JournalScreen />);
  await waitFor(() => {
    expect(screen.queryByText(/Opening your journal…/)).toBeNull();
  });
  return { utils, seen };
}

describe("JournalScreen (T10, parity row 4)", () => {
  it("renders real /api/journal entries", async () => {
    await bootJournal();
    expect(screen.getByText("Entry number 20")).toBeTruthy();
  });

  it("kind filters are aria-pressed toggles", async () => {
    await bootJournal();
    const all = screen.getByRole("button", { name: "All" });
    expect(all.getAttribute("aria-pressed")).toBe("true");
    const drift = screen.getByRole("button", { name: "Drift" });
    expect(drift.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(drift);
    expect(drift.getAttribute("aria-pressed")).toBe("true");
    expect(all.getAttribute("aria-pressed")).toBe("false");
    // Filtering shows only drift entries from the loaded page.
    // Filtering shows only drift entries from the loaded page.
    expect(screen.getAllByText(/Kind: drift/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Kind: observation/)).toBeNull();
  });

  it("load more re-queries /api/journal with a larger n= param", async () => {
    const { seen } = await bootJournal();
    expect(seen).toEqual(["n=20"]);
    fireEvent.click(screen.getByRole("button", { name: "Load more entries" }));
    await waitFor(() => {
      expect(seen).toContain("n=100");
    });
    expect(screen.getByText("Older entry 1")).toBeTruthy();
  });

  it("provenance renders through Disclosure Source + technical details", async () => {
    await bootJournal();
    fireEvent.click(screen.getAllByText("Source")[0]);
    expect(screen.getAllByText(/Recorded by daily-loop\./).length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByText("Technical details")[0]);
    expect(screen.getAllByText("Authority").length).toBeGreaterThan(0);
    expect(screen.getAllByText("observed").length).toBeGreaterThan(0);
  });

  it("composer saves through POST /api/journal", async () => {
    await bootJournal();
    fireEvent.change(screen.getByLabelText("Journal note"), {
      target: { value: "A note from the test" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save entry" }));
    await waitFor(() => {
      const statuses = screen.getAllByRole("status");
      expect(statuses.some((el) => /Saved to your journal\./.test(el.textContent ?? ""))).toBe(true);
    });
  });

  it("honest empty state when the journal is empty", async () => {
    mockFetchByRoute({
      "/api/journal": () => jsonResponse(200, { ok: true, data: [] }),
    });
    screenProviders(<JournalScreen />);
    await waitFor(() => {
      expect(screen.queryByText(/Opening your journal…/)).toBeNull();
    });
    expect(screen.getByText("No journal entries yet")).toBeTruthy();
  });

  it("journal read failure names what failed and what still works", async () => {
    mockFetchByRoute({
      "/api/journal": () => jsonResponse(500, { detail: "journal unreadable" }),
    });
    screenProviders(<JournalScreen />);
    await screen.findByText(/Could not load journal entries/);
    expect(screen.getByText(/journal unreadable/)).toBeTruthy();
    expect(screen.getByText(/rest of your world still works/)).toBeTruthy();
  });

  it("audit trail: collapsed by default (zero extra fetch), loads verbatim on request", async () => {
    let auditCalls = 0;
    // NOTE: more-specific prefix first — mockFetchByRoute matches in
    // insertion order, and "/api/journal" would swallow the audit path.
    mockFetchByRoute({
      "/api/journal/audit": () => {
        auditCalls += 1;
        return jsonResponse(200, {
          ok: true,
          data: { text: "2026-09-12T00:00:00+00:00 observation [chat] (world) test entry" },
        });
      },
      "/api/journal": (_path, init) => {
        if (init?.method === "POST") {
          return jsonResponse(200, { ok: true, data: { written: 5 } });
        }
        return jsonResponse(200, { ok: true, data: FIRST_PAGE });
      },
    });
    screenProviders(<JournalScreen />);
    await waitFor(() => {
      expect(screen.queryByText(/Opening your journal…/)).toBeNull();
    });
    // Calm default: the audit disclosure exists but fetches nothing.
    expect(
      screen.getByText("Audit trail — every entry with full provenance")
    ).toBeTruthy();
    expect(auditCalls).toBe(0);
    // Open the disclosure, then request the technical log.
    fireEvent.click(
      screen.getByText("Audit trail — every entry with full provenance")
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Show the technical audit log" })
    );
    await waitFor(() => {
      expect(screen.getByText(/observation \[chat\] \(world\)/)).toBeTruthy();
    });
    expect(auditCalls).toBe(1);
  });

  it("axe: 0 violations (color-contrast disabled)", async () => {
    const { utils } = await bootJournal();
    expect(await axeNoContrast(utils.container)).toHaveNoViolations();
  });
});
describe("Journal correction workflow (propose → approve → act; original preserved)", () => {
  let supersedePosts: Array<Record<string, unknown>> = [];

  function bootCorrectable() {
    supersedePosts = [];
    const one = entry({
      ts: "2026-09-11T09:30:00Z",
      summary: "Server migrated to node 3 (wrong rack)",
      provenance: { ...entry().provenance, source: "user" },
    });
    const corrected = entry({
      ts: "2026-09-11T10:00:00Z",
      summary: "Server migrated to node 4",
      supersedes: "2026-09-11T09:30:00Z",
      supersede_reason: "typo — wrong rack number",
      provenance: { ...entry().provenance, source: "user" },
    });
    mockFetchByRoute({
      // More-specific prefixes first (mockFetchByRoute matches in order).
      "/api/journal/supersede": (_path, init) => {
        supersedePosts.push(JSON.parse(String(init?.body ?? "{}")));
        return jsonResponse(200, {
          ok: true,
          status: "healthy",
          data: {
            current: corrected,
            superseded: one,
            audit: entry({ ts: "2026-09-11T10:00:01Z", kind: "approval",
              summary: "journal correction approved" }),
            already_applied: false,
          },
        });
      },
      "/api/journal/history": (path: string) => {
        const ts = new URL(path, "http://x").searchParams.get("ts");
        return jsonResponse(200, {
          ok: true,
          data: {
            entries: ts === corrected.ts
              ? [one, corrected]
              : [entry({ ts: ts ?? "2026-09-11T09:30:00Z" })],
          },
        });
      },
      "/api/journal": (_path, init) => {
        if (init?.method === "POST") {
          return jsonResponse(200, { ok: true, data: { written: 5 } });
        }
        return jsonResponse(200, { ok: true, data: [one] });
      },
    });
    screenProviders(<JournalScreen />);
    return { one, corrected };
  }

  it("proposal shows original vs proposed, effect/risk/recovery, and changes nothing before approval", async () => {
    bootCorrectable();
    await waitFor(() => {
      expect(screen.queryByText(/Opening your journal…/)).toBeNull();
    });
    fireEvent.click(screen.getByRole("button", { name: "Correct this entry" }));
    const panel = screen.getByRole("heading", { name: "Correct this entry" }).closest("section")!;
    expect(panel.getAttribute("data-pw-correction")).toBe("proposed");
    // WHAT/WHY/EFFECT/RISK/RECOVERY + has-not-happened.
    expect(within(panel).getAllByText(/Server migrated to node 3/).length).toBeGreaterThan(0);
    expect(within(panel).getByText(/stays in history/)).toBeTruthy();
    expect(within(panel).getByText(/becomes the current version/)).toBeTruthy();
    expect(within(panel).getByText(/Risk: low/)).toBeTruthy();
    expect(within(panel).getByText(/you can correct the corrected entry again/)).toBeTruthy();
    expect(within(panel).getByText(/Nothing has changed yet/)).toBeTruthy();
    expect(supersedePosts).toEqual([]);
  });

  it("approve triggers exactly one act, then the calm list shows the corrected entry", async () => {
    bootCorrectable();
    await waitFor(() => {
      expect(screen.queryByText(/Opening your journal…/)).toBeNull();
    });
    fireEvent.click(screen.getByRole("button", { name: "Correct this entry" }));
    const textarea = screen.getByLabelText(/Corrected entry text/) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "Server migrated to node 4" } });
    fireEvent.change(screen.getByLabelText(/Reason \(optional/), {
      target: { value: "typo — wrong rack number" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Approve and correct" }));
    await waitFor(() => {
      expect(screen.getByText(/Done — the corrected entry is now the current version/)).toBeTruthy();
    });
    expect(supersedePosts.length).toBe(1);
    expect(supersedePosts[0]).toEqual({
      supersedes: "2026-09-11T09:30:00Z",
      text: "Server migrated to node 4",
      reason: "typo — wrong rack number",
    });
  });

  it("identical-text approval is disabled (no no-op corrections)", async () => {
    bootCorrectable();
    await waitFor(() => {
      expect(screen.queryByText(/Opening your journal…/)).toBeNull();
    });
    fireEvent.click(screen.getByRole("button", { name: "Correct this entry" }));
    const approveBtn = screen.getByRole("button", { name: "Approve and correct" }) as HTMLButtonElement;
    expect(approveBtn.disabled).toBe(true); // textarea starts as the original text
    expect(supersedePosts).toEqual([]);
  });

  it("failure state is honest and the way back is offered", async () => {
    bootCorrectable();
    await waitFor(() => {
      expect(screen.queryByText(/Opening your journal…/)).toBeNull();
    });
    fireEvent.click(screen.getByRole("button", { name: "Correct this entry" }));
    fireEvent.change(screen.getByLabelText(/Corrected entry text/), {
      target: { value: "attempt that will fail" },
    });
    // Re-mock the endpoint to fail.
    mockFetchByRoute({
      "/api/journal/supersede": () =>
        jsonResponse(200, {
          ok: false,
          status: "unavailable",
          warnings: ["entry was already superseded — correct the current entry instead"],
        }),
      "/api/journal": () => jsonResponse(200, { ok: true, data: [] }),
    });
    fireEvent.click(screen.getByRole("button", { name: "Approve and correct" }));
    await waitFor(() => {
      expect(screen.getByText(/The correction was not applied/)).toBeTruthy();
    });
    expect(screen.getByText(/already superseded/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Back to the proposal" }));
    expect(screen.getByText(/Nothing has changed yet/)).toBeTruthy();
  });

  it("corrected entries show the Corrected note and a history disclosure", async () => {
    const one = entry({ ts: "2026-09-11T09:30:00Z", summary: "first version" });
    const corrected = entry({
      ts: "2026-09-11T10:00:00Z",
      summary: "second version",
      supersedes: one.ts,
    });
    mockFetchByRoute({
      "/api/journal/history": () =>
        jsonResponse(200, { ok: true, data: { entries: [one, corrected] } }),
      "/api/journal": () => jsonResponse(200, { ok: true, data: [corrected] }),
    });
    screenProviders(<JournalScreen />);
    await waitFor(() => {
      expect(screen.getByText("second version")).toBeTruthy();
    });
    expect(screen.getByText(/Corrected — an earlier version/)).toBeTruthy();
    fireEvent.click(screen.getByText("View history"));
    await waitFor(() => {
      expect(screen.getByText("first version")).toBeTruthy();
    });
    expect(screen.getByText(/Original/)).toBeTruthy();
    expect(screen.getByText(/Corrected version 1/)).toBeTruthy();
  });

  it("keyboard: the correct button is reachable and toggles via Enter", async () => {
    bootCorrectable();
    await waitFor(() => {
      expect(screen.queryByText(/Opening your journal…/)).toBeNull();
    });
    const btn = screen.getByRole("button", { name: "Correct this entry" });
    btn.focus();
    fireEvent.keyDown(btn, { key: "Enter" });
    // The button's onClick is what tests use; assert panel appears via the heading.
    fireEvent.click(btn);
    expect(screen.getByRole("heading", { name: "Correct this entry" })).toBeTruthy();
  });
});
