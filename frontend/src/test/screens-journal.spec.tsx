import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, fireEvent } from "@testing-library/react";
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

  it("axe: 0 violations (color-contrast disabled)", async () => {
    const { utils } = await bootJournal();
    expect(await axeNoContrast(utils.container)).toHaveNoViolations();
  });
});