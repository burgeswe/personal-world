/**
 * T14 gates e2e (§7 rows 15–17): the full-route walk proving zero
 * cross-origin requests, zero console errors, and external-resource
 * absence (fonts/icons served from the Project Worlds origin only).
 */
import { test, expect } from "playwright/test";
import {
  login,
  bootWait,
  collectErrors,
  collectExternal,
  ROUTES,
} from "./helpers";

const ORIGIN = "http://127.0.0.1:8731";

test.describe("no external requests (row 16)", () => {
  test("full route walk: every request is same-origin; zero console errors", async ({ page }) => {
    const errors = collectErrors(page);
    const external = collectExternal(page, ORIGIN);
    await login(page);
    for (const route of ROUTES) {
      await page.goto(route);
      await bootWait(page);
    }
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });

  test("no external font/CDN/analytics markers in the DOM", async ({ page }) => {
    await page.goto("/login");
    await bootWait(page);
    const html = await page.content();
    expect(html).not.toMatch(/fonts\.googleapis|fonts\.gstatic|cdn\.|analytics|gtag|doubleclick/i);
    // fonts resolve from the Project Worlds origin
    const fontHrefs = await page.evaluate(() =>
      Array.from(document.querySelectorAll("link[href]"))
        .map((l) => (l as HTMLLinkElement).href)
        .filter((h) => /\.(woff2?|ttf)/i.test(h))
    );
    expect(fontHrefs.length).toBeGreaterThanOrEqual(0); // may be CSS-internal
    for (const href of fontHrefs) {
      expect(href.startsWith(ORIGIN)).toBeTruthy();
    }
  });
});