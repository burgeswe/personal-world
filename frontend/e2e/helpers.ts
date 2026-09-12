/**
 * T14 e2e helpers (FOUNDATION-SPEC §8 browser job).
 *
 * The seeded world (e2e/server.mjs) has `interests` hidden — the
 * nav-omission fixture — and PW_LAB_CLI unset so Lab is honestly
 * not_configured. `ci-token` is the valid bearer.
 */
import { expect, type Page } from "playwright/test";

export const TOKEN = "ci-token";
export const ROUTES = [
  "/",
  "/journal",
  "/vault",
  "/chat",
  "/settings",
  "/lab",
  "/interests",
];

/** Auth via the real /login flow (evidence, not shortcut): drive the
 * token input, submit, land on `/`. */
export async function login(page: Page) {
  await page.goto("/login");
  await page.locator('input[type="password"]').fill(TOKEN);
  await page.getByRole("button", { name: /^Enter$/ }).click();
  await page.waitForURL("**/");
  await page.waitForSelector("#main-content");
}

/** Console/page-error collector: attach before navigation. */
export function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
  });
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  return errors;
}

/** Cross-origin collector: every request whose URL origin differs
 * from the test server's origin is recorded. */
export function collectExternal(page: Page, origin: string) {
  const external: string[] = [];
  page.on("request", (req) => {
    const url = new URL(req.url());
    if (url.origin !== origin && url.protocol.startsWith("http")) {
      external.push(req.url());
    }
  });
  return external;
}

/** Wait for the boot gate: prefs attrs on <html> + main content. */
export async function bootWait(page: Page) {
  await page.waitForSelector("#main-content");
  await expect(page.locator("html")).toHaveAttribute("data-pw-motion", /.+/);
  await expect(page.locator("html")).toHaveAttribute("data-pw-contrast", /.+/);
  await expect(page.locator("html")).toHaveAttribute("data-pw-density", /.+/);
}

/** No horizontal overflow: document is not wider than the viewport. */
export async function assertNoHorizontalOverflow(page: Page) {
  const over = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(over).toBeLessThanOrEqual(1);
}

/** Focusable nav/controls meet the 44px floor (boundingBox check). */
export async function assertTargets(page: Page, selector: string) {
  const boxes = await page.locator(selector).all();
  for (const b of boxes) {
    const box = await b.boundingBox();
    if (box) expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(43.5);
  }
}