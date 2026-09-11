const API_BASE = import.meta.env.VITE_API_URL || "";

/**
 * Transition-only (until P2 cookie sessions): the bearer token lives in
 * localStorage after sign-in. It is NEVER read from build-time env —
 * anything in import.meta.env is inlined into the public bundle.
 */
export function getAuthToken(): string {
  return localStorage.getItem("pw_token") || "";
}

interface RequestInitWithAuth extends RequestInit {
  token?: string;
}

async function apiFetch<T>(
  path: string,
  options: RequestInitWithAuth = {}
): Promise<T> {
  const { token, ...fetchOptions } = options;
  const headers = new Headers(fetchOptions.headers);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...fetchOptions,
    headers,
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  const json = await response.json();
  return json.data !== undefined ? json.data : json;
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

// ── API Functions ──

export async function fetchWorld(token?: string): Promise<WorldData> {
  return apiFetch<WorldData>("/api/exports/world", { token });
}

export async function fetchWorldStatus(token?: string): Promise<WorldStatus> {
  return apiFetch<WorldStatus>("/api/status", { token });
}

export async function fetchReminders(token?: string): Promise<Reminder[]> {
  return apiFetch<Reminder[]>("/api/reminders", { token });
}

export async function fetchJournal(token?: string): Promise<JournalEntry[]> {
  return apiFetch<JournalEntry[]>("/api/journal", { token });
}

export async function fetchHealth(): Promise<HealthStatus> {
  return apiFetch<HealthStatus>("/healthz");
}

export async function fetchPrincipal(token?: string): Promise<Principal> {
  return apiFetch<Principal>("/api/identity/principal", { token });
}

// ── Vault API ──
export async function fetchVaultStatus(token: string) {
  return apiFetch<{ locked: boolean; encrypted: boolean }>("/api/vault/status", { token });
}

export async function fetchVaultNames(token: string) {
  return apiFetch<{ names: string[] }>("/api/vault/names", { token });
}

export async function unlockVault(token: string, passphrase: string) {
  return apiFetch<unknown>("/api/vault/unlock", {
    token,
    method: "POST",
    body: JSON.stringify({ passphrase }),
  });
}

export async function lockVault(token: string) {
  return apiFetch<unknown>("/api/vault/lock", { token, method: "POST" });
}

export async function setVaultSecret(token: string, name: string, value: string) {
  return apiFetch<unknown>("/api/vault/set", {
    token,
    method: "POST",
    body: JSON.stringify({ name, value }),
  });
}

export async function deleteVaultSecret(token: string, name: string) {
  return apiFetch<unknown>(`/api/vault/${name}`, { token, method: "DELETE" });
}

// ── Source Control API ──
export async function fetchSourceControlStatus(token: string) {
  return apiFetch<{ repos: any[] }>("/api/source-control/status", { token });
}

export async function fetchSourceControlHistory(token: string, repo: string, limit = 20) {
  return apiFetch<{ repo: string; commits: any[] }>(
    `/api/source-control/history?repo=${encodeURIComponent(repo)}&limit=${limit}`,
    { token }
  );
}

// ── Actors API ──
export async function fetchActors(token: string) {
  return apiFetch<any[]>("/api/actors", { token });
}

// ── Backup API ──
export async function fetchBackup(token: string) {
  return apiFetch<any>("/api/backup", { token });
}

// ── Themes API ──
export async function fetchThemes(token: string) {
  return apiFetch<any[]>("/api/themes", { token });
}

// ── Journal Audit API ──
export async function fetchJournalAudit(token: string) {
  return apiFetch<{ text: string }>("/api/journal/audit", { token });
}

// ── Exports API ──
export async function fetchExportSettings(token: string) {
  return apiFetch<any>("/api/exports/settings", { token });
}

export async function fetchExportStory(token: string) {
  return apiFetch<{ text: string }>("/api/exports/story", { token });
}

// ── Manifest API ──
export async function fetchManifest(token: string) {
  return apiFetch<any>("/api/manifest", { token });
}

// ── Updates API ──
export async function fetchUpdates(token: string) {
  return apiFetch<any>("/api/updates", { token });
}

// ── Chat Providers API ──
export async function fetchChatProviders(token: string) {
  return apiFetch<{ providers: any[]; active: string | null }>("/api/chat/providers", { token });
}

// ── Lab API ──
export async function fetchLabState(token: string) {
  return apiFetch<any>("/api/lab/state", { token });
}

export async function fetchLabHealth(token: string) {
  return apiFetch<any>("/api/lab/health", { token });
}

// ── Memory Search API ──
export async function fetchMemorySearch(token: string, query: string) {
  return apiFetch<any>(`/api/memory/search?q=${encodeURIComponent(query)}`, { token });
}
