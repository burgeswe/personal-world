import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, fireEvent, within } from "@testing-library/react";
import { axe } from "vitest-axe";
import TodayScreen from "../screens/TodayScreen";
import {
  screenProviders,
  mockFetchByRoute,
  jsonResponse,
  okEnvelope,
  CAPABILITIES_FIXTURE,
  JOURNAL_ENTRY_FIXTURE,
} from "./screen-helpers";
import { toHaveNoViolations } from "vitest-axe/dist/matchers";
import type { JournalEntry } from "../lib/api";

/**
 * T10 Today spec (parity rows 1–3, FOUNDATION-SPEC §7):
 * - renders real API data only (status/daily/journal/apps/lab);
 * - a quiet day (no digest actions) renders NO "what changed" list;
 * - the services add flow goes through PUT /api/apps (step-up path);
 * - keyboard-only add flow works;
 * - axe: 0 violations (color-contrast disabled — tokens own contrast);
 * - T14 warmth: greeting + real h2 headings (no card chrome), the
 *   "available:" shape humanized in What changed too, quiet
 *   capability grouping (problems surfaced, healthy majority behind
 *   one honest count), and the fresh-install health sentence.
 */

expect.extend({ toHaveNoViolations });

const axeNoContrast = (el: Element) =>
  axe(el, { rules: { "color-contrast": { enabled: false } } } as never);

const DAILY_BUSY = {
  ok: true,
  status: "healthy",
  warnings: ["reasoning: unavailable"],
  actions: [
    "drift: focus: 'resting' != intent 'shipping'",
    "available: forge-probe (source_control) — not enabled for writes",
  ],
  data: {
    world: { facts: 3, intents: 1, policies: 1, cemented_policies: 0, capabilities: 3, providers: 2, packs: 0 },
    capabilities: CAPABILITIES_FIXTURE,
    // The daily loop's digest: attention = warnings + actions (loop.py).
    attention: [
      "reasoning: unavailable",
      "drift: focus: 'resting' != intent 'shipping'",
      "available: forge-probe (source_control) — not enabled for writes",
    ],
  },
};

const DAILY_QUIET = {
  ok: true,
  status: "healthy",
  warnings: [],
  actions: [],
  data: {
    world: { facts: 3, intents: 1, policies: 1, cemented_policies: 0, capabilities: 3, providers: 2, packs: 0 },
    capabilities: CAPABILITIES_FIXTURE,
    attention: [],
  },
};

/** A fresh install: every capability not_configured (a valid,
 * non-error state per NATIVE-BASELINE-AND-ENRICHMENT). */
const DAILY_FRESH = {
  ok: true,
  status: "healthy",
  warnings: [],
  actions: [],
  data: {
    world: { facts: 0, intents: 0, policies: 0, cemented_policies: 0, capabilities: 2, providers: 0, packs: 0 },
    capabilities: {
      source_control: { ok: false, status: "not_configured", warnings: [], last_observed: "2026-09-11T05:00:00Z" },
      media: { ok: false, status: "not_configured", warnings: [], last_observed: "2026-09-11T05:00:00Z" },
    },
    attention: [],
  },
};

const NOTE_ENTRY = {
  ts: "2026-09-11T06:30:00Z",
  kind: "observation",
  summary: "Replaced the garage door sensor battery",
  provenance: {
    source: "user",
    observed_at: "2026-09-11T06:30:00Z",
    provider: null,
    authority: "observed",
  },
  classification: "private",
};

