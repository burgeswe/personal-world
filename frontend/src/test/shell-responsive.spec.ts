import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * T9 responsive-cascade spec (FOUNDATION-SPEC §5 shell, §10 row T9):
 * the cascade is CSS truth, so this spec asserts the stylesheet
 * directly (jsdom has no layout engine):
 * - three viewport buckets (rail ≥900 / banner 600–899 / bottom <600),
 *   mirrored by AppShell's bucket logic (behavioral seams live in
 *   shell-landmarks.spec);
 * - env(safe-area-inset-bottom) on the bottom bar (A11y §2.7);
 * - 44px targets via the token var, never smaller literals.
 */
const here = dirname(fileURLToPath(import.meta.url));

const css = readFileSync(join(here, "..", "index.css"), "utf8");
const shellTsx = readFileSync(join(here, "..", "shell", "AppShell.tsx"), "utf8");

describe("responsive cascade seams (T9)", () => {
  it("has the rail bucket at ≥900px", () => {
    expect(css).toContain("@media (min-width: 900px)");
  });

  it("has the banner bucket at 600–899px", () => {
    expect(css).toContain("@media (min-width: 600px) and (max-width: 899px)");
    // The component mirrors the same banner breakpoint.
    expect(shellTsx).toContain('"(min-width: 600px) and (max-width: 899px)"');
  });

  it("has the bottom-bar bucket at <600px", () => {
    expect(css).toContain("@media (max-width: 599px)");
    expect(shellTsx).toContain('"(max-width: 599px)"');
  });

  it("bottom bar carries env(safe-area-inset-bottom) (A11y §2.7)", () => {
    expect(css).toContain("env(safe-area-inset-bottom");
  });

  it("shell classes exist for every slot", () => {
    expect(css).toContain(".pw-rail");
    expect(css).toContain(".pw-bottom-bar");
    expect(css).toContain(".pw-banner-nav");
    expect(css).toContain(".pw-header");
  });

  it("header carries FIXED compact geometry (T14 human gate 1)", () => {
    // Height is a fixed shell-local var, identical on every route; the
    // banner bucket may wrap taller (bucket-driven, not route-driven).
    expect(css).toMatch(/\.pw-header\s*\{[^}]*height:\s*var\(--pw-header-height\)/);
    expect(css).toContain("--pw-header-height: 3.5rem");
    // the banner bucket's taller wrap is the only height override
    expect(css).toMatch(/min-width: 600px[^}]*\{[\s\S]*?\.pw-header\s*\{[^}]*height:\s*auto/);
  });

  it("main owns the ONE content measure (T14 human gate 2)", () => {
    expect(css).toMatch(/\.pw-main\s*\{[^}]*max-width:\s*var\(--pw-content-measure\)/);
    expect(css).toMatch(/\.pw-main\s*\{[^}]*margin-inline:\s*auto/);
    expect(css).toContain("--pw-content-measure: 64rem");
    // screens no longer pick their own wrappers (mechanical removal)
    const screensDir = join(here, "..", "screens");
    for (const file of readdirSync(screensDir)) {
      if (!file.endsWith(".tsx")) continue;
      const text = readFileSync(join(screensDir, file), "utf8");
      expect(text, `${file} must not set its own content measure`).not.toMatch(/max-w-[23]xl/);
      expect(text, `${file} must not center itself (shell owns measure)`).not.toMatch(/mx-auto/);
    }
  });

  it("rail legibility: 6.75rem width, 24px icons, 0.8rem labels, 44px targets (T14 human gate 3)", () => {
    expect(css).toMatch(/--pw-rail-width:\s*6\.75rem/);
    expect(css).toMatch(/\.pw-nav-link--rail\s*\{[^}]*font-size:\s*0\.8rem/);
    const sectionNav = readFileSync(join(here, "..", "shell", "SectionNav.tsx"), "utf8");
    expect(sectionNav).toMatch(/compact \? 24 : 18/);
    // 44px floor stays CSS truth
    expect(css).toMatch(/\.pw-nav-link\s*\{[^}]*min-height:\s*var\(--pw-target-minimum\)/);
  });

  it("shell hosts the assistant trigger, exactly one shell companion (T14 human gates 4+5; finding D)", () => {
    const appShell = readFileSync(join(here, "..", "shell", "AppShell.tsx"), "utf8");
    // finding D: the brand lockup is the wordmark ONLY — the shell has
    // exactly ONE companion, the assistant trigger's artwork.
    expect(appShell).not.toContain('<CompanionSlot size="nav" />');
    expect(appShell).toContain("asAssistantTrigger");
    expect(appShell).toContain('title="World Assistant"');
    // heading the contract names (A11y §3.2)
    const emptyState = readFileSync(join(here, "..", "shell", "EmptyState.tsx"), "utf8");
    expect(emptyState).toContain('size="empty"');
  });

  it("assistant trigger is a labeled affordance, not an ambiguous '+' (finding C)", () => {
    const slot = readFileSync(join(here, "..", "primitives", "CompanionSlot.tsx"), "utf8");
    // visible affordance text; the bare ✚ / text-transparent hack is gone
    expect(slot).toContain('"Ask your world"');
    expect(slot).not.toContain("✚");
    expect(slot).not.toContain("text-transparent");
  });

  it("empty states stay proportionate: 34rem card, 1.25rem h2 (finding E)", () => {
    expect(css).toMatch(/\.pw-state\s*\{[^}]*max-width:\s*34rem/);
    expect(css).toMatch(/\.pw-state h2\s*\{[^}]*font-size:\s*1\.25rem/);
    // the oversized-banner padding (section) is gone with the banner
    expect(css).toMatch(/\.pw-state\s*\{[^}]*padding:\s*var\(--pw-spacing-loose\)/);
  });

  it("rail line 2 pins under the header (finding A: no dead band)", () => {
    // The ≥900px block pins cross-axis content to the top so leftover
    // space falls BELOW the rail/main line, never between header and
    // content (attention contract: predictable geometry).
    const railBlock = css.match(/@media \(min-width: 900px\)\s*\{[\s\S]*?\n\}/);
    expect(railBlock).not.toBeNull();
    expect(railBlock![0]).toContain("align-content: flex-start");
  });

  it("nav targets use the 44px token floor, never a smaller literal", () => {
    expect(css).toMatch(/\.pw-nav-link\s*\{[^}]*min-height:\s*var\(--pw-target-minimum\)/);
    expect(css).toMatch(/\.pw-nav-link\s*\{[^}]*min-width:\s*var\(--pw-target-minimum\)/);
  });

  it("shell CSS uses token variables, never hex (belt-and-braces with tokens-hex)", () => {
    const shellBlock = css.slice(css.indexOf("── AppShell"));
    expect(shellBlock).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\brgb\(/);
  });

  it("AppShell buckets match the CSS breakpoints exactly", () => {
    expect(shellTsx).toContain('"(min-width: 900px)"');
    expect(shellTsx).toContain('"(max-width: 599px)"');
  });
});