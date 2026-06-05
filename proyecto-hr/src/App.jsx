import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ViewProvider } from "./context/ViewContext";
import { isAdminOrgUser, isEmployeeUser, isManagerUser } from "./lib/roleHelpers";
import { resolveUiText } from "./lib/uiCopy";
import { apiUrl } from "./lib/api";
import LoginPage from "./pages/LoginPage";
import AppShell from "./components/AppShell";
import ForcePasswordPage from "./pages/ForcePasswordPage";
import ErrorBoundary from "./components/ErrorBoundary";

const loadDashboardPage = () => import("./pages/DashboardPage");
const loadOrganizationsPage = () => import("./pages/OrganizationsPage");
const loadUsersPage = () => import("./pages/UsersPage");
const loadRolesPage = () => import("./pages/RolesPage");
const loadAnnouncementsPage = () => import("./pages/AnnouncementsPage");
const loadEmployeesPage = () => import("./pages/EmployeesPage");
const loadCompetenciesPage = () => import("./pages/CompetenciesPage");
const loadMetricsPage = () => import("./pages/MetricsPage");
const loadEvaluationCyclesPage = () => import("./pages/EvaluationCyclesPage");
const loadEvaluationsPage = () => import("./pages/EvaluationsPage");
const loadDevelopmentPlansPage = () => import("./pages/DevelopmentPlansPage");
const loadEducationalExportsPage = () => import("./pages/EducationalExportsPage");
const loadBulkImportPage = () => import("./pages/BulkImportPage");
const loadExecutiveReportPage = () => import("./pages/ExecutiveReportPage");
const loadStorageCenterPage = () => import("./pages/StorageCenterPage");
const loadSettingsPage = () => import("./pages/SettingsPage");
const loadProfilePage = () => import("./pages/ProfilePage");

const DashboardPage = lazy(loadDashboardPage);
const OrganizationsPage = lazy(loadOrganizationsPage);
const UsersPage = lazy(loadUsersPage);
const RolesPage = lazy(loadRolesPage);
const AnnouncementsPage = lazy(loadAnnouncementsPage);
const EmployeesPage = lazy(loadEmployeesPage);
const CompetenciesPage = lazy(loadCompetenciesPage);
const MetricsPage = lazy(loadMetricsPage);
const EvaluationCyclesPage = lazy(loadEvaluationCyclesPage);
const EvaluationsPage = lazy(loadEvaluationsPage);
const DevelopmentPlansPage = lazy(loadDevelopmentPlansPage);
const EducationalExportsPage = lazy(loadEducationalExportsPage);
const BulkImportPage = lazy(loadBulkImportPage);
const ExecutiveReportPage = lazy(loadExecutiveReportPage);
const StorageCenterPage = lazy(loadStorageCenterPage);
const SettingsPage = lazy(loadSettingsPage);
const ProfilePage = lazy(loadProfilePage);

