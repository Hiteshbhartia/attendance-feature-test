// Hybrid list store: in-memory cache + debounced Mongo sync via Arena API.
import { api, apiEnabled, getToken } from "./api-client";
import { DB_FIRST } from "./db-mode";

type Listener = () => void;

export type ApiListConfig<T extends { id: string }> = {
  legacyKey: string;
  apiPath: string;
  seed: T[];
};

export function createApiListStore<T extends { id: string }>(config: ApiListConfig<T>) {
  let cache: T[] = config.seed;
  let hydrated = false;
  const listeners = new Set<Listener>();
  const emit = () => listeners.forEach((l) => l());

  let syncTimer: ReturnType<typeof setTimeout> | null = null;
  const SYNC_DEBOUNCE_MS = 600;

  const loadLegacy = (): T[] => {
    if (DB_FIRST || typeof window === "undefined") return config.seed;
    try {
      const raw = window.localStorage.getItem(config.legacyKey);
      if (!raw) return config.seed;
      return JSON.parse(raw) as T[];
    } catch {
      return config.seed;
    }
  };

  const persistLegacy = (value: T[]) => {
    if (DB_FIRST || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(config.legacyKey, JSON.stringify(value));
    } catch {
      // quota
    }
  };

  const scheduleSync = () => {
    if (!apiEnabled || !getToken()) return;
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      syncTimer = null;
      void api
        .post<{ ok: boolean; upserted: number }>(`${config.apiPath}/bulk-upsert`, { items: cache })
        .catch((err) => console.warn(`[store] sync failed (${config.apiPath}):`, err));
    }, SYNC_DEBOUNCE_MS);
  };

  const read = (): T[] => {
    if (typeof window === "undefined") return config.seed;
    if (!hydrated) {
      cache = loadLegacy();
      hydrated = true;
    }
    return cache;
  };

  const write = (value: T[]) => {
    cache = value;
    hydrated = true;
    persistLegacy(value);
    emit();
    scheduleSync();
  };

  const ensureSeed = () => {
    if (DB_FIRST) {
      cache = config.seed;
      hydrated = true;
      return;
    }
    if (typeof window === "undefined") return;
    const existing = window.localStorage.getItem(config.legacyKey);
    if (!existing) {
      persistLegacy(config.seed);
    }
    cache = loadLegacy();
    hydrated = true;
    emit();
  };

  const subscribe = (fn: Listener) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  };

  async function hydrateFromApi(): Promise<boolean> {
    if (!apiEnabled || !getToken()) return false;
    if (syncTimer) return false; // Prevent overwriting pending local changes
    try {
      const res = await api.get<{ items: T[] }>(config.apiPath);
      if (res.items?.length) {
        cache = res.items;
        hydrated = true;
        persistLegacy(cache);
        emit();
        return true;
      }
    } catch (err) {
      console.warn(`[store] hydrate failed (${config.apiPath}):`, err);
    }
    return false;
  }

  function getLegacySnapshot(): T[] {
    return loadLegacy();
  }

  async function flushSync(): Promise<void> {
    if (!apiEnabled || !getToken()) return;
    if (syncTimer) {
      clearTimeout(syncTimer);
      syncTimer = null;
    }
    if (!cache.length) return;
    await api.post(`${config.apiPath}/bulk-upsert`, { items: cache });
  }

  return {
    read,
    write,
    subscribe,
    ensureSeed,
    emit,
    getServerSnapshot: () => config.seed,
    hydrateFromApi,
    getLegacySnapshot,
    flushSync,
  };
}
