import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { axe } from "vitest-axe";
import { Disclosure, TechnicalDetails } from "../primitives/Disclosure";

/**
 * axe rule disable (jsdom limit only — mirrors T7 specs):
 * color-contrast cannot evaluate without real rendered layout.
 */
const axeNoContrast = (el: Element) =>
  axe(el, { rules: { "color-contrast": { enabled: false } } } as never);

/**
 * T8 Disclosure spec (FOUNDATION-SPEC §5 Disclosure row, A11y §4.6):
 * - native <details><summary> with aria-controls; levels 1–4 nest;
 * - summary is a ≥44px target (min-height token in class);
 * - controlled: Enter/Space toggle (jsdom lacks native summary keyboard
 *   activation; preventDefault makes browsers run the same path);
 * - Level-1 truth is NOT behind the click: the primitive renders
 *   children only when open, so hosts must keep glance-truth outside —
 *   proven here by a host pattern test (glance text lives outside);
 * - no animation beyond the motion tier: reveal is attribute toggling
 *   (no transition/animation declared on the primitive);
 * - TechnicalDetails preset = Level 4 (provider, model, latency, raw).
 */
describe("Disclosure (T8)", () => {
  it("renders native details/summary with aria-controls and a region", async () => {
    const { container } = render(
      <Disclosure summary="Sources" level={2}>
        <p>Three sources: local journal, two capability probes.</p>
      </Disclosure>
    );
    const details = container.querySelector("details");
    expect(details).not.toBeNull();
    const summary = container.querySelector("summary") as HTMLElement;
    const contentId = summary.getAttribute("aria-controls");
    expect(contentId).toBeTruthy();
    expect(document.getElementById(contentId as string)).not.toBeNull();
    expect(details?.querySelector("div[role='region']")).not.toBeNull();
    expect(await axeNoContrast(container)).toHaveNoViolations();
  });

  it("closed by default; Enter and Space toggle; click toggles", () => {
    const { container } = render(
      <Disclosure summary="Provenance" level={2}>
        <p>detail</p>
      </Disclosure>
    );
    const details = container.querySelector("details") as HTMLDetailsElement;
    const summary = container.querySelector("summary") as HTMLElement;
    expect(details.hasAttribute("open")).toBe(false);

    fireEvent.keyDown(summary, { key: "Enter" });
    expect(details.hasAttribute("open")).toBe(true);
    expect(summary.getAttribute("aria-expanded")).toBe("true");
    fireEvent.keyDown(summary, { key: "Enter" });
    expect(details.hasAttribute("open")).toBe(false);
    expect(summary.getAttribute("aria-expanded")).toBe("false");

    fireEvent.keyDown(summary, { key: " " });
    expect(details.hasAttribute("open")).toBe(true);
    fireEvent.keyDown(summary, { key: " " });
    expect(details.hasAttribute("open")).toBe(false);

    fireEvent.click(summary);
    expect(details.hasAttribute("open")).toBe(true);
    fireEvent.click(summary);
    expect(details.hasAttribute("open")).toBe(false);
  });

  it("defaultOpen renders open initially", () => {
    const { container } = render(
      <Disclosure summary="Provenance" level={2} defaultOpen>
        <p>detail</p>
      </Disclosure>
    );
    expect(
      (container.querySelector("details") as HTMLDetailsElement).hasAttribute("open")
    ).toBe(true);
  });

  it("summary carries the level as text (glance/detail/diagnostic/technical)", () => {
    const { container } = render(
      <Disclosure summary="Sources" level={1}>
        <p>3</p>
      </Disclosure>
    );
    const summary = container.querySelector("summary") as HTMLElement;
    expect(summary.textContent).toContain("(level 1: glance)");
    expect(container.querySelector("details")?.getAttribute("data-pw-disclosure-level")).toBe("1");
  });

  it("levels 1–4 nest and carry distinct level attributes", () => {
    const { container } = render(
      <Disclosure summary="What changed" level={1}>
        <p>Two capabilities updated.</p>
        <Disclosure summary="Which ones" level={2}>
          <p>Discovery, media.</p>
          <Disclosure summary="Why" level={3}>
            <p>Scheduled probe ran.</p>
            <TechnicalDetails provider="lab-health" latency="120ms" raw={"{\"ok\":true}"} />
          </Disclosure>
        </Disclosure>
      </Disclosure>
    );
    const levels = container.querySelectorAll("details[data-pw-disclosure-level]");
    expect([...levels].map((d) => d.getAttribute("data-pw-disclosure-level"))).toEqual([
      "1",
      "2",
      "3",
      "4",
    ]);
  });

  it("Level-1 truth is not behind the click: host renders glance outside, disclosure only detail", () => {
    const Host = () => (
      <>
        {/* Level 1 (glance) — always visible, never inside the disclosure */}
        <p>Discovery: unavailable.</p>
        <Disclosure summary="Why is this unavailable" level={2}>
          <p>The discovery capability is not configured.</p>
        </Disclosure>
      </>
    );
    const { container } = render(<Host />);
    const glance = screen.getByText("Discovery: unavailable.");
    const details = container.querySelector("details") as HTMLDetailsElement;
    // glance text lives OUTSIDE the details element
    expect(details.contains(glance)).toBe(false);
    // and is visible with the disclosure closed
    expect(details.hasAttribute("open")).toBe(false);
    expect(glance).toBeTruthy();
  });

  it("content is hidden when closed and visible when open", () => {
    const { container } = render(
      <Disclosure summary="Details" level={2}>
        <p>hidden body</p>
      </Disclosure>
    );
    const region = container.querySelector("div[role='region']") as HTMLElement;
    expect(region.hidden).toBe(true);
    fireEvent.click(container.querySelector("summary") as HTMLElement);
    expect(region.hidden).toBe(false);
    expect(screen.getByText("hidden body")).toBeTruthy();
  });

  it("TechnicalDetails renders provider, model, latency and raw at level 4", async () => {
    const { container } = render(
      <TechnicalDetails
        provider="forge-adapter"
        model="glm-5.3-flash"
        latency="180ms"
        raw={"{\"commits\":3}"}
        defaultOpen
      />
    );
    const details = container.querySelector("details") as HTMLDetailsElement;
    expect(details.getAttribute("data-pw-disclosure-level")).toBe("4");
    expect(details.getAttribute("open")).not.toBeNull();
    expect(screen.getByText("Technical details")).toBeTruthy();
    expect(screen.getByText("forge-adapter")).toBeTruthy();
    expect(screen.getByText("glm-5.3-flash")).toBeTruthy();
    expect(screen.getByText("180ms")).toBeTruthy();
    expect(screen.getByText('{"commits":3}')).toBeTruthy();
    expect(await axeNoContrast(container)).toHaveNoViolations();
  });

  it("TechnicalDetails renders only present fields", () => {
    const { container } = render(<TechnicalDetails provider="lab-health" />);
    expect(container.querySelector("details")).not.toBeNull();
    expect(container.textContent).not.toContain("Model");
    expect(container.textContent).not.toContain("Latency");
    expect(container.textContent).not.toContain("Raw");
  });

  it("no motion beyond the tier: reveal is attribute toggle, no transition declared", () => {
    const { container } = render(
      <Disclosure summary="Details" level={2}>
        <p>x</p>
      </Disclosure>
    );
    const summary = container.querySelector("summary") as HTMLElement;
    const style = window.getComputedStyle(summary);
    expect(summary.getAttribute("style") ?? "").not.toContain("transition");
    expect(style.animationName === "none" || style.animationName === "").toBe(true);
  });

  it("axe: 0 violations on a level-4 nested tree", async () => {
    const { container } = render(
      <Disclosure summary="Lab" level={2} defaultOpen>
        <TechnicalDetails provider="lab-health" latency="120ms" raw="{}" />
      </Disclosure>
    );
    expect(await axeNoContrast(container)).toHaveNoViolations();
  });
});