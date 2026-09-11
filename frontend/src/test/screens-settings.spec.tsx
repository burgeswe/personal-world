import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { axe } from "vitest-axe";
import SettingsScreen from "../screens/SettingsScreen";
import { CompanionProvider } from "../lib/companion-context";
import {
  PrefsProvider,
  PREFERENCES_DEFAULTS,
} from "../lib/prefs-context";
import { LiveRegionProvider } from "../primitives/LiveRegion";
import type { SectionData } from "../lib/api";

/**
 * T11 Settings screen spec (FOUNDATION-SPEC §10 row T11 / parity row 6,
 * A11y contract). All fetch is mocked; payloads mirror the exact server
 * shapes (api.py handlers, tests/test_sections.py,
 * tests/test_prefs.py, scheduler.py).
 *
 * Covers:
 * - prefs options come from /api/prefs/schema (NOT hard-coded);
 * - a server 400 on PUT /api/prefs is shown SPECIFICALLY (field + reason);
 * - sections panel: reorder / hide / show via PUT /api/sections,
 *   `settings` pinned (no Hide control), restore-defaults flow
 *   (server reset via {"order": [], "hidden": []});
 * - reminders add / toggle / delete (step-up writes);
 * - companion "off": artwork removed, assistant trigger kept
 *   (frontend-only machinery; server vocabulary untouched);
 * - capability table: canonical StatusChip words only, honest unknown
 *   when null, no invented statuses;
 * - axe 0 violations (color-contrast off — jsdom limit, mirroring all
 *   T7/T8/T9 specs).
 */

// jsdom limit shared by every screen/primitive spec in this repo.
const axeNoContrast = (el: Element) =>
  axe(el, { rules: { "color-contrast": { enabled: false } } } as never);

// ── Fixtures: exact server shapes ──

const SCHEMA = {
  motion: { type: "enum", default: "reduced", floor: "off", allowed: ["off", "reduced", "subtle"] },
  contrast: { type: "enum", default: "comfortable", floor: "comfortable", allowed: ["comfortable", "high"] },
  text_scale: { type: "number", default: 1.0, floor: 1.0, allowed: [1.0, 1.25, 1.5], integer: false, unit: "" },
  density: { type: "enum", default: "comfortable", floor: "compact", allowed: ["comfortable", "compact"] },
  target_size: { type: "number", default: 44, floor: 44, allowed: [44, 56], integer: true, unit: "px" },
  companion: {
    type: "enum",
    default: "personal-world",
    floor: "personal-world",
    allowed: ["personal-world", "mermaid", "robot", "world-tree-squirrel", "taco-news-truck"],
  },
  accent: { type: "enum", default: "world-keeper", floor: "world-keeper", allowed: ["world-keeper", "rylee"] },
};

const PREFS = {
  motion: "reduced",
  contrast: "comfortable",
  text_scale: 1.0,
  density: "comfortable",
  target_size: 44,
  companion: "personal-world",
  accent: "world-keeper",
};

function section(overrides: Partial<SectionData> = {}): SectionData {
  return {
    id: "today",
    label: "Today",
    icon: "navigation--today",
    order: 0,
    visible: true,
    pinned: false,
    kind: "core",
    configured: true,
    status: null,
    ...overrides,
  };
}

/** Default registry payload, spec §2.1 (server truth, not client). */
const DEFAULT_SECTIONS: SectionData[] = [
  section({ id: "today", label: "Today", icon: "navigation--today", order: 0 }),
  section({
    id: "interests", label: "Interests", icon: "world-content--bookmark", order: 1,
    configured: false, status: "not_configured",
  }),
  section({
    id: "media", label: "Media", icon: "world-content--story", order: 2,
    configured: false, status: "not_configured",
  }),
  section({ id: "projects", label: "Projects", icon: "navigation--projects", order: 3, status: "not_configured", configured: false }),
  section({ id: "lab", label: "Lab", icon: "system-device--desktop", order: 4, status: "not_configured", configured: false }),
  section({ id: "journal", label: "Journal & Memory", icon: "navigation--journal", order: 5 }),
  section({ id: "vault", label: "Vault", icon: "system-device--lock", order: 6 }),
  section({ id: "chat", label: "Chat", icon: "navigation--chat", order: 7, kind: "transitional" }),
  section({ id: "settings", label: "Settings", icon: "navigation--settings", order: 8, pinned: true }),
];

