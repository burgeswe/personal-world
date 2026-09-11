const API_BASE = import.meta.env.VITE_API_URL || "";

/**
 * Transition-only (until P2 cookie sessions): the bearer token lives in
 * localStorage after sign-in. It is NEVER read from build-time env —
 * anything in import.meta.env is inlined into the public bundle.
 */
export function getAuthToken(): string {
  return localStorage.getItem("pw_token") || "";
}

/**
 * Where unauthenticated responses send the user. T12 owns the real
 * /login route; until then the default hard-navigates, and tests (or a
 * future router) stub this hook.
 */
let navigateToLogin: (path: string) => void = (path) =>
  window.location.assign(path);

export function setLoginNavigation(fn: (path: string) => void): void {
  navigateToLogin = fn;
}

export type ApiErrorCode =
  | "network"
  | "unauthorized"
  | "auth_not_configured"
  | "step_up_required"
  | "forbidden"
  | "http_error";

export class ApiError extends Error {
  /** 0 = network failure (request never got a response). */
  readonly status: number;
  readonly code: ApiErrorCode;
  /** Server-provided message (HTTPException detail), if any. */
  readonly detail: string | null;
  /** Parsed error body, when the server sent one. */
  readonly body: unknown;

  constructor(
    status: number,
    code: ApiErrorCode,
    message: string,
    options?: { detail?: string | null; body?: unknown }
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.detail = options?.detail ?? null;
    this.body = options?.body;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Transition-only (until P2 replaces it with real session step-up):
 * every write path must carry `X-PW-StepUp: 1`, exactly as the legacy
 * dashboard does (api.py `_step_up_authorized`). All POST/PUT/PATCH/
 * DELETE helpers in this file go through `withStepUp` so P2 removes it
 * in one place.
 */
function withStepUp(headers: Headers): Headers {
  headers.set("X-PW-StepUp", "1");
  return headers;
}

/**
 * Runtime-safe envelope unwrapping. Most handlers return
 * `{ok, status?, data, warnings?}` (api.py); a few (chat, memory
 * search, daily) return a Result-shaped body where `data` is the
 * payload itself. Reads fall back to the bare body only when the
 * envelope is malformed. `/healthz` is a bare JSON object with no
 * envelope at all and is typed explicitly at its call site.
 */
function unwrapEnvelope(json: unknown): unknown {
  if (!isRecord(json)) return json;
  if ("data" in json) return json.data;
  return json;
}

function extractErrorDetail(json: unknown): string | null {
  if (!isRecord(json)) return null;
  if (typeof json.detail === "string") return json.detail;
  const warnings = json.warnings;
  if (Array.isArray(warnings) && typeof warnings[0] === "string") {
    return warnings[0];
  }
  return null;
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${getAuthToken()}`);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });
  } catch {
    throw new ApiError(0, "network", "Could not reach the server.");
  }

  if (response.status === 401) {
    localStorage.removeItem("pw_token");
    navigateToLogin("/login");
    throw new ApiError(401, "unauthorized", "Sign-in required.");
  }

  if (response.status === 503) {
    const raw = await response.json().catch(() => null);
    const detail = extractErrorDetail(raw);
    navigateToLogin("/setup");
    throw new ApiError(
      503,
      "auth_not_configured",
      detail ?? "Server authentication is not configured yet.",
      { body: raw }
    );
  }

  if (response.status === 403) {
    const raw = await response.json().catch(() => null);
    const detail = extractErrorDetail(raw);
    if (detail !== null && /step-up/.test(detail)) {
      throw new ApiError(
        403,
        "step_up_required",
        detail,
        { detail, body: raw }
      );
    }
    throw new ApiError(
      403,
      "forbidden",
      detail ?? "Not allowed.",
      { detail, body: raw }
    );
  }

  if (!response.ok) {
    const raw = await response.json().catch(() => null);
    const detail = extractErrorDetail(raw);
    throw new ApiError(
      response.status,
      "http_error",
      detail ?? `Request failed (${response.status}).`,
      { detail, body: raw }
    );
  }

  const json: unknown = await response.json().catch(() => null);
  return unwrapEnvelope(json) as T;
}

// ── Types ──

export interface WorldData {
  schema: string;
  intents: Record<string, { key: string; value: string }>;
  policies: Record<string, unknown>;
  lore: Record<string, unknown>;
  packs: unknown[];
  accessibility: {
    motion: string;
    contrast: string;
    text_scale: number;
    density: string;
    targets: string;
  };
}

export interface WorldStatus {
  facts: number;
  intents: number;
  policies: number;
  cemented_policies: number;
  lore: {
    confirmed: number;
    derived: number;
    suggested: number;
    ephemeral: number;
  };
  capabilities: Record<string, {
    ok: boolean;
    status: string;
    warnings: string[];
    last_observed: string;
  }>;
  providers: number;
  packs: number;
  actors: Array<{
    name: string;
    role: string;
    provider: string;
    capabilities: string[];
    status: string;
    secrets: string;
    writes: string;
  }>;
}

export interface Reminder {
  id: string;
  text: string;
  enabled: boolean;
  created_at: string;
}

export interface JournalEntry {
  ts: string;
  kind: string;
  summary: string;
  provenance: {
    source: string;
    observed_at: string;
    provider: string | null;
    authority: string;
  };
  classification: string;
}

/** Bare JSON — /healthz has no envelope (api.py `healthz`). */
export interface HealthStatus {
  ok: boolean;
  auth_configured: boolean;
  setup_needed: boolean;
}

export interface Principal {
  id: string;
  kind: string;
  display_name: string;
  scopes: string[];
  source: string;
}

export interface Prefs {
  motion: string;
  contrast: string;
  text_scale: number;
  density: string;
  target_size: number;
  companion: string;
  accent: string;
}

/**
 * GET /api/sections (T9, FOUNDATION-SPEC §2.3): the nav registry merged
 * with the caller's stored layout. `status` is the canonical status.py
 * vocabulary or null (never an invented value); `configured` answers
 * "is something wired up?" while `status` answers "how is it doing?".
 * Neither affects navigability — a failing or unconfigured provider
 * never removes a section from the payload.
 */
export interface SectionData {
  id: string;
  label: string;
  /** Sprite symbol id (icons/sprite.svg), e.g. "navigation--today". */
  icon: string;
  order: number;
  visible: boolean;
  pinned: boolean;
  kind: "core" | "transitional" | "extension";
  configured: boolean;
  status: string | null;
}

export interface SectionsPayload {
  schema: string;
  sections: SectionData[];
}

/**
 * GET /api/sections unwraps to `{schema, sections}` (api.py
 * _sections_payload); the hook wants the section list itself.
 */
export async function fetchSections(): Promise<SectionData[]> {
  const payload = await apiFetch<SectionsPayload>("/api/sections");
  const sections = (payload as { sections?: SectionData[] }).sections;
  if (!Array.isArray(sections)) {
    throw new ApiError(500, "http_error", "Sections response was not the expected shape.", {
      body: payload,
    });
  }
  return sections;
}

/** Shapes not yet pinned by a screen task (T10–T13 tighten them). */
export type VaultStatusData = { locked: boolean; encrypted: boolean };
export type VaultNamesData = { names: string[] };
export type SourceControlRepo = {
  name: string;
  branch: string | null;
  dirty: boolean | null;
};
export type SourceControlStatusData = { repos: SourceControlRepo[] };
export type SourceControlHistoryData = {
  repo: string;
  commits: unknown[];
};
export type ChatProvidersData = {
  providers: unknown[];
  active: string | null;
};

// ── Reads ──

export async function fetchWorld(): Promise<WorldData> {
  return apiFetch<WorldData>("/api/exports/world");
}

export async function fetchWorldStatus(): Promise<WorldStatus> {
  return apiFetch<WorldStatus>("/api/status");
}

export async function fetchReminders(): Promise<Reminder[]> {
  return apiFetch<Reminder[]>("/api/reminders");
}

export async function fetchJournal(): Promise<JournalEntry[]> {
  return apiFetch<JournalEntry[]>("/api/journal");
}

export async function fetchHealth(): Promise<HealthStatus> {
  const json = await apiFetch<unknown>("/healthz");
  return json as HealthStatus;
}

export async function fetchPrincipal(): Promise<Principal> {
  return apiFetch<Principal>("/api/identity/principal");
}

export async function fetchPrefs(): Promise<Prefs> {
  return apiFetch<Prefs>("/api/prefs");
}

export async function fetchVaultStatus(): Promise<VaultStatusData> {
  return apiFetch<VaultStatusData>("/api/vault/status");
}

export async function fetchVaultNames(): Promise<VaultNamesData> {
  return apiFetch<VaultNamesData>("/api/vault/names");
}

export async function fetchSourceControlStatus(): Promise<SourceControlStatusData> {
  return apiFetch<SourceControlStatusData>("/api/source-control/status");
}

export async function fetchSourceControlHistory(
  repo: string,
  limit = 20
): Promise<SourceControlHistoryData> {
  return apiFetch<SourceControlHistoryData>(
    `/api/source-control/history?repo=${encodeURIComponent(repo)}&limit=${limit}`
  );
}

export async function fetchActors(): Promise<unknown[]> {
  return apiFetch<unknown[]>("/api/actors");
}

export async function fetchBackup(): Promise<unknown> {
  return apiFetch<unknown>("/api/backup");
}

export async function fetchThemes(): Promise<unknown[]> {
  return apiFetch<unknown[]>("/api/themes");
}

export async function fetchJournalAudit(): Promise<{ text: string }> {
  return apiFetch<{ text: string }>("/api/journal/audit");
}

export async function fetchExportSettings(): Promise<unknown> {
  return apiFetch<unknown>("/api/exports/settings");
}

export async function fetchExportStory(): Promise<{ text: string }> {
  return apiFetch<{ text: string }>("/api/exports/story");
}

export async function fetchManifest(): Promise<unknown> {
  return apiFetch<unknown>("/api/manifest");
}

export async function fetchUpdates(): Promise<unknown> {
  return apiFetch<unknown>("/api/updates");
}

export async function fetchChatProviders(): Promise<ChatProvidersData> {
  return apiFetch<ChatProvidersData>("/api/chat/providers");
}

export async function fetchLabState(): Promise<unknown> {
  return apiFetch<unknown>("/api/lab/state");
}

export async function fetchLabHealth(): Promise<unknown> {
  return apiFetch<unknown>("/api/lab/health");
}

export async function fetchMemorySearch(query: string): Promise<unknown> {
  return apiFetch<unknown>(`/api/memory/search?q=${encodeURIComponent(query)}`);
}

export async function fetchConnections(): Promise<unknown[]> {
  return apiFetch<unknown[]>("/api/connections");
}

// ── Writes (all step-up gated through withStepUp) ──

export async function unlockVault(passphrase: string): Promise<unknown> {
  return apiFetch<unknown>("/api/vault/unlock", {
    method: "POST",
    headers: withStepUp(new Headers({ "Content-Type": "application/json" })),
    body: JSON.stringify({ passphrase }),
  });
}

export async function lockVault(): Promise<unknown> {
  return apiFetch<unknown>("/api/vault/lock", {
    method: "POST",
    headers: withStepUp(new Headers()),
  });
}

export async function setVaultSecret(
  name: string,
  value: string
): Promise<unknown> {
  return apiFetch<unknown>("/api/vault/set", {
    method: "POST",
    headers: withStepUp(new Headers({ "Content-Type": "application/json" })),
    body: JSON.stringify({ name, value }),
  });
}

export async function deleteVaultSecret(name: string): Promise<unknown> {
  return apiFetch<unknown>(`/api/vault/${encodeURIComponent(name)}`, {
    method: "DELETE",
    headers: withStepUp(new Headers()),
  });
}

export async function savePrefs(prefs: Prefs): Promise<Prefs> {
  return apiFetch<Prefs>("/api/prefs", {
    method: "PUT",
    headers: withStepUp(new Headers({ "Content-Type": "application/json" })),
    body: JSON.stringify(prefs),
  });
}

export async function savePrincipalDisplayName(
  display_name: string
): Promise<unknown> {
  return apiFetch<unknown>("/api/identity/principal", {
    method: "PUT",
    headers: withStepUp(new Headers({ "Content-Type": "application/json" })),
    body: JSON.stringify({ display_name }),
  });
}

export async function saveConnection(payload: unknown): Promise<unknown> {
  return apiFetch<unknown>("/api/connections", {
    method: "PUT",
    headers: withStepUp(new Headers({ "Content-Type": "application/json" })),
    body: JSON.stringify(payload),
  });
}

export async function validateConnection(payload: unknown): Promise<unknown> {
  return apiFetch<unknown>("/api/connections/validate", {
    method: "POST",
    headers: withStepUp(new Headers({ "Content-Type": "application/json" })),
    body: JSON.stringify(payload),
  });
}

export async function saveJournalEntry(text: string): Promise<unknown> {
  return apiFetch<unknown>("/api/journal", {
    method: "POST",
    headers: withStepUp(new Headers({ "Content-Type": "application/json" })),
    body: JSON.stringify({ text }),
  });
}

export async function saveWorldIntent(
  key: string,
  value: string
): Promise<unknown> {
  return apiFetch<unknown>("/api/world/intent", {
    method: "POST",
    headers: withStepUp(new Headers({ "Content-Type": "application/json" })),
    body: JSON.stringify({ key, value }),
  });
}

export async function saveWorldPolicy(
  key: string,
  effect: string
): Promise<unknown> {
  return apiFetch<unknown>("/api/world/policy", {
    method: "POST",
    headers: withStepUp(new Headers({ "Content-Type": "application/json" })),
    body: JSON.stringify({ key, effect }),
  });
}

export interface ChatResult {
  ok?: boolean;
  status?: string;
  warnings?: string[];
  reply?: string;
}

export async function sendChatMessage(
  message: string,
  history: Array<{ role: string; content: string }>
): Promise<ChatResult> {
  return apiFetch<ChatResult>("/api/chat", {
    method: "POST",
    headers: withStepUp(new Headers({ "Content-Type": "application/json" })),
    body: JSON.stringify({ message, history }),
  });
}

// ── Setup (pre-auth; /api/setup and /api/setup/status are public
// routes — api.py registers them with no auth dependency) ──

export async function fetchSetupStatus(): Promise<unknown> {
  return apiFetch<unknown>("/api/setup/status");
}

export interface SetupResult {
  token_set: boolean;
  vault_initialized: boolean;
}

export async function postSetup(payload: {
  token: string;
  companion?: string;
}): Promise<SetupResult> {
  return apiFetch<SetupResult>("/api/setup", {
    method: "POST",
    headers: new Headers({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
}