import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { axe } from "vitest-axe";
import { CompanionSlot, ASSISTANT_TRIGGER_LABEL } from "../primitives/CompanionSlot";

/**
 * axe rule disable (jsdom limit only — mirrors T7 specs):
 * color-contrast cannot evaluate without real rendered layout.
 */
const axeNoContrast = (el: Element) =>
  axe(el, { rules: { "color-contrast": { enabled: false } } } as never);

/**
 * T8 CompanionSlot spec (FOUNDATION-SPEC §5 owner correction 3, A11y §7):
 * - two SIBLING parts, never nested: artwork span[aria-hidden] + (when
 *   asAssistantTrigger) a separate button OUTSIDE that subtree;
 * - the trigger's ONLY accessible name is "Open World assistant";
 * - artwork img has alt="" and sits in an aria-hidden subtree;
 * - companion off removes part (a) ONLY — the trigger remains
 *   (A11y §7.4: turning the companion off removes no functionality);
 * - slot carries no information, is not itself focusable, never
 *   announces (no role=status / aria-live anywhere in its DOM);
 * - sizes micro|nav|inline|empty|error map to the COMPANION_INTEGRATION
 *   scale table (Micro 16-20, Nav 32, Inline 32-48, Empty 48-64,
 *   Error 64).
 */
describe("CompanionSlot (T8)", () => {
  it("trigger-mode: artwork + visible label live INSIDE the button as aria-hidden decoration (finding C)", async () => {
    const { container } = render(
      <CompanionSlot size="nav" asAssistantTrigger onOpenAssistant={() => {}} />
    );
    const slot = container.querySelector("[data-pw-companion-slot]") as HTMLElement;
    // no sibling artwork beside a trigger — exactly ONE companion (finding D)
    expect(slot.querySelector(":scope > span[aria-hidden='true']")).toBeNull();
    const trigger = slot.querySelector(":scope > button") as HTMLElement;
    expect(trigger).not.toBeNull();
    // the button itself is not inside an aria-hidden subtree
    expect(trigger.closest("[aria-hidden='true']")).toBeNull();
    // artwork + visible label are INSIDE the button, aria-hidden
    const artwork = trigger.querySelector("span[aria-hidden='true'] img");
    expect(artwork).not.toBeNull();
    expect(artwork?.getAttribute("alt")).toBe("");
    const labels = Array.from(trigger.querySelectorAll("span[aria-hidden='true']")).map(
      (s) => s.textContent
    );
    expect(labels).toContain("Ask your world");
    expect(await axeNoContrast(container)).toHaveNoViolations();
  });

  it("trigger's ONLY accessible name is 'Open World assistant'", () => {
    render(<CompanionSlot size="nav" asAssistantTrigger onOpenAssistant={() => {}} />);
    const trigger = screen.getByRole("button", { name: ASSISTANT_TRIGGER_LABEL });
    expect(trigger).toBeTruthy();
    // and there is no second button under any other name
    expect(screen.getAllByRole("button").length).toBe(1);
    expect(trigger.textContent).not.toContain("World Keeper");
    expect(trigger.textContent).not.toContain("companion");
  });

  it("artwork src is the canonical /companions/<companion>.svg route", () => {
    const { container } = render(
      <CompanionSlot size="nav" companion="mermaid" />
    );
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe("/companions/mermaid.svg");
    expect(container.querySelector("[data-pw-companion]")?.getAttribute("data-pw-companion")).toBe(
      "mermaid"
    );
  });

  it("companion OFF removes part (a) only; the trigger and its function remain", () => {
    const onOpenAssistant = vi.fn();
    const { container } = render(
      <CompanionSlot
        size="nav"
        companion="off"
        asAssistantTrigger
        onOpenAssistant={onOpenAssistant}
      />
    );
    // part (a): the artwork subtree is gone entirely
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector(":scope > span[aria-hidden='true']")).toBeNull();
    // part (b): the trigger remains with its function
    const trigger = screen.getByRole("button", { name: ASSISTANT_TRIGGER_LABEL });
    fireEvent.click(trigger);
    expect(onOpenAssistant).toHaveBeenCalledTimes(1);
    expect(
      container.querySelector("[data-pw-companion]")?.getAttribute("data-pw-companion")
    ).toBe("off");
  });

  it("reads the companion pref through CompanionProvider by default", () => {
    const { container } = render(<CompanionSlot size="nav" />, {
      wrapper: ({ children }) => <>{children}</>,
    });
    const img = container.querySelector("img");
    // CompanionProvider default is personal-world
    expect(img?.getAttribute("src")).toBe("/companions/personal-world.svg");
  });

  it("without asAssistantTrigger there is no button and nothing focusable", () => {
    const { container } = render(<CompanionSlot size="micro" />);
    expect(container.querySelector("button")).toBeNull();
    const slot = container.querySelector("[data-pw-companion-slot]") as HTMLElement;
    // the slot itself is a span: not focusable, carries no role, no tabindex
    expect(slot.hasAttribute("tabindex")).toBe(false);
    expect(slot.getAttribute("role")).toBeNull();
    // no live region / announcement machinery anywhere in the slot
    expect(
      slot.querySelector("[role='status'],[aria-live],[role='alert']")
    ).toBeNull();
  });

  it("pose changes the artwork src only (decorative, never announced)", () => {
    const { container } = render(
      <CompanionSlot size="inline" companion="mermaid" pose="thinking" />
    );
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe("/companions/mermaid-thinking.svg");
    expect(
      container.querySelector("[role='status'],[aria-live]")
    ).toBeNull();
  });

  it.each([
    ["micro", 18],
    ["nav", 32],
    ["inline", 48],
    ["empty", 64],
    ["error", 64],
  ] as const)("size %s maps to the COMPANION_INTEGRATION scale (%ipx)", (size, px) => {
    const { container } = render(<CompanionSlot size={size} />);
    const img = container.querySelector("img") as HTMLImageElement;
    expect(Number(img.getAttribute("width"))).toBe(px);
    expect(Number(img.getAttribute("height"))).toBe(px);
  });

  it("axe: 0 violations without trigger and with companion off", async () => {
    const a = render(<CompanionSlot size="nav" />);
    expect(await axeNoContrast(a.container)).toHaveNoViolations();
    const b = render(
      <CompanionSlot size="nav" companion="off" asAssistantTrigger onOpenAssistant={() => {}} />
    );
    expect(await axeNoContrast(b.container)).toHaveNoViolations();
  });
});