import { render, type RenderOptions } from "@testing-library/react";
import { vi } from "vitest";
import type { ReactElement, ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { CompanionProvider } from "../lib/companion-context";
import { PrefsProvider } from "../lib/prefs-context";
import { LiveRegionProvider } from "../primitives/LiveRegion";

/**
 * T10 screen-test helpers: render a screen through the providers the
 * real app tree supplies (Companion, Prefs, LiveRegion) inside a
 * MemoryRouter, so useAnnounce/useStepUp/NavLink resolve exactly as in
 * the app (mirrors test/shell-helpers.tsx).
 */

export function screenProviders(
  ui: ReactElement,
  options: Omit<RenderOptions, "wrapper"> = {}
) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={["/"]}>
        <CompanionProvider>
          <PrefsProvider>
            <LiveRegionProvider>{children}</LiveRegionProvider>
          </PrefsProvider>
        </CompanionProvider>
      </MemoryRouter>
    );
  }
  return render(ui, { wrapper: Wrapper, ...options });
}

type FetchHandler = (path: string, init?: RequestInit) => Response | Promise<Response>;

/**
 * Route-based fetch mock keyed by path prefix. Unmatched paths fail
 * loudly (the screens must only call endpoints they declare).
 */
export function mockFetchByRoute(handlers: Record<string, FetchHandler>): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((input: unknown, init?: RequestInit) => {
      const path =
        typeof input === "string"
          ? input
          : String((input as Request).url ?? input);
      for (const prefix of Object.keys(handlers)) {
        if (path === prefix || path.startsWith(prefix)) {
          return Promise.resolve(handlers[prefix](path, init));
        }
      }
      return Promise.reject(new Error(`mockFetchByRoute: no handler for ${path}`));
    })
  );
}

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function okEnvelope(data: unknown, extra: Record<string, unknown> = {}): Response {
  return jsonResponse(200, { ok: true, status: "healthy", data, ...extra });
}

/** Canonical API payload fixtures, shaped exactly as api.py returns them. */
export const CAPABILITIES_FIXTURE = {
  source_control: {
    ok: true,
    status: "healthy",
    warnings: [],
    last_observed: "2026-09-11T05:00:00Z",
  },
  media: {
    ok: false,
    status: "not_configured",
    warnings: [],
    last_observed: "2026-09-11T05:00:00Z",
  },
  reasoning: {
    ok: false,
    status: "unavailable",
    warnings: ["no reasoning provider answered"],
    last_observed: "2026-09-11T05:00:00Z",
  },
};

export const JOURNAL_ENTRY_FIXTURE = {
  ts: "2026-09-11T04:12:00Z",
  kind: "observation",
  summary: "capability source_control: healthy",
  provenance: {
    source: "daily-loop",
    observed_at: "2026-09-11T04:12:00Z",
    provider: "registry",
    authority: "observed",
  },
  classification: "private",
};