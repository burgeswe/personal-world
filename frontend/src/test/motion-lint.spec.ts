import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

/**
 * T5 motion lint (FOUNDATION-SPEC §3): continuous/decorative animation
 * is banned. No `infinite` loops, no spin/pulse/ping/shake/flash
 * keyframes, and no transition or animation duration above the 300ms
 * subtle ceiling. tokens.css must also carry the unconditional OS
 * prefers-reduced-motion override (A11y contract §6.2).
 */
const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(here, "..");

const BANNED = /\binfinite\b|\bspin\b|\bpulse\b|\bping\b|\bshake\b|\bflash\b/i;
const DURATION_RE = /(?:animation|transition)(?:-duration)?\s*:\s*[^;]*?(\d+(?:\.\d+)?)(ms|s)\b/;

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry === "dist") continue;
      yield* walk(full);
    } else {
      yield full;
    }
  }
}

function cssFiles(): string[] {
  const files: string[] = [];
  for (const file of walk(srcRoot)) {
    if (!file.endsWith(".css")) continue;
    if (file.startsWith(here)) continue; // specs name the forbidden patterns themselves
    files.push(file);
  }
  return files;
}

describe("motion lint over frontend CSS", () => {
  it("contains no infinite/spin/pulse/ping/shake/flash motion", () => {
    const offenders: string[] = [];
    for (const file of cssFiles()) {
      const text = readFileSync(file, "utf8");
      text.split("\n").forEach((line, i) => {
        if (BANNED.test(line)) {
          offenders.push(
            `${relative(srcRoot, file)}:${i + 1}: ${line.trim()}`
          );
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  it("contains no animation/transition duration above 300ms", () => {
    const offenders: string[] = [];
    for (const file of cssFiles()) {
      const text = readFileSync(file, "utf8");
      text.split("\n").forEach((line, i) => {
        // Strip comments so generated documentation cannot false-positive.
        const code = line.replace(/\/\*.*?\*\//g, "");
        const match = DURATION_RE.exec(code);
        if (!match) return;
        const value = Number(match[1]);
        const ms = match[2] === "s" ? value * 1000 : value;
        if (ms > 300) {
          offenders.push(
            `${relative(srcRoot, file)}:${i + 1}: ${line.trim()}`
          );
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  it("tokens.css carries the unconditional OS reduced-motion override", () => {
    const tokensCss = readFileSync(join(srcRoot, "tokens.css"), "utf8");
    expect(tokensCss).toContain("@media (prefers-reduced-motion: reduce)");
    expect(tokensCss).toContain("animation: none !important;");
    expect(tokensCss).toContain("transition: none !important;");
  });
});