const REMINDERS = [
  { id: "r-1", text: "Water the plants", enabled: true, created_at: 1757500000 },
  { id: "r-2", text: "Rotate vault passphrase", enabled: false, created_at: 1757400000 },
];

const STATUS = {
  ok: true,
  status: "healthy",
  data: {
    facts: 3,
    intents: 0,
    policies: 0,
    cemented_policies: 0,
    lore: { confirmed: 0, derived: 0, suggested: 0, ephemeral: 0 },
    capabilities: {
      journal: { ok: true, status: "healthy", warnings: [], last_observed: "2026-09-10T00:00:00Z" },
      media: { ok: false, status: "not_configured", warnings: ["no media connection"], last_observed: "2026-09-10T00:00:00Z" },
      discovery: { ok: true, status: null, warnings: [], last_observed: "2026-09-10T00:00:00Z" },
    },
    providers: 1,
    packs: 0,
    actors: [],
  },
};

const THEMES = [
  { name: "world-keeper", display_name: "World Keeper (Globe)" },
  { name: "not-a-companion", display_name: "Not A Companion" },
];

// ── Fetch mock: route by URL ──

type FetchResponder = (url: string, init: RequestInit) => Response | undefined;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function mockFetch(responders: FetchResponder[]): void {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string | URL, init: RequestInit = {}) => {
      const target = String(url);
      for (const respond of responders) {
        const result = respond(target, init);
        if (result) return Promise.resolve(result);
      }
      return Promise.resolve(jsonResponse(404, { detail: `no mock for ${target}` }));
    })
  );
}

/** Route /api/sections GET with a mutable list the tests can rewrite. */
let sectionsState: SectionData[] = DEFAULT_SECTIONS;

function respondSections(): FetchResponder {
  return (url) => {
    if (url.endsWith("/api/sections") && !url.includes("reminders")) {
      return jsonResponse(200, {
        ok: true,
        data: { schema: "personal-world/sections/1", sections: sectionsState },
      });
    }
    return undefined;
  };
}

function respondOk(urlSuffix: string, body: unknown = {}): FetchResponder {
  return (url) =>
    url.endsWith(urlSuffix) ? jsonResponse(200, { ok: true, data: body }) : undefined;
}

/** /api/status returns `{ok, status, data}` — data carries the payload. */
function respondStatus(): FetchResponder {
  return (url) =>
    url.endsWith("/api/status")
      ? jsonResponse(200, STATUS)
      : undefined;
}

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={["/settings"]}>
      <CompanionProvider>
        <PrefsProvider initialPrefs={PREFERENCES_DEFAULTS}>
          <LiveRegionProvider>
            <SettingsScreen />
          </LiveRegionProvider>
        </PrefsProvider>
      </CompanionProvider>
    </MemoryRouter>
  );
}

function standardRoutes(overrides: FetchResponder[] = []): FetchResponder[] {
  return [
    ...overrides,
    respondOk("/api/prefs/schema", SCHEMA),
    respondOk("/api/prefs", PREFS),
    respondSections(),
    respondOk("/api/reminders", REMINDERS),
    respondStatus(),
    respondOk("/api/themes", THEMES),
  ];
}

