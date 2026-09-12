import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { axe } from "vitest-axe";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { LiveRegionProvider } from "../primitives/LiveRegion";
import { setLoginNavigation } from "../lib/api";
import LoginScreen from "../screens/LoginScreen";

/**
 * T12 LoginScreen spec (FOUNDATION-SPEC §1.5 + §7 row 9): token entry →
 * localStorage["pw_token"] → verified through the real /api/prefs
 * probe → navigate to /. A rejected token (401 through the T6
 * boundary) is reported as wrong — "Sign in" never means "a value was
 * stored". 401s anywhere land here through the T6 setLoginNavigation
 * hook (wired in App.tsx; the hook contract itself is proven in
 * api-errors.spec).
 *
 * axe 0 with color-contrast off only (jsdom cannot compute it; real
 * contrast is enforced by tokens + the Playwright gate).
 */

const axeNoContrast = (el: Element) =>
  axe(el, { rules: { "color-contrast": { enabled: false } } } as never);

type FetchMock = ReturnType<typeof vi.fn>;

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
  },
};

function renderLogin(initial = "/login") {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <LiveRegionProvider>
        <Routes>
          <Route path="/login" element={<LoginScreen />} />
          <Route path="/" element={<p>WORLD HOME</p>} />
          <Route path="/setup" element={<p>SETUP PAGE</p>} />
        </Routes>
      </LiveRegionProvider>
    </MemoryRouter>
  );
}

describe("LoginScreen (T12, parity row 9)", () => {
  let fetchMock: FetchMock;
  let navigated: string[];

  beforeEach(() => {
    localStorage.clear();
    navigated = [];
    // T6 hook wiring exactly as App.tsx does (SPA navigation, no reload).
    setLoginNavigation((path: string) => navigated.push(path));
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    setLoginNavigation((path: string) => window.location.assign(path));
  });

  it("token entry sets pw_token, verifies via /api/prefs, navigates to /", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, PREFS_OK));
    renderLogin();

    const input = screen.getByLabelText("Access code") as HTMLInputElement;
    const form = input.closest("form") as HTMLFormElement;
    await waitFor(() => {
      fireEvent.change(input, { target: { value: "correct-horse" } });
      fireEvent.submit(form);
    });

    await waitFor(() => {
      expect(screen.getByText("WORLD HOME")).toBeTruthy();
    });
    expect(localStorage.getItem("pw_token")).toBe("correct-horse");
    // The verification hit the real prefs probe (with the token).
    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path.startsWith("/api/prefs")).toBe(true);
    expect(new Headers(init.headers).get("Authorization")).toBe(
      "Bearer correct-horse"
    );
  });

  it("wrong token (401): pw_token cleared by the boundary, error shown, no navigation", async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, { detail: "unauthorized" }));
    renderLogin();

    const input = screen.getByLabelText("Access code") as HTMLInputElement;
    await waitFor(() => {
      fireEvent.change(input, { target: { value: "wrong-token" } });
      fireEvent.submit(input.closest("form") as HTMLFormElement);
    });

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy();
    });
    expect(screen.getByRole("alert").textContent).toContain(
      "did not unlock your world"
    );
    // The api boundary cleared the failed token (truth: no stale secret).
    expect(localStorage.getItem("pw_token")).toBeNull();
    expect(navigated).toEqual(["/login"]);
  });

  it("network failure keeps the typed token for correction, error shown", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    renderLogin();

    const input = screen.getByLabelText("Access code") as HTMLInputElement;
    await waitFor(() => {
      fireEvent.change(input, { target: { value: "maybe-right" } });
      fireEvent.submit(input.closest("form") as HTMLFormElement);
    });
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy();
    });
    // Server was never reached: the candidate stays so the person can
    // retry without retyping (a reachable server is not implied).
    expect(localStorage.getItem("pw_token")).toBe("maybe-right");
    expect(navigated).toEqual([]);
  });

  it("empty token cannot submit; busy state disables the control", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, PREFS_OK));
    renderLogin();

    const submit = screen.getByRole("button", { name: "Enter" }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    const input = screen.getByLabelText("Access code") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "x" } });
    expect(submit.disabled).toBe(false);
  });

  it("offers the setup deep-link for fresh installs", async () => {
    renderLogin();
    const link = screen.getByRole("link", { name: "Set up your world" });
    expect(link.getAttribute("href")).toBe("/setup");
  });

  it("axe: 0 violations (color-contrast off only)", async () => {
    const { container } = renderLogin();
    expect(await axeNoContrast(container)).toHaveNoViolations();
  });

  it("keyboard: Enter in the token field submits the form", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, PREFS_OK));
    renderLogin();
    const input = screen.getByLabelText("Access code") as HTMLInputElement;
    await waitFor(() => {
      fireEvent.change(input, { target: { value: "enter-key-token" } });
      fireEvent.keyDown(input, { key: "Enter" });
      fireEvent.submit(input.closest("form") as HTMLFormElement);
    });
    await waitFor(() => {
      expect(localStorage.getItem("pw_token")).toBe("enter-key-token");
    });
  });
});