import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, act, within } from "@testing-library/react";
import { axe } from "vitest-axe";
import { MemoryRouter } from "react-router-dom";
import { CompanionProvider } from "../lib/companion-context";
import { LiveRegionProvider } from "../primitives/LiveRegion";
import ProjectsScreen from "../screens/ProjectsScreen";
import type { SourceControlRepo } from "../lib/api";

/**
 * Projects workspace v1 (Finish Line "Projects workspace", first
 * slice): the real repository table over GET /api/source-control/status
 * + /api/source-control/history — the same envelope shapes the backend
 * tests assert (tests/test_source_control.py, tests/test_api_*).
 *
 * Proven:
 * - configured repos render one row each: name, branch, last commit,
 *   state (dirty/ahead/behind from real fields, never invented);
 * - the glance line counts what matters (watched/dirty/ahead) and
 *   stays quiet when everything is clean;
 * - repo selection loads its recent commits (drill-in), exactly one
 *   detail open at a time;
 * - an error repo renders its structured error, not a dropped row;
 * - the not_configured envelope keeps the honest EmptyState + knob;
 * - no fabricated rows, no demo content; axe 0 (contrast off in jsdom).
 */

const axeNoContrast = (el: Element) =>
  axe(el, { rules: { "color-contrast": { enabled: false } } } as never);

function repo(overrides: Partial<SourceControlRepo> = {}): SourceControlRepo {
  return {
    name: "personal-world",
    path: "/data/repos/personal-world",
    branch: "main",
    revision: "abc123def456",
    dirty: false,
    ahead: 0,
    behind: 0,
    remote: "https://github.com/example/personal-world.git",
    last_commit_date: "2026-09-12T00:00:00+00:00",
    last_commit_subject: "feat: one small thing",
    error: null,
    ...overrides,
  };
}

