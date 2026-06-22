import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "../lib/api";

const AuthContext = createContext(null);
const ACTIVE_COMPANY_KEY = "active_company_id";

const defaultBranding = {
  nombreVisible: "ZENTOR",
  logoUrl: "",
  primaryColor: "#10b981",
  maxUploadSizeMb: 10,
};

function safeUserCache(u) {
  if (!u) return null;
  const { permisos, isSuperAdmin, roleKey, ...safe } = u;
  return safe;
}

function decodeTokenPayload(token) {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(normalized);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}


export function AuthProvider({ children }) {
  // Access token lives only in memory — never written to localStorage.
  // On page load the bootstrap effect below exchanges the httpOnly refresh
  // cookie for a fresh access token via POST /auth/refresh.
  const [token, setToken] = useState("");
  const [user, setUser] = useState(JSON.parse(localStorage.getItem("user") || "null"));
  const [companies, setCompanies] = useState([]);
  const [branding, setBranding] = useState(defaultBranding);
  const [announcementSummary, setAnnouncementSummary] = useState({
    unreadCount: 0,
    latest: [],
  });
  const [globalSearchResults, setGlobalSearchResults] = useState({
    companies: [],
    files: [],
    announcements: [],
  });
  const [activeCompanyId, setActiveCompanyIdState] = useState(
    localStorage.getItem(ACTIVE_COMPANY_KEY) || ""
  );
  const [sessionHydrating, setSessionHydrating] = useState(false);
  // True while the initial cookie→token exchange is in flight.
  // Consumers can show a loading screen instead of redirecting to login.
  const [sessionBootstrapping, setSessionBootstrapping] = useState(true);

  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Bootstrap: exchange the httpOnly refresh cookie for an access token.
  // Runs once on mount so the user stays logged in across page reloads.
  useEffect(() => {
    apiFetch("/auth/refresh", { method: "POST" })
      .then(({ token: t, user: u }) => {
        setToken(t);
        setUser(u);
        localStorage.setItem("user", JSON.stringify(safeUserCache(u)));
      })
      .catch(() => {
        // No valid refresh cookie — clear stale cached user.
        localStorage.removeItem("user");
        setUser(null);
      })
      .finally(() => setSessionBootstrapping(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setActiveCompanyId = useCallback((companyId) => {
    if (!companyId) {
      localStorage.removeItem(ACTIVE_COMPANY_KEY);
      setActiveCompanyIdState("");
      return;
    }

    localStorage.setItem(ACTIVE_COMPANY_KEY, companyId);
    setActiveCompanyIdState(companyId);
  }, []);

  const applySession = useCallback((nextToken, nextUser) => {
    // Token is memory-only — NOT stored in localStorage.
    // user is cached in localStorage for fast paint on next load (non-sensitive).
    localStorage.setItem("user", JSON.stringify(safeUserCache(nextUser)));
    setToken(nextToken);
    setUser(nextUser);
  }, []);

  const fetchBranding = useCallback(async (nextToken) => {
    if (!nextToken) {
      setBranding(defaultBranding);
      return;
    }

    try {
      const settings = await apiFetch("/settings", { token: nextToken });
      setBranding({ ...defaultBranding, ...(settings || {}) });
    } catch {
      setBranding(defaultBranding);
    }
  }, []);

  const fetchAnnouncementSummary = useCallback(async (nextToken) => {
    if (!nextToken) {
      setAnnouncementSummary({ unreadCount: 0, latest: [] });
      return;
    }

    try {
      const data = await apiFetch("/announcements/summary", { token: nextToken });
      setAnnouncementSummary({
        unreadCount: data.unreadCount || 0,
        latest: data.latest || [],
      });
    } catch {
      setAnnouncementSummary({ unreadCount: 0, latest: [] });
    }
  }, []);

  const searchGlobally = useCallback(async (q) => {
    if (!token || !user?.isSuperAdmin || !q?.trim()) {
      setGlobalSearchResults({ companies: [], files: [], announcements: [] });
      return;
    }

    try {
      const data = await apiFetch(`/search/global?q=${encodeURIComponent(q.trim())}`, { token });
      setGlobalSearchResults(data);
    } catch {
      setGlobalSearchResults({ companies: [], files: [], announcements: [] });
    }
  }, [token, user?.isSuperAdmin]);

  const fetchCompanies = useCallback(async (nextToken, nextUser) => {
    if (!nextToken) {
      setCompanies([]);
      return;
    }

    if (!nextUser?.isSuperAdmin && !nextUser?.permisos?.includes("manage_companies")) {
      setCompanies([]);
      return;
    }

    try {
      const companyList = await apiFetch("/companies", { token: nextToken });
      setCompanies(companyList);

      const storedId = localStorage.getItem(ACTIVE_COMPANY_KEY);
      const validIds = new Set((Array.isArray(companyList) ? companyList : []).map((c) => String(c._id)));

      const nextCompanyId =
        (storedId && validIds.has(storedId) ? storedId : null) ||
        nextUser.companyId ||
        companyList[0]?._id ||
        "";

      // Always call setActiveCompanyId — passing "" clears the stale value from localStorage
      setActiveCompanyId(nextCompanyId || "");
    } catch {
      setCompanies([]);
    }
  }, [setActiveCompanyId]);

  const hydrateSessionData = useCallback(async (nextToken, nextUser) => {
    await Promise.allSettled([
      fetchCompanies(nextToken, nextUser),
      fetchBranding(nextToken),
      fetchAnnouncementSummary(nextToken),
    ]);
  }, [fetchAnnouncementSummary, fetchBranding, fetchCompanies]);

  const login = useCallback(async ({ token: nextToken, user: nextUser }) => {
    applySession(nextToken, nextUser);
    setSessionHydrating(true);
    try {
      await hydrateSessionData(nextToken, nextUser);
    } finally {
      setSessionHydrating(false);
    }
  }, [applySession, hydrateSessionData]);

  const updateSession = useCallback(async ({ token: nextToken, user: nextUser }) => {
    applySession(nextToken || token, nextUser);
    setSessionHydrating(true);
    await hydrateSessionData(nextToken || token, nextUser);
    setSessionHydrating(false);
  }, [applySession, hydrateSessionData, token]);

  const logout = useCallback(() => {
    // Ask the server to clear the httpOnly refresh cookie.
    apiFetch("/auth/logout", { method: "POST" }).catch(() => {});
    localStorage.removeItem("user");
    localStorage.removeItem(ACTIVE_COMPANY_KEY);
    setToken("");
    setUser(null);
    setCompanies([]);
    setBranding(defaultBranding);
    setAnnouncementSummary({ unreadCount: 0, latest: [] });
    setGlobalSearchResults({ companies: [], files: [], announcements: [] });
    setActiveCompanyIdState("");
  }, []);

  useEffect(() => {
    if (!token || sessionHydrating) return;

    apiFetch("/auth/me", { token, timeoutMs: 30000 })
      .then(async (nextUser) => {
        localStorage.setItem("user", JSON.stringify(safeUserCache(nextUser)));
        setUser(nextUser);
        if (!userRef.current) {
          await hydrateSessionData(token, nextUser);
        }
      })
      .catch((error) => {
        // Only force-logout on explicit 401 (invalid/expired token).
        // Network errors and timeouts keep the cached session alive —
        // the user shouldn't be logged out just because Render is warming up.
        if (error?.status === 401) {
          logout();
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, sessionHydrating]); // intentionally omit user to avoid re-running on every user update

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--performia-primary", branding.primaryColor || "#10b981");
    root.style.setProperty("--performia-primary-soft", `${branding.primaryColor || "#10b981"}22`);
  }, [branding.primaryColor]);

  const activeCompany = useMemo(
    () => companies.find((company) => company._id === activeCompanyId) || null,
    [activeCompanyId, companies]
  );
  const tokenPayload = useMemo(() => (token ? decodeTokenPayload(token) : null), [token]);
  const tokenExpiresAt = useMemo(
    () => (tokenPayload?.exp ? new Date(tokenPayload.exp * 1000) : null),
    [tokenPayload]
  );

  const computeTokenTimes = useCallback(() => {
    if (!tokenExpiresAt) return { remainingMs: 0, nearExpiry: false };
    const remainingMs = tokenExpiresAt.getTime() - Date.now();
    return { remainingMs, nearExpiry: remainingMs <= 60 * 60 * 1000 };
  }, [tokenExpiresAt]);

  const [tokenTimes, setTokenTimes] = useState(computeTokenTimes);

  useEffect(() => {
    setTokenTimes(computeTokenTimes());
    const interval = setInterval(() => setTokenTimes(computeTokenTimes()), 60 * 1000);
    return () => clearInterval(interval);
  }, [computeTokenTimes]);

  // Silent refresh — fires 30 min before expiry, keeps session alive without re-login
  useEffect(() => {
    if (!tokenExpiresAt || !token) return;
    const REFRESH_BEFORE_MS = 30 * 60 * 1000;
    const msUntilRefresh = tokenExpiresAt.getTime() - Date.now() - REFRESH_BEFORE_MS;
    if (msUntilRefresh <= 0) return;
    const id = setTimeout(async () => {
      try {
        const data = await apiFetch("/auth/refresh", { method: "POST" });
        if (data?.token && data?.user) {
          applySession(data.token, data.user);
        }
      } catch {
        // Refresh failed — session will show near-expiry warning, user re-logs manually
      }
    }, msUntilRefresh);
    return () => clearTimeout(id);
  }, [tokenExpiresAt, token, applySession]);

  const tokenRemainingMs = tokenTimes.remainingMs;
  const tokenNearExpiry = tokenTimes.nearExpiry;

  const value = useMemo(
    () => ({
      token,
      user,
      companies,
      branding,
      announcementSummary,
      globalSearchResults,
      activeCompany,
      tokenExpiresAt,
      tokenNearExpiry,
      tokenRemainingMs,
      activeCompanyId,
      setActiveCompanyId,
      refreshCompanies: () => fetchCompanies(token, user),
      refreshBranding: () => fetchBranding(token),
      refreshAnnouncementSummary: () => fetchAnnouncementSummary(token),
      searchGlobally,
      login,
      updateSession,
      logout,
      sessionBootstrapping,
      isAuthenticated: !!token,
      hasPermission: (perm) => user?.permisos?.includes(perm),
      modules: user?.modules ?? null,
      hasModule: (key) => {
        if (user?.isSuperAdmin) return true;
        if (!user?.modules) return true;
        return user.modules[key] !== false;
      },
      sessionHydrating,
    }),
    [
      activeCompany,
      activeCompanyId,
      announcementSummary,
      branding,
      companies,
      fetchAnnouncementSummary,
      fetchBranding,
      fetchCompanies,
      globalSearchResults,
      login,
      logout,
      searchGlobally,
      setActiveCompanyId,
      token,
      tokenExpiresAt,
      tokenNearExpiry,
      tokenRemainingMs,
      updateSession,
      user,
      sessionHydrating,
      sessionBootstrapping,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
