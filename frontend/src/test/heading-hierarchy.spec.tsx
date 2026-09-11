import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { waitFor } from "@testing-library/react";
import InterestsScreen from "../screens/InterestsScreen";
import MediaScreen from "../screens/MediaScreen";
import ProjectsScreen from "../screens/ProjectsScreen";
import LabScreen from "../screens/LabScreen";
import VaultScreen from "../screens/VaultScreen";
import JournalScreen from "../screens/JournalScreen";
import WorldScreen from "../screens/WorldScreen";
import {
  screenProviders,
  mockFetchByRoute,
  jsonResponse,
  okEnvelope,
} from "./screen-helpers";

/**
 * Heading hierarchy (A11y §4.1 — non-negotiable; SCREEN-READER
 * WALKTHROUGH: one real h1 per page, h2 for major sections; DESIGN
 * HANDOFF section L): every state surface of the T10/T13 screens
 * carries exactly one h1, never two headings with the same visible
 * text, and never a skipped level (h1 → h2 → h3, no h1 → h3).
 *
 * Why this spec exists: EmptyState/ErrorState used to hard-code an
 * h2, so screens where the state was the ONLY page content had no h1
 * at all (Interests/Media/Projects, Vault error), and screens that
 * wrapped the state in their own h1 announced the title twice (Lab:
 * "Lab" h1 stacked over "Lab" h2). CardTitle used to render a plain
 * div, so card sections had no heading outline either. The fix is
 * semantic only: headingLevel={1} where the state is the page's only
 * heading, CardTitle defaulting to a real h2 — identical visuals.
 *
 * jsdom honesty: fetch is mocked per state exactly as the sibling
 * screen specs do (screens-lab / screens-vault / screens-journal);
 * the fixtures mirror the backend envelopes those specs assert.
 */

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

beforeEach(() => {
  localStorage.setItem("pw_token", "test-token");
});

type Heading = { level: number; text: string };

/** The experienced outline: headings inside closed dialogs or hidden
 *  subtrees are not rendered, so they are not part of it. */
function outline(container: HTMLElement): Heading[] {
  return [...container.querySelectorAll("h1,h2,h3,h4,h5,h6")]
    .filter(
      (el) => !el.closest("dialog:not([open]), [hidden]")
    )
    .map((el) => ({
      level: Number(el.tagName.slice(1)),
      text: (el.textContent ?? "").trim(),
    }));
}

/** The contract check: one h1, no duplicate heading text, no skips. */
function expectSoundOutline(container: HTMLElement, page: string): Heading[] {
  const headings = outline(container);
  expect(
    headings.length,
    `${page}: the page has at least one real heading`
  ).toBeGreaterThan(0);
  expect(
    headings.filter((h) => h.level === 1).length,
    `${page}: exactly one h1 (A11y §4.1)`
  ).toBe(1);
  expect(headings[0].level, `${page}: the outline starts at level 1`).toBe(1);
  for (let i = 1; i < headings.length; i++) {
    expect(
      headings[i].level,
      `${page}: no skipped level into "${headings[i].text}"`
    ).toBeLessThanOrEqual(headings[i - 1].level + 1);
  }
  const texts = headings.map((h) => h.text);
  expect(
    new Set(texts).size,
    `${page}: no two headings share identical visible text`
  ).toBe(texts.length);
  return headings;
}

describe("stub screens: the EmptyState heading IS the page h1", () => {
  it.each([
    ["Interests", <InterestsScreen key="interests" />],
    ["Media", <MediaScreen key="media" />],
    ["Projects", <ProjectsScreen key="projects" />],
  ])("%s renders exactly one heading, an h1, with no duplicates", (title, ui) => {
    const { container } = screenProviders(ui);
    const headings = expectSoundOutline(container, title);
    expect(headings).toEqual([{ level: 1, text: title }]);
  });
});

describe("Lab: one correctly-levelled 'Lab' heading in every state", () => {
  it("loading keeps the single h1 (nothing stacked beside it)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => new Promise(() => {}))
    );
    const { container } = screenProviders(<LabScreen />);
    await waitFor(() => {
      expect(container.querySelector("[data-pw-lab='loading']")).not.toBeNull();
    });
    const headings = expectSoundOutline(container, "/lab loading");
    expect(headings).toEqual([{ level: 1, text: "Lab" }]);
  });

  it("network error: the ErrorState heading is the page's one h1", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("network down"))
    );
    const { container } = screenProviders(<LabScreen />);
    await waitFor(() => {
      expect(container.querySelector("[data-pw-state='error']")).not.toBeNull();
    });
    const headings = expectSoundOutline(container, "/lab error");
    expect(headings).toEqual([{ level: 1, text: "Lab" }]);
  });

  it("absent CLI (not_configured): the EmptyState heading is the one h1", async () => {
    mockFetchByRoute({
      "/api/lab": () =>
        jsonResponse(200, { ok: false, status: "not_configured", data: { rows: [] } }),
    });
    const { container } = screenProviders(<LabScreen />);
    await waitFor(() => {
      expect(container.querySelector("[data-pw-state='empty']")).not.toBeNull();
    });
    const headings = expectSoundOutline(container, "/lab absent");
    expect(headings).toEqual([{ level: 1, text: "Lab" }]);
  });

  it("failing CLI (unavailable): the ErrorState heading is the one h1", async () => {
    mockFetchByRoute({
      "/api/lab": () =>
        jsonResponse(200, {
          ok: false,
          status: "unavailable",
          data: { rows: [], reason: "lab CLI unavailable or invalid output" },
          warnings: ["lab: could not fetch a valid lab-lowbw/1 packet"],
        }),
    });
    const { container } = screenProviders(<LabScreen />);
    await waitFor(() => {
      expect(container.querySelector("[data-pw-state='error']")).not.toBeNull();
    });
    const headings = expectSoundOutline(container, "/lab unavailable");
    expect(headings).toEqual([{ level: 1, text: "Lab" }]);
  });

  it("unknown packet: the EmptyState heading is the one h1", async () => {
    mockFetchByRoute({
      "/api/lab": () => jsonResponse(200, { ok: true, data: null }),
    });
    const { container } = screenProviders(<LabScreen />);
    await waitFor(() => {
      expect(container.querySelector("[data-pw-lab='unknown']")).not.toBeNull();
    });
    const headings = expectSoundOutline(container, "/lab unknown");
    expect(headings).toEqual([{ level: 1, text: "Lab" }]);
  });

  it("success table: the page's own h1 stands alone (no state heading beside it)", async () => {
    mockFetchByRoute({
      "/api/lab/state": () =>
        okEnvelope({
          rows: [
            { row: "urgent", count: 1, stale: false, observations: [] },
            { row: "safe", count: 0, stale: false, observations: [] },
          ],
          schema: "lab-lowbw/1",
          generated_at: "2026-09-11T05:00:00Z",
        }),
      "/api/lab/health": () =>
        okEnvelope({ total: 2, healthy: 2, unhealthy: 0, restarting: 0, stopped: 0 }),
    });
    const { container } = screenProviders(<LabScreen />);
    await waitFor(() => {
      expect(container.querySelector("table")).not.toBeNull();
    });
    const headings = expectSoundOutline(container, "/lab success");
    expect(headings).toEqual([{ level: 1, text: "Lab" }]);
  });
});

