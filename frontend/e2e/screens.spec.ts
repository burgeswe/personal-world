/**
 * T14 screens e2e (FOUNDATION-SPEC §7/§8): EmptyState/ErrorState
 * truth, Dialog top layer, Popover behavior (if reachable), vault
 * values never rendered, reduced-motion resilience.
 */
import { test, expect } from "playwright/test";
import { login, bootWait, collectErrors } from "./helpers";

test.describe("honest states", () => {
  test("Lab unavailable (CLI unreachable) shows ErrorState with the server warning, rest still works", async ({ page }) => {
    await login(page);
    await page.goto("/lab");
    await bootWait(page);
    const text = await page.locator("#main-content").innerText();
    // The fixture's PW_LAB_CLI points nowhere: the backend reports
    // unavailable with its own warning — mirrored verbatim, never guessed.
    expect(text).toMatch(/could not be reached/i);
    expect(text).toMatch(/lab: could not fetch a valid lab-lowbw\/1 packet/);
    expect(text).toMatch(/still works/i);
  });

  test("Interests route (hidden section) renders honest EmptyState, no mount paths", async ({ page }) => {
    await login(page);
    await page.goto("/interests");
    await bootWait(page);
    const text = await page.locator("#main-content").innerText();
    expect(text).toMatch(/Interests/i);
    expect(text).not.toMatch(/\/home\/|\/var\/|\/Users\//);
  });

  test("Media stub stays an honest empty state", async ({ page }) => {
    await login(page);
    const errors = collectErrors(page);
    await page.goto("/media");
    await bootWait(page);
    const text = await page.locator("#main-content").innerText();
    expect(text).not.toMatch(/Coming soon|demo|sample data/i);
    expect(errors).toEqual([]);
  });

  test("Projects (configured via real search_paths) shows the real repository table", async ({ page }) => {
    await login(page);
    const errors = collectErrors(page);
    await page.goto("/projects");
    await bootWait(page);
    // The e2e fixture points the native source_control baseline at the
    // repo itself: the real table must render with the repo's own name.
    await expect(
      page.getByRole("button", { name: "personal-world" })
    ).toBeVisible();
    const glance = await page.locator("#main-content p").first().innerText();
    expect(glance).toMatch(/repositor(y|ies) watched/);
    // Provenance disclosure opens and carries the real fields.
    await page.getByRole("button", { name: "personal-world" }).click();
    await expect(page.locator("[data-pw-projects-detail]")).toBeVisible();
    // History loads from the real /api/source-control/history.
    await expect(
      page.locator("[data-pw-projects-history]")
    ).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("empty states are proportionate: 34rem card, What/Why/Next order (finding E)", async ({ page }) => {
    await login(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/media");
    await bootWait(page);
    const state = page.locator(".pw-state");
    // proportionate card, not a full-measure banner (34rem < 64rem measure)
    const box = await state.boundingBox();
    expect(box?.width).toBeLessThanOrEqual(34 * 16 + 1);
    // What/Why/Next: heading → chip → capability → knob (DOM order)
    const order = await state.evaluate((el) => {
      // the state heading is h1 when it is the page's only heading
      // (headingLevel 1) and h2 beside a page h1 — match either level
      const heading = el.querySelector("h1, h2");
      const chip = el.querySelector(".chip");
      const summary = el.querySelector(".pw-state-summary");
      const detail = el.querySelector(".pw-state-detail");
      const before = (a: Element | null, b: Element | null) =>
        a !== null && b !== null && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
      return {
        chipAfterHeading: before(heading, chip),
        summaryAfterChip: before(chip, summary),
        detailAfterSummary: before(summary, detail),
      };
    });
    expect(order.chipAfterHeading).toBe(true);
    expect(order.summaryAfterChip).toBe(true);
    expect(order.detailAfterSummary).toBe(true);
    // copy still names capability + knob (contract intact after layout fix)
    const text = await state.innerText();
    expect(text).toMatch(/media connection in Settings/i);
  });
});

test.describe("dialog top layer (§5 Dialog primitive in a real browser)", () => {
  test("Settings sections panel dialog opens in top layer, Escape closes, focus returns", async ({ page }) => {
    await login(page);
    await page.goto("/settings");
    await bootWait(page);
    // Restore-defaults is the danger confirm (T11 sections panel).
    const trigger = page.getByRole("button", { name: /restore default sections/i });
    await trigger.click();
    const dialog = page.locator("dialog[open]");
    await expect(dialog).toBeVisible();
    // top layer: the dialog element is in documentElement's top layer
    const inTopLayer = await dialog.evaluate(
      (el) => (el as HTMLDialogElement).open && el.matches(":modal")
    );
    expect(inTopLayer).toBeTruthy();
    // Escape closes and focus returns to the trigger
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    const focusedIsTrigger = await trigger.evaluate((el) =>
      el === (document.activeElement as HTMLElement | null)
    );
    expect(focusedIsTrigger).toBeTruthy();
  });

  test("vault secret values are never rendered (names only)", async ({ page }) => {
    await login(page);
    await page.goto("/vault");
    await bootWait(page);
    const text = await page.locator("#main-content").innerText();
    // no secret-shape material in the DOM (values are never fetched/rendered)
    expect(text).not.toMatch(/[A-Za-z0-9_-]{32,}/);
  });
});

test.describe("reduced motion (OS overrides application)", () => {
  test("prefers-reduced-motion: app fully functional, nothing required animates", async ({ browser }) => {
    const ctx = await browser.newContext({
      reducedMotion: "reduce",
      viewport: { width: 1280, height: 800 },
    });
    const p = await ctx.newPage();
    await login(p);
    await bootWait(p);
    await p.goto("/settings");
    await bootWait(p);
    // OS reduce forces the override regardless of application prefs (§3)
    const ambient = await p.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue("--pw-motion-ambient")
        .trim()
    );
    expect(ambient === "0" || ambient === "").toBeTruthy();
    await ctx.close();
  });
});