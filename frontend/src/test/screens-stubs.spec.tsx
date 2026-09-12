import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { MemoryRouter } from "react-router-dom";
import { CompanionProvider } from "../lib/companion-context";
import { LiveRegionProvider } from "../primitives/LiveRegion";
import InterestsScreen from "../screens/InterestsScreen";
import MediaScreen from "../screens/MediaScreen";
import ProjectsScreen from "../screens/ProjectsScreen";

/**
 * T13 section-stub spec (FOUNDATION-SPEC §10 row T13): Interests / Media
 * / Projects are honest EmptyStates naming the capability and the
 * configuration knob — no fabricated content, no demo lists, and never
 * a mount path (plan C-2; EmptyState contract in shell/EmptyState.tsx).
 *
 * Interests/Media fetch nothing. Projects now fetches real repo
 * status (Projects workspace v1); its test mocks the honest
 * not_configured envelope a zero-provider deployment answers.
 * Providers are mounted to mirror the real tree shape.
 */

const axeNoContrast = (el: Element) =>
  axe(el, { rules: { "color-contrast": { enabled: false } } } as never);

/** Mount a screen exactly as App does (bare inside providers). */
function stubProviders(ui: React.ReactElement) {
  return (
    <MemoryRouter initialEntries={["/"]}>
      <CompanionProvider>
        <LiveRegionProvider>{ui}</LiveRegionProvider>
      </CompanionProvider>
    </MemoryRouter>
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("section stubs: honest EmptyStates (T13)", () => {
  it("Interests names the discovery capability and the Settings knob", () => {
    render(stubProviders(<InterestsScreen />));
    expect(screen.getByRole("heading", { name: "Interests" })).toBeTruthy();
    expect(
      screen.getByText(
        "Interests collect things you care about and find more like them."
      )
    ).toBeTruthy();
    expect(
      screen.getByText(
        /discovery connection in Settings → Connections/
      )
    ).toBeTruthy();
    expect(screen.getByText("not configured")).toBeTruthy();
  });

  it("Media names the media capability and the Settings knob", () => {
    render(stubProviders(<MediaScreen />));
    expect(screen.getByRole("heading", { name: "Media" })).toBeTruthy();
    expect(
      screen.getByText("Media gathers your stories, bookmarks, and saved reading.")
    ).toBeTruthy();
    expect(
      screen.getByText(/media connection in Settings → Connections/)
    ).toBeTruthy();
    expect(screen.getByText("not configured")).toBeTruthy();
  });

  it("Projects names the source_control capability and its knob", async () => {
    // The screen fetches real repo status now (Projects workspace v1);
    // a zero-provider deployment answers the honest not_configured
    // envelope, which must render the same EmptyState + knob as before.
    const fetchMock = vi.fn().mockImplementation((input: unknown) => {
      const path = typeof input === "string" ? input : String(input);
      if (path.includes("/api/source-control/status")) {
        return Promise.resolve(
          new Response(JSON.stringify({
            ok: false,
            status: "not_configured",
            warnings: ["no source_control search paths configured"],
          }), { status: 200, headers: { "Content-Type": "application/json" } })
        );
      }
      return Promise.resolve(new Response(JSON.stringify({ ok: true, data: null }), { headers: { "Content-Type": "application/json" } }));
    });
    vi.stubGlobal("fetch", fetchMock);
    render(stubProviders(<ProjectsScreen />));
    expect(
      await screen.findByText("Projects follow your repositories and their recent activity.")
    ).toBeTruthy();
    expect(
      screen.getByText(/repository locations under Source Control in Settings/)
    ).toBeTruthy();
    // No capability dependency: no chip rather than an invented status.
    expect(document.querySelector(".chip")).toBeNull();
  });

  it("no fabricated content: no lists or demo rows in any stub", () => {
    for (const ui of [
      <InterestsScreen key="i" />,
      <MediaScreen key="m" />,
    ]) {
      const { container, unmount } = render(stubProviders(ui));
      expect(container.querySelectorAll("ul, ol, table")).toHaveLength(0);
      unmount();
    }
  });

  it("no mount paths anywhere in the rendered text (plan C-2)", () => {
    for (const ui of [
      <InterestsScreen key="i" />,
      <MediaScreen key="m" />,
      <ProjectsScreen key="p" />,
    ]) {
      const { container, unmount } = render(stubProviders(ui));
      const text = container.textContent ?? "";
      expect(text).not.toMatch(/\/home\b/);
      expect(text).not.toMatch(/\/var\//);
      expect(text).not.toMatch(/\/opt\b/);
      expect(text).not.toMatch(/\/config\b/);
      unmount();
    }
  });

  it("copy carries no implementation-internal names (env, modules, files)", () => {
    for (const ui of [
      <InterestsScreen key="i" />,
      <MediaScreen key="m" />,
      <ProjectsScreen key="p" />,
    ]) {
      const { container, unmount } = render(stubProviders(ui));
      const text = container.textContent ?? "";
      // The three stubs name human knobs only — no env vars, no file
      // names, no code module names.
      expect(text).not.toMatch(/\b[A-Z][A-Z0-9_]{2,}\b/);
      expect(text).not.toMatch(/connections\.json|\.env|provider_type/);
      unmount();
    }
  });

  it("statuses are canonical only (chip vocabulary from status.py)", () => {
    for (const ui of [
      <InterestsScreen key="i" />,
      <MediaScreen key="m" />,
    ]) {
      const { container, unmount } = render(stubProviders(ui));
      const chip = container.querySelector(".chip") as HTMLElement | null;
      expect(chip).not.toBeNull();
      expect(chip?.getAttribute("data-status")).toBe("not_configured");
      unmount();
    }
  });

  it("axe: 0 violations (color-contrast off, jsdom limit)", async () => {
    const { container } = render(stubProviders(<InterestsScreen />));
    expect(await axeNoContrast(container)).toHaveNoViolations();
  });

  it("axe: 0 violations for Media and Projects", async () => {
    for (const ui of [
      <MediaScreen key="m" />,
      <ProjectsScreen key="p" />,
    ]) {
      const { container, unmount } = render(stubProviders(ui));
      expect(await axeNoContrast(container)).toHaveNoViolations();
      unmount();
    }
  });
});