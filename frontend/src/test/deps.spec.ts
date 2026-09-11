import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * T4 dependency diet enforcement (FOUNDATION-SPEC §1.4): the removed
 * packages must appear nowhere in tracked frontend source or
 * package.json, and no external font/script may return via index.html.
 * (This spec builds its own forbidden list at runtime; it must not be
 * caught by itself, so it is excluded from the walk below.)
 */
const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(here, "..");
const pkgRoot = join(here, "..", "..");

const REMOVED_PACKAGES = [
  "@storybook",
  "@chromatic-com/storybook",
  "@tanstack/react-query",
  "class-variance-authority",
  "tailwind-merge",
  "lucide-react",
];

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

describe("dependency diet", () => {
  it("package.json contains none of the removed packages", () => {
    const pkg = readFileSync(join(pkgRoot, "package.json"), "utf8");
    for (const name of REMOVED_PACKAGES) {
      expect(pkg).not.toContain(name);
    }
    expect(pkg).not.toContain("storybook");
  });

  it("no tracked source imports a removed package", () => {
    const offenders: string[] = [];
    for (const file of walk(srcRoot)) {
      if (!/\.(tsx?|css)$/.test(file)) continue;
      if (file.startsWith(here)) continue; // specs name the forbidden packages themselves
      const text = readFileSync(file, "utf8");
      for (const name of REMOVED_PACKAGES) {
        if (text.includes(name)) offenders.push(`${file}: ${name}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("index.html loads no external fonts or scripts", () => {
    const html = readFileSync(join(pkgRoot, "index.html"), "utf8");
    expect(html).not.toContain("fonts.googleapis.com");
    expect(html).not.toContain("fonts.gstatic.com");
    expect(html).not.toContain("http://");
    expect(html).not.toContain("https://");
  });
});