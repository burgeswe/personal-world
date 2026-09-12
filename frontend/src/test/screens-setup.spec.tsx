import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { axe } from "vitest-axe";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { LiveRegionProvider } from "../primitives/LiveRegion";
import { setLoginNavigation, type Prefs } from "../lib/api";
import SetupWizard from "../screens/SetupWizard";

/**
 * T12 SetupWizard spec (FOUNDATION-SPEC §5 shell row + §7 row 8): ONE
 * first-run flow — token ≥8 validation, optional vault passphrase,
 * companion choice, world-name fact (/api/world/fact, canonical key
 * "world.name"), login deep-link on fresh install, honest completion
 * states (partial success named, never silent).
 *
 * Fetch is mocked at the real lib/api.ts boundary, so every assertion
 * below proves the exact request the wizard sends.
 */

const axeNoContrast = (el: Element) =>
  axe(el, { rules: { "color-contrast": { enabled: false } } } as never);

type FetchMock = ReturnType<typeof vi.fn>;

interface Call {
  path: string;
  init: RequestInit | undefined;
  body: Record<string, unknown>;
}

function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = { "Content-Type": "application/json" }
): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

const PREFS_OK = {
  ok: true,
  data: {
    motion: "reduced",
    contrast: "comfortable",
    density: "comfortable",
    text_scale: 1,
    target_size: 44,
    companion: "personal-world",
    accent: "world-keeper",
  } satisfies Prefs,
};

function renderWizard(initial = "/setup") {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <LiveRegionProvider>
        <Routes>
          <Route path="/setup" element={<SetupWizardRoute />} />
          <Route path="/login" element={<p>LOGIN PAGE</p>} />
          <Route path="/" element={<p>WORLD HOME</p>} />
        </Routes>
      </LiveRegionProvider>
    </MemoryRouter>
  );
}

// The screen owns its own useNavigate; the route wrapper keeps the
// spec shaped like the real app (a bare Route element).
function SetupWizardRoute() {
  return <SetupWizard />;
}

async function walkToFinish(): Promise<HTMLButtonElement> {
  // Step 1: world name (leave default) → Next
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  // Step 2: companion (personal-world preselected) → Next
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  // Step 3: token ≥8 → Next
  const token = screen.getByLabelText("Login token") as HTMLInputElement;
  fireEvent.change(token, { target: { value: "wizard-token-1" } });
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  // Step 4: optional vault (skipped) → summary visible
  await waitFor(() =>
    expect(screen.getByText("Finish setup")).toBeTruthy()
  );
  return screen.getByRole("button", { name: "Finish setup" }) as HTMLButtonElement;
}