describe("Vault: error branch gets its h1; success keeps h1 + h2 cards", () => {
  it("status read failure: the ErrorState heading is the page's one h1", async () => {
    mockFetchByRoute({
      "/api/vault/status": () => jsonResponse(500, { detail: "vault unreachable" }),
    });
    const { container } = screenProviders(<VaultScreen />);
    await waitFor(() => {
      expect(container.querySelector("[data-pw-state='error']")).not.toBeNull();
    });
    const headings = expectSoundOutline(container, "/vault error");
    expect(headings).toEqual([{ level: 1, text: "Vault" }]);
  });

  it("locked success state: h1 Vault with real h2 card sections, no skips", async () => {
    mockFetchByRoute({
      "/api/vault/status": () => okEnvelope({ locked: true, encrypted: true }),
    });
    const { container } = screenProviders(<VaultScreen />);
    await waitFor(() => {
      expect(container.querySelector("h1")?.textContent).toBe("Vault");
    });
    const headings = expectSoundOutline(container, "/vault success");
    // Card titles are real h2 elements now (CardTitle as="h2" default).
    expect(headings).toEqual([
      { level: 1, text: "Vault" },
      { level: 2, text: "Unlock your vault" },
    ]);
  });
});

describe("Journal: page h1 with sequential h2 sections (empty state)", () => {
  it("empty journal: one h1, card/section headings are real h2s, no duplicates", async () => {
    mockFetchByRoute({
      "/api/journal": () => jsonResponse(200, { ok: true, data: [] }),
    });
    const { container } = screenProviders(<JournalScreen />);
    await waitFor(() => {
      expect(container.textContent).toContain("No journal entries yet");
    });
    const headings = expectSoundOutline(container, "/journal empty");
    expect(headings.map((h) => h.level)).toEqual([1, 2, 2, 2]);
    expect(headings[0]).toEqual({ level: 1, text: "Journal" });
  });
});

describe("World: page h1 with h2 summary/capability sections", () => {
  it("success state: h1 Your World, card titles render as real h2s, sequential h3 caps", async () => {
    mockFetchByRoute({
      "/api/exports/world": () =>
        okEnvelope({
          schema: "personal-world/world/1",
          intents: { focus: { key: "focus", value: "Build frontend v2" } },
          policies: { privacy: "minimum-necessary" },
          lore: {},
          packs: [],
          accessibility: {
            motion: "reduced",
            contrast: "comfortable",
            text_scale: 1,
            density: "comfortable",
            targets: "standard",
          },
        }),
      "/api/status": () =>
        okEnvelope({
          facts: 0,
          intents: 1,
          policies: 1,
          cemented_policies: 0,
          lore: { confirmed: 0, derived: 0, suggested: 0, ephemeral: 0 },
          capabilities: {
            source_control: {
              ok: true,
              status: "healthy",
              warnings: [],
              last_observed: "2026-09-11T05:00:00Z",
            },
            media: {
              ok: false,
              status: "not_configured",
              warnings: [],
              last_observed: "2026-09-11T05:00:00Z",
            },
          },
          providers: 0,
          packs: 0,
          actors: [],
        }),
      "/api/reminders": () =>
        okEnvelope([
          {
            id: "r-1",
            text: "Water the plants",
            enabled: true,
            created_at: "2026-09-11T05:00:00Z",
          },
        ]),
    });
    const { container } = screenProviders(<WorldScreen />);
    await waitFor(() => {
      expect(container.querySelector("h1")?.textContent).toBe("Your World");
    });
    const headings = expectSoundOutline(container, "/world success");
    expect(headings.map((h) => h.level)).toEqual([1, 2, 2, 2, 2, 2, 2, 3, 3]);
    expect(headings.map((h) => h.text)).toEqual([
      "Your World",
      "Summary",
      "Facts",
      "Intents",
      "Policies",
      "Reminders",
      "Capabilities",
      "Source Control",
      "Media",
    ]);
  });
});
