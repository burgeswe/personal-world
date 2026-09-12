import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * no-fake-strings (P1 T14, FOUNDATION-SPEC §7 row 15 / §11): the
 * frontend never ships fabricated presentation — hard-coded "Recent
 * changes"-style content, invented versions/timezones/hosts, or
 * debug logging. All such truth comes from the API; this gate greps
 * the shipped source so the lie cannot compile back in. Test files
 * are excluded (not shipped); comments are stripped so explaining
 * the rule never trips it.
 */

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

const SRC = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "src"
);
/** Test files are not shipped; only app source is scanned. */
const FILES = walk(SRC)
  .filter((f) => /\.(ts|tsx|css)$/.test(f))
  .filter((f) => !f.includes(`${join("src", "test")}`));
const SHIPPED_TS = FILES.filter((f) => /\.(ts|tsx)$/.test(f));

/** Strip comments so a rule about fabricated copy can't be tripped by
 * a comment explaining the rule itself. */
function code(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("no fake strings in shipped frontend/src (row 15)", () => {
  it("scans the real tree", () => {
    expect(FILES.length).toBeGreaterThan(10);
  });

  it("contains no fabricated 'recent changes'-style content", () => {
    for (const f of FILES) {
      const text = code(readFileSync(f, "utf8"));
      expect(text).not.toMatch(/recent changes/i);
      expect(text).not.toMatch(/sample data|demo data|fake data|lorem ipsum/i);
    }
  });

  it("contains no hard-coded version / timezone / host truth", () => {
    for (const f of FILES) {
      const text = code(readFileSync(f, "utf8"));
      // A version claim belongs to the server, never to UI copy.
      expect(text).not.toMatch(/version["']?\s*[:=]\s*["']\d+\.\d+/);
      // A hard-coded zone or host implies knowledge the server owns.
      expect(text).not.toMatch(/supportedValuesOf|timeZone["']?\s*[:=]\s*["'][A-Za-z/]+["']/);
      // No remote origins in shipped code; the API base comes from
      // VITE_API_URL (same-origin by default).
      expect(text).not.toMatch(/https?:\/\/[a-z0-9.-]+\.(?:com|net|org|io|dev|app)\b/);
      expect(text).not.toMatch(/localhost:\d+/);
    }
  });

  it("contains no console.log/warn/error in shipped code", () => {
    for (const f of SHIPPED_TS) {
      const text = code(readFileSync(f, "utf8"));
      expect(text).not.toMatch(/console\.(log|warn|error|info|debug)\b/);
    }
  });

  it("contains no fabricated upload endpoints", () => {
    for (const f of SHIPPED_TS) {
      const text = code(readFileSync(f, "utf8"));
      expect(text).not.toMatch(/api\/icons\/upload/);
    }
  });
});