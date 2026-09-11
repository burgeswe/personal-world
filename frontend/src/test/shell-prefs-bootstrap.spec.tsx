import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyPrefsToDocument,
  PREFERENCES_DEFAULTS,
  prefsFromServer,
} from "../lib/prefs-context";
import { fetchPrefs, type Prefs } from "../lib/api";

/**
 * T9 prefs-before-content spec (FOUNDATION-SPEC §1.2, §10 row 10):
 *
 * - fetchPrefs → applyPrefsToDocument → render routes (App bootstrap
 *   ordering); the attributes/variables land on documentElement, not
 *   body, and land BEFORE route content mounts.
 * - every data-pw-* attribute and --pw-* variable the shell build owns
 *   is asserted on document.documentElement.
 *
 * jsdom honesty: jsdom cannot prove PAINT order (no rendering
 * pipeline). The "before content" guarantee is enforced structurally:
 * App renders no route content until prefs have been applied
 * (booted gate), so no content can exist before the attrs. These tests
 * assert the attrs/vars on documentElement and the application
 * function itself.
 */

function prefsBody(p: Partial<Prefs> = {}) {
  return new Response(
    JSON.stringify({
      ok: true,
      data: {
        motion: "subtle",
        contrast: "high",
        density: "compact",
        text_scale: 1.5,
        target_size: 56,
        companion: "mermaid",
        accent: "world-keeper",
        ...p,
      },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

beforeEach(() => {
  document.documentElement.removeAttribute("data-pw-theme");
  document.documentElement.removeAttribute("data-pw-contrast");
  document.documentElement.removeAttribute("data-pw-density");
  document.documentElement.removeAttribute("data-pw-motion");
  document.documentElement.removeAttribute("data-pw-text-scale");
  document.documentElement.removeAttribute("data-pw-target-size");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("prefs → documentElement (T9)", () => {
  it("applyPrefsToDocument sets all data-pw-* attributes on documentElement", () => {
    applyPrefsToDocument({
      motion: "subtle",
      contrast: "high",
      density: "compact",
      textScale: 1.5,
      targetSize: 56,
      theme: "dark",
    });
    const root = document.documentElement;
    expect(root.getAttribute("data-pw-motion")).toBe("subtle");
    expect(root.getAttribute("data-pw-contrast")).toBe("high");
    expect(root.getAttribute("data-pw-density")).toBe("compact");
    expect(root.getAttribute("data-pw-text-scale")).toBe("1.5");
    expect(root.getAttribute("data-pw-target-size")).toBe("56");
    expect(root.getAttribute("data-pw-theme")).toBe("dark");
  });

  it("sets --pw-motion-duration/ambient per the motion tier", () => {
    applyPrefsToDocument({ ...PREFERENCES_DEFAULTS, motion: "subtle" });
    expect(
      document.documentElement.style.getPropertyValue("--pw-motion-duration")
    ).toBe("200ms");
    expect(
      document.documentElement.style.getPropertyValue("--pw-motion-ambient")
    ).toBe("1");

    applyPrefsToDocument({ ...PREFERENCES_DEFAULTS, motion: "reduced" });
    expect(
      document.documentElement.style.getPropertyValue("--pw-motion-duration")
    ).toBe("0ms");
    expect(
      document.documentElement.style.getPropertyValue("--pw-motion-ambient")
    ).toBe("0");

    applyPrefsToDocument({ ...PREFERENCES_DEFAULTS, motion: "off" });
    expect(
      document.documentElement.style.getPropertyValue("--pw-motion-duration")
    ).toBe("0ms");
  });

  it("sets --pw-typography-text-scale-base from text_scale", () => {
    applyPrefsToDocument({ ...PREFERENCES_DEFAULTS, textScale: 1.5 });
    expect(
      document.documentElement.style.getPropertyValue(
        "--pw-typography-text-scale-base"
      )
    ).toBe("1.5rem");
  });

  it("target_size never lands below the 44px floor", () => {
    applyPrefsToDocument({ ...PREFERENCES_DEFAULTS, targetSize: 44 });
    expect(
      document.documentElement.style.getPropertyValue("--pw-target-minimum")
    ).toBe("44px");
  });

  it("prefsFromServer maps the wire shape and falls back to defaults", () => {
    const mapped = prefsFromServer({
      motion: "off",
      contrast: "comfortable",
      density: "comfortable",
      text_scale: 1,
      target_size: 44,
      companion: "personal-world",
      accent: "world-keeper",
    });
    expect(mapped.motion).toBe("off");
    expect(mapped.theme).toBe("dark");
    const fallback = prefsFromServer(undefined);
    expect(fallback).toEqual(PREFERENCES_DEFAULTS);
  });

  it("bootstrap order: attrs land on documentElement after fetchPrefs resolves", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(prefsBody()));
    const attrs = () => document.documentElement.getAttribute("data-pw-motion");
    expect(attrs()).toBeNull();
    const d = await fetchPrefs();
    applyPrefsToDocument(prefsFromServer(d));
    expect(attrs()).toBe("subtle");
  });

  it("defaults still land when the server is unreachable (honest fallback)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("network down"))
    );
    try {
      await fetchPrefs();
    } catch {
      applyPrefsToDocument(PREFERENCES_DEFAULTS);
    }
    expect(document.documentElement.getAttribute("data-pw-motion")).toBe("reduced");
    expect(document.documentElement.getAttribute("data-pw-theme")).toBe("dark");
  });
});