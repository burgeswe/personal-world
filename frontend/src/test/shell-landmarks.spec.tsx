import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { MemoryRouter } from "react-router-dom";
import { AppShell } from "../shell/AppShell";
import { ErrorState } from "../shell/ErrorState";
import { EmptyState } from "../shell/EmptyState";
import { shellProviders } from "./shell-helpers";

/**
 * T9 landmarks/skip-link/h1 spec (A11y §2.6, §4.2, §5.1; FOUNDATION-SPEC
 * §5 shell components).
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
    const { container } = render(
      <MemoryRouter initialEntries={["/"]}>{withRoute(<h1>Today</h1>)}</MemoryRouter>
    );
    const focusables = container.querySelectorAll(
      "a[href], button, [tabindex], input, select, textarea"
    );
    expect(focusables[0]?.getAttribute("href")).toBe("#main-content");
    expect(focusables[0]?.textContent).toBe("Skip to main content");
  });

  it("renders header, nav[aria-label=Main], main#main-content landmarks", () => {
    render(<MemoryRouter initialEntries={["/"]}>{withRoute(<h1>Today</h1>)}</MemoryRouter>);
    expect(screen.getByRole("banner")).toBeTruthy(); // <header>
    expect(screen.getAllByRole("navigation").length).toBeGreaterThan(0);
    const mains = screen.getAllByRole("main");
    expect(mains.length).toBe(1);
    expect(mains[0].id).toBe("main-content");
  });

  it("every nav landmark is labelled Main", () => {
    render(<MemoryRouter initialEntries={["/"]}>{withRoute(<h1>Today</h1>)}</MemoryRouter>);
    for (const nav of screen.getAllByRole("navigation")) {
      expect(nav.getAttribute("aria-label")).toBe("Main");
    }
  });

  it("renders exactly one Main nav in the current viewport bucket", () => {
    // The bucket is mirrored from CSS breakpoints; exactly one nav
    // landmark exists per bucket (landmark-unique). jsdom (no
    // matchMedia) is the rail bucket.
    const { container } = render(
      <MemoryRouter initialEntries={["/"]}>{withRoute(<h1>Today</h1>)}</MemoryRouter>
    );
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
    render(<MemoryRouter initialEntries={["/"]}>{withRoute(<h1>Today</h1>)}</MemoryRouter>);
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
    const { container } = render(
      <MemoryRouter initialEntries={["/"]}>{withRoute(<h1>Today</h1>)}</MemoryRouter>
    );
    const navs = screen.getAllByRole("navigation");
    expect(navs.length).toBe(1);
    expect(navs[0].className).toContain("pw-banner-nav");
    expect((container.querySelector(".pw-header") as HTMLElement).contains(navs[0])).toBe(true);
  });

  it("has exactly one h1 with the route content and axe-clean shell", async () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/"]}>{withRoute(<h1>Today</h1>)}</MemoryRouter>
    );
    const h1s = container.querySelectorAll("h1");
    expect(h1s.length).toBe(1);
    expect(h1s[0].textContent).toBe("Today");
    expect(
      await axe(container, { rules: { "color-contrast": { enabled: false } } } as never)
    ).toHaveNoViolations();
  });

  it("skip link href target #main-content exists in the DOM", () => {
    render(<MemoryRouter initialEntries={["/"]}>{withRoute(<h1>Today</h1>)}</MemoryRouter>);
    expect(document.getElementById("main-content")).not.toBeNull();
  });

  it("provides the Drawer mount point (future World Assistant, T12)", () => {
    render(<MemoryRouter initialEntries={["/"]}>{withRoute(<h1>Today</h1>)}</MemoryRouter>);
    const mount = document.getElementById("pw-drawer-mount");
    expect(mount).not.toBeNull();
    expect(mount?.getAttribute("data-pw-drawer-mount")).toBe("world-assistant");
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