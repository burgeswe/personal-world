import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

/**
 * T5 hex-literal gate (FOUNDATION-SPEC §4): the only tracked frontend
 * file that may contain a color literal is the generated tokens.css.
 * Everything else must reference the --pw-* token variables. This is
 * the luminance-only / design-truth enforcement: a status tint or a
 * saturated badge variant must enter design/tokens.json first.
 */
const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(here, "..");
const pkgRoot = join(here, "..", "..");

const HEX_RE = /#[0-9a-fA-F]{3,8}\b|\brgb\(|\brgba\(/;

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

function scanTargets(): string[] {
  const targets: string[] = [];
  for (const file of walk(srcRoot)) {
    if (!/\.(ts|tsx|css)$/.test(file)) continue;
    if (file.endsWith("tokens.css")) continue; // the one allowed file
    if (file.startsWith(here)) continue; // specs name the forbidden patterns themselves
    targets.push(file);
  }
  targets.push(join(pkgRoot, "index.html"));
  return targets;
}

describe("no color literals outside tokens.css", () => {
  it("frontend source contains no hex or rgb() literals", () => {
    const offenders: { file: string; line: number; text: string }[] = [];
    for (const file of scanTargets()) {
      const text = readFileSync(file, "utf8");
      text.split("\n").forEach((line, i) => {
        if (HEX_RE.test(line)) {
          offenders.push({
            file: relative(pkgRoot, file),
            line: i + 1,
            text: line.trim(),
          });
        }
      });
    }
    expect(
      offenders.map((o) => `${o.file}:${o.line}: ${o.text}`)
    ).toEqual([]);
  });

  it("the only file allowed to carry literals is present and generated", () => {
    const tokensCss = readFileSync(join(srcRoot, "tokens.css"), "utf8");
    expect(tokensCss.startsWith("/* generated */")).toBe(true);
  });
});