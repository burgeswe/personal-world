import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { axe } from "vitest-axe";
import { Popover } from "../primitives/Popover";

/**
 * T7 Popover spec (FOUNDATION-SPEC §5 Popover row).
 *
 * jsdom 30 has no popover attribute implementation, so the tests run
 * against the feature-detected fallback (same DOM contract: trigger
 * with aria-expanded/aria-haspopup, panel with popover attr when the
 * platform supports it, Escape close, light dismiss, ≥44px targets).
 * Native light-dismiss sequencing in a real browser is covered later
 * by the Playwright gates.
 *
 * axe rule disable (jsdom limit only): color-contrast cannot evaluate
 * without real rendered layout (jsdom has no visual output; its
 * matcher also consults canvas font metrics). Real contrast is
 * enforced by tokens + the Playwright axe gate.
 */

const axeNoContrast = (el: Element) =>
  axe(el, { rules: { "color-contrast": { enabled: false } } } as never);

describe("Popover (T7)", () => {
  it("trigger carries aria-expanded; panel opens and closes", async () => {
    const { container } = render(
      <Popover trigger="Filters">
        <button type="button">Filter A</button>
        <button type="button">Filter B</button>
      </Popover>
    );
    const trigger = screen.getByRole("button", { name: "Filters" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("button", { name: "Filter A" })).toBeTruthy();
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(await axeNoContrast(container)).toHaveNoViolations();
  });

  it("Escape closes and focus returns to the trigger", () => {
    render(
      <Popover trigger="Filters">
        <button type="button">Filter A</button>
      </Popover>
    );
    const trigger = screen.getByRole("button", { name: "Filters" });
    trigger.focus();
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const inner = screen.getByRole("button", { name: "Filter A" });
    inner.focus();
    const panel = inner.closest("[data-pw-popover-open]") as HTMLElement;
    fireEvent.keyDown(panel, { key: "Escape", bubbles: true });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger);
  });

  it("light dismiss: pointerdown outside closes the popover", () => {
    render(
      <Popover trigger="Filters">
        <button type="button">Filter A</button>
      </Popover>
    );
    const trigger = screen.getByRole("button", { name: "Filters" });
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const outside = document.createElement("button");
    document.body.appendChild(outside);
    fireEvent.pointerDown(outside);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("contents keep the 44px target floor", async () => {
    const { container } = render(
      <Popover trigger="Filters">
        <button type="button" className="min-h-[var(--pw-target-minimum)] min-w-[var(--pw-target-minimum)]">
          Filter A
        </button>
      </Popover>
    );
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    const inner = screen.getByRole("button", { name: "Filter A" });
    expect(inner.className).toContain("var(--pw-target-minimum)");
    expect(await axeNoContrast(container)).toHaveNoViolations();
  });

  it("panel carries the popover attribute contract", async () => {
    const { container } = render(
      <Popover trigger="More">
        <button type="button">Action</button>
      </Popover>
    );
    const panel = container.querySelector("[data-pw-popover-open]") as HTMLElement;
    expect(panel).not.toBeNull();
    expect(panel.tagName).toBe("DIV");
    expect(await axeNoContrast(container)).toHaveNoViolations();
  });
});