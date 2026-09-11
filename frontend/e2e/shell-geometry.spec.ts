/**
 * T14 human-gate polish e2e (finding B — geometry stability regression,
 * finding A — no dead band): the regression test that would have caught
 * the align-content dead band.
 *
 * The shell contract: rail and main NEVER move because of route
 * content. The header is a fixed 3.5rem strip; line 2 (rail + main)
 * pins directly under it — leftover cross-space falls BELOW the line
 * (align-content: flex-start, finding A), never between header and
 * content (attention contract §4: predictable geometry).
 *
 * Drawer invariance: the World Assistant drawer is fixed-position, so
 * opening it must not resize the shell.
 */
import { test, expect } from "playwright/test";
import { login, bootWait } from "./helpers";

test.describe("shell geometry stability (finding A/B)", () => {
  test("rail/main tops identical across short + tall routes; no dead band at 1280", async ({ page }) => {
    await login(page);
    await page.setViewportSize({ width: 1280, height: 800 });

    // Short routes fit within min-height:100vh (the dead-band trigger)
    // + one tall route that overflows.
    const tops: Record<string, { rail: number; main: number; headerBottom: number }> = {};
    for (const route of ["/", "/vault", "/settings", "/interests", "/journal"]) {
      await page.goto(route);
      await bootWait(page);
      tops[route] = await page.evaluate(() => {
        const top = (sel: string) =>
          (document.querySelector(sel) as HTMLElement | null)?.getBoundingClientRect().top ?? -1;
        const header = (document.querySelector(".pw-header") as HTMLElement | null)
          ?.getBoundingClientRect();
        return {
          rail: top(".pw-rail"),
          main: top("#main-content"),
          headerBottom: header ? header.bottom : -1,
        };
      });
    }

    // Every short route pins rail/main to the identical top…
    const shortRoutes = ["/vault", "/settings", "/journal"];
    const railTops = shortRoutes.map((r) => tops[r].rail);
    const mainTops = shortRoutes.map((r) => tops[r].main);
    for (const t of railTops) {
      expect(Math.abs(t - railTops[0]), `rail top on ${r_label(railTops, t)}`).toBeLessThan(1);
    }
    for (const t of mainTops) {
      expect(Math.abs(t - mainTops[0])).toBeLessThan(1);
    }
    // …identical across the short/tall boundary too (tall / shows the
    // same geometry as short routes)
    expect(Math.abs(tops["/"].rail - railTops[0])).toBeLessThan(1);
    expect(Math.abs(tops["/"].main - mainTops[0])).toBeLessThan(1);

    // NO dead band: main starts at the header's bottom edge (within
    // spacing.section = 24px; the measured bug was an 89px gap).
    for (const route of Object.keys(tops)) {
      const gap = tops[route].main - tops[route].headerBottom;
      expect(
        gap,
        `header→main gap on ${route} (dead band would exceed one section spacing)`
      ).toBeGreaterThanOrEqual(-1);
      expect(gap).toBeLessThanOrEqual(24.5);
    }
  });

  test("short routes pin rail/main right under the 3.5rem header (probe values, finding A)", async ({ page }) => {
    await login(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/vault");
    await bootWait(page);
    const { rail, main, headerBottom } = await page.evaluate(() => ({
      rail: (document.querySelector(".pw-rail") as HTMLElement).getBoundingClientRect().top,
      main: (document.querySelector("#main-content") as HTMLElement).getBoundingClientRect().top,
      headerBottom: (document.querySelector(".pw-header") as HTMLElement).getBoundingClientRect()
        .bottom,
    }));
    // The line sits directly under the header (border ~1px tolerance),
    // not 89px below it.
    expect(Math.abs(rail - headerBottom)).toBeLessThanOrEqual(2);
    expect(Math.abs(main - headerBottom)).toBeLessThanOrEqual(2);
  });

  test("opening the World Assistant drawer does not resize the shell", async ({ page }) => {
    await login(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/settings");
    await bootWait(page);
    const before = await page.evaluate(() => {
      const shell = document.querySelector(".pw-shell") as HTMLElement;
      const rect = shell.getBoundingClientRect();
      return { width: rect.width, height: rect.height, scrollW: document.documentElement.scrollWidth };
    });
    const trigger = page.getByRole("button", { name: "Open World assistant" });
    await trigger.click();
    await expect(page.locator("aside[role='complementary']")).toBeVisible();
    const after = await page.evaluate(() => {
      const shell = document.querySelector(".pw-shell") as HTMLElement;
      const rect = shell.getBoundingClientRect();
      return { width: rect.width, height: rect.height, scrollW: document.documentElement.scrollWidth };
    });
    expect(Math.abs(after.width - before.width)).toBeLessThan(1);
    expect(Math.abs(after.height - before.height)).toBeLessThan(1);
    expect(after.scrollW).toBe(before.scrollW);
  });
});

/** Small helper for a readable assertion message. */
function r_label(tops: number[], t: number): string {
  return tops.indexOf(t) === 0 ? "first short route" : "a short route";
}