describe("SetupWizard (T12, parity row 8)", () => {
  let fetchMock: FetchMock;
  let wizardCalls: Call[];
  let navigated: string[];

  function record(path: string, init?: RequestInit): void {
    let body: Record<string, unknown> = {};
    try {
      body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
    } catch {
      body = {};
    }
    wizardCalls.push({ path, init, body });
  }

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    wizardCalls = [];
    navigated = [];
    setLoginNavigation((path: string) => navigated.push(path));
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    setLoginNavigation((path: string) => window.location.assign(path));
  });

  function mockHappyPath(): void {
    fetchMock.mockImplementation((input: unknown, init?: RequestInit) => {
      const path = typeof input === "string" ? input : String((input as Request).url ?? input);
      if (path.startsWith("/api/setup/status")) {
        record(path, init);
        return Promise.resolve(
          jsonResponse(200, { ok: true, data: { complete: false } })
        );
      }
      if (path === "/api/setup") {
        record(path, init);
        return Promise.resolve(
          jsonResponse(200, {
            ok: true,
            data: { token_set: true, vault_initialized: false },
          })
        );
      }
      if (path.startsWith("/api/prefs")) {
        record(path, init);
        return Promise.resolve(jsonResponse(200, PREFS_OK));
      }
      if (path.startsWith("/api/world/fact")) {
        record(path, init);
        return Promise.resolve(jsonResponse(200, { ok: true, data: { key: "world.name" } }));
      }
      return Promise.resolve(jsonResponse(200, { ok: true, data: null }));
    });
  }

  it("fresh-install check queries /api/setup/status and shows the wizard", async () => {
    mockHappyPath();
    const { container } = renderWizard();
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1, name: "Welcome to your Project Worlds" })).toBeTruthy();
    });
    const status = wizardCalls.find((c) => c.path.startsWith("/api/setup/status"));
    expect(status).toBeTruthy();
    expect(await axeNoContrast(container)).toHaveNoViolations();
  });

  it("already-set-up install deep-links to sign-in instead of re-running setup", async () => {
    fetchMock.mockImplementation((input: unknown) => {
      const path = typeof input === "string" ? input : String((input as Request).url ?? input);
      if (path.startsWith("/api/setup/status")) {
        return Promise.resolve(
          jsonResponse(200, { ok: true, data: { complete: true } })
        );
      }
      return Promise.resolve(jsonResponse(200, { ok: true, data: null }));
    });
    renderWizard();
    await waitFor(() => {
      expect(screen.getByText(/already set up/)).toBeTruthy();
    });
    const link = screen.getByRole("button", { name: "Go to sign in" });
    fireEvent.click(link);
    expect(screen.getByText("LOGIN PAGE")).toBeTruthy();
    // No setup POST ever fired.
    expect(wizardCalls.some((c) => c.path === "/api/setup")).toBe(false);
  });

  it("token ≥8 validation: short token blocks Finish with an honest warning", async () => {
    mockHappyPath();
    renderWizard();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    const token = screen.getByLabelText("Login token") as HTMLInputElement;
    await waitFor(() => expect(token).toBeTruthy());
    fireEvent.change(token, { target: { value: "short" } });

    expect(screen.getByText(/At least 8 characters/)).toBeTruthy();
    // Step 4 (Finish) is not reachable with a too-short token.
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.queryByRole("button", { name: "Finish setup" })).toBeNull();
  });

  it("full flow: POST /api/setup, companion pref, world-name fact with canonical key", async () => {
    mockHappyPath();
    renderWizard();
    const finish = await walkToFinish();

    fireEvent.click(finish);
    await waitFor(() => {
      expect(screen.getByText(/Your world is ready/)).toBeTruthy();
    });

    // 1. POST /api/setup with token + companion + no vault passphrase.
    const setup = wizardCalls.find((c) => c.path === "/api/setup");
    expect(setup).toBeTruthy();
    expect(setup?.body.token).toBe("wizard-token-1");
    expect(setup?.body.companion).toBe("personal-world");
    expect(setup?.body.vault_passphrase).toBeUndefined();

    // 2. Companion pref saved (PUT /api/prefs carries the companion).
    const prefsPut = wizardCalls.find(
      (c) => c.path.startsWith("/api/prefs") && c.init?.method === "PUT"
    );
    expect(prefsPut?.body.companion).toBe("personal-world");

    // 3. World-name fact: POST /api/world/fact {key: "world.name", value}.
    const fact = wizardCalls.find((c) => c.path.startsWith("/api/world/fact"));
    expect(fact).toBeTruthy();
    expect(fact?.body.key).toBe("world.name");
    expect(fact?.body.value).toBe("My Project Worlds");

    // 4. Signed in: pw_token stored through the login path.
    expect(localStorage.getItem("pw_token")).toBe("wizard-token-1");
  });

  it("world name field flows into the world.name fact", async () => {
    mockHappyPath();
    renderWizard();
    const name = screen.getByLabelText("World name") as HTMLInputElement;
    fireEvent.change(name, { target: { value: "Rylee's Nook" } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    const token = screen.getByLabelText("Login token") as HTMLInputElement;
    fireEvent.change(token, { target: { value: "wizard-token-2" } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    const finish = await waitFor(() => {
      const b = screen.getByRole("button", { name: "Finish setup" }) as HTMLButtonElement;
      return b;
    });
    fireEvent.click(finish);
    await waitFor(() => {
      expect(screen.getByText(/Your world is ready/)).toBeTruthy();
    });
    const fact = wizardCalls.find((c) => c.path.startsWith("/api/world/fact"));
    expect(fact?.body.value).toBe("Rylee's Nook");
  });

  it("optional vault passphrase: set + mismatch warns; matching passphrase is sent", async () => {
    mockHappyPath();
    renderWizard();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    const token = screen.getByLabelText("Login token") as HTMLInputElement;
    fireEvent.change(token, { target: { value: "wizard-token-3" } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    const pass1 = screen.getByLabelText("Vault passphrase (optional)") as HTMLInputElement;
    const pass2 = screen.getByLabelText("Confirm") as HTMLInputElement;
    fireEvent.change(pass1, { target: { value: "vault-pass-9" } });
    fireEvent.change(pass2, { target: { value: "different" } });
    expect(screen.getByText(/Passphrases do not match/)).toBeTruthy();
    // Mismatch blocks finish.
    const blocked = screen.getByRole("button", { name: "Finish setup" }) as HTMLButtonElement;
    expect(blocked.disabled).toBe(true);

    fireEvent.change(pass2, { target: { value: "vault-pass-9" } });
    expect(blocked.disabled).toBe(false);
    fireEvent.click(blocked);
    await waitFor(() => {
      expect(screen.getByText(/Your world is ready/)).toBeTruthy();
    });
    const setup = wizardCalls.find((c) => c.path === "/api/setup");
    expect(setup?.body.vault_passphrase).toBe("vault-pass-9");
  });

  it("companion choice is a radio group; selection flows into POST /api/setup", async () => {
    mockHappyPath();
    renderWizard();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    const group = screen.getByRole("radiogroup", { name: "Companion" });
    expect(group).toBeTruthy();
    const squirrel = screen.getByRole("radio", { name: /Squirrel/ }) as HTMLElement;
    fireEvent.click(squirrel);
    expect(squirrel.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    const token = screen.getByLabelText("Login token") as HTMLInputElement;
    fireEvent.change(token, { target: { value: "wizard-token-4" } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Finish setup" }));
    await waitFor(() => {
      expect(screen.getByText(/Your world is ready/)).toBeTruthy();
    });
    const setup = wizardCalls.find((c) => c.path === "/api/setup");
    expect(setup?.body.companion).toBe("world-tree-squirrel");
    // …and into the bundled PUT /api/prefs — the all-or-nothing write
    // that the old wrong slug ("squirrel") made fail silently, taking
    // motion/contrast/density/text-scale/target-size down with it.
    const prefsPut = wizardCalls.find(
      (c) => c.path.startsWith("/api/prefs") && c.init?.method === "PUT"
    );
    expect(prefsPut?.body.companion).toBe("world-tree-squirrel");
  });

  it("Tacos & the Morning Paper sends the correct backend slug in BOTH the setup POST and the bundled prefs PUT", async () => {
    mockHappyPath();
    renderWizard();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    const tacos = screen.getByRole("radio", { name: /Tacos/ }) as HTMLElement;
    fireEvent.click(tacos);
    expect(tacos.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    const token = screen.getByLabelText("Login token") as HTMLInputElement;
    fireEvent.change(token, { target: { value: "wizard-token-6" } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Finish setup" }));
    await waitFor(() => {
      expect(screen.getByText(/Your world is ready/)).toBeTruthy();
    });
    const setup = wizardCalls.find((c) => c.path === "/api/setup");
    expect(setup?.body.companion).toBe("taco-news-truck");
    const prefsPut = wizardCalls.find(
      (c) => c.path.startsWith("/api/prefs") && c.init?.method === "PUT"
    );
    expect(prefsPut?.body.companion).toBe("taco-news-truck");
    // The whole bundle applied: the wizard names the companion saved
    // (the old wrong slug failed the entire PUT silently).
    expect(screen.getByText(/Companion saved/)).toBeTruthy();
  });

  it("server 400 (setup rejected) is shown specifically, no fake success", async () => {
    fetchMock.mockImplementation((input: unknown, init?: RequestInit) => {
      const path = typeof input === "string" ? input : String((input as Request).url ?? input);
      if (path.startsWith("/api/setup/status")) {
        return Promise.resolve(jsonResponse(200, { ok: true, data: { complete: false } }));
      }
      if (path === "/api/setup") {
        record(path, init);
        return Promise.resolve(jsonResponse(409, { detail: "setup already complete" }));
      }
      return Promise.resolve(jsonResponse(200, { ok: true, data: null }));
    });
    renderWizard();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    const token = screen.getByLabelText("Login token") as HTMLInputElement;
    fireEvent.change(token, { target: { value: "wizard-token-5" } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Finish setup" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy();
    });
    expect(screen.getByRole("alert").textContent).toContain("setup already complete");
    // No completion screen, no token stored behind the person's back.
    expect(screen.queryByText(/Your world is ready/)).toBeNull();
    expect(localStorage.getItem("pw_token")).toBeNull();
  });

  it("completion names partial success honestly (companion pref write fails)", async () => {
    fetchMock.mockImplementation((input: unknown, init?: RequestInit) => {
      const path = typeof input === "string" ? input : String((input as Request).url ?? input);
      if (path.startsWith("/api/setup/status")) {
        return Promise.resolve(jsonResponse(200, { ok: true, data: { complete: false } }));
      }
      if (path === "/api/setup") {
        record(path, init);
        return Promise.resolve(
          jsonResponse(200, {
            ok: true,
            data: { token_set: true, vault_initialized: true },
          })
        );
      }
      if (path.startsWith("/api/prefs")) {
        record(path, init);
        return Promise.resolve(jsonResponse(403, { detail: "write requires step-up auth" }));
      }
      if (path.startsWith("/api/world/fact")) {
        record(path, init);
        return Promise.resolve(jsonResponse(200, { ok: true, data: { key: "world.name" } }));
      }
      return Promise.resolve(jsonResponse(200, { ok: true, data: null }));
    });
    renderWizard();
    const finish = await walkToFinish();
    fireEvent.click(finish);
    await waitFor(() => {
      expect(screen.getByText(/Your world is ready/)).toBeTruthy();
    });
    expect(screen.getByText(/Vault initialized with your passphrase/)).toBeTruthy();
    expect(screen.getByText(/Companion will use the default for now/)).toBeTruthy();
    expect(screen.getByText(/World name saved/)).toBeTruthy();
  });

  it("axe: 0 violations across the wizard (color-contrast off only)", async () => {
    mockHappyPath();
    const { container } = renderWizard();
    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 1 })).toBeTruthy()
    );
    expect(await axeNoContrast(container)).toHaveNoViolations();
  });
});