function statusEnvelope(repos: SourceControlRepo[]) {
  return new Response(
    JSON.stringify({ ok: true, status: "healthy", data: { repos } }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

function notConfiguredEnvelope() {
  return new Response(
    JSON.stringify({
      ok: false,
      status: "not_configured",
      warnings: ["no source_control search paths configured"],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

function historyEnvelope(repo: string) {
  return new Response(
    JSON.stringify({
      ok: true,
      status: "healthy",
      data: {
        repo,
        commits: [
          {
            revision: "deadbeef",
            date: "2026-09-11T10:00:00+00:00",
            author: "Rylee",
            subject: "fix: the thing",
          },
          {
            revision: "cafebabe",
            date: "2026-09-10T09:00:00+00:00",
            author: "GLM",
            subject: "feat: earlier thing",
          },
        ],
      },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

let fetchMock: ReturnType<typeof vi.fn>;
let historyCalls: string[] = [];

function stubProviders(ui: React.ReactElement) {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <CompanionProvider>
        <LiveRegionProvider>{ui}</LiveRegionProvider>
      </CompanionProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  historyCalls = [];
  fetchMock = vi.fn().mockImplementation((input: unknown) => {
    const path = typeof input === "string" ? input : String(input);
    if (path.includes("/api/source-control/history")) {
      historyCalls.push(path);
      const repo = new URL(path, "http://x").searchParams.get("repo") ?? "";
      return Promise.resolve(historyEnvelope(repo));
    }
    if (path.includes("/api/source-control/status")) {
      return Promise.resolve(statusEnvelope([repo()]));
    }
    return Promise.resolve(
      new Response(JSON.stringify({ ok: true, data: null }), {
        headers: { "Content-Type": "application/json" },
      })
    );
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ProjectsScreen (workspace v1)", () => {
  it("renders one row per configured repo with real fields", async () => {
    fetchMock.mockImplementation((input: unknown) => {
      const path = typeof input === "string" ? input : String(input);
      if (path.includes("/api/source-control/status")) {
        return Promise.resolve(
          statusEnvelope([
            repo(),
            repo({ name: "other", branch: "dev", dirty: true, ahead: 2, behind: 1, last_commit_subject: "second repo commit" }),
          ])
        );
      }
      return Promise.resolve(notConfiguredEnvelope());
    });
    const { container } = stubProviders(<ProjectsScreen />);
    await waitFor(() =>
      expect(screen.getByText(/2 repositories watched/)).toBeTruthy()
    );
    expect(screen.getByText("personal-world")).toBeTruthy();
    expect(screen.getByText("dev")).toBeTruthy();
    expect(screen.getAllByText(/uncommitted changes/).length).toBeGreaterThan(0);
    expect(screen.getByText(/2 ahead of remote/)).toBeTruthy();
    expect(screen.getByText(/1 behind remote/)).toBeTruthy();
    expect(await axeNoContrast(container)).toHaveNoViolations();
  });

  it("glance line stays quiet when everything is clean", async () => {
    stubProviders(<ProjectsScreen />);
    await waitFor(() =>
      expect(
        screen.getByText(/1 repository watched — everything clean/)
      ).toBeTruthy()
    );
  });

  it("selecting a repo loads its recent commits", async () => {
    stubProviders(<ProjectsScreen />);
    await waitFor(() => expect(screen.getByText("personal-world")).toBeTruthy());
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "personal-world" }));
    });
    await waitFor(() =>
      expect(screen.getByText("fix: the thing")).toBeTruthy()
    );
    expect(screen.getByText("feat: earlier thing")).toBeTruthy();
    expect(historyCalls.length).toBe(1);
    expect(historyCalls[0]).toContain("repo=personal-world");
  });

  it("an error repo keeps its row and shows the structured error", async () => {
    fetchMock.mockImplementation((input: unknown) => {
      const path = typeof input === "string" ? input : String(input);
      if (path.includes("/api/source-control/status")) {
        return Promise.resolve(
          statusEnvelope([repo({ name: "broken", error: "not a git repository", branch: null, revision: null })])
        );
      }
      return Promise.resolve(notConfiguredEnvelope());
    });
    stubProviders(<ProjectsScreen />);
    await waitFor(() => expect(screen.getByText("broken")).toBeTruthy());
    expect(screen.getByText("not a git repository")).toBeTruthy();
  });

  it("not_configured keeps the honest EmptyState naming the knob", async () => {
    fetchMock.mockImplementation((input: unknown) => {
      const path = typeof input === "string" ? input : String(input);
      if (path.includes("/api/source-control")) {
        return Promise.resolve(notConfiguredEnvelope());
      }
      return Promise.resolve(
        new Response(JSON.stringify({ ok: true, data: null }), {
          headers: { "Content-Type": "application/json" },
        })
      );
    });
    const { container } = stubProviders(<ProjectsScreen />);
    expect(
      await screen.findByText(/repository locations under Source Control in Settings/)
    ).toBeTruthy();
    expect(screen.queryByText(/repositories watched/)).toBeNull();
    expect(await axeNoContrast(container)).toHaveNoViolations();
  });
});
describe("Projects approval workflow (propose → approve → act → audit)", () => {
  let refreshCalls: Array<Record<string, unknown>> = [];

  beforeEach(() => {
    refreshCalls = [];
    fetchMock = vi.fn().mockImplementation((input: unknown, init?: RequestInit) => {
      const path = typeof input === "string" ? input : String(input);
      if (path.includes("/api/source-control/refresh")) {
        refreshCalls.push(JSON.parse(String(init?.body ?? "{}")));
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ok: true,
              status: "healthy",
              data: {
                repo: "personal-world",
                status: repo({ dirty: false, branch: "main" }),
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        );
      }
      if (path.includes("/api/source-control/history")) {
        return Promise.resolve(historyEnvelope("personal-world"));
      }
      if (path.includes("/api/source-control/status")) {
        return Promise.resolve(statusEnvelope([repo()]));
      }
      return Promise.resolve(
        new Response(JSON.stringify({ ok: true, data: null }), {
          headers: { "Content-Type": "application/json" },
        })
      );
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  it("proposes with WHAT/WHY/TOOL/RISK/EXPECTED and nothing happens before approval", async () => {
    stubProviders(<ProjectsScreen />);
    await waitFor(() => expect(screen.getByText("personal-world")).toBeTruthy());
    // Select the repo to reveal the proposal.
    fireEvent.click(screen.getByRole("button", { name: "personal-world" }));
    await waitFor(() =>
      expect(screen.getByText("Refresh repository status")).toBeTruthy()
    );
    const panel = screen.getByRole("heading", { name: "Refresh repository status" }).closest("section")!;
    expect(panel.getAttribute("data-pw-refresh")).toBe("proposed");
    // The five explanation rows.
    expect(within(panel).getByText(/Why:/)).toBeTruthy();
    expect(within(panel).getByText(/Uses:/)).toBeTruthy();
    expect(within(panel).getByText(/Risk:/)).toBeTruthy();
    expect(within(panel).getByText(/Expected:/)).toBeTruthy();
    expect(within(panel).getByText(/Re-check/)).toBeTruthy();
    // Explicit has-not-happened + zero server calls before approval.
    expect(within(panel).getByText(/Nothing has happened yet/)).toBeTruthy();
    expect(refreshCalls).toEqual([]);
  });

  it("explicit approval triggers exactly one act, then result is shown", async () => {
    stubProviders(<ProjectsScreen />);
    await waitFor(() => expect(screen.getByText("personal-world")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "personal-world" }));
    const approve = await screen.findByText("Approve and refresh");
    fireEvent.click(approve);
    await waitFor(() =>
      expect(screen.getByText(/Done — personal-world re-checked/)).toBeTruthy()
    );
    expect(refreshCalls).toEqual([{ repo: "personal-world" }]);
    expect(screen.getByText(/is clean/)).toBeTruthy();
  });

  it("failed refresh is honest and offers the way back", async () => {
    fetchMock.mockImplementation((input: unknown) => {
      const path = typeof input === "string" ? input : String(input);
      if (path.includes("/api/source-control/refresh")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ok: false,
              status: "not_configured",
              warnings: ["repository 'x' not found"],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        );
      }
      return Promise.resolve(statusEnvelope([repo()]));
    });
    stubProviders(<ProjectsScreen />);
    await waitFor(() => expect(screen.getByText("personal-world")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "personal-world" }));
    fireEvent.click(await screen.findByText("Approve and refresh"));
    await waitFor(() =>
      expect(screen.getByText(/The refresh did not finish/)).toBeTruthy()
    );
    expect(screen.getByText(/repository 'x' not found/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Back to the proposal" }));
    await waitFor(() =>
      expect(screen.getByText(/Nothing has happened yet/)).toBeTruthy()
    );
  });

  it("repeated use behaves sensibly: refresh again re-proposes, not auto-runs", async () => {
    stubProviders(<ProjectsScreen />);
    await waitFor(() => expect(screen.getByText("personal-world")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "personal-world" }));
    fireEvent.click(await screen.findByText("Approve and refresh"));
    await waitFor(() =>
      expect(screen.getByText(/Done — personal-world re-checked/)).toBeTruthy()
    );
    expect(refreshCalls.length).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: "Refresh again" }));
    await waitFor(() =>
      expect(screen.getByText(/Nothing has happened yet/)).toBeTruthy()
    );
    // Still exactly one act until approved again.
    expect(refreshCalls.length).toBe(1);
  });
});

describe("Projects GitHub enrichment (optional remote facts, quiet degradation)", () => {
  function enrichmentResponse(payload: unknown) {
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const healthyPayload = {
    ok: true,
    status: "healthy",
    data: {
      slug: "example/personal-world",
      url: "https://github.com/example/personal-world",
      default_branch: "main",
      open_prs: 2,
      open_issues: 3,
      pushed_at: "2026-09-12T10:00:00Z",
    },
  };

  async function openDetail() {
    stubProviders(<ProjectsScreen />);
    await waitFor(() => expect(screen.getByText("personal-world")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "personal-world" }));
    await waitFor(() =>
      expect(screen.getByText("GitHub activity")).toBeTruthy()
    );
  }

  it("shows remote facts with per-field labels when GitHub is healthy", async () => {
    fetchMock.mockImplementation((input: unknown) => {
      const path = typeof input === "string" ? input : String(input);
      if (path.includes("/api/source-control/enrichment")) {
        return Promise.resolve(enrichmentResponse(healthyPayload));
      }
      if (path.includes("/api/source-control/status")) {
        return Promise.resolve(statusEnvelope([repo()]));
      }
      return Promise.resolve(
        new Response(JSON.stringify({ ok: true, data: null }), {
          headers: { "Content-Type": "application/json" },
        })
      );
    });
    await openDetail();
    const panel = await screen.findByText(/From GitHub/);
    expect(panel.closest("[data-pw-projects-enrichment]")?.getAttribute("data-pw-projects-enrichment")).toBe("healthy");
    expect(screen.getByText("Open pull requests")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("Open issues")).toBeTruthy();
    expect(screen.getByText("Remote default branch")).toBeTruthy();
    expect(screen.getAllByText(/example\/personal-world/).length).toBeGreaterThan(0);
  });

  it("degrades quietly when gh is missing (unavailable)", async () => {
    fetchMock.mockImplementation((input: unknown) => {
      const path = typeof input === "string" ? input : String(input);
      if (path.includes("/api/source-control/enrichment")) {
        return Promise.resolve(
          enrichmentResponse({
            ok: false,
            status: "unavailable",
            warnings: ["gh CLI not found on this host"],
          })
        );
      }
      if (path.includes("/api/source-control/status")) {
        return Promise.resolve(statusEnvelope([repo()]));
      }
      return Promise.resolve(
        new Response(JSON.stringify({ ok: true, data: null }), {
          headers: { "Content-Type": "application/json" },
        })
      );
    });
    await openDetail();
    const panel = await screen.findByText(
      /GitHub information is not available right now/
    );
    expect(panel.closest("[data-pw-projects-enrichment]")?.getAttribute("data-pw-projects-enrichment")).toBe("absent");
    // The native table still answers — local truth survives the provider.
    expect(screen.getByText("main")).toBeTruthy();
    expect(screen.getAllByText(/feat: one small thing/).length).toBeGreaterThan(0);
  });

  it("names a non-GitHub remote honestly (not_github), without error styling", async () => {
    fetchMock.mockImplementation((input: unknown) => {
      const path = typeof input === "string" ? input : String(input);
      if (path.includes("/api/source-control/enrichment")) {
        return Promise.resolve(
          enrichmentResponse({
            ok: false,
            status: "not_github",
            data: { remote: "https://gitlab.com/example/personal-world.git" },
          })
        );
      }
      if (path.includes("/api/source-control/status")) {
        return Promise.resolve(statusEnvelope([repo({ remote: "https://gitlab.com/example/personal-world.git" })]));
      }
      return Promise.resolve(
        new Response(JSON.stringify({ ok: true, data: null }), {
          headers: { "Content-Type": "application/json" },
        })
      );
    });
    await openDetail();
    const panel = (await screen.findByText(/remote is not on GitHub/)).closest(
      "[data-pw-projects-enrichment]"
    );
    expect(panel?.getAttribute("data-pw-projects-enrichment")).toBe("absent");
    // Non-GitHub is a valid answer, not an error: no error vocabulary inside the panel.
    expect(panel?.textContent).not.toMatch(/error/i);
  });
});