function defaultHandlers(overrides: Record<string, unknown> = {}) {
  return {
    "/api/daily": () => jsonResponse(200, overrides.daily ?? DAILY_BUSY),
    "/api/journal": (path: string, init?: RequestInit) => {
      const n = Number(new URL(path, "http://x").searchParams.get("n") ?? "20");
      const entries = (overrides.journal as JournalEntry[] | undefined) ?? [
        NOTE_ENTRY,
        JOURNAL_ENTRY_FIXTURE,
        { ...JOURNAL_ENTRY_FIXTURE, ts: "2026-09-11T03:00:00Z", summary: "capability media: not_configured" },
      ];
      if (init?.method === "POST") {
        return jsonResponse(200, { ok: true, data: { written: 5 } });
      }
      return jsonResponse(200, { ok: true, data: entries.slice(0, n) });
    },
    "/api/apps": (_path: string, _init?: RequestInit) => okEnvelope(overrides.apps ?? []),
    "/api/lab/state": () =>
      overrides.lab !== undefined
        ? jsonResponse(200, overrides.lab)
        : jsonResponse(200, {
            ok: true,
            status: "healthy",
            data: {
              rows: [
                {
                  row: "review",
                  count: 1,
                  stale: false,
                  observations: [
                    {
                      detail: "provider credit balance 45% /used 132 of window resets in 3 days",
                      action: null,
                      state: "REVIEW",
                      observed_at: "2026-09-11T04:50:00Z",
                    },
                  ],
                },
              ],
              schema: "lab-lowbw/1",
              generated_at: "2026-09-11T05:00:00Z",
            },
          }),
    "/api/sections": () => okEnvelope({ schema: "personal-world/sections/1", sections: [] }),
  };
}

