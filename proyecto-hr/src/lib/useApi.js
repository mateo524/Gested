import { useState, useEffect, useRef } from "react";
import { apiFetch } from "../lib/api";

const cache = new Map();
const CACHE_TTL = 30000;

export function useApi(url, token, options = {}) {
  const { skip, cache: useCache = true, retries = 0 } = options;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(!skip);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (skip || !url) return;

    let cancelled = false;
    const cacheKey = `${url}|${token || ""}`;

    async function fetchData(attempt = 0) {
      if (!mountedRef.current) return;

      // cache hit
      if (useCache && cache.has(cacheKey)) {
        const cached = cache.get(cacheKey);
        if (Date.now() - cached.ts < CACHE_TTL) {
          if (!cancelled) { setData(cached.data); setLoading(false); }
          return;
        }
        cache.delete(cacheKey);
      }

      setLoading(true);
      setError(null);

      try {
        const json = await apiFetch(url, { token });
        if (useCache) cache.set(cacheKey, { data: json, ts: Date.now() });
        if (!cancelled) { setData(json); setLoading(false); }
      } catch (err) {
        if (attempt < retries && !cancelled) {
          if (cancelled) return;
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
          return fetchData(attempt + 1);
        }
        if (!cancelled) { setError(err.message); setLoading(false); }
      }
    }

    fetchData();

    return () => { cancelled = true; };
  }, [url, token, skip, useCache, retries]);

  return { data, loading, error };
}
