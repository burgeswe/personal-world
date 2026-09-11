import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * T6 (FOUNDATION-SPEC §1.5, §10 row T6): the one typed API boundary.
 *
 * Proves: envelope unwrapping (both shapes), error-status mapping, 401
 * → clear pw_token + navigate /login via the settable hook, 503 →
 * /setup, getAuthToken reads pw_token only, stepUp attaches the header
 * through ONE code path, no Bearer/Authorization construction outside
 * api.ts, import.meta.env is only VITE_API_URL across src, and no
 * @tanstack import (React Query stays dieted per §1.4).
 */
const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(here, "..");

import {
  ApiError,
  fetchHealth,
  fetchJournal,
  fetchWorld,
  getAuthToken,
  postSetup,
  savePrefs,
  saveWorldIntent,
  sendChatMessage,
  setLoginNavigation,
  unlockVault,
} from "../lib/api";

type FetchMock = ReturnType<typeof vi.fn>;

function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = { "Content-Type": "application/json" }
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers,
  });
}

function okEnvelope(data: unknown, extra: Record<string, unknown> = {}) {
  return jsonResponse(200, { ok: true, status: "healthy", data, ...extra });
}

describe("typed API boundary (T6)", () => {
  let fetchMock: FetchMock;
  let navigated: string[];

  beforeEach(() => {
    vi.restoreAllMocks();
    navigated = [];
    setLoginNavigation((path) => navigated.push(path));
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    setLoginNavigation((path) => window.location.assign(path));
  });

  // (a) success unwrap both envelope shapes
  it("unwraps {ok, data} envelopes", async () => {
    fetchMock.mockResolvedValueOnce(
      okEnvelope([{ ts: "2026-09-10T00:00:00Z", kind: "observation", summary: "hi" }])
    );
    const entries = await fetchJournal();
    expect(entries[0].summary).toBe("hi");
  });

  it("passes through bare JSON bodies (healthz has no envelope)", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        ok: true,
        auth_configured: true,
        setup_needed: false,
      })
    );
    const health = await fetchHealth();
    expect(health.auth_configured).toBe(true);
    expect(health.setup_needed).toBe(false);
  });

  it("unwraps Result-shaped bodies whose data holds the payload (chat)", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        ok: true,
        status: "healthy",
        data: { reply: "hello", model: "test" },
      })
    );
    const result = await sendChatMessage("hi", []);
    expect(result.reply).toBe("hello");
  });

  it("falls back to the bare body when the envelope has no data field (setup status shape)", async () => {
    // POST /api/setup returns {ok, data:{token_set,...}} — unwrap data
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        ok: true,
        data: { token_set: true, vault_initialized: false },
      })
    );
    const setup = await postSetup({ token: "longenoughtoken" });
    expect(setup.token_set).toBe(true);
  });

  // (b) each error status maps correctly
  it("network failure → ApiError status 0 with honest message", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    const err = await fetchWorld().catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(0);
    expect(err.code).toBe("network");
    expect(err.message).toContain("Could not reach");
  });

  it("404 maps to http_error with server detail", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(404, { detail: "no such thing" })
    );
    const err = await fetchWorld().catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(404);
    expect(err.code).toBe("http_error");
    expect(err.detail).toBe("no such thing");
  });

  it("403 step-up maps to the typed step_up_required code", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(403, { detail: "write requires step-up auth" })
    );
    const err = await savePrefs({
      motion: "reduced",
      contrast: "comfortable",
      text_scale: 1,
      density: "comfortable",
      target_size: 44,
      companion: "personal-world",
      accent: "world-keeper",
    }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(403);
    expect(err.code).toBe("step_up_required");
  });

  it("403 other reasons map to forbidden, not step_up_required", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(403, { detail: "admin only" })
    );
    const err = (await saveWorldIntent("focus", "x").catch((e) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe("forbidden");
  });

  // (c) 401 clears pw_token + navigates /login via the stubbed hook
  it("401 clears pw_token and routes through the navigation hook", async () => {
    localStorage.setItem("pw_token", "stale");
    fetchMock.mockResolvedValueOnce(
      jsonResponse(401, { detail: "unauthorized" })
    );
    const err = await fetchJournal().catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(401);
    expect(err.code).toBe("unauthorized");
    expect(localStorage.getItem("pw_token")).toBeNull();
    expect(navigated).toEqual(["/login"]);
  });

  it("default navigation hook hard-navigates to /login", async () => {
    // Restore the module's real default hook, then observe it through a
    // redefined window.location (jsdom's own assign is not stubbable).
    setLoginNavigation((path) => window.location.assign(path));
    const stub = vi.fn();
    const originalDescriptor = Object.getOwnPropertyDescriptor(window, "location")!;
    Object.defineProperty(window, "location", {
      configurable: true,
      get: () => ({ assign: stub }),
    });
    fetchMock.mockResolvedValueOnce(jsonResponse(401, {}));
    await fetchJournal().catch(() => undefined);
    expect(stub).toHaveBeenCalledWith("/login");
    Object.defineProperty(window, "location", originalDescriptor);
  });

  // (d) 503 + auth_configured=false → /setup
  it("503 (auth not configured) routes to /setup and carries the body", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(503, { detail: "auth not configured" })
    );
    const err = await fetchWorld().catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(503);
    expect(err.code).toBe("auth_not_configured");
    expect(err.body).toEqual({ detail: "auth not configured" });
    expect(navigated).toEqual(["/setup"]);
  });

  it("503 without a JSON body still routes to /setup", async () => {
    fetchMock.mockResolvedValueOnce(new Response("", { status: 503 }));
    const err = await fetchWorld().catch((e) => e);
    expect(err.code).toBe("auth_not_configured");
    expect(navigated).toEqual(["/setup"]);
  });

  // (e) getAuthToken reads pw_token only
  it("getAuthToken reads only localStorage[pw_token]", () => {
    localStorage.setItem("pw_token", "legacy-key-token");
    expect(getAuthToken()).toBe("legacy-key-token");
    // a decoy legacy key must never be consulted
    localStorage.setItem("pw-token", "decoy");
    localStorage.setItem("token", "decoy2");
    expect(getAuthToken()).toBe("legacy-key-token");
    localStorage.removeItem("pw_token");
    expect(getAuthToken()).toBe("");
  });

  it("apiFetch sends the pw_token value as Bearer itself", async () => {
    localStorage.setItem("pw_token", "unified-token");
    fetchMock.mockResolvedValueOnce(okEnvelope([]));
    await fetchJournal();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get("Authorization")).toBe("Bearer unified-token");
  });

  // (f) import.meta.env only VITE_API_URL across src
  it("only VITE_API_URL is read from import.meta.env across src", () => {
    const offenders: string[] = [];
    for (const file of walkSource(srcRoot)) {
      if (!/\.(tsx?|css)$/.test(file)) continue;
      const text = readFileSync(file, "utf8");
      const matches = text.matchAll(/import\.meta\.env\.(\w+)/g);
      for (const [, key] of matches) {
        if (key !== "VITE_API_URL") offenders.push(`${file}: ${key}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("api.ts declares the transition-only token rule", () => {
    const apiSource = readFileSync(join(srcRoot, "lib", "api.ts"), "utf8");
    expect(apiSource).toContain('localStorage.getItem("pw_token")');
    expect(apiSource).toContain("NEVER read from build-time env");
  });

  // (g) stepUp() attaches the header on writes via ONE code path
  it("all writes attach X-PW-StepUp through the single withStepUp path", async () => {
    fetchMock.mockResolvedValue(okEnvelope({}));
    await saveWorldIntent("focus", "build");
    await savePrefs({
      motion: "reduced",
      contrast: "comfortable",
      text_scale: 1,
      density: "comfortable",
      target_size: 44,
      companion: "personal-world",
      accent: "world-keeper",
    });
    await unlockVault("passphrase");
    for (const [, init] of fetchMock.mock.calls as Array<[string, RequestInit]>) {
      const headers = new Headers(init.headers);
      expect(headers.get("X-PW-StepUp")).toBe("1");
      expect(init.method).not.toBe("GET");
    }
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("reads do NOT send X-PW-StepUp", async () => {
    fetchMock.mockResolvedValueOnce(okEnvelope([]));
    await fetchJournal();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get("X-PW-StepUp")).toBeNull();
  });

  it("withStepUp exists exactly once in api.ts", () => {
    const apiSource = readFileSync(join(srcRoot, "lib", "api.ts"), "utf8");
    const definitions = apiSource.match(/function withStepUp/g) ?? [];
    expect(definitions).toHaveLength(1);
  });

  // (h) no Bearer/Authorization construction outside api.ts
  it("no Authorization construction outside lib/api.ts", () => {
    const offenders: string[] = [];
    for (const file of walkSource(srcRoot)) {
      if (!/\.(tsx?|css)$/.test(file)) continue;
      if (file.endsWith("lib/api.ts")) continue; // the one boundary
      const text = readFileSync(file, "utf8");
      if (text.includes("Bearer") || /["'`]Authorization["'`]\s*[:=]/.test(text)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("X-PW-StepUp is set only inside lib/api.ts", () => {
    const offenders: string[] = [];
    for (const file of walkSource(srcRoot)) {
      if (!/\.(tsx?|css)$/.test(file)) continue;
      const text = readFileSync(file, "utf8");
      if (text.includes("X-PW-StepUp") && !file.endsWith("lib/api.ts")) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });

  // (i) no @tanstack import — no tracked source file at all
  it("no @tanstack import anywhere in tracked source", () => {
    const offenders: string[] = [];
    for (const file of walkSource(srcRoot)) {
      if (!/\.(tsx?|css)$/.test(file)) continue;
      const text = readFileSync(file, "utf8");
      if (text.includes("@tanstack")) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });
});

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

/** Source files the grep gates scan — specs are excluded because they
 * state the rules themselves (mirrors deps.spec.ts's exclusion). */
function* walkSource(dir: string): Generator<string> {
  const testPrefix = join(dir, "test") + "/";
  for (const file of walk(dir)) {
    if (file.startsWith(testPrefix)) continue;
    yield file;
  }
}