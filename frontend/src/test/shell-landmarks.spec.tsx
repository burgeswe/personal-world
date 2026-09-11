import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { axe } from "vitest-axe";
import { AppShell } from "../shell/AppShell";
import { ErrorState } from "../shell/ErrorState";
import { EmptyState } from "../shell/EmptyState";
import { ASSISTANT_TRIGGER_LABEL } from "../primitives/CompanionSlot";
import { shellProviders } from "./shell-helpers";

/**
 * T9 landmarks/skip-link/h1 spec (A11y §2.6, §4.2, §5.1; FOUNDATION-SPEC
 * §5 shell components). AppShell renders through shellProviders (the
 * real app tree: Companion/Prefs/LiveRegion) because the shell now
 * hosts the World Assistant ChatPanel, which requires the app-level
 * live region (A11y §8: one region for the whole tree).
 */

const axeNoContrast = (el: Element) =>
  axe(el, { rules: { "color-contrast": { enabled: false } } } as never);

afterEach(() => {
  vi.unstubAllGlobals();
});

function withRoute(children: React.ReactNode) {
  // AppShell owns <main id="main-content">; route content renders bare.
  return <AppShell>{children}</AppShell>;
}

describe("AppShell landmarks and structure (T9)", () => {
  it("renders skip link as the first focusable element", () => {
    const { container } = shellProviders(withRoute(<h1>Today</h1>));
    const focusables = container.querySelectorAll(
      "a[href], button, [tabindex], input, select, textarea"
    );
    expect(focusables[0]?.getAttribute("href")).toBe("#main-content");
    expect(focusables[0]?.textContent).toBe("Skip to main content");
  });

  it("renders header, nav[aria-label=Main], main#main-content landmarks", () => {
    shellProviders(withRoute(<h1>Today</h1>));
    expect(screen.getByRole("banner")).toBeTruthy(); // <header>
    expect(screen.getAllByRole("navigation").length).toBeGreaterThan(0);
    const mains = screen.getAllByRole("main");
    expect(mains.length).toBe(1);
    expect(mains[0].id).toBe("main-content");
  });

  it("every nav landmark is labelled Main", () => {
    shellProviders(withRoute(<h1>Today</h1>));
    for (const nav of screen.getAllByRole("navigation")) {
      expect(nav.getAttribute("aria-label")).toBe("Main");
    }
  });

  it("renders exactly one Main nav in the current viewport bucket", () => {
    // The bucket is mirrored from CSS breakpoints; exactly one nav
    // landmark exists per bucket (landmark-unique). jsdom (no
    // matchMedia) is the rail bucket.
    const { container } = shellProviders(withRoute(<h1>Today</h1>));
    const shell = container.querySelector(".pw-shell") as HTMLElement;
    expect(shell.getAttribute("data-pw-nav")).toBe("rail");
    const navs = screen.getAllByRole("navigation");
    expect(navs.length).toBe(1);
    expect(navs[0].className).toContain("pw-rail");
    expect(navs[0].getAttribute("aria-label")).toBe("Main");
    // banner nav not rendered in rail bucket; bottom bar not rendered
    expect(shell.querySelector(".pw-banner-nav")).toBeNull();
    expect(shell.querySelector(".pw-bottom-bar")).toBeNull();
  });

  it("SEAM: bottom bucket renders the bottom bar nav (matchMedia stub = CSS truth)", () => {
    // Stub exactly the CSS contract: <600px. The shell then renders the
    // bottom-bar slot only.
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: query === "(max-width: 599px)",
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    );
    shellProviders(withRoute(<h1>Today</h1>));
    const navs = screen.getAllByRole("navigation");
    expect(navs.length).toBe(1);
    expect(navs[0].className).toContain("pw-bottom-bar");
  });

  it("SEAM: banner bucket renders the banner nav in the header", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: query === "(min-width: 600px) and (max-width: 899px)",
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    );
    const { container } = shellProviders(withRoute(<h1>Today</h1>));
    const navs = screen.getAllByRole("navigation");
    expect(navs.length).toBe(1);
    expect(navs[0].className).toContain("pw-banner-nav");
    expect((container.querySelector(".pw-header") as HTMLElement).contains(navs[0])).toBe(true);
  });

  it("has exactly one h1 with the route content and axe-clean shell", async () => {
    const { container } = shellProviders(withRoute(<h1>Today</h1>));
    const h1s = container.querySelectorAll("h1");
    expect(h1s.length).toBe(1);
    expect(h1s[0].textContent).toBe("Today");
    expect(
      await axe(container, { rules: { "color-contrast": { enabled: false } } } as never)
    ).toHaveNoViolations();
  });

  it("skip link href target #main-content exists in the DOM", () => {
    shellProviders(withRoute(<h1>Today</h1>));
    expect(document.getElementById("main-content")).not.toBeNull();
  });

  it("hosts the World Assistant: the Drawer mount became the real Drawer", async () => {
    // T14 human gate 5: the T9 placeholder mount (#pw-drawer-mount) is
    // replaced by the shell-hosted Drawer (complementary landmark) with
    // heading "World Assistant" and the ChatPanel inside.
    const { container } = shellProviders(withRoute(<h1>Today</h1>));
    expect(document.getElementById("pw-drawer-mount")).toBeNull();
    await waitFor(() => {
      expect(container.querySelector("aside[role='complementary']")).not.toBeNull();
    });
    const heading = container.querySelector("aside h2");
    expect(heading?.textContent).toBe("World Assistant");
    expect(container.querySelector("[data-pw-chat]")).not.toBeNull();
  });

  it("assistant trigger opens the Drawer; Escape closes; focus returns; axe-clean while open", async () => {
    // A11y §3.2 desktop: non-modal drawer — focus moves in, Escape
    // closes, focus returns to the trigger, background stays
    // interactive; companion artwork is aria-hidden (§7.2/7.3).
    const { container } = shellProviders(withRoute(<h1>Today</h1>));
    const trigger = await waitFor(() => {
      const el = screen.getByRole("button", { name: ASSISTANT_TRIGGER_LABEL });
      expect(el).toBeTruthy();
      return el;
    });
    // companion artwork present and aria-hidden, trigger outside it
    const artwork = container.querySelector(".pw-header [data-pw-companion-slot] > span[aria-hidden='true']");
    expect(artwork).not.toBeNull();
    expect(artwork?.querySelector("img")?.getAttribute("alt")).toBe("");
    expect(artwork?.contains(trigger as Node)).toBe(false);

    // A real click focuses the button; jsdom's fireEvent does not, so
    // set it explicitly (the Drawer restores focus to its invoker).
    trigger.focus();
    fireEvent.click(trigger);
    const heading = await waitFor(() => {
      const el = container.querySelector("aside h2");
      expect(el).toBeTruthy();
      return el as HTMLElement;
    });
    expect(heading.textContent).toBe("World Assistant");
    expect(await axeNoContrast(container)).toHaveNoViolations();

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => {
      expect(container.querySelector("aside")?.className).toContain("hidden");
    });
    expect(document.activeElement).toBe(trigger);
  });
});

