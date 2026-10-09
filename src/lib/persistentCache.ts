/**
 * A small key → value cache kept in memory and in localStorage, so content
 * that rarely changes (place descriptions, key facts) shows at once on the
 * next visit, even after a relaunch. Entries expire after `ttlMs`; only the
 * `maxEntries` most recently used are kept, so it stays small next to the
 * React Query cache that shares localStorage.
 */
interface Entry<T> {
  v: T;
  /** Saved at (ms) — for expiry. */
  t: number;
  /** Last used at (ms) — for keeping the most recently used. */
  u: number;
}

export interface PersistentCache<T> {
  get(key: string): T | undefined;
  set(key: string, value: T): void;
}

export function createPersistentCache<T>(
  name: string,
  { maxEntries, ttlMs }: { maxEntries: number; ttlMs: number }
): PersistentCache<T> {
  const storageKey = `stampaway_cache_${name}`;
  let entries: Record<string, Entry<T>> | null = null;

  const load = (): Record<string, Entry<T>> => {
    if (entries) return entries;
    try {
      entries = JSON.parse(localStorage.getItem(storageKey) || "{}") as Record<string, Entry<T>>;
    } catch {
      entries = {};
    }
    return entries;
  };

  const save = () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(entries));
    } catch {
      // Storage full or unavailable: the in-memory copy still works.
    }
  };

  return {
    get(key) {
      const all = load();
      const entry = all[key];
      if (!entry) return undefined;
      if (Date.now() - entry.t > ttlMs) {
        delete all[key];
        save();
        return undefined;
      }
      entry.u = Date.now();
      return entry.v;
    },
    set(key, value) {
      const all = load();
      const now = Date.now();
      all[key] = { v: value, t: now, u: now };
      const keys = Object.keys(all);
      if (keys.length > maxEntries) {
        keys
          .sort((a, b) => all[a].u - all[b].u)
          .slice(0, keys.length - maxEntries)
          .forEach((k) => delete all[k]);
      }
      save();
    },
  };
}
