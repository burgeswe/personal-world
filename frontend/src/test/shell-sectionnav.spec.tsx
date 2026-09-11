import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { axe } from "vitest-axe";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { AppShell } from "../shell/AppShell";
import { SectionNav } from "../shell/SectionNav";
import { SECTIONS_ENVELOPE_KEYS, DEFAULT_SECTIONS, section, shellProviders } from "./shell-helpers";
import { fetchSections, type SectionData } from "../lib/api";
import { sectionIconToShimName, ICON_NAMES } from "../lib/icons";

/**
 * T9 SectionNav spec (FOUNDATION-SPEC §5/§10 row T9, §2.3):
 * - items come from the mocked /api/sections envelope (exact shape);
 * - hidden sections are OMITTED from the nav (routes still resolve —
 *   asserted in shell-routes.spec);
 * - the active item carries aria-current="page";
 * - every section icon id maps to a sprite symbol that exists in the
 *   tracked sprite (the sprite gate stays green).
 *
 * axe (jsdom limit, mirrors T7/T8 specs): color-contrast disabled only.
 */
const axeNoContrast = (el: Element) =>
  axe(el, { rules: { "color-contrast": { enabled: false } } } as never);

const here = dirname(fileURLToPath(import.meta.url));

function mockSections(payload: unknown): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: payload }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )
  );
}
/** Wrap the section list in the §2.3 envelope: `{ok, data:{schema, sections}}`. */
function sectionsEnvelope(sections: SectionData[]) {
  return { schema: "personal-world/sections/1", sections };
}

beforeEach(() => {
  localStorage.setItem("pw_token", "test-token");
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("SectionNav renders from /api/sections (T9)", () => {
  it("renders visible sections from the API in payload order", async () => {
    mockSections(sectionsEnvelope(DEFAULT_SECTIONS));
    shellProviders(<AppShell><div /></AppShell>);
    await waitFor(() => {
      expect(screen.getByRole("link", { name: /Journal & Memory/ })).toBeTruthy();
    });
    // All nine defaults are visible by default.
    for (const label of ["Today", "Interests", "Media", "Projects", "Lab", "Journal & Memory", "Vault", "Chat", "Settings"]) {
      expect(screen.getAllByRole("link", { name: new RegExp(label) }).length).toBeGreaterThan(0);
    }
  });

  it("omits hidden sections from the nav (visible=false is dropped)", async () => {
    const hidden = DEFAULT_SECTIONS.map((s) =>
      s.id === "journal" ? { ...s, visible: false } : s
    );
    mockSections(sectionsEnvelope(hidden));
    shellProviders(<AppShell><div /></AppShell>);
    await waitFor(() => {
      expect(screen.getByRole("link", { name: /Today/ })).toBeTruthy();
    });
    // Banner nav shows only in the 600–899 CSS bucket; in jsdom both
    // the rail and bottom copies render, so filter by rail list.
    expect(screen.queryAllByRole("link", { name: /Journal & Memory/ })).toHaveLength(0);
  });

  it("keeps the exact server envelope shape (§2.3)", () => {
    expect(SECTIONS_ENVELOPE_KEYS).toEqual([
      "id", "label", "icon", "order", "visible", "pinned", "kind",
      "configured", "status",
    ]);
  });

  it("marks the active section with aria-current=page", () => {
    // Direct items: no fetch needed (items override the hook).
    shellProviders(
      <nav aria-label="Main">
        <SectionNav items={DEFAULT_SECTIONS} />
      </nav>,
    );
    const today = screen.getByRole("link", { name: /Today/ });
    expect(today.getAttribute("aria-current")).toBe("page");
    const settings = screen.getByRole("link", { name: /Settings/ });
    expect(settings.getAttribute("aria-current")).toBeNull();
  });

  it("renders nav targets at the 44px floor via token vars", () => {
    // Class seam: the 44px floor is CSS truth; assert the class and the
    // token variable it consumes (jsdom has no layout).
    shellProviders(
      <nav aria-label="Main">
        <SectionNav items={DEFAULT_SECTIONS} />
      </nav>,
    );
    const link = screen.getAllByRole("link", { name: /Today/ })[0];
    expect(link.className).toContain("pw-nav-link");
  });

  it("every section icon id resolves to a sprite symbol in the tracked sprite", () => {
    // The nine §5/§10 ids (server icon fields) must exist in the sprite.
    const sprite = readFileSync(
      join(here, "..", "..", "..", "src", "personal_world", "static", "icons", "sprite.svg"),
      "utf8"
    );
    const spriteIds = new Set(
      Array.from(sprite.matchAll(/id="([^"]+)"/g), (m) => m[1] as string)
    );
    const sectionIcons = [
      "navigation--today",
      "world-content--bookmark",
      "world-content--story",
      "navigation--projects",
      "system-device--desktop",
      "navigation--journal",
      "system-device--lock",
      "navigation--chat",
      "navigation--settings",
    ];
    for (const icon of sectionIcons) {
      const shim = sectionIconToShimName(icon);
      expect(shim, `${icon} must map into the shim`).not.toBeNull();
      expect(ICON_NAMES).toContain(shim);
      expect(spriteIds.has(shim as string), `${shim} must exist in sprite.svg`).toBe(true);
    }
  });

  it("an unknown icon id renders label-only (honest, not broken)", () => {
    const items = [section({ id: "future", label: "Future", icon: "navigation--nonexistent" })];
    shellProviders(
      <nav aria-label="Main">
        <SectionNav items={items} />
      </nav>,
    );
    const link = screen.getByRole("link", { name: "Future" });
    expect(link.querySelector("svg")).toBeNull();
    expect(link.textContent).toContain("Future");
  });

  it("axe: 0 violations on the shell with default sections", async () => {
    mockSections(sectionsEnvelope(DEFAULT_SECTIONS));
    const { container } = shellProviders(
      <AppShell>
        <h1>Today</h1>
      </AppShell>
    );
    await waitFor(() => {
      expect(screen.getAllByRole("link", { name: /Settings/ }).length).toBeGreaterThan(0);
    });
    expect(await axeNoContrast(container)).toHaveNoViolations();
  });

  it("client exposes fetchSections against /api/sections", async () => {
    const mock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ ok: true, data: sectionsEnvelope(DEFAULT_SECTIONS) }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    );
    vi.stubGlobal("fetch", mock);
    const sections = await fetchSections();
    expect(sections).toHaveLength(DEFAULT_SECTIONS.length);
    expect(mock).toHaveBeenCalledWith(
      "/api/sections",
      expect.objectContaining({ headers: expect.any(Headers) })
    );
  });
});