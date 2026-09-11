import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { axe } from "vitest-axe";
import App from "../App";
import { DEFAULT_SECTIONS } from "./shell-helpers";

/**
 * T9 routes spec (FOUNDATION-SPEC §5/§10 row T9): hidden sections are
 * omitted from nav but their ROUTES STILL RESOLVE — a direct URL to a
 * hidden section renders honestly (EmptyState), never a 404.
 *
 * jsdom honesty: this suite mounts the real App tree with a real
 * fetch mock; the prefs bootstrap runs inside jsdom (no paint), and
 * the "before content" property is asserted as structural order
 * (attrs present on documentElement once content is mounted).
 */
const axeNoContrast = (el: Element) =>
  axe(el, { rules: { "color-contrast": { enabled: false } } } as never);

function mockApi(): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((input: unknown) => {
      const path =
        typeof input === "string"
          ? input
          : String((input as Request).url ?? input);
      if (path.startsWith("/api/sections")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ok: true,
              data: {
                schema: "personal-world/sections/1",
                sections: DEFAULT_SECTIONS.map((s) =>
                  s.id === "lab" ? { ...s, visible: false } : s
                ),
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        );
      }
      if (path.startsWith("/api/prefs")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ok: true,
              data: {
                motion: "reduced",
                contrast: "comfortable",
                density: "comfortable",
                text_scale: 1,
                target_size: 44,
                companion: "personal-world",
                accent: "world-keeper",
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        );
      }
      // Everything the prototype screens fetch: an honest null payload
      // (screens render their own empty/error states; T10+ redesigns).
      return Promise.resolve(
        new Response(JSON.stringify({ ok: true, data: null }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
    })
  );
}

beforeEach(() => {
  localStorage.setItem("pw_token", "test-token");
  mockApi();
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  document.documentElement.removeAttribute("data-pw-motion");
  document.documentElement.removeAttribute("data-pw-theme");
});

async function boot() {
  const { container } = render(<App />);
  await waitFor(
    () => {
      expect(document.getElementById("main-content")).not.toBeNull();
    },
    { timeout: 4000 }
  );
  return container;
}

describe("routes render with App shell (T9)", () => {
  it("mounts the shell: landmarks, nav from API, live region, drawer mount", async () => {
    const container = await boot();
    expect(screen.getAllByRole("navigation").every((n) => n.getAttribute("aria-label") === "Main")).toBe(true);
    expect(container.querySelectorAll("[data-pw-live-region]")).toHaveLength(1);
    expect(document.getElementById("pw-drawer-mount")).not.toBeNull();
    // prefs attrs applied before content (structural: attrs exist on
    // documentElement now that content is mounted)
    expect(document.documentElement.getAttribute("data-pw-motion")).toBe("reduced");
    expect(document.documentElement.getAttribute("data-pw-theme")).toBe("dark");
  });

  it("stub routes render honest EmptyStates naming capability + knob", async () => {
    const cases = [
      ["/interests", /discovery connection in Settings/],
      ["/media", /media connection in Settings/],
      ["/projects", /repository locations under Source Control/],
      ["/lab", /lab command-line path/],
    ] as const;
    for (const [path, copy] of cases) {
      window.history.pushState({}, "", path);
      const { unmount } = render(<App />);
      await waitFor(
        () => {
          expect(document.getElementById("main-content")).not.toBeNull();
        },
        { timeout: 4000 }
      );
      expect(screen.getByText(copy)).toBeTruthy();
      unmount();
    }
    window.history.pushState({}, "", "/");
  });

  it("direct URL to a HIDDEN section still resolves (Lab hidden → still renders)", async () => {
    window.history.pushState({}, "", "/lab");
    const container = await boot();
    expect(container.querySelector("[data-pw-state]")).not.toBeNull();
    expect(await axeNoContrast(container)).toHaveNoViolations();
    window.history.pushState({}, "", "/");
  });

  it("axe: 0 violations over the default route", async () => {
    const container = await boot();
    expect(await axeNoContrast(container)).toHaveNoViolations();
  });
});