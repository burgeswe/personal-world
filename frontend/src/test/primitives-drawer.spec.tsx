import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { axe } from "vitest-axe";
import { Drawer, preferSheetViewport } from "../primitives/Drawer";

/**
 * axe rule disable (jsdom limit only — mirrors T7 specs):
 * color-contrast cannot evaluate without real rendered layout.
 */
const axeNoContrast = (el: Element) =>
  axe(el, { rules: { "color-contrast": { enabled: false } } } as never);

/**
 * T8 Drawer spec (FOUNDATION-SPEC §5 Drawer row, A11y §3.1/3.2/3.4/3.5).
 *
 * jsdom honesty (same limits as T7, stated up front):
 * - jsdom has NO matchMedia, so the desktop NON-MODAL path is the one
 *   under test; the <600px modal-sheet path is reached through the
 *   `data-pw-drawer-sheet` seam with matchMedia stubbed (the stub is
 *   exactly the contract the real CSS @media query encodes).
 * - jsdom has no layout, so `hidden` attribute + class toggling is the
 *   visibility truth (no getComputedStyle geometry).
 * - Focus trap impossibility on desktop is asserted POSITIVELY:
 *   background controls stay focusable/clickable while open.
 */

afterEach(() => {
  vi.unstubAllGlobals();
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
});

