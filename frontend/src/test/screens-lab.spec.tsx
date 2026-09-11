import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { axe } from "vitest-axe";
import { MemoryRouter } from "react-router-dom";
import { CompanionProvider } from "../lib/companion-context";
import { LiveRegionProvider } from "../primitives/LiveRegion";
import { CANONICAL_STATUSES } from "../primitives/StatusChip";
import LabScreen from "../screens/LabScreen";

/**
 * T13 Lab spec (FOUNDATION-SPEC §7 parity row 3): the REAL operator
 * table from `GET /api/lab/state` (lab-lowbw/1 packet), StatusChip per
 * row (canonical statuses only), per-row provenance behind a Level-4
 * TechnicalDetails Disclosure, and honest degradation:
 * - absent CLI  → `not_configured` naming the `PW_LAB_CLI` knob with the
 *   backend's language ("Lab provider not configured — …");
 * - failing CLI → `unavailable` with the server's warning, never a
 *   guessed row.
 *
 * jsdom honesty: fetch is mocked at the boundary the screens actually
 * use (lib/api.ts apiFetch); the payloads mirror the backend envelopes
 * exactly as api.py lab_state / lab_health produce them.
 */

const axeNoContrast = (el: Element) =>
  axe(el, { rules: { "color-contrast": { enabled: false } } } as never);

/** A lab-lowbw/1 packet shaped exactly as LabState._normalize emits it. */
function packetRows() {
  return [
    {
      row: "urgent",
      count: 1,
      stale: false,
      observations: [
        {
          detail: "d1",
          action: "a1",
          state: "needs_attention",
          observed_at: "2026-09-07T22:00:00+00:00",
        },
      ],
    },
    { row: "review", count: 0, stale: false, observations: [] },
    { row: "safe", count: 0, stale: false, observations: [] },
    { row: "unknown", count: 0, stale: false, observations: [] },
    { row: "last_known_good", count: 0, stale: false, observations: [] },
    { row: "next", count: 0, stale: false, observations: [] },
    // Schema growth is preserved, never silent (LabState._normalize).
    {
      row: "brand_new_row",
      count: 0,
      stale: false,
      unrecognized: true,
      observations: [],
    },
  ];
}

function labStateEnvelope(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    status: "healthy",
    data: {
      rows: packetRows(),
      schema: "lab-lowbw/1",
      generated_at: "2026-09-07T22:00:00Z",
    },
    ...overrides,
  };
}

function labHealthEnvelope() {
  return {
    ok: true,
    status: "healthy",
    data: { total: 3, healthy: 3, unhealthy: 0, restarting: 0, stopped: 0 },
  };
}

/** Install a fetch mock that answers the lab envelopes. */
function mockLab(state: Record<string, unknown>, health = labHealthEnvelope()) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((input: unknown) => {
      const path =
        typeof input === "string"
          ? input
          : String((input as Request).url ?? input);
      const body = path.includes("/api/lab/state")
        ? state
        : path.includes("/api/lab/health")
          ? health
          : { ok: false, status: "not_configured", warnings: ["unexpected fetch"] };
      return Promise.resolve(
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
    })
  );
}

function labProviders() {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <MemoryRouter initialEntries={["/lab"]}>
        <CompanionProvider>
          <LiveRegionProvider>{children}</LiveRegionProvider>
        </CompanionProvider>
      </MemoryRouter>
    );
  };
}

