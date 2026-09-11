import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { StatusChip } from "../primitives/StatusChip";
import {
  CANONICAL_STATUSES,
  type CanonicalStatus,
} from "../primitives/StatusChip";

/**
 * axe rule disable (jsdom limit only — mirrors T7 specs):
 * color-contrast cannot evaluate without real rendered layout.
 */
const axeNoContrast = (el: Element) =>
  axe(el, { rules: { "color-contrast": { enabled: false } } } as never);

/**
 * T8 StatusChip spec (FOUNDATION-SPEC §5 StatusChip row, A11y §1.3):
 * - renders the humanized status word from the ONE map over the
 *   canonical vocabulary owned by src/personal_world/status.py;
 * - luminance-only rank encoding: the DOM carries data-status + the
 *   word; no hue-encoded meaning (hue/contrast lives in CSS over
 *   tokens and is checked by the Playwright gate);
 * - title = raw status (screen-reader tooltip truth);
 * - null renders nothing; invented statuses are rejected, never
 *   coerced (e.g. no "n/a", no "ok", no "n/a"-shaped fallback);
 * - optional label renders next to the word.
 */
describe("StatusChip (T8)", () => {
  it("renders the humanized word for every canonical status with title=raw", () => {
    const words: Record<CanonicalStatus, string> = {
      healthy: "healthy",
      warning: "warning",
      unknown: "unknown",
      needs_attention: "needs attention",
      unavailable: "unavailable",
      stale: "stale",
      disabled: "disabled",
      not_configured: "not configured",
    };
    const { container } = render(
      <>
        {CANONICAL_STATUSES.map((s) => (
          <StatusChip key={s} status={s} />
        ))}
      </>
    );
    const chips = container.querySelectorAll("span.chip");
    expect(chips.length).toBe(CANONICAL_STATUSES.length);
    for (const status of CANONICAL_STATUSES) {
      const chip = container.querySelector(`span.chip[data-status="${status}"]`);
      expect(chip).not.toBeNull();
      expect(chip?.getAttribute("title")).toBe(status);
      expect(chip?.textContent).toContain(words[status]);
    }
  });

  it("status word is the text content — meaning is never color-only (A11y §1.3)", async () => {
    const { container } = render(<StatusChip status="needs_attention" />);
    const chip = container.querySelector("span.chip") as HTMLElement;
    expect(chip.textContent).toBe("needs attention");
    // data-status exposes the canonical value for CSS luminance ranks
    expect(chip.dataset.status).toBe("needs_attention");
    expect(await axeNoContrast(container)).toHaveNoViolations();
  });

  it("null/undefined status renders nothing (callers pass nothing for null)", () => {
    const { container, rerender } = render(<StatusChip status={null} />);
    expect(container.querySelector("span.chip")).toBeNull();
    expect(container.textContent).toBe("");
    rerender(<StatusChip />);
    expect(container.querySelector("span.chip")).toBeNull();
    expect(container.textContent).toBe("");
  });

  it("rejects invented statuses (throws), never coerces or fabricates", () => {
    // invented vocabulary
    expect(() => render(<StatusChip status={"n/a" as CanonicalStatus} />)).toThrow(
      /canonical status/
    );
    // legacy dashboard vocabulary that status.py does NOT own
    expect(() => render(<StatusChip status={"ok" as CanonicalStatus} />)).toThrow(
      /canonical status/
    );
    expect(() =>
      render(<StatusChip status={"unhealthy" as CanonicalStatus} />)
    ).toThrow(/canonical status/);
    // non-string garbage
    expect(() =>
      render(<StatusChip status={42 as unknown as CanonicalStatus} />)
    ).toThrow(/canonical status/);
  });

  it("optional label renders inside the chip after the status word", () => {
    render(<StatusChip status="unavailable" label="Lab" />);
    const chip = screen.getByTitle("unavailable");
    expect(chip.textContent).toBe("unavailable · Lab");
  });

  it("size=sm renders the small chip class; md is the default", () => {
    const { container, rerender } = render(<StatusChip status="healthy" size="sm" />);
    expect(container.querySelector("span.chip")?.className).toContain("chip-sm");
    rerender(<StatusChip status="healthy" />);
    expect(container.querySelector("span.chip")?.className).not.toContain("chip-sm");
  });

  it("chip vocabulary matches src/personal_world/status.py exactly", () => {
    // Read the Python source as the contract; the frontend list must
    // mirror it. (Source-of-truth cross-check without a Python runtime.)
    const py = readStatusPy();
    for (const s of CANONICAL_STATUSES) {
      expect(py).toContain(`"${s}"`);
    }
    // status.py owns exactly these 8 — no extras on either side
    const declared = [...py.matchAll(/([A-Z_]+)\s*=\s*"([a-z_]+)"/g)].map(
      (m) => m[2]
    );
    expect(declared.sort()).toEqual([...CANONICAL_STATUSES].sort());
  });
});

function readStatusPy(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return readFileSync(
    join(here, "..", "..", "..", "src", "personal_world", "status.py"),
    "utf8"
  );
}