describe("Drawer (T8)", () => {
  it("renders a non-modal aside role=complementary, labelled by its heading", async () => {
    const { container } = render(
      <Drawer open title="Provenance" side="right" onClose={() => {}}>
        <p>Observed by lab-health, 120ms.</p>
      </Drawer>
    );
    const aside = container.querySelector("aside");
    expect(aside).not.toBeNull();
    expect(aside?.getAttribute("role")).toBe("complementary");
    const headingId = aside?.getAttribute("aria-labelledby");
    expect(headingId).toBeTruthy();
    const heading = document.getElementById(headingId as string);
    expect(heading?.textContent).toBe("Provenance");
    expect(heading?.tagName).toBe("H2");
    expect(await axeNoContrast(container)).toHaveNoViolations();
  });

  it("on open, focus moves to the drawer heading", () => {
    const { container, rerender } = render(
      <Drawer open={false} title="World Assistant" side="right" onClose={() => {}}>
        <p>chat</p>
      </Drawer>
    );
    rerender(
      <Drawer open title="World Assistant" side="right" onClose={() => {}}>
        <p>chat</p>
      </Drawer>
    );
    const headingId = container
      .querySelector("aside")
      ?.getAttribute("aria-labelledby");
    expect(document.activeElement?.id).toBe(headingId);
  });

  it("Escape closes and focus returns to the trigger", () => {
    const onClose = vi.fn();
    const trigger = document.createElement("button");
    trigger.textContent = "Show provenance";
    document.body.appendChild(trigger);
    trigger.focus();

    const { container, rerender } = render(
      <Drawer open={false} title="Provenance" side="right" onClose={onClose}>
        <p>x</p>
      </Drawer>
    );
    rerender(
      <Drawer open title="Provenance" side="right" onClose={onClose}>
        <p>x</p>
      </Drawer>
    );
    const headingId = container
      .querySelector("aside")
      ?.getAttribute("aria-labelledby");
    expect(document.activeElement?.id).toBe(headingId);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(
      <Drawer open={false} title="Provenance" side="right" onClose={onClose}>
        <p>x</p>
      </Drawer>
    );
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it("background stays interactive while open — NO focus trap (A11y §3.1)", () => {
    const { container } = render(
      <>
        <button type="button">Background control</button>
        <Drawer open title="Provenance" side="right" onClose={() => {}}>
          <p>x</p>
        </Drawer>
      </>
    );
    const background = screen.getByRole("button", { name: "Background control" });
    // focusable
    background.focus();
    expect(document.activeElement).toBe(background);
    // clickable
    let clicked = 0;
    background.addEventListener("click", () => (clicked += 1));
    fireEvent.click(background);
    expect(clicked).toBe(1);
    // no trap machinery on the aside
    const aside = container.querySelector("aside");
    expect(aside?.hasAttribute("inert")).toBe(false);
    expect(container.querySelector("dialog")).toBeNull();
  });

  it("content refresh while open does NOT steal focus (A11y §3.4)", () => {
    const { rerender } = render(
      <Drawer open title="Provenance" side="right" onClose={() => {}}>
        <p>first payload</p>
      </Drawer>
    );
    const heading = document.querySelector("aside h2") as HTMLElement;
    expect(document.activeElement).toBe(heading);

    // move focus to a background control (user is working elsewhere)
    const elsewhere = document.createElement("button");
    elsewhere.textContent = "elsewhere";
    document.body.appendChild(elsewhere);
    elsewhere.focus();
    expect(document.activeElement).toBe(elsewhere);

    // refresh drawer content (children swap, open stays true)
    rerender(
      <Drawer open title="Provenance" side="right" onClose={() => {}}>
        <p>refreshed payload</p>
      </Drawer>
    );
    expect(document.activeElement).toBe(elsewhere);
    elsewhere.remove();
  });

  it("close button closes and focus returns to the trigger", () => {
    const onClose = vi.fn();
    const trigger = document.createElement("button");
    trigger.textContent = "Show provenance";
    document.body.appendChild(trigger);
    trigger.focus();
    const { rerender } = render(
      <Drawer open={false} title="Provenance" side="right" onClose={onClose}>
        <p>x</p>
      </Drawer>
    );
    rerender(
      <Drawer open title="Provenance" side="right" onClose={onClose}>
        <p>x</p>
      </Drawer>
    );
    fireEvent.click(
      document.querySelector("aside button[aria-label='Close Provenance']") as HTMLElement
    );
    expect(onClose).toHaveBeenCalledTimes(1);
    rerender(
      <Drawer open={false} title="Provenance" side="right" onClose={onClose}>
        <p>x</p>
      </Drawer>
    );
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it("closed drawer is visually hidden and carries side data", () => {
    const { container } = render(
      <Drawer open={false} title="Provenance" side="right" onClose={() => {}} />
    );
    const aside = container.querySelector("aside") as HTMLElement;
    // visibility seam: the hidden class (no layout in jsdom), plus the
    // machine-readable open state attribute
    expect(aside.className).toContain("hidden");
    expect(aside.getAttribute("data-pw-drawer")).toBe("right");
    expect(aside.getAttribute("data-pw-drawer-open")).toBe("false");
  });

  it("hosting the World Assistant names the heading 'World Assistant'", async () => {
    const { container } = render(
      <Drawer open title="World Assistant" side="right" onClose={() => {}}>
        <p>contextual chat lives here (T12 ChatPanel)</p>
      </Drawer>
    );
    const headingId = container
      .querySelector("aside")
      ?.getAttribute("aria-labelledby");
    expect(document.getElementById(headingId as string)?.textContent).toBe(
      "World Assistant"
    );
    expect(await axeNoContrast(container)).toHaveNoViolations();
  });

  it("SEAM: <600px viewport switches side=bottom to the modal sheet (Dialog compose)", async () => {
    // Stub exactly the CSS contract: matchMedia reports the sheet
    // breakpoint. jsdom's own absence of matchMedia is the desktop path.
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })
    );
    expect(preferSheetViewport()).toBe(true);

    const onClose = vi.fn();
    const trigger = document.createElement("button");
    trigger.textContent = "Open details";
    document.body.appendChild(trigger);
    trigger.focus();

    const { container } = render(
      <Drawer open title="Provenance" side="bottom" onClose={onClose}>
        <p>sheet body</p>
      </Drawer>
    );
    // sheet seam: no non-modal aside; a native dialog element instead
    expect(container.querySelector("aside")).toBeNull();
    const seam = container.querySelector("[data-pw-drawer-sheet='true']");
    expect(seam).not.toBeNull();
    const dialog = container.querySelector("dialog");
    expect(dialog).not.toBeNull();
    // modal sheet: explicit close control named for the title (A11y §3.5)
    const close = screen.getByRole("button", { name: "Close Provenance" });
    fireEvent.click(close);
    expect(onClose).toHaveBeenCalledTimes(1);
    // Escape dismisses via the composed Dialog
    fireEvent.keyDown(dialog as Element, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
    trigger.remove();
  });

  it("SEAM: side=right never becomes a sheet; jsdom default stays desktop", () => {
    // no matchMedia in jsdom → desktop non-modal even for bottom on load
    expect(preferSheetViewport()).toBe(false);
    const { container } = render(
      <Drawer open title="Provenance" side="right" onClose={() => {}} />
    );
    expect(container.querySelector("aside")).not.toBeNull();
    expect(container.querySelector("[data-pw-drawer-sheet]")).toBeNull();
  });

  it("axe: 0 violations on the bottom-side desktop drawer", async () => {
    const { container } = render(
      <Drawer open title="Provenance" side="bottom" onClose={() => {}}>
        <p>x</p>
      </Drawer>
    );
    expect(await axeNoContrast(container)).toHaveNoViolations();
  });
});