describe("EmptyState honest copy (T9, §5)", () => {
  it("names the capability and the knob, never a mount path", () => {
    render(
      <EmptyState
        title="Interests"
        capability="Interests collect things you care about and find more like them."
        knob="Turn on a discovery connection in Settings → Connections to populate this section."
        status="not_configured"
      />
    );
    expect(screen.getByText(/discovery connection in Settings/)).toBeTruthy();
    const text = document.body.textContent ?? "";
    // No mount paths / internals in the person-facing copy.
    expect(text).not.toMatch(/(^|\s)\/[a-z-]+\/[A-Za-z_]/);
    expect(text).not.toMatch(/\.tsx|src\/|mount|PW_[A-Z_]+/);
  });

  it("renders the companion comfort presence at the Empty-State 64px scale, aria-hidden", () => {
    // T14 human gate 4: error/empty comfort is the companion contract's
    // #1 use (COMPANION_INTEGRATION "Empty State (64px)"); artwork is
    // aria-hidden with alt="" (A11y §7.1/7.2) and carries no info.
    const { container } = render(<EmptyState title="Lab" capability="c" knob="k" />);
    const artwork = container.querySelector(".pw-state [data-pw-companion-slot] > span[aria-hidden='true']");
    expect(artwork).not.toBeNull();
    const img = artwork?.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("alt")).toBe("");
    expect(Number(img?.getAttribute("width"))).toBe(64);
    expect(Number(img?.getAttribute("height"))).toBe(64);
    // no trigger, nothing focusable, no announcement machinery
    expect(container.querySelector("button")).toBeNull();
    expect(container.querySelector("[role='status'],[aria-live]")).toBeNull();
  });

  it("empty-state companion is a plain decorative slot: no trigger, nothing focusable", () => {
    // Companion "off" behavior is the CompanionSlot primitive's own
    // contract (primitives-companionslot.spec): part (a) disappears,
    // part (b) — not rendered here — is unaffected.
    const { container } = render(<EmptyState title="Lab" capability="c" knob="k" />);
    const slot = container.querySelector("[data-pw-companion-slot]");
    expect(slot).not.toBeNull();
    expect(slot?.querySelector("button")).toBeNull();
    expect(slot?.getAttribute("tabindex")).toBeNull();
  });

  it("renders the canonical status chip when a status exists", () => {
    render(<EmptyState title="Lab" capability="c" knob="k" status="not_configured" />);
    expect(screen.getByText("not configured")).toBeTruthy();
  });

  it("renders no chip when status is null (no invented status)", () => {
    const { container } = render(<EmptyState title="Projects" capability="c" knob="k" />);
    expect(container.querySelector(".chip")).toBeNull();
  });

  it("axe: 0 violations", async () => {
    const { container } = render(
      <EmptyState
        title="Media"
        capability="Media gathers your stories and saved reading."
        knob="Add a media connection in Settings → Connections."
        status="not_configured"
      />
    );
    expect(await axeNoContrast(container)).toHaveNoViolations();
  });
});

describe("ErrorState honest copy (T9, A11y §4.5)", () => {
  it("names what failed AND what still works", () => {
    render(
      <ErrorState title="Today" failed="could not load your journal" />
    );
    expect(screen.getByText(/could not load your journal/)).toBeTruthy();
    expect(screen.getByText(/rest of your world still works/)).toBeTruthy();
  });

  it("shows server detail when present (never fabricated)", () => {
    render(
      <ErrorState title="Today" failed="could not load your journal" detail="server said no" />
    );
    expect(screen.getByText("server said no")).toBeTruthy();
  });

  it("offers retry that invokes the callback", () => {
    let clicked = 0;
    render(
      <ErrorState title="Today" failed="failed" onRetry={() => { clicked += 1; }} />
    );
    screen.getByRole("button", { name: "Try again" }).click();
    expect(clicked).toBe(1);
  });

  it("axe: 0 violations", async () => {
    const { container } = render(
      <ErrorState title="Journal" failed="could not load entries" onRetry={() => {}} />
    );
    expect(await axeNoContrast(container)).toHaveNoViolations();
  });
});

describe("shell providers (T9 wiring)", () => {
  it("renders the app-level live region exactly once", () => {
    const { container } = shellProviders(<div />);
    expect(container.querySelectorAll("[data-pw-live-region]")).toHaveLength(1);
  });
});