beforeEach(() => {
  localStorage.setItem("pw_token", "test-token");
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

async function bootToday(handlers: Parameters<typeof mockFetchByRoute>[0]) {
  mockFetchByRoute(handlers);
  const utils = screenProviders(<TodayScreen />);
  await waitFor(() => {
    // All four read queries settled: the health sentence is rendered
    // (digest done) AND the journal panel shows either entries or its
    // honest empty state (no "Opening…" spinners remain).
    expect(screen.queryByText(/Checking your world…/)).toBeNull();
    expect(screen.queryByText(/Opening your journal…/)).toBeNull();
    expect(screen.queryByText(/Opening your services…/)).toBeNull();
    expect(screen.queryByText(/Checking usage…/)).toBeNull();
  });
  return utils;
}

describe("TodayScreen (T10, parity rows 1–3)", () => {
  it("renders the health sentence from real capability counts", async () => {
    await bootToday(defaultHandlers());
    expect(
      screen.getByText(/1 thing needs a look\. 1 capability is healthy\./)
    ).toBeTruthy();
  });

  it("renders the attention list from /api/daily attention", async () => {
    await bootToday(defaultHandlers());
    expect(screen.getByText("Attention")).toBeTruthy();
    // Scoped to the Attention region: the same humanized sentence now
    // also appears in "What changed" (shared voice, task brief §3).
    const attention = screen.getByRole("region", { name: "Attention" });
    expect(within(attention).getByText(/Reasoning: unavailable/)).toBeTruthy();
    expect(
      within(attention).getByText(/Source control is ready for looking, not changing things\./)
    ).toBeTruthy();
  });

  it("a quiet day shows NO what-changed list (no fabricated Recent Changes)", async () => {
    await bootToday(defaultHandlers({ daily: DAILY_QUIET }));
    expect(screen.queryByText("What changed")).toBeNull();
    expect(screen.queryByText("Recent Changes")).toBeNull();
    expect(screen.getByText("Nothing needs your attention.")).toBeTruthy();
  });

  it("a busy day renders the real what-changed items verbatim", async () => {
    await bootToday(defaultHandlers());
    expect(screen.getByText("What changed")).toBeTruthy();
    expect(screen.getByText(/drift: focus/)).toBeTruthy();
  });

  it("renders recent journal entries from /api/journal and filters loop noise", async () => {
    await bootToday(defaultHandlers());
    expect(screen.getByText("Replaced the garage door sensor battery")).toBeTruthy();
    // capability self-observations are filtered out of "Recent entries"
    const recent = screen.getByRole("list", { name: /recent entries/i });
    expect(recent.textContent).not.toContain("capability source_control: healthy");
  });

  it("journal composer saves through POST /api/journal and clears the box", async () => {
    const handlers = defaultHandlers();
    const journalHandler = handlers["/api/journal"];
    handlers["/api/journal"] = (path, init) => {
      if (init?.method === "POST") {
        const body = JSON.parse(String(init.body));
        expect(body.text).toBe("Note from the test");
        return jsonResponse(200, { ok: true, data: { written: body.text.length } });
      }
      return journalHandler(path, init);
    };
    await bootToday(handlers);
    fireEvent.change(screen.getByLabelText("Journal note"), {
      target: { value: "Note from the garage door" },
    });
    fireEvent.change(screen.getByLabelText("Journal note"), {
      target: { value: "Note from the test" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save entry" }));
    await waitFor(() => {
      expect(screen.getByLabelText("Journal note")).toHaveProperty("value", "");
    });
  });

  it("services launcher renders saved services from /api/apps", async () => {
    await bootToday(
      defaultHandlers({
        apps: [
          { id: "forge-probe", name: "Forge Probe", url: "https://git.example.net" },
          { id: "grafana", name: "Grafana", url: "https://metrics.example.net", category: "dashboards" },
        ],
      })
    );
    // Open "More from your world" disclosure to reach the launcher.
    fireEvent.click(
      screen
        .getAllByText("More from your world")
        .find((el) => el.tagName === "SPAN") as HTMLElement
    );
    expect(screen.getByRole("link", { name: /Forge Probe/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Grafana/ })).toBeTruthy();
  });

  it("subscription usage lists real lab packet quota observations, honest when absent", async () => {
    await bootToday(defaultHandlers());
    fireEvent.click(
      screen
        .getAllByText("More from your world")
        .find((el) => el.tagName === "SPAN") as HTMLElement
    );
    expect(
      screen.getByText("provider credit balance 45% /used 132 of window resets in 3 days")
    ).toBeTruthy();
  });

  it("adding a service PUTs the full registry through step-up and the new service appears", async () => {
    const handlers = defaultHandlers({
      apps: [{ id: "forge-probe", name: "Forge Probe", url: "https://git.example.net" }],
    });
    let putCount = 0;
    let savedApps: unknown[] = [
      { id: "forge-probe", name: "Forge Probe", url: "https://git.example.net" },
    ];
    let putHeaders: Headers | null = new Headers();
    handlers["/api/apps"] = (_path: string, init?: RequestInit) => {
      if (init?.method === "PUT") {
        putCount += 1;
        putHeaders = new Headers(init.headers);
        if (putCount === 1) {
          // First attempt: elevation required (the transitional P1 flow).
          return jsonResponse(403, { detail: "write requires step-up auth" });
        }
        savedApps = JSON.parse(String(init.body)).apps;
        return jsonResponse(200, { ok: true, data: savedApps });
      }
      // GET reflects the persisted registry (server truth after the PUT).
      return jsonResponse(200, { ok: true, data: savedApps });
    };
    await bootToday(handlers);
    fireEvent.click(
      screen
        .getAllByText("More from your world")
        .find((el) => el.tagName === "SPAN") as HTMLElement
    );
    fireEvent.change(screen.getByLabelText("Service name"), {
      target: { value: "Home Assistant" },
    });
    fireEvent.change(screen.getByLabelText("Service address"), {
      target: { value: "https://ha.example.net" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add service" }));
    // 403 step_up_required opens the StepUpPrompt naming the reason.
    await screen.findByText("Confirm this action");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => {
      const statuses = screen.getAllByRole("status");
      expect(
        statuses.some((el) => /Service added/.test(el.textContent ?? ""))
      ).toBe(true);
    });
    expect(putCount).toBe(2);
    // Both attempts carry the step-up header (single withStepUp path)
    expect(putHeaders?.get("X-PW-StepUp")).toBe("1");
    expect(savedApps).toEqual([
      { id: "forge-probe", name: "Forge Probe", url: "https://git.example.net" },
      { id: "home-assistant", name: "Home Assistant", url: "https://ha.example.net/" },
    ]);
    expect(await screen.findByRole("link", { name: /Home Assistant/ })).toBeTruthy();
  });

  it("keyboard-only add flow works (fill fields via keyboard, activate with Enter)", async () => {
    const handlers = defaultHandlers({ apps: [] });
    let savedApps: unknown[] = [];
    handlers["/api/apps"] = (_path: string, init?: RequestInit) => {
      if (init?.method === "PUT") {
        savedApps = JSON.parse(String(init.body)).apps;
        return jsonResponse(200, { ok: true, data: savedApps });
      }
      // GET reflects the persisted registry (server truth after the PUT).
      return jsonResponse(200, { ok: true, data: savedApps });
    };
    await bootToday(handlers);
    fireEvent.click(
      screen
        .getAllByText("More from your world")
        .find((el) => el.tagName === "SPAN") as HTMLElement
    );
    // Keyboard path: focus the name field, type, tab to address, type,
    // tab to the button, activate with Enter (jsdom fires click on
    // button + Enter through fireEvent.keyDown/keypress semantics).
    const name = screen.getByLabelText("Service name");
    const url = screen.getByLabelText("Service address");
    name.focus();
    fireEvent.change(name, { target: { value: "Jellyfin" } });
    url.focus();
    fireEvent.change(url, { target: { value: "http://media.local:8096" } });
    const button = screen.getByRole("button", { name: "Add service" });
    button.focus();
    expect(document.activeElement).toBe(button);
    fireEvent.keyDown(button, { key: "Enter", code: "Enter" });
    fireEvent.click(button); // browser synthesizes click on Enter
    await screen.findByRole("link", { name: /Jellyfin/ });
  });

  it("honest empty states when endpoints report not-configured / empty", async () => {
    await bootToday(
      defaultHandlers({
        apps: [],
        daily: DAILY_QUIET,
        journal: [],
        lab: { ok: true, status: "healthy", data: { rows: [], schema: "lab-lowbw/1", generated_at: "" } },
      })
    );
    fireEvent.click(
      screen
        .getAllByText("More from your world")
        .find((el) => el.tagName === "SPAN") as HTMLElement
    );
    expect(screen.getByText("No services saved here yet. Add one when it would be useful.")).toBeTruthy();
    expect(screen.getByText("No journal entries yet. This is a gentle place to begin.")).toBeTruthy();
    expect(screen.getByText("No current subscription limits need your attention.")).toBeTruthy();
  });

  it("digest failure renders the honest error naming what failed (A11y §4.5)", async () => {
    mockFetchByRoute({
      "/api/daily": () => jsonResponse(500, { detail: "digest exploded" }),
      "/api/journal": () => jsonResponse(200, { ok: true, data: [] }),
      "/api/apps": () => okEnvelope([]),
      "/api/lab/state": () => jsonResponse(200, { ok: false, status: "unavailable" }),
    });
    screenProviders(<TodayScreen />);
    await screen.findByText(/could not load your daily digest/);
    expect(screen.getByText(/digest exploded/)).toBeTruthy();
    expect(screen.getByText(/rest of your world still works/)).toBeTruthy();
  });

  it("capabilities rows carry canonical StatusChip words + provenance disclosure", async () => {
    await bootToday(defaultHandlers());
    fireEvent.click(
      screen
        .getAllByText("More from your world")
        .find((el) => el.tagName === "SPAN") as HTMLElement
    );
    // The healthy/not_configured majority now sits behind the quiet
    // disclosure — open it first (the real reachable path to those rows).
    fireEvent.click(screen.getByText("Show the other 2"));
    const chips = screen.getAllByText("not configured");
    expect(chips.length).toBeGreaterThan(0);
    const chip = chips[0].closest(".chip");
    expect(chip?.getAttribute("data-status")).toBe("not_configured");
    // per-row provenance: disclosure reveals the raw payload (L4)
    fireEvent.click(screen.getAllByText("source control")[0]);
    await waitFor(() => {
      expect(screen.getAllByText("Technical details").length).toBeGreaterThan(0);
    });
  });

  it("greets with time-of-day warmth, host-local date, and a decorative greeting companion", async () => {
    const { container } = await bootToday(defaultHandlers());
    const region = container.querySelector('section[aria-labelledby="today-health-heading"]');
    expect(region).toBeTruthy();
    expect(screen.getByText(/^Good (morning|afternoon|evening)\.$/)).toBeTruthy();
    expect(region?.querySelector("h1")?.textContent).toBe("Today");
    const date = region?.querySelector("time");
    expect(date).toBeTruthy();
    expect(date?.getAttribute("dateTime")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect((date?.textContent ?? "").length).toBeGreaterThan(0);
    // the greeting companion is decorative only (COMPANION_INTEGRATION
    // "Inline" 48px greeting-area placement): aria-hidden artwork with
    // alt="", never a second trigger/button.
    const slot = region?.querySelector("[data-pw-companion-slot]");
    expect(slot).toBeTruthy();
    expect(slot?.querySelector("button")).toBeNull();
    const artwork = slot?.querySelector("img");
    expect(artwork?.getAttribute("alt")).toBe("");
    expect(Number(artwork?.getAttribute("width"))).toBe(48);
    expect(artwork?.closest("[aria-hidden='true']")).toBeTruthy();
  });

  it("sections are real h2 headings with quiet dividers — no card chrome (A11y §4.1, DESIGN-HANDOFF N.7)", async () => {
    const { container } = await bootToday(defaultHandlers());
    const h1s = container.querySelectorAll("h1");
    expect(h1s.length).toBe(1);
    expect(h1s[0].textContent).toBe("Today");
    for (const id of ["today-attention-heading", "today-changes-heading", "today-journal-heading"]) {
      const h2 = container.querySelector(`h2#${id}`);
      expect(h2, `missing real h2#${id}`).toBeTruthy();
      expect(h2?.closest("section")?.getAttribute("aria-labelledby")).toBe(id);
    }
    expect(screen.getByRole("heading", { level: 2, name: "Recent entries" })).toBeTruthy();
    // the bordered/shadowed Card boxes are gone from Today
    // (transition-shadow is the Card chrome signature — buttons have
    // shadow-sm/hover:shadow-md but never transition-shadow)
    expect(container.querySelectorAll('[class*="transition-shadow"]').length).toBe(0);
    // quiet dividers between the stacked sections
    expect(container.querySelectorAll("section[class*='border-t']").length).toBeGreaterThanOrEqual(3);
  });

  it("what-changed reads the 'available:' shape in the same humanized voice as Attention", async () => {
    await bootToday(defaultHandlers());
    const changes = screen.getByRole("region", { name: "What changed" });
    expect(
      within(changes).getByText(/Source control is ready for looking, not changing things\./)
    ).toBeTruthy();
    // entries that do not match that shape keep their recorded content verbatim
    expect(within(changes).getByText(/drift: focus: 'resting' != intent 'shipping'/)).toBeTruthy();
    expect(within(changes).queryByText(/available: forge-probe/)).toBeNull();
  });

  it("quiets the healthy majority behind one honest count line; problems stay individual", async () => {
    await bootToday(defaultHandlers());
    fireEvent.click(
      screen
        .getAllByText("More from your world")
        .find((el) => el.tagName === "SPAN") as HTMLElement
    );
    // reasoning (unavailable) is surfaced as its own row
    expect(screen.getByText("reasoning")).toBeTruthy();
    // the healthy/not_configured majority collapsed to one line (real count from the data)
    expect(screen.getByText("2 other capabilities are healthy or not yet connected.")).toBeTruthy();
    // progressive disclosure reveals complexity, it never erases it: the
    // quiet rows are still reachable inside the disclosure
    fireEvent.click(screen.getByText("Show the other 2"));
    expect(screen.getAllByText("source control").length).toBeGreaterThan(0);
    expect(screen.getAllByText("media").length).toBeGreaterThan(0);
  });

  it("a fresh world (everything not yet connected) reads as ready, never '0 are healthy'", async () => {
    await bootToday(defaultHandlers({ daily: DAILY_FRESH }));
    expect(
      screen.getByText(/Your world is ready\. Nothing is connected yet — capabilities will show up here as you add them\./)
    ).toBeTruthy();
    fireEvent.click(
      screen
        .getAllByText("More from your world")
        .find((el) => el.tagName === "SPAN") as HTMLElement
    );
    // nothing surfaced (all quiet), so the count line carries the whole truth
    expect(screen.getByText("2 capabilities are healthy or not yet connected.")).toBeTruthy();
    expect(screen.getByText("Show the other 2")).toBeTruthy();
  });

  it("axe: 0 violations (color-contrast disabled)", async () => {
    const { container } = await bootToday(defaultHandlers());
    fireEvent.click(
      screen
        .getAllByText("More from your world")
        .find((el) => el.tagName === "SPAN") as HTMLElement
    );
    expect(await axeNoContrast(container)).toHaveNoViolations();
  });
});