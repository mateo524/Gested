// Simple in-memory cache with TTL. No external dependencies.
// Suitable for frequently-read, rarely-changing data: roles, competencies, settings.

const store = new Map(); // key → { value, expiresAt }

export function cacheGet(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { store.delete(key); return null; }
  return entry.value;
}

export function cacheSet(key, value, ttlSeconds = 60) {
  store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

export function cacheDelete(key) { store.delete(key); }
export function cacheClear() { store.clear(); }

export function cacheClearByPrefix(prefix) {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

// Convenience: get or fetch
export async function cacheGetOrFetch(key, fetchFn, ttlSeconds = 60) {
  const cached = cacheGet(key);
  if (cached !== null) return cached;
  const value = await fetchFn();
  cacheSet(key, value, ttlSeconds);
  return value;
}