function ViewLoader() {
  return (
    <div className="space-y-4 p-1">
      <div className="pf-surface p-6">
        <div className="space-y-3">
          <div className="skeleton h-3 w-20" />
          <div className="skeleton h-8 w-56" />
          <div className="skeleton h-4 w-80" />
        </div>
        <div className="mt-5 flex gap-3">
          <div className="skeleton h-10 w-32" />
          <div className="skeleton h-10 w-28" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-3xl border border-white/8 bg-[#0c1e28] p-5 space-y-3">
            <div className="skeleton h-3 w-20" />
            <div className="skeleton h-7 w-14" />
            <div className="skeleton h-3 w-28" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="pf-card p-5 space-y-3">
            <div className="skeleton h-5 w-36" />
            {[...Array(3)].map((_, j) => (
              <div key={j} className="skeleton h-14 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function AppContent() {
  const { isAuthenticated, hasPermission, user } = useAuth();
  const [view, setView] = useState("dashboard");
  const [searchQuery, setSearchQuery] = useState(() => localStorage.getItem("performia_search_query") || "");
  const [theme, setTheme] = useState(() => localStorage.getItem("performia_theme") || "dark");
  const [language, setLanguage] = useState("es");

  // Silent backend wake-up: ping /health as soon as the app loads so that
  // by the time the user logs in, Render is already awake.
  useEffect(() => {
    fetch(`${apiUrl}/health`, { method: "GET" }).catch(() => {});
  }, []);

  const availableViews = useMemo(
    () =>
      [
        "dashboard",
        hasPermission("manage_companies") || hasPermission("manage_schools")
          ? "organizaciones"
          : null,
        hasPermission("manage_users") ? "usuarios" : null,
        hasPermission("manage_roles") || hasPermission("view_audit") ? "roles" : null,
        hasPermission("manage_settings") || user?.isSuperAdmin ? "settings" : null,
        user ? "novedades" : null,
        user ? "perfil" : null,
        hasPermission("manage_employees") ? "empleados" : null,
        hasPermission("manage_competencies") ? "competencias" : null,
        hasPermission("manage_metrics") ? "metricas" : null,
        hasPermission("manage_evaluation_cycles") || hasPermission("view_reports")
          ? "ciclos"
          : null,
        hasPermission("manage_evaluations") ||
        hasPermission("evaluate_team") ||
        hasPermission("self_evaluate") ||
        hasPermission("view_reports")
          ? "evaluaciones"
          : null,
        hasPermission("manage_development_plans") ||
        hasPermission("evaluate_team") ||
        hasPermission("self_evaluate") ||
        hasPermission("download_self_report") ||
        hasPermission("view_reports")
          ? "planes"
          : null,
        hasPermission("view_reports") ||
        hasPermission("download_reports") ||
        hasPermission("download_team_reports") ||
        hasPermission("download_self_report")
          ? "bases-descargas"
          : null,
        hasPermission("view_reports") ||
        hasPermission("download_reports") ||
        hasPermission("download_team_reports") ||
        hasPermission("view_audit")
          ? "reporte-ejecutivo"
          : null,
        hasPermission("manage_users") ||
        hasPermission("manage_school_users") ||
        hasPermission("manage_employees") ||
        hasPermission("manage_roles") ||
        hasPermission("view_audit")
          ? "carga-masiva"
          : null,
        user?.isSuperAdmin ? "archivo-central" : null,
      ].filter(Boolean),
    [hasPermission, user]
  );

  useEffect(() => {
    if (!availableViews.includes(view)) {
      setView(availableViews[0] || "dashboard");
    }
  }, [view, availableViews]);

  useEffect(() => {
    localStorage.setItem("performia_search_query", searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    localStorage.setItem("performia_theme", theme);
    document.documentElement.classList.remove("theme-dark", "theme-light");
    document.body.classList.remove("theme-dark", "theme-light");
    document.documentElement.classList.add(`theme-${theme}`);
    document.body.classList.add(`theme-${theme}`);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("performia_language", "es");
    if (language !== "es") {
      setLanguage("es");
    }
  }, [language]);

  const t = useMemo(
    () => (key, fallback = "") => resolveUiText(language, key, fallback),
    [language]
  );

  const viewContextValue = useMemo(
    () => ({
      view,
      setView,
      searchQuery,
      setSearchQuery,
      theme,
      setTheme,
      language,
      setLanguage,
      t,
    }),
    [language, searchQuery, setView, theme, t, view]
  );

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const preloaders = [loadDashboardPage];
    preloaders.push(loadProfilePage);

    if (isAdminOrgUser(user) || isManagerUser(user) || isEmployeeUser(user)) {
      preloaders.push(loadEvaluationsPage, loadDevelopmentPlansPage);
    }
    if (isAdminOrgUser(user)) {
      preloaders.push(loadEmployeesPage, loadMetricsPage, loadEvaluationCyclesPage);
    }
    if (user.isSuperAdmin) {
      preloaders.push(
        loadOrganizationsPage,
        loadUsersPage,
        loadRolesPage,
        loadSettingsPage,
        loadEducationalExportsPage,
        loadStorageCenterPage
      );
    } else if (hasPermission("view_reports")) {
      preloaders.push(loadEducationalExportsPage);
      preloaders.push(loadExecutiveReportPage);
    }

    const runPreload = () => {
      preloaders.forEach((preload) => {
        preload().catch(() => {});
      });
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(runPreload, { timeout: 1800 });
      return () => window.cancelIdleCallback(idleId);
    }

    const timer = window.setTimeout(runPreload, 400);
    return () => window.clearTimeout(timer);
  }, [hasPermission, isAuthenticated, user]);

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  if (user?.mustChangePassword) {
    return <ForcePasswordPage />;
  }

  return (
    <ViewProvider value={viewContextValue}>
      <AppShell
        view={view}
        setView={setView}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        theme={theme}
        setTheme={setTheme}
        language={language}
        setLanguage={setLanguage}
        t={t}
      >
        <ErrorBoundary>
        <Suspense fallback={<ViewLoader />}>
          {view === "dashboard" && <DashboardPage />}
          {view === "novedades" && <AnnouncementsPage />}
          {view === "perfil" && <ProfilePage />}
          {view === "organizaciones" && <OrganizationsPage />}
          {view === "empleados" && <EmployeesPage />}
          {view === "competencias" && <CompetenciesPage />}
          {view === "metricas" && <MetricsPage />}
          {view === "ciclos" && <EvaluationCyclesPage />}
          {view === "evaluaciones" && <EvaluationsPage />}
          {view === "planes" && <DevelopmentPlansPage />}
          {view === "bases-descargas" && <EducationalExportsPage />}
          {view === "reporte-ejecutivo" && <ExecutiveReportPage />}
          {view === "carga-masiva" && <BulkImportPage />}
          {view === "archivo-central" && <StorageCenterPage />}
          {view === "usuarios" && <UsersPage />}
          {view === "roles" && <RolesPage />}
          {view === "settings" && <SettingsPage />}
        </Suspense>
        </ErrorBoundary>
      </AppShell>
    </ViewProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
