import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../lib/api";

const AuthContext = createContext(null);
const ACTIVE_COMPANY_KEY = "active_company_id";

const defaultBranding = {
  nombreVisible: "Performia",
  logoUrl: "",
  primaryColor: "#10b981",
  maxUploadSizeMb: 10,
};

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

  const setActiveCompanyId = (companyId) => {
    if (!companyId) {
      localStorage.removeItem(ACTIVE_COMPANY_KEY);
      setActiveCompanyIdState("");
      return;
    }

    localStorage.setItem(ACTIVE_COMPANY_KEY, companyId);
    setActiveCompanyIdState(companyId);
  };

  const applySession = (nextToken, nextUser) => {
    localStorage.setItem("token", nextToken);
    localStorage.setItem("user", JSON.stringify(nextUser));
    setToken(nextToken);
    setUser(nextUser);
  };

  const fetchBranding = async (nextToken) => {
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
  };

  const fetchAnnouncementSummary = async (nextToken) => {
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
  };

  const searchGlobally = async (q) => {
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
  };

  const fetchCompanies = async (nextToken, nextUser) => {
    if (!nextToken || !nextUser?.permisos?.includes("manage_companies")) {
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
  };

  const login = async ({ token: nextToken, user: nextUser }) => {
    applySession(nextToken, nextUser);
    await Promise.all([
      fetchCompanies(nextToken, nextUser),
      fetchBranding(nextToken),
      fetchAnnouncementSummary(nextToken),
    ]);
  };

  const updateSession = async ({ token: nextToken, user: nextUser }) => {
    applySession(nextToken || token, nextUser);
    await Promise.all([
      fetchCompanies(nextToken || token, nextUser),
      fetchBranding(nextToken || token),
      fetchAnnouncementSummary(nextToken || token),
    ]);
  };

  const logout = () => {
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
  };

  useEffect(() => {
    if (!token) return;

    apiFetch("/auth/me", { token })
      .then(async (nextUser) => {
        localStorage.setItem("user", JSON.stringify(nextUser));
        setUser(nextUser);
        await Promise.all([
          fetchCompanies(token, nextUser),
          fetchBranding(token),
          fetchAnnouncementSummary(token),
        ]);
      })
      .catch(() => logout());
  }, [token, activeCompanyId]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--performia-primary", branding.primaryColor || "#10b981");
    root.style.setProperty("--performia-primary-soft", `${branding.primaryColor || "#10b981"}22`);
  }, [branding.primaryColor]);

  const activeCompany = companies.find((company) => company._id === activeCompanyId) || null;

  const value = useMemo(
    () => ({
      token,
      user,
      companies,
      branding,
      announcementSummary,
      globalSearchResults,
      activeCompany,
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
    }),
    [token, user, companies, branding, announcementSummary, globalSearchResults, activeCompanyId]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
