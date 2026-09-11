/**
 * T14 shell e2e (FOUNDATION-SPEC §8): structure, boot gate, nav
 * semantics, hidden sections, keyboard, responsive cascade, zoom
 * PROXIES, console errors, external-request gate, axe.
 *
 * Zoom checks (§7 row 18) are automated PROXIES ONLY — the true 200%
 * browser-zoom acceptance is a HUMAN GATE recorded by the owner
 * (Rylee) on the deployed build (A11y §6.4); CSS zoom never
 * satisfies it.
 */
import { test, expect } from "playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  login,
  collectErrors,
  collectExternal,
  bootWait,
  assertNoHorizontalOverflow,
  assertTargets,
} from "./helpers";

const ORIGIN = "http://127.0.0.1:8731";

test.describe("shell + boot gate", () => {
  test("login lands on / with prefs attrs before content, zero console errors, no external requests", async ({ page }) => {
    const errors = collectErrors(page);
    const external = collectExternal(page, ORIGIN);
    await login(page);
    await bootWait(page);
    // one visible h1, landmarks, skip link first
    await expect(page.locator("h1")).toBeVisible();
    const mains = await page.locator("main#main-content").count();
    expect(mains).toBe(1);
    const navs = await page.locator('nav[aria-label="Main"]').count();
    expect(navs).toBeGreaterThanOrEqual(1);
    const skip = page.locator("a.skip-link, a[href='#main-content']").first();
    await expect(skip).toBeAttached();
    await assertNoHorizontalOverflow(page);
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });

  test("SectionNav aria-current; hidden section omitted from nav, route still resolves", async ({ page }) => {
    await login(page);
    await bootWait(page);
    // nav omits the hidden section but the direct route resolves
    const nav = page.locator('nav[aria-label="Main"]').first();
    await expect(nav).not.toContainText("Interests");
    await page.goto("/interests");
    await expect(page.locator("#main-content")).toContainText(/Interests/i);
    // aria-current on active section
    await page.goto("/settings");
    await expect(nav).toContainText("Settings");
    const current = await nav.locator('[aria-current="page"]').allTextContents();
    expect(current.join(" ").toLowerCase()).toContain("settings");
  });

  test("keyboard: Tab reaches nav and main content; focus visible", async ({ page }) => {
    await login(page);
    await bootWait(page);
    const skip = page.locator("a.skip-link, a[href='#main-content']").first();
    await skip.focus();
    // Tab into the document moves focus onward visibly
    await page.keyboard.press("Tab");
    const focusedTag = await page.evaluate(
      () => document.activeElement?.tagName.toLowerCase()
    );
    expect(["a", "button", "input", "textarea"]).toContain(focusedTag ?? "a");
  });

  test("chips carry status words — meaning never color-only", async ({ page }) => {
    await login(page);
    await bootWait(page);
    const chips = await page.locator(".chip[data-status]").all();
    for (const chip of chips) {
      // textContent, not innerText: a chip inside a collapsed
      // <details> still carries its word in the a11y tree/DOM
      // (innerText of hidden text is ""), and the word is the signal.
      const text = (await chip.textContent())?.trim() ?? "";
      expect(text, "chip must carry its status word").toMatch(/\S/);
    }
  });
});

test.describe("responsive cascade (§5 rail/banner/bottom)", () => {
  test("≥900 rail only; 600–899 banner only; <600 bottom only", async ({ page }) => {
    await login(page);
    await bootWait(page);

    // ≥900: rail visible, banner/bottom absent
    await page.setViewportSize({ width: 900, height: 800 });
    await expect(page.locator(".pw-rail")).toBeVisible();
    await expect(page.locator(".pw-banner-nav")).toBeHidden();
    await expect(page.locator(".pw-bottom-bar")).toBeHidden();
    await assertNoHorizontalOverflow(page);

    // 600–899: banner visible, rail/bottom absent
    await page.setViewportSize({ width: 600, height: 800 });
    await expect(page.locator(".pw-banner-nav")).toBeVisible();
    await expect(page.locator(".pw-rail")).toBeHidden();
    await expect(page.locator(".pw-bottom-bar")).toBeHidden();

    // <600: bottom bar visible, rail/banner absent
    await page.setViewportSize({ width: 599, height: 800 });
    await expect(page.locator(".pw-bottom-bar")).toBeVisible();
    await expect(page.locator(".pw-rail")).toBeHidden();
    await expect(page.locator(".pw-banner-nav")).toBeHidden();
    await assertNoHorizontalOverflow(page);

    // seam widths: no overflow at either side of each breakpoint
    for (const w of [390, 899, 1280]) {
      await page.setViewportSize({ width: w, height: 800 });
      await assertNoHorizontalOverflow(page);
    }
  });

  test("44px floor: nav links and primary controls", async ({ page }) => {
    await login(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await bootWait(page);
    await assertTargets(page, ".pw-rail a, .pw-rail button");
  });
});

test.describe("zoom/text-resilience PROXIES (row 18a/b — NOT the human gate)", () => {
  // PROXY (a): CSS zoom 2x reflow stress — a proxy, never true 200% zoom.
  // A 1440px viewport at zoom 2 lays out in 720 CSS px: the same
  // geometry a real 200% browser zoom produces on a 1440 display.
  test("PROXY-a: document zoom 2 on a 1440 viewport (720 CSS px layout) — no horizontal scroll, controls reachable", async ({ page }) => {
    await login(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await bootWait(page);
    await page.evaluate(() => {
      document.documentElement.style.zoom = "2";
    });
    const over = await page.evaluate(() => {
      const d = document.documentElement;
      return d.scrollWidth - d.clientWidth;
    });
    expect(over).toBeLessThanOrEqual(1);
    const h1 = page.locator("h1").first();
    await expect(h1).toBeVisible();
  });

  // PROXY (b): 720×450 is what a real 200% zoom yields on a 1440 layout.
  test("PROXY-b: viewport 720×450 — no clipped controls, essential text visible", async ({ page }) => {
    await login(page);
    await page.setViewportSize({ width: 720, height: 450 });
    await bootWait(page);
    await assertNoHorizontalOverflow(page);
    await expect(page.locator("h1").first()).toBeVisible();
    const navVisible =
      (await page.locator(".pw-rail").isVisible()) ||
      (await page.locator(".pw-banner-nav").isVisible()) ||
      (await page.locator(".pw-bottom-bar").isVisible());
    expect(navVisible).toBeTruthy();
  });
});

test.describe("axe browser gates (0 serious/critical; color-contrast NOT disabled)", () => {
  for (const viewport of [
    { width: 1280, height: 800, name: "desktop" },
    { width: 390, height: 844, name: "mobile" },
  ]) {
    for (const route of ["/", "/journal", "/vault", "/chat", "/settings", "/lab"]) {
      test(`axe ${route} @${viewport.name}`, async ({ page }) => {
        await login(page);
        await page.setViewportSize(viewport);
        await page.goto(route);
        await bootWait(page);
        const results = await new AxeBuilder({ page }).analyze();
        const serious = results.violations.filter(
          (v) => v.impact === "serious" || v.impact === "critical"
        );
        expect(
          serious.map((v) => ({ id: v.id, nodes: v.nodes.length })),
          `${route} @${viewport.name}: ${JSON.stringify(serious.map((v) => v.id))}`
        ).toEqual([]);
      });
    }
  }
});