beforeEach(() => {
  localStorage.setItem("pw_token", "test-token");
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

async function bootLab() {
  const { container } = render(<LabScreen />, { wrapper: labProviders() });
  await waitFor(() => {
    expect(document.querySelector("[data-pw-lab-table='operator-rows']")).not.toBeNull();
  });
  return container;
}

describe("Lab screen: real operator table (T13, parity row 3)", () => {
  it("renders rows from GET /api/lab/state — real data shape, no fake hosts", async () => {
    mockLab(labStateEnvelope());
    const container = await bootLab();
    const table = container.querySelector("table");
    expect(table).not.toBeNull();
    const rowNames = [...container.querySelectorAll("tr[data-pw-lab-row]")].map(
      (tr) => tr.getAttribute("data-pw-lab-row")
    );
    // Every row the packet carried, including the unrecognized one.
    expect(rowNames).toEqual([
      "urgent",
      "review",
      "safe",
      "unknown",
      "last_known_good",
      "next",
      "brand_new_row",
    ]);
    // No invented hosts or services anywhere in the rendered text.
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/192\.168\.|10\.0\.|\.local\b|host-\d/);
    expect(text).not.toMatch(/\/home\b|\/var\/|\/opt\b/);
  });

  it("shows the packet's own glance line (health counts, not invented)", async () => {
    mockLab(labStateEnvelope());
    await bootLab();
    expect(screen.getByText("3 services checked — all reported healthy")).toBeTruthy();
  });

  it("StatusChip per row, canonical statuses only", async () => {
    mockLab(labStateEnvelope());
    const container = await bootLab();
    const chips = [...container.querySelectorAll(".chip")];
    expect(chips.length).toBeGreaterThan(0);
    for (const chip of chips) {
      const status = chip.getAttribute("data-status");
      expect(status).not.toBeNull();
      expect(
        (CANONICAL_STATUSES as readonly string[]).includes(status as string)
      ).toBe(true);
    }
  });

  it("urgent row carries the healthy chip; staleness renders stale", async () => {
    mockLab(labStateEnvelope());
    const container = await bootLab();
    const urgent = container.querySelector("tr[data-pw-lab-row='urgent'] .chip");
    expect(urgent?.getAttribute("data-status")).toBe("healthy");
    // Unrecognized row: unknown, never a guessed state.
    const growth = container.querySelector(
      "tr[data-pw-lab-row='brand_new_row'] .chip"
    );
    expect(growth?.getAttribute("data-status")).toBe("unknown");
  });

  it("stale evidence renders the canonical stale chip", async () => {
    const stale = labStateEnvelope({
      status: "stale",
      data: {
        rows: packetRows().map((r) =>
          r.row === "urgent" ? { ...r, stale: true } : r
        ),
      },
    });
    mockLab(stale);
    const container = await bootLab();
    const urgent = container.querySelector("tr[data-pw-lab-row='urgent'] .chip");
    expect(urgent?.getAttribute("data-status")).toBe("stale");
    expect(screen.getByText("stale")).toBeTruthy();
  });

  it("per-row provenance behind Level-4 TechnicalDetails disclosure", async () => {
    mockLab(labStateEnvelope());
    const container = await bootLab();
    const details = [...container.querySelectorAll("details")];
    expect(details.length).toBe(1); // only rows with observations
    const d = details[0] as HTMLDetailsElement;
    expect(d.getAttribute("data-pw-disclosure-level")).toBe("4");
    const summary = d.querySelector("summary");
    expect(summary?.textContent).toContain("Technical details");
    // Provenance fields: provider, observed-at (latency slot), raw JSON.
    const text = d.textContent ?? "";
    expect(text).toContain("lab state (homelab Lab CLI)");
    expect(text).toContain("observed");
    expect(text).toContain('"detail"');
    // Glance truth stays outside the disclosure.
    expect(container.textContent).toContain("urgent");
    // Closed by default (progressive disclosure, not hidden truth).
    expect(d.hasAttribute("open")).toBe(false);
  });

  it("observation detail is visible in the provenance disclosure", async () => {
    mockLab(labStateEnvelope());
    const container = await bootLab();
    const d = container.querySelector("details") as HTMLDetailsElement;
    expect(d.textContent).toContain("d1");
  });

  it("axe: 0 violations over the real-table state (color-contrast off)", async () => {
    mockLab(labStateEnvelope());
    const container = await bootLab();
    expect(await axeNoContrast(container)).toHaveNoViolations();
  });
});

describe("Lab screen: honest degradation (T13)", () => {
  it("absent CLI → not_configured EmptyState naming PW_LAB_CLI with the backend's language", async () => {
    mockLab({ ok: false, status: "not_configured", data: { rows: [] } });
    const { container } = render(<LabScreen />, { wrapper: labProviders() });
    await waitFor(() => {
      expect(document.querySelector("[data-pw-state='empty']")).not.toBeNull();
    });
    expect(screen.getByText("not configured")).toBeTruthy();
    expect(screen.getByText("Lab watches the health of your homelab services.")).toBeTruthy();
    const knob = screen.getByText(/PW_LAB_CLI/);
    expect(knob.textContent).toContain("Lab provider not configured");
    expect(knob.textContent).toContain("lab command-line path");
    // No mount path leaks with the knob name.
    expect(container.textContent).not.toMatch(/\/home\b|\/var\/|\/opt\b|\/homelab\b/);
  });

  it("failing CLI → unavailable ErrorState with the server warning, no table", async () => {
    mockLab({
      ok: false,
      status: "unavailable",
      data: { rows: [], reason: "lab CLI unavailable or invalid output" },
      warnings: ["lab: could not fetch a valid lab-lowbw/1 packet"],
    });
    const { container } = render(<LabScreen />, { wrapper: labProviders() });
    await waitFor(() => {
      expect(document.querySelector("[data-pw-state='error']")).not.toBeNull();
    });
    // The server's own warning is the detail; no status chip is invented
    // here (ErrorState carries the failure in text, A11y §4.5).
    expect(
      screen.getByText(/could not fetch a valid lab-lowbw\/1 packet/)
    ).toBeTruthy();
    expect(container.querySelector("table")).toBeNull();
  });

  it("an envelope with no rows at all → honest unknown EmptyState, never a fake table", async () => {
    mockLab({ ok: true, data: null });
    const { container } = render(<LabScreen />, { wrapper: labProviders() });
    await waitFor(() => {
      expect(document.querySelector("[data-pw-lab='unknown']")).not.toBeNull();
    });
    expect(document.querySelector("[data-pw-state='empty']")).not.toBeNull();
    expect(screen.getByText("unknown")).toBeTruthy();
    expect(container.querySelector("table")).toBeNull();
  });

  it("network failure → ErrorState with retry, never fabricated rows", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("network down"))
    );
    const { container } = render(<LabScreen />, { wrapper: labProviders() });
    await waitFor(() => {
      expect(document.querySelector("[data-pw-state='error']")).not.toBeNull();
    });
    expect(container.querySelector("table")).toBeNull();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("axe: 0 violations in the not_configured state", async () => {
    mockLab({ ok: false, status: "not_configured", data: { rows: [] } });
    const { container } = render(<LabScreen />, { wrapper: labProviders() });
    await waitFor(() => {
      expect(document.querySelector("[data-pw-state='empty']")).not.toBeNull();
    });
    expect(await axeNoContrast(container)).toHaveNoViolations();
  });
});