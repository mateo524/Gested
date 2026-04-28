import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../lib/api";

const AuthContext = createContext(null);
const ACTIVE_COMPANY_KEY = "active_company_id";

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [user, setUser] = useState(JSON.parse(localStorage.getItem("user") || "null"));
  const [companies, setCompanies] = useState([]);
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
    await fetchCompanies(nextToken, nextUser);
  };

  const updateSession = async ({ token: nextToken, user: nextUser }) => {
    applySession(nextToken || token, nextUser);
    await fetchCompanies(nextToken || token, nextUser);
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem(ACTIVE_COMPANY_KEY);
    setToken("");
    setUser(null);
    setCompanies([]);
    setActiveCompanyIdState("");
  };

  useEffect(() => {
    if (!token) return;

    apiFetch("/auth/me", { token })
      .then(async (nextUser) => {
        localStorage.setItem("user", JSON.stringify(nextUser));
        setUser(nextUser);
        await fetchCompanies(token, nextUser);
      })
      .catch(() => logout());
  }, [token]);

  const activeCompany = companies.find((company) => company._id === activeCompanyId) || null;

  const value = useMemo(
    () => ({
      token,
      user,
      companies,
      activeCompany,
      activeCompanyId,
      setActiveCompanyId,
      refreshCompanies: () => fetchCompanies(token, user),
      login,
      updateSession,
      logout,
      isAuthenticated: !!token,
      hasPermission: (perm) => user?.permisos?.includes(perm),
    }),
    [token, user, companies, activeCompanyId]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
