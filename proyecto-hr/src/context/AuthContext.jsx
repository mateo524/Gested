import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../lib/api";

const AuthContext = createContext(null);
const ACTIVE_COMPANY_KEY = "active_company_id";

const defaultBranding = {
  nombreVisible: "Performia",
  logoUrl: "",
  primaryColor: "#10b981",
  maxUploadSizeMb: 10,
};

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
  const [token, setToken] = useState(localStorage.getItem("token") || "");
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
    localStorage.setItem("token", nextToken);
    localStorage.setItem("user", JSON.stringify(nextUser));
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

      const nextCompanyId =
        localStorage.getItem(ACTIVE_COMPANY_KEY) ||
        nextUser.companyId ||
        companyList[0]?._id ||
        "";

      if (nextCompanyId) {
        setActiveCompanyId(nextCompanyId);
      }
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
    hydrateSessionData(nextToken, nextUser).finally(() => setSessionHydrating(false));
  }, [applySession, hydrateSessionData]);

  const updateSession = useCallback(async ({ token: nextToken, user: nextUser }) => {
    applySession(nextToken || token, nextUser);
    setSessionHydrating(true);
    await hydrateSessionData(nextToken || token, nextUser);
    setSessionHydrating(false);
  }, [applySession, hydrateSessionData, token]);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
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

    apiFetch("/auth/me", { token })
      .then(async (nextUser) => {
        localStorage.setItem("user", JSON.stringify(nextUser));
        setUser(nextUser);
        if (!user) {
          await hydrateSessionData(token, nextUser);
        }
      })
      .catch(() => logout());
  }, [hydrateSessionData, logout, sessionHydrating, token, user]);

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
  const tokenRemainingMs = tokenExpiresAt ? tokenExpiresAt.getTime() - Date.now() : 0;
  const tokenNearExpiry = tokenExpiresAt ? tokenRemainingMs <= 60 * 60 * 1000 : false;

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
      activeCompanyId,
      setActiveCompanyId,
      refreshCompanies: () => fetchCompanies(token, user),
      refreshBranding: () => fetchBranding(token),
      refreshAnnouncementSummary: () => fetchAnnouncementSummary(token),
      searchGlobally,
      login,
      updateSession,
      logout,
      isAuthenticated: !!token,
      hasPermission: (perm) => user?.permisos?.includes(perm),
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
      updateSession,
      user,
      sessionHydrating,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
