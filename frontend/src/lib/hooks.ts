import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchWorld,
  fetchWorldStatus,
  fetchReminders,
  fetchJournal,
  fetchHealth,
  fetchPrincipal,
  fetchVaultStatus,
  fetchSourceControlStatus,
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
} from "./api";
import { getAuthToken } from "./api";

/**
 * T4 transitional data hooks: plain useState/useEffect replacing React
 * Query (dieted per FOUNDATION-SPEC §1.4). T6 replaces these with the
 * typed client + error mapping per §1.5; no cache layer was needed.
 */

export interface QueryState<T> {
  data: T | undefined;
  error: Error | null;
  isLoading: boolean;
  isError: boolean;
  refetch: () => Promise<void>;
}

function useApiQuery<T>(
  fn: (token: string) => Promise<T>,
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
      const result = await fn(getAuthToken());
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
  return useApiQuery<WorldData>((t) => fetchWorld(t), [], ["world"]);
}

export function useWorldStatus() {
  return useApiQuery<WorldStatus>((t) => fetchWorldStatus(t), [], ["worldStatus"]);
}

export function useReminders() {
  return useApiQuery<Reminder[]>((t) => fetchReminders(t), [], ["reminders"]);
}

export function useJournal() {
  return useApiQuery<JournalEntry[]>((t) => fetchJournal(t), [], ["journal"]);
}

export function useHealth() {
  return useApiQuery<HealthStatus>(() => fetchHealth());
}

export function usePrincipal() {
  const state = useApiQuery<Principal>((t) => fetchPrincipal(t));
  useEffect(() => {
    const handler = () => void state.refetch();
    window.addEventListener("principal-updated", handler);
    return () => window.removeEventListener("principal-updated", handler);
  }, [state]);
  return state;
}

// ── Refresh signals (transitional; T6 folds these into the typed
// client's invalidation surface) ──
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
export function useVaultStatus() {
  return useApiQuery<{ locked: boolean; encrypted: boolean }>((t) =>
    fetchVaultStatus(t)
  );
}

// ── Source Control hooks ──
export function useSourceControlStatus() {
  return useApiQuery<{ repos: any[] }>((t) => fetchSourceControlStatus(t));
}

// ── Actors hook ──
export function useActors() {
  return useApiQuery<any[]>((t) => fetchActors(t));
}

// ── Backup hook ──
export function useBackup() {
  return useApiQuery<any>((t) => fetchBackup(t));
}

// ── Themes hook ──
export function useThemes() {
  return useApiQuery<any[]>((t) => fetchThemes(t));
}

// ── Journal Audit hook ──
export function useJournalAudit() {
  return useApiQuery<{ text: string }>((t) => fetchJournalAudit(t));
}

// ── Exports hooks ──
export function useExportSettings() {
  return useApiQuery<any>((t) => fetchExportSettings(t));
}

export function useExportStory() {
  return useApiQuery<{ text: string }>((t) => fetchExportStory(t));
}

// ── Manifest hook ──
export function useManifest() {
  return useApiQuery<any>((t) => fetchManifest(t));
}

// ── Updates hook ──
export function useUpdates() {
  return useApiQuery<any>((t) => fetchUpdates(t));
}

// ── Chat Providers hook ──
export function useChatProviders() {
  return useApiQuery<{ providers: any[]; active: string | null }>((t) =>
    fetchChatProviders(t)
  );
}

// ── Lab hooks ──
export function useLabState() {
  return useApiQuery<any>((t) => fetchLabState(t));
}

export function useLabHealth() {
  return useApiQuery<any>((t) => fetchLabHealth(t));
}

// ── Memory Search hook ──
export function useMemorySearch(query: string) {
  return useApiQuery<any>((t) => fetchMemorySearch(t, query), [query]);
}