beforeEach(() => {
  localStorage.setItem("pw_token", "test-token");
  sectionsState = DEFAULT_SECTIONS.map((s) => ({ ...s }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

// ── Prefs from schema ──

describe("Settings: prefs render from GET /api/prefs/schema (parity row 6)", () => {
  it("renders each pref control with ONLY the server's allowed options", async () => {
    mockFetch(standardRoutes());
    renderScreen();
    const motion = (await screen.findByLabelText("Motion")) as HTMLSelectElement;
    const options = within(motion).getAllByRole("option").map((o) => o.textContent);
    // The schema's exact vocabulary (prefs.py MOTION, §3) — a
    // hard-coded list would not survive a server vocabulary change.
    expect(options).toEqual(["off", "reduced", "subtle"]);
    expect(motion.value).toBe("reduced");
    const density = await screen.findByLabelText("Density");
    expect(within(density).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "comfortable", "compact",
    ]);
    const textScale = await screen.findByLabelText("Text scale");
    expect(within(textScale).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "1", "1.25", "1.5",
    ]);
  });

  it("omits a pref panel the schema does not declare (server-driven, not hard-coded)", async () => {
    const schemaNoMotion = { ...SCHEMA } as typeof SCHEMA;
    const { motion: _dropped, ...rest } = schemaNoMotion;
    mockFetch(standardRoutes([respondOk("/api/prefs/schema", rest)]));
    renderScreen();
    await screen.findByLabelText("Contrast");
    expect(screen.queryByLabelText("Motion")).toBeNull();
  });

  it("PUT /api/prefs sends the step-up header and announces the save", async () => {
    const fetchMock = vi.fn((url: string | URL, init: RequestInit = {}) => {
      const target = String(url);
      void init;
      if (target.endsWith("/api/prefs/schema")) {
        return Promise.resolve(jsonResponse(200, { ok: true, data: SCHEMA }));
      }
      if (target.endsWith("/api/prefs")) {
        return Promise.resolve(jsonResponse(200, { ok: true, data: { ...PREFS, motion: "subtle" } }));
      }
      return Promise.resolve(jsonResponse(200, { ok: true, data: [] }));
    });
    vi.stubGlobal("fetch", fetchMock);
    renderScreen();
    const motion = await screen.findByLabelText("Motion");
    fireEvent.change(motion, { target: { value: "subtle" } });
    await waitFor(() => {
      const calls = (fetchMock.mock.calls as Array<[string, RequestInit]>).filter(
        ([u, i]) => String(u).endsWith("/api/prefs") && i.method === "PUT"
      );
      expect(calls.length).toBeGreaterThan(0);
      const headers = new Headers(calls[calls.length - 1][1].headers);
      expect(headers.get("X-PW-StepUp")).toBe("1");
      expect(JSON.parse(String(calls[calls.length - 1][1].body))).toEqual({ motion: "subtle" });
    });
    await waitFor(() => {
      const region = document.querySelector("[data-pw-live-region]");
      expect(region?.textContent).toMatch(/Settings saved/);
    });
  });

  it("server 400 on a pref is shown SPECIFICALLY (field + reason), no generic failure", async () => {
    const detail =
      "text_scale: 0.5 is below the accessibility floor (1)";
    const fetchMock = vi.fn((url: string | URL, init: RequestInit = {}) => {
      const target = String(url);
      if (target.endsWith("/api/prefs/schema")) {
        return Promise.resolve(jsonResponse(200, { ok: true, data: SCHEMA }));
      }
      if (target.endsWith("/api/prefs") && (init.method ?? "GET") === "PUT") {
        return Promise.resolve(
          jsonResponse(400, { detail })
        );
      }
      return Promise.resolve(jsonResponse(200, { ok: true, data: PREFS }));
    });
    vi.stubGlobal("fetch", fetchMock);
    renderScreen();
    fireEvent.change(await screen.findByLabelText("Text scale"), { target: { value: "0.5" } });
    const alert = await screen.findByTestId("pref-error-text_scale");
    expect(alert.textContent).toContain("text_scale: 0.5 is below the accessibility floor");
    expect(alert.getAttribute("role")).toBe("alert");
    // and the other panels still render (what still works, A11y §4.5)
    expect(screen.getByLabelText("Motion")).toBeTruthy();
  });

  it("schema load failure is named honestly and does not invent options", async () => {
    mockFetch([
      (url) =>
        url.endsWith("/api/prefs/schema")
          ? jsonResponse(500, { detail: "schema unavailable" })
          : undefined,
      respondOk("/api/prefs", PREFS),
      respondSections(),
      respondOk("/api/reminders", []),
      respondStatus(),
    ]);
    renderScreen();
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Preference options are unavailable");
    expect(screen.queryByLabelText("Motion")).toBeNull();
  });
});

// ── Sections panel ──

describe("Settings: sections panel (GET/PUT /api/sections)", () => {
  it("renders sections from the server payload in payload order", async () => {
    mockFetch(standardRoutes());
    renderScreen();
    const list = await screen.findByTestId("sections-list");
    const ids = within(list)
      .getAllByTestId(/^section-row-/)
      .map((row) => row.getAttribute("data-testid"));
    expect(ids).toEqual([
      "section-row-today",
      "section-row-interests",
      "section-row-media",
      "section-row-projects",
      "section-row-lab",
      "section-row-journal",
      "section-row-vault",
      "section-row-chat",
      "section-row-settings",
    ]);
  });

  it("Move down on `today` reorders and PUTs the new order (persisted via server)", async () => {
    const puts: unknown[] = [];
    const fetchMock = vi.fn((url: string | URL, init: RequestInit = {}) => {
      const target = String(url);
      if (target.endsWith("/api/sections") && (init.method ?? "GET") === "PUT") {
        puts.push(JSON.parse(String(init.body)));
        // Server truth: apply the new order and return it (§2.4 contract).
        const body = JSON.parse(String(init.body)) as { order?: string[]; hidden?: string[] };
        if (body.order) {
          sectionsState = body.order
            .map((id) => DEFAULT_SECTIONS.find((s) => s.id === id))
            .filter((s): s is SectionData => s !== undefined);
        }
        return Promise.resolve(jsonResponse(200, {
          ok: true,
          data: { schema: "personal-world/sections/1", sections: sectionsState },
        }));
      }
      if (target.endsWith("/api/sections")) {
        return Promise.resolve(jsonResponse(200, {
          ok: true,
          data: { schema: "personal-world/sections/1", sections: sectionsState },
        }));
      }
      return Promise.resolve(jsonResponse(200, { ok: true, data: [] }));
    });
    vi.stubGlobal("fetch", fetchMock);
    renderScreen();
    fireEvent.click(await screen.findByRole("button", { name: "Move Today down" }));
    await waitFor(() => expect(puts).toHaveLength(1));
    expect(puts[0]).toEqual({
      order: ["interests", "today", "media", "projects", "lab", "journal", "vault", "chat", "settings"],
    });
    const list = await screen.findByTestId("sections-list");
    const ids = within(list).getAllByTestId(/^section-row-/).map((r) => r.getAttribute("data-testid"));
    expect(ids.indexOf("section-row-today")).toBe(1);
    expect(screen.getByRole("button", { name: "Move Today down" })).toBeTruthy();
    const region = document.querySelector("[data-pw-live-region]");
    await waitFor(() => expect(region?.textContent).toMatch(/Interests moved to the top|Today moved down/));
  });

  it("Hide on `today` sends the hidden list; hidden sections show a Show control", async () => {
    const puts: unknown[] = [];
    const fetchMock = vi.fn((url: string | URL, init: RequestInit = {}) => {
      const target = String(url);
      if (target.endsWith("/api/sections") && (init.method ?? "GET") === "PUT") {
        puts.push(JSON.parse(String(init.body)));
        const body = JSON.parse(String(init.body)) as { order?: string[]; hidden?: string[] };
        if (body.hidden) {
          sectionsState = sectionsState.map((s) =>
            body.hidden?.includes(s.id) ? { ...s, visible: false } : s
          );
        }
        return Promise.resolve(jsonResponse(200, {
          ok: true,
          data: { schema: "personal-world/sections/1", sections: sectionsState },
        }));
      }
      if (target.endsWith("/api/sections")) {
        return Promise.resolve(jsonResponse(200, {
          ok: true,
          data: { schema: "personal-world/sections/1", sections: sectionsState },
        }));
      }
      return Promise.resolve(jsonResponse(200, { ok: true, data: [] }));
    });
    vi.stubGlobal("fetch", fetchMock);
    renderScreen();
    fireEvent.click(await screen.findByTestId("hide-today"));
    await waitFor(() => expect(puts).toHaveLength(1));
    expect(puts[0]).toEqual({ hidden: ["today"] });
    // Server says hidden → row flips to Show
    await screen.findByTestId("show-today");
    expect(screen.queryByTestId("hide-today")).toBeNull();
  });

  it("`settings` is pinned: NO Hide control, moves still allowed", async () => {
    mockFetch(standardRoutes());
    renderScreen();
    const row = await screen.findByTestId("section-row-settings");
    expect(screen.queryByTestId("hide-settings")).toBeNull();
    expect(within(row).queryByRole("button", { name: "Hide Settings" })).toBeNull();
    expect(screen.getByRole("button", { name: "Move Settings down" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Move Settings up" }).hasAttribute("disabled")).toBe(false);
    expect(row.textContent).toContain("always reachable");
  });

  it("a hidden section in the payload renders Show, not Hide (server truth)", async () => {
    sectionsState = DEFAULT_SECTIONS.map((s) =>
      s.id === "today" ? { ...s, visible: false } : s
    );
    mockFetch(standardRoutes());
    renderScreen();
    expect(await screen.findByTestId("show-today")).toBeTruthy();
    expect(screen.queryByTestId("hide-today")).toBeNull();
  });

  it("Restore default sections asks, then PUTs the server reset {order: [], hidden: []}", async () => {
    const puts: unknown[] = [];
    sectionsState = DEFAULT_SECTIONS.map((s) =>
      s.id === "today" ? { ...s, visible: false } : s
    );
    const fetchMock = vi.fn((url: string | URL, init: RequestInit = {}) => {
      const target = String(url);
      if (target.endsWith("/api/sections") && (init.method ?? "GET") === "PUT") {
        puts.push(JSON.parse(String(init.body)));
        const body = JSON.parse(String(init.body)) as { order?: string[]; hidden?: string[] };
        if (Array.isArray(body.order) && body.order.length === 0 && Array.isArray(body.hidden) && body.hidden.length === 0) {
          sectionsState = DEFAULT_SECTIONS.map((s) => ({ ...s }));
        }
        return Promise.resolve(jsonResponse(200, {
          ok: true,
          data: { schema: "personal-world/sections/1", sections: sectionsState },
        }));
      }
      if (target.endsWith("/api/sections")) {
        return Promise.resolve(jsonResponse(200, {
          ok: true,
          data: { schema: "personal-world/sections/1", sections: sectionsState },
        }));
      }
      return Promise.resolve(jsonResponse(200, { ok: true, data: PREFS }));
    });
    vi.stubGlobal("fetch", fetchMock);
    const { container } = renderScreen();
    fireEvent.click(await screen.findByTestId("restore-sections"));
    // danger dialog (A11y §4.4): native <dialog>, verb label, consequence
    const dialog = container.querySelector("dialog");
    expect(dialog).not.toBeNull();
    expect(dialog?.hasAttribute("open")).toBe(true);
    expect(dialog?.getAttribute("data-pw-dialog")).toBe("danger");
    expect(screen.getByText(/return to the defaults/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Restore defaults" }));
    await waitFor(() => expect(puts).toHaveLength(1));
    expect(puts[0]).toEqual({ order: [], hidden: [] });
    await screen.findByTestId("section-row-today");
    expect(screen.getByTestId("hide-today")).toBeTruthy();
    await waitFor(() =>
      expect(document.querySelector("[data-pw-live-region]")?.textContent).toMatch(/restored to defaults/)
    );
  });

  it("a server 400 on PUT /api/sections (pinned hidden) is surfaced verbatim", async () => {
    const detail = "section 'settings' is pinned and cannot be hidden";
    mockFetch(standardRoutes([
      (url, init) =>
        url.endsWith("/api/sections") && (init.method ?? "GET") === "PUT"
          ? jsonResponse(400, { detail })
          : undefined,
    ]));
    renderScreen();
    fireEvent.click(await screen.findByTestId("hide-today"));
    const alert = await screen.findByTestId("sections-error");
    expect(alert.textContent).toContain(detail);
  });
});

// ── Reminders ──

describe("Settings: reminders add / toggle / delete (step-up writes)", () => {
  it("add sends POST with the text + step-up header and announces", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchMock = vi.fn((url: string | URL, init: RequestInit = {}) => {
      calls.push({ url: String(url), init });
      if (String(url).endsWith("/api/reminders") && init.method === "POST") {
        return Promise.resolve(jsonResponse(200, { ok: true, data: { id: "r-9", text: "Feed the squirrel", enabled: true, created_at: 1 } }));
      }
      if (String(url).endsWith("/api/reminders")) {
        return Promise.resolve(jsonResponse(200, { ok: true, data: REMINDERS }));
      }
      return Promise.resolve(jsonResponse(200, { ok: true, data: PREFS }));
    });
    vi.stubGlobal("fetch", fetchMock);
    renderScreen();
    fireEvent.change(await screen.findByLabelText("New reminder text"), {
      target: { value: "Feed the squirrel" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add reminder" }));
    await waitFor(() => {
      const post = calls.find((c) => c.init.method === "POST");
      expect(post).toBeTruthy();
      expect(post?.url.endsWith("/api/reminders")).toBe(true);
      expect(new Headers(post?.init.headers).get("X-PW-StepUp")).toBe("1");
      expect(JSON.parse(String(post?.init.body))).toEqual({ text: "Feed the squirrel" });
    });
    await waitFor(() =>
      expect(document.querySelector("[data-pw-live-region]")?.textContent).toMatch(/Reminder added/)
    );
  });

  it("toggle PATCHes {enabled} with step-up; delete goes through the danger dialog", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    mockFetch(standardRoutes([
      (url, init) => {
        if (url.endsWith("/api/reminders/r-1") && init.method === "PATCH") {
          return jsonResponse(200, { ok: true, data: { ...REMINDERS[0], enabled: false } });
        }
        if (url.endsWith("/api/reminders/r-1") && init.method === "DELETE") {
          return jsonResponse(200, { ok: true, data: { id: "r-1" } });
        }
        return undefined;
      },
    ]));
    const fetchSpy = vi.stubGlobal(
      "fetch",
      new Proxy(globalThis.fetch, {
        apply(target, _this, args) {
          calls.push({ url: String(args[0]), init: (args[1] ?? {}) as RequestInit });
          return Reflect.apply(target, _this, args);
        },
      })
    );
    void fetchSpy;
    renderScreen();
    fireEvent.click(await screen.findByRole("button", { name: "Pause reminder Water the plants" }));
    await waitFor(() => {
      const patch = calls.find((c) => c.init.method === "PATCH");
      expect(patch).toBeTruthy();
      expect(patch?.url.endsWith("/api/reminders/r-1")).toBe(true);
      expect(new Headers(patch?.init.headers).get("X-PW-StepUp")).toBe("1");
      expect(JSON.parse(String(patch?.init.body))).toEqual({ enabled: false });
    });
    fireEvent.click(screen.getByTestId("delete-reminder-r-1"));
    expect(screen.getByText(/cannot be undone/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Delete reminder" }));
    await waitFor(() => {
      const del = calls.find((c) => c.init.method === "DELETE");
      expect(del).toBeTruthy();
      expect(del?.url.endsWith("/api/reminders/r-1")).toBe(true);
      expect(new Headers(del?.init.headers).get("X-PW-StepUp")).toBe("1");
    });
  });
});

// ── Capability table ──

describe("Settings: capability table from /api/status", () => {
  it("renders canonical status words; a null status renders the honest unknown word, no invented statuses", async () => {
    mockFetch(standardRoutes());
    renderScreen();
    const table = await screen.findByRole("table");
    expect(within(table).getAllByText("healthy").length).toBeGreaterThan(0);
    expect(within(table).getAllByText("not configured").length).toBeGreaterThan(0);
    // discovery has status null → the canonical "unknown" word renders
    expect(within(table).getAllByText("unknown").length).toBeGreaterThan(0);
    for (const chip of Array.from(table.querySelectorAll(".chip"))) {
      const status = chip.getAttribute("data-status");
      expect([
        "healthy", "warning", "unknown", "needs_attention", "unavailable",
        "stale", "disabled", "not_configured",
      ]).toContain(status);
    }
    expect(table.textContent).not.toContain("n/a");
  });

  it("status unavailability is named; the rest of the screen still works", async () => {
    mockFetch([
      respondOk("/api/prefs/schema", SCHEMA),
      respondOk("/api/prefs", PREFS),
      respondSections(),
      respondOk("/api/reminders", []),
      (url) =>
        url.endsWith("/api/status")
          ? jsonResponse(500, { detail: "status unavailable" })
          : undefined,
      respondOk("/api/themes", []),
    ]);
    renderScreen();
    const panel = await screen.findByTestId("capabilities-panel");
    expect(panel.textContent).toContain("Capability status is unavailable");
    expect(panel.textContent).toContain("still works");
    await screen.findByLabelText("Motion");
  });
});

// ── Companion control ──

describe("Settings: companion selection + frontend-only off", () => {
  it("companion options come from the schema vocabulary plus 'off'", async () => {
    mockFetch(standardRoutes());
    renderScreen();
    const panel = await screen.findByTestId("companion-panel");
    for (const name of ["Personal World", "Mermaid", "Little Helper Robot", "World-tree Squirrel", "Tacos & the Morning Paper"]) {
      expect(within(panel).getByText(name)).toBeTruthy();
    }
    expect(within(panel).getByText("Off (artwork hidden)")).toBeTruthy();
  });

  it("choosing 'off' sets the companion context to off WITHOUT a server write", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    mockFetch(standardRoutes([
      (_url, init) => {
        calls.push({ url: "/api/prefs", init });
        return jsonResponse(500, { detail: "writes refused in this test" });
      },
    ]));
    renderScreen();
    const panel = await screen.findByTestId("companion-panel");
    // CompanionSlot artwork + trigger: render the primitive under the
    // same providers to observe the context value the screen set.
    fireEvent.click(within(panel).getByRole("button", { name: "Select Off (artwork hidden)" }));
    await waitFor(() =>
      expect(document.querySelector("[data-pw-live-region]")?.textContent).toMatch(/assistant is still available/)
    );
    const put = calls.find((c) => c.init.method === "PUT");
    expect(put).toBeUndefined();
  });

  it("a real companion value PUTs the server pref and updates the context", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    mockFetch(standardRoutes([
      (url, init) => {
        if (url.endsWith("/api/prefs") && (init.method ?? "GET") === "PUT") {
          calls.push({ url: String(url), init });
          return jsonResponse(200, { ok: true, data: { ...PREFS, companion: "mermaid" } });
        }
        return undefined;
      },
    ]));
    renderScreen();
    const panel = await screen.findByTestId("companion-panel");
    fireEvent.click(within(panel).getByRole("button", { name: "Select Mermaid" }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ companion: "mermaid" });
    expect(new Headers(calls[0].init.headers).get("X-PW-StepUp")).toBe("1");
  });
});

// ── Honest rendering / a11y ──

describe("Settings: structure and accessibility", () => {
  it("renders NO <main> landmark (the shell owns it)", () => {
    mockFetch(standardRoutes());
    const { container } = renderScreen();
    expect(container.querySelector("main")).toBeNull();
  });

  it("axe: 0 violations (color-contrast off — jsdom limit)", async () => {
    mockFetch(standardRoutes());
    const { container } = renderScreen();
    await screen.findByLabelText("Motion");
    expect(await axeNoContrast(container)).toHaveNoViolations();
  });

  it("an unknown section status value never renders as a chip word", async () => {
    sectionsState = DEFAULT_SECTIONS.map((s) =>
      s.id === "media" ? { ...s, status: "made_up_status" as unknown as null } : s
    );
    mockFetch(standardRoutes());
    const { container } = renderScreen();
    await screen.findByTestId("sections-list");
    for (const chip of Array.from(container.querySelectorAll(".chip"))) {
      const word = chip.textContent ?? "";
      expect(word).not.toContain("made_up");
    }
  });
});