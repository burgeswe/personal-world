import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchWorld,
  fetchWorldStatus,
  fetchReminders,
  fetchJournal,
  fetchJournalPage,
  fetchDaily,
  fetchApps,
  fetchHealth,
  fetchPrincipal,
  fetchVaultStatus,
  fetchVaultNames,
  fetchSourceControlStatus,
  fetchSections,
  fetchActors,
  fetchBackup,
  fetchThemes,
  fetchJournalAudit,
  fetchExportSettings,
  fetchExportStory,
  fetchManifest,
  fetchUpdates,
  fetchChatProviders,
  fetchLabState,
  fetchLabHealth,
  fetchMemorySearch,
  type WorldData,
  type WorldStatus,
  type Reminder,
  type JournalEntry,
  type HealthStatus,
  type Principal,
  type VaultStatusData,
  type VaultNamesData,
  type DailyResult,
  type DailyData,
  type ServiceApp,
  type SourceControlStatusData,
  type SectionData,
  type ChatProvidersData,
} from "./api";

/**
 * T6 data hooks: plain useState/useEffect on the typed client
 * (FOUNDATION-SPEC §1.5). apiFetch reads the token itself and maps
 * errors to ApiError; no cache layer was needed (screens re-fetch via
 * the refresh signals below, dedupe was never the bottleneck).
 */

export interface QueryState<T> {
  data: T | undefined;
  error: Error | null;
  isLoading: boolean;
  isError: boolean;
  refetch: () => Promise<void>;
}

function useApiQuery<T>(
  fn: () => Promise<T>,
  deps: unknown[] = [],
  signals: string[] = []
): QueryState<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const seq = useRef(0);

  const refetch = useCallback(async () => {
    const id = ++seq.current;
    setIsLoading(true);
    setError(null);
    try {
      const result = await fn();
      if (id === seq.current) {
        setData(result);
        setError(null);
      }
    } catch (e) {
      if (id === seq.current) setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      if (id === seq.current) setIsLoading(false);
    }
  }, deps);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  useEffect(() => {
    if (signals.length === 0) return;
    const unsubs = signals.map((s) => subscribeRefresh(s, () => void refetch()));
    return () => unsubs.forEach((u) => u());
  }, [refetch, signals]);

  return { data, error, isLoading, isError: error !== null, refetch };
}

export function useWorld() {
  return useApiQuery<WorldData>(() => fetchWorld(), [], ["world"]);
}

export function useWorldStatus() {
  return useApiQuery<WorldStatus>(() => fetchWorldStatus(), [], ["worldStatus"]);
}

export function useReminders() {
  return useApiQuery<Reminder[]>(() => fetchReminders(), [], ["reminders"]);
}

export function useJournal() {
  return useApiQuery<JournalEntry[]>(() => fetchJournal(), [], ["journal"]);
}

// ── T10 screen hooks (additive; parity rows 1–5) ──

/** GET /api/daily (Today, row 1): digest + attention + what-changed. */
export function useDaily() {
  return useApiQuery<DailyResult & { data: DailyData }>(
    () => fetchDaily(),
    [],
    ["daily", "worldStatus"]
  );
}

/** GET /api/journal?n= (Today recent + Journal reader, row 4). */
export function useJournalPage(n: number) {
  return useApiQuery<JournalEntry[]>(() => fetchJournalPage(n), [n], [
    "journal",
  ]);
}

/** GET /api/apps (Today services launcher, row 2). */
export function useApps() {
  return useApiQuery<ServiceApp[]>(() => fetchApps(), [], ["apps"]);
}

/** GET /api/vault/names (Vault, row 5). */
export function useVaultNames() {
  return useApiQuery<VaultNamesData>(() => fetchVaultNames());
}

export function useHealth() {
  return useApiQuery<HealthStatus>(() => fetchHealth());
}

export function usePrincipal() {
  const state = useApiQuery<Principal>(() => fetchPrincipal());
  useEffect(() => {
    const handler = () => void state.refetch();
    window.addEventListener("principal-updated", handler);
    return () => window.removeEventListener("principal-updated", handler);
  }, [state]);
  return state;
}

// ── Refresh signals (transitional; P1 screens re-fetch explicitly) ──
export function useSections() {
  return useApiQuery<SectionData[]>(() => fetchSections(), [], ["sections"]);
}
const refreshListeners = new Map<string, Set<() => void>>();

function subscribeRefresh(signal: string, fn: () => void): () => void {
  let set = refreshListeners.get(signal);
  if (!set) {
    set = new Set();
    refreshListeners.set(signal, set);
  }
  set.add(fn);
  return () => {
    set.delete(fn);
    if (set.size === 0) refreshListeners.delete(signal);
  };
}

function emitRefresh(signal: string) {
  refreshListeners.get(signal)?.forEach((fn) => fn());
}

export function useWorldKey(): () => void {
  return () => {
    emitRefresh("world");
    emitRefresh("worldStatus");
    emitRefresh("reminders");
  };
}

export function useJournalKey(): () => void {
  return () => emitRefresh("journal");
}

/** After a vault write, other surfaces showing vault status re-fetch. */
export function useVaultKey(): () => void {
  return () => emitRefresh("vaultStatus");
}
export function useVaultStatus() {
  return useApiQuery<VaultStatusData>(() => fetchVaultStatus(), [], ["vaultStatus"]);
}

// ── Source Control hooks ──
export function useSourceControlStatus() {
  return useApiQuery<SourceControlStatusData>(() => fetchSourceControlStatus());
}

// ── Actors hook ──
export function useActors() {
  return useApiQuery<unknown[]>(() => fetchActors());
}

// ── Backup hook ──
export function useBackup() {
  return useApiQuery<{ schema: string; world?: { facts?: Record<string, unknown> } }>(
    () => fetchBackup() as Promise<{ schema: string; world?: { facts?: Record<string, unknown> } }>
  );
}

// ── Themes hook ──
export function useThemes() {
  return useApiQuery<unknown[]>(() => fetchThemes());
}

// ── Journal Audit hook ──
export function useJournalAudit() {
  return useApiQuery<{ text: string }>(() => fetchJournalAudit());
}

// ── Exports hooks ──
export function useExportSettings() {
  return useApiQuery<unknown>(() => fetchExportSettings());
}

export function useExportStory() {
  return useApiQuery<{ text: string }>(() => fetchExportStory());
}

// ── Manifest hook ──
export function useManifest() {
  return useApiQuery<unknown>(() => fetchManifest());
}

// ── Updates hook ──
export function useUpdates() {
  return useApiQuery<unknown>(() => fetchUpdates());
}

// ── Chat Providers hook ──
export function useChatProviders() {
  return useApiQuery<ChatProvidersData>(() => fetchChatProviders());
}

// ── Lab hooks ──
export function useLabState() {
  return useApiQuery<unknown>(() => fetchLabState());
}

export function useLabHealth() {
  return useApiQuery<unknown>(() => fetchLabHealth());
}

// ── Memory Search hook ──
export function useMemorySearch(query: string) {
  return useApiQuery<unknown>(() => fetchMemorySearch(query), [query]);
}