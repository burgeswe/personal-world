/**
 * T14 auth-shell e2e (OWNER DECISION): /login and /setup are
 * STANDALONE — no AppShell, no section navigation, no app controls.
 * The person must never appear half-signed-in before success.
 */
import { test, expect } from "playwright/test";
import { bootWait, collectErrors, assertNoHorizontalOverflow } from "./helpers";

test.describe("standalone auth shell", () => {
  test("/login renders NO app navigation — standalone frame", async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto("/login");
    await bootWait(page);
    // No section nav of any responsive form
    for (const sel of [".pw-rail", ".pw-banner-nav", ".pw-bottom-nav"]) {
      await expect(page.locator(sel)).toHaveCount(0);
    }
    // No section links at all (the authenticated shell is gone, not hidden)
    const navs = await page.locator("nav").count();
    expect(navs).toBe(0);
    // The auth frame is the only shell on screen
    await expect(page.locator(".pw-auth")).toBeVisible();
    await expect(page.locator(".pw-shell")).toBeHidden();
    // One main, one h1
    expect(await page.locator("main#main-content").count()).toBe(1);
    await expect(page.locator("h1").first()).toBeVisible();
    await assertNoHorizontalOverflow(page);
    expect(errors).toEqual([]);
  });

  test("/setup renders NO app navigation — standalone frame", async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto("/setup");
    await bootWait(page);
    for (const sel of [".pw-rail", ".pw-banner-nav", ".pw-bottom-nav"]) {
      await expect(page.locator(sel)).toHaveCount(0);
    }
    expect(await page.locator("nav").count()).toBe(0);
    await expect(page.locator(".pw-auth")).toBeVisible();
    await expect(page.locator(".pw-shell")).toBeHidden();
    expect(await page.locator("main#main-content").count()).toBe(1);
    await assertNoHorizontalOverflow(page);
    expect(errors).toEqual([]);
  });

  test("auth shell at mobile width stays clean and unclipped", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/login");
    await bootWait(page);
    await assertNoHorizontalOverflow(page);
    expect(await page.locator("nav").count()).toBe(0);
  });
});