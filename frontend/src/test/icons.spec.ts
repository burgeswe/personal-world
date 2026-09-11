import { describe, expect, it } from "vitest";
import { ICON_NAMES } from "../lib/icons";

/**
 * T4: the transitional icon shim may only reference sprite symbols that
 * actually exist in the tracked production sprite. The sprite is the
 * icon system (the old icon dependency was dieted out,
 * FOUNDATION-SPEC §1.4); T5's manifest audit re-checks the same ids
 * against design/assets/icons/manifest.json on the backend side.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

describe("icon shim sprite ids", () => {
  it("every icon name exists in the tracked sprite", () => {
    const spritePath = join(
      here,
      "..",
      "..",
      "..",
      "src",
      "personal_world",
      "static",
      "icons",
      "sprite.svg"
    );
    const sprite = readFileSync(spritePath, "utf8");
    const spriteIds = new Set(
      Array.from(sprite.matchAll(/id="([^"]+)"/g), (m) => m[1] as string)
    );
    const missing = ICON_NAMES.filter((n) => !spriteIds.has(n));
    expect(missing).toEqual([]);
  });

  it("declares no duplicate names", () => {
    expect(new Set(ICON_NAMES).size).toBe(ICON_NAMES.length);
  });
});