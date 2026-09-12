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

/**
 * Same transport as apiFetch but keeps the whole `{ok, status,
 * warnings, actions, data}` envelope (T10): /api/daily is a Result
 * whose `actions`/`warnings` live at the envelope level, outside
 * `data`. Additive; no existing read changes behavior.
 */
export async function apiFetchEnvelope<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${getAuthToken()}`);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    throw new ApiError(0, "network", "Could not reach the server.");
  }
  if (!response.ok) {
    const raw = await response.json().catch(() => null);
    const detail = extractErrorDetail(raw);
    if (response.status === 401) {
      localStorage.removeItem("pw_token");
      navigateToLogin("/login");
      throw new ApiError(401, "unauthorized", "Sign-in required.");
    }
    if (response.status === 503) {
      navigateToLogin("/setup");
      throw new ApiError(
        503,
        "auth_not_configured",
        detail ?? "Server authentication is not configured yet.",
        { body: raw }
      );
    }
    if (response.status === 403 && detail !== null && /step-up/.test(detail)) {
      throw new ApiError(403, "step_up_required", detail, { detail, body: raw });
    }
    throw new ApiError(
      response.status,
      response.status === 403 ? "forbidden" : "http_error",
      detail ?? `Request failed (${response.status}).`,
      { detail, body: raw }
    );
  }
  const json: unknown = await response.json().catch(() => null);
  return json as T;
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

/**
 * GET /api/daily (T10 row 1): the read-only digest the daily loop
 * presents. `attention` merges capability warnings with drift/available
 * actions; `actions` is the "what changed" list — empty on a quiet day,
 * and TodayScreen must not invent content for it (parity row 1).
 */
export interface DailyData {
  world: {
    facts: number;
    intents: number;
    policies: number;
    cemented_policies: number;
    capabilities: number;
    providers: number;
    packs: number;
  };
  capabilities: Record<
    string,
    { ok: boolean; status: string; warnings: string[]; last_observed: string }
  >;
  attention: string[];
}
export type DailyResult = {
  ok: boolean;
  status: string;
  warnings: string[];
  actions: string[];
};

/** Service launcher entry: GET/PUT /api/apps (parity row 2). */
export interface ServiceApp {
  id: string;
  name: string;
  url: string;
  icon?: string;
  category?: string;
}

export async function fetchApps(): Promise<ServiceApp[]> {
  return apiFetch<ServiceApp[]>("/api/apps");
}
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
/** One entry of GET /api/chat/providers (api.py `chat_providers`). */
export interface ChatProviderInfo {
  name: string;
  display_name: string;
  /** Canonical status.py vocabulary for the provider's observation. */
  status: string;
  ok: boolean;
}

export type ChatProvidersData = {
  providers: ChatProviderInfo[];
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

/**
 * GET /api/journal?n=<limit> (T10 row 4): the journal reader loads in
 * pages; the server clamps/returns up to n events.
 */
export async function fetchJournalPage(n: number): Promise<JournalEntry[]> {
  return apiFetch<JournalEntry[]>(`/api/journal?n=${encodeURIComponent(n)}`);
}

/**
 * GET /api/daily (T10 row 1): the read-only digest (loop.py `daily`,
 * record=False). The body is a Result envelope whose `data` carries
 * the digest; `actions`/`warnings` live at the envelope level.
 */
export async function fetchDaily(): Promise<DailyResult & { data: DailyData }> {
  return apiFetchEnvelope<DailyResult & { data: DailyData }>("/api/daily");
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
  try {
    return await apiFetch<VaultNamesData>("/api/vault/names");
  } catch (err) {
    // A locked vault is the EXPECTED rest state, not a failure: the
    // backend answers 409 "vault is locked" and the screen renders
    // the honest locked status. Swallowing only this case keeps the
    // browser console clean (row 15) without hiding real errors.
    if (err instanceof ApiError && err.status === 409) {
      return { names: [] };
    }
    throw err;
  }
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

/**
 * Lab envelopes (T13, parity row 3): the lab routes answer 200 with
 * `ok:false` + `warnings` when the capability is absent or the CLI
 * fails (api.py lab_state/lab_health). apiFetch's envelope unwrap
 * would drop ok/status/warnings, and the Lab screen needs exactly
 * those to degrade honestly, so these two reads keep the envelope.
 */
export interface LabEnvelope {
  ok: boolean;
  status?: string;
  data?: unknown;
  warnings?: string[];
}

async function labEnvelope(path: string): Promise<LabEnvelope> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: new Headers({ Authorization: `Bearer ${getAuthToken()}` }),
    });
  } catch {
    throw new ApiError(0, "network", "Could not reach the server.");
  }
  if (response.status === 401) {
    localStorage.removeItem("pw_token");
    navigateToLogin("/login");
    throw new ApiError(401, "unauthorized", "Sign-in required.");
  }
  if (!response.ok) {
    const raw: unknown = await response.json().catch(() => null);
    const detail = extractErrorDetail(raw);
    throw new ApiError(
      response.status,
      "http_error",
      detail ?? `Request failed (${response.status}).`,
      { detail, body: raw }
    );
  }
  const json: unknown = await response.json().catch(() => null);
  if (!isRecord(json) || typeof json.ok !== "boolean") {
    throw new ApiError(
      500,
      "http_error",
      "Lab response was not the expected shape.",
      { body: json }
    );
  }
  return json as unknown as LabEnvelope;
}

export async function fetchLabState(): Promise<LabEnvelope> {
  return labEnvelope("/api/lab/state");
}

export async function fetchLabHealth(): Promise<LabEnvelope> {
  return labEnvelope("/api/lab/health");
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

/**
 * PUT /api/prefs partial update (T11 Settings): the server merges the
 * update into the stored prefs (api.py set_prefs validates every key,
 * collecting errors as one 400), so a single-key change is legitimate.
 */
export async function savePrefsPartial(
  updates: Partial<Prefs>
): Promise<Prefs> {
  return apiFetch<Prefs>("/api/prefs", {
    method: "PUT",
    headers: withStepUp(new Headers({ "Content-Type": "application/json" })),
    body: JSON.stringify(updates),
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

/**
 * PUT /api/apps (T10 row 2): replace the services launcher registry.
 * The screen always sends the full list (current + the new entry), the
 * shape the server persists (api.py apps_put).
 */
export async function saveApps(apps: ServiceApp[]): Promise<ServiceApp[]> {
  return apiFetch<ServiceApp[]>("/api/apps", {
    method: "PUT",
    headers: withStepUp(new Headers({ "Content-Type": "application/json" })),
    body: JSON.stringify({ apps }),
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

export async function saveWorldFact(
  key: string,
  value: string
): Promise<unknown> {
  return apiFetch<unknown>("/api/world/fact", {
    method: "POST",
    headers: withStepUp(new Headers({ "Content-Type": "application/json" })),
    body: JSON.stringify({ key, value }),
  });
}

export interface ChatResult {
  ok?: boolean;
  status?: string;
  warnings?: string[];
  /** The provider's visible reply (Result.data.reply — chat.py). */
  reply?: string;
  /**
   * Provider-supplied reasoning text, when the adapter exposes it
   * (ollama `thinking`); always treated as progressive-disclosure
   * material, never concatenated into the visible reply.
   */
  thinking?: string | null;
  /** Model identifier the provider reported (Result.data.model). */
  model?: string | null;
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

// ── T11 Settings additions (additive only; FOUNDATION-SPEC §7 row 6,
// §2.5). Shapes mirror api.py + prefs.py + theme_pack.py + scheduler.py
// exactly (tests/test_sections.py, tests/test_prefs.py,
// tests/test_prefs_schema_parity.py). ──

/**
 * GET /api/prefs/schema (spec §2.5): the read-only preference
 * vocabulary derived from prefs.PREFS. Settings renders its controls
 * FROM this payload — options are never hard-coded client-side, so the
 * UI can never offer a value the server would reject with 400.
 */
export interface PrefSchemaEntry {
  type: "enum" | "number";
  default: string | number;
  floor: string | number;
  /** enum: allowed values (most→least restrictive); number: allowed values or null (any ≥ floor). */
  allowed: string[] | number[] | null;
  /** number prefs only */
  integer?: boolean;
  unit?: string;
}

export type PrefsSchema = Record<string, PrefSchemaEntry>;

export async function fetchPrefsSchema(): Promise<PrefsSchema> {
  return apiFetch<PrefsSchema>("/api/prefs/schema");
}

/**
 * PUT /api/sections (spec §2.4): either key optional (omitted keeps the
 * stored value); `{"order": [], "hidden": []}` resets to server
 * defaults. Validation failures (unknown id, duplicate in order, pinned
 * id in hidden, non-list values) return one 400 whose detail carries
 * every error; ApiError.detail surfaces it verbatim.
 */
export interface SectionsLayoutUpdate {
  order?: string[];
  hidden?: string[];
}

export async function saveSections(update: SectionsLayoutUpdate): Promise<SectionsPayload> {
  return apiFetch<SectionsPayload>("/api/sections", {
    method: "PUT",
    headers: withStepUp(new Headers({ "Content-Type": "application/json" })),
    body: JSON.stringify(update),
  });
}

/**
 * Reminder write ops (api.py /api/reminders POST/PATCH/DELETE, all
 * require_step_up). POST body is `{text, cron_*}` (server generates the
 * id when omitted); PATCH toggles `{enabled}`; DELETE removes.
 */
export async function addReminder(
  text: string
): Promise<{ ok: boolean; data?: Reminder; warnings?: string[] }> {
  return apiFetch("/api/reminders", {
    method: "POST",
    headers: withStepUp(new Headers({ "Content-Type": "application/json" })),
    body: JSON.stringify({ text }),
  });
}

export async function toggleReminder(
  id: string,
  enabled: boolean
): Promise<{ ok: boolean; data?: Reminder; warnings?: string[] }> {
  return apiFetch(`/api/reminders/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: withStepUp(new Headers({ "Content-Type": "application/json" })),
    body: JSON.stringify({ enabled }),
  });
}

export async function deleteReminder(
  id: string
): Promise<{ ok: boolean; data?: unknown; warnings?: string[] }> {
  return apiFetch(`/api/reminders/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: withStepUp(new Headers()),
  });
}

/**
 * GET /api/themes (api.py themes_list): theme-pack manifests; Settings
 * uses them as companion-presets (legacy parity: a pack select PUTs
 * `companion: pack.name`). Unknown shapes stay `unknown` until a task
 * pins them.
 */
export interface ThemePackData {
  name: string;
  display_name: string;
}

// ── Setup (pre-auth; /api/setup and /api/setup/status are public
// routes — api.py registers them with no auth dependency) ──

/** GET /api/setup/status unwraps to `{complete: boolean}` (api.py). */
export interface SetupStatusData {
  complete: boolean;
}

export async function fetchSetupStatus(): Promise<SetupStatusData> {
  return apiFetch<SetupStatusData>("/api/setup/status");
}

export interface SetupResult {
  token_set: boolean;
  vault_initialized: boolean;
}

export async function postSetup(payload: {
  token: string;
  companion?: string;
  vault_passphrase?: string;
}): Promise<SetupResult> {
  return apiFetch<SetupResult>("/api/setup", {
    method: "POST",
    headers: new Headers({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
}