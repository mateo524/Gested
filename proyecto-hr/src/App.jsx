import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ViewProvider } from "./context/ViewContext";
import { ToastProvider } from "./context/ToastContext";
import { CompactModeProvider } from "./context/CompactModeContext";
import { isAdminOrgUser, isEmployeeUser, isManagerUser } from "./lib/roleHelpers";
import { resolveUiText } from "./lib/uiCopy";
import { apiUrl, apiFetch } from "./lib/api";
import LoginPage from "./pages/LoginPage";
import AppShell from "./components/AppShell";
import ForcePasswordPage from "./pages/ForcePasswordPage";
import ErrorBoundary from "./components/ErrorBoundary";
import { PlanGate } from "./components/PlanGate";

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
const loadUsageAnalyticsPage = () => import("./pages/UsageAnalyticsPage");
const loadOrgChartPage = () => import("./pages/OrgChartPage");
const loadCalibracionPage = () => import("./pages/CalibracionPage");
const loadBillingPage = () => import("./pages/BillingPage");
const loadExcelSyncPage = () => import("./pages/ExcelSyncPage");

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
const UsageAnalyticsPage = lazy(loadUsageAnalyticsPage);
const OrgChartPage = lazy(loadOrgChartPage);
const CalibracionPage = lazy(loadCalibracionPage);
const BillingPage = lazy(loadBillingPage);
const ExcelSyncPage = lazy(loadExcelSyncPage);

const KNOWN_VIEWS = new Set([
  "dashboard","novedades","perfil","organizaciones","empleados","organigrama",
  "competencias","metricas","metricas-ejecutivo","ciclos","evaluaciones","planes",
  "bases-descargas","reporte-ejecutivo","carga-masiva","archivo-central","analytics",
  "usuarios","roles","settings","calibracion","billing","excel-sync",
]);

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
  const { isAuthenticated, hasPermission, hasModule, user, sessionBootstrapping, token } = useAuth();
  const [view, setView] = useState("dashboard");
  const [billingRequired, setBillingRequired] = useState(null);
  const [searchQuery, setSearchQuery] = useState(() => localStorage.getItem("performia_search_query") || "");
  const [theme, setTheme] = useState(() => localStorage.getItem("performia_theme") || "dark");
  const [language, setLanguage] = useState(() => localStorage.getItem("performia_language") || "es");

  // Keep backend awake every 5 min — prevents Render cold starts (15 min sleep threshold).
  useEffect(() => {
    const ping = () => fetch(`${apiUrl}/health`, { method: "GET" }).catch(() => {});
    ping();
    const id = setInterval(ping, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // Billing gate: company admins must pay before using the app.
  // Skip for SuperAdmin, employees, and managers.
  useEffect(() => {
    if (!token || !user) {
      setBillingRequired(null);
      return;
    }
    if (user.isSuperAdmin || isEmployeeUser(user) || isManagerUser(user)) {
      setBillingRequired(false);
      return;
    }
    apiFetch("/billing/status", { token })
      .then((data) => {
        const hasActiveSub = !!data.subscription;
        const hasManualPlan = data.planExpiresAt && !data.expired;
        setBillingRequired(!hasActiveSub && !hasManualPlan);
      })
      .catch(() => setBillingRequired(false));
  }, [token, user]);

  const availableViews = useMemo(
    () =>
      [
        "dashboard",
        hasPermission("manage_companies") || hasPermission("manage_schools") || user?.isSuperAdmin
          ? "organizaciones"
          : null,
        hasPermission("manage_users") ? "usuarios" : null,
        hasPermission("manage_roles") || hasPermission("view_audit") ? "roles" : null,
        hasPermission("manage_settings") || user?.isSuperAdmin ? "settings" : null,
        user ? "novedades" : null,
        user ? "perfil" : null,
        hasPermission("manage_employees") ? "empleados" : null,
        hasPermission("manage_employees") && hasModule("orgchart") ? "organigrama" : null,
        hasPermission("manage_competencies") && hasModule("competencias") ? "competencias" : null,
        hasPermission("manage_metrics") && hasModule("kpis") ? "metricas" : null,
        hasModule("evaluaciones") && (hasPermission("manage_evaluation_cycles") || hasPermission("view_reports"))
          ? "ciclos"
          : null,
        hasModule("evaluaciones") && (
          hasPermission("manage_evaluations") ||
          hasPermission("evaluate_team") ||
          hasPermission("self_evaluate") ||
          hasPermission("view_reports")
        ) ? "evaluaciones" : null,
        hasModule("planesDesarrollo") && (
          hasPermission("manage_development_plans") ||
          hasPermission("evaluate_team") ||
          hasPermission("self_evaluate") ||
          hasPermission("download_self_report") ||
          hasPermission("view_reports")
        ) ? "planes" : null,
        hasModule("exportacion") && (
          hasPermission("view_reports") ||
          hasPermission("download_reports") ||
          hasPermission("download_team_reports") ||
          hasPermission("download_self_report")
        ) ? "bases-descargas" : null,
        hasModule("reporteEjecutivo") && (
          hasPermission("view_reports") ||
          hasPermission("download_reports") ||
          hasPermission("download_team_reports") ||
          hasPermission("view_audit")
        ) ? "reporte-ejecutivo" : null,
        hasModule("reporteEjecutivo") && hasPermission("view_reports") && hasPermission("manage_metrics")
          ? "metricas-ejecutivo"
          : null,
        hasModule("cargaMasiva") && (
          hasPermission("manage_users") ||
          hasPermission("manage_school_users") ||
          hasPermission("manage_employees") ||
          hasPermission("manage_roles") ||
          hasPermission("view_audit")
        ) ? "carga-masiva" : null,
        hasPermission("manage_employees") || hasPermission("manage_users") ? "excel-sync" : null,
        user?.isSuperAdmin ? "archivo-central" : null,
        user?.isSuperAdmin ? "analytics" : null,
        !isEmployeeUser(user) && !isManagerUser(user) && (user?.isSuperAdmin || hasPermission("manage_users"))
          ? "billing"
          : null,
        hasModule("evaluaciones") && (hasPermission("manage_evaluations") || hasPermission("view_reports")) && hasModule("calibracion")
          ? "calibracion"
          : null,
      ].filter(Boolean),
    [hasPermission, hasModule, user]
  );

  const gatedViews = useMemo(
    () => billingRequired ? ["billing"] : availableViews,
    [billingRequired, availableViews]
  );

  const activeView = gatedViews.includes(view) ? view : (gatedViews[0] || "dashboard");

  useEffect(() => {
    if (view !== activeView) {
      setView(activeView);
    }
  }, [activeView, view]);

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
    localStorage.setItem("performia_language", language);
  }, [language]);

  const t = useMemo(
    () => (key, fallback = "") => resolveUiText(language, key, fallback),
    [language]
  );

  const viewContextValue = useMemo(
    () => ({
      view: activeView,
      setView,
      searchQuery,
      setSearchQuery,
      theme,
      setTheme,
      language,
      setLanguage,
      t,
    }),
    [activeView, language, searchQuery, setView, theme, t]
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
        loadStorageCenterPage,
        loadUsageAnalyticsPage
      );
    } else if (hasPermission("view_reports")) {
      preloaders.push(loadEducationalExportsPage, loadExecutiveReportPage);
      if (hasPermission("manage_metrics")) {
        preloaders.push(loadMetricsPage);
      }
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

  if (sessionBootstrapping) return null;

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  if (user?.mustChangePassword) {
    return <ForcePasswordPage />;
  }

  // Hold rendering until billing check resolves for users who need it.
  // Prevents dashboard from mounting (and firing API calls) before we know
  // whether to gate them to the billing page.
  if (billingRequired === null && !user?.isSuperAdmin && !isEmployeeUser(user) && !isManagerUser(user)) {
    return null;
  }

  // Company not found — show banner but allow navigation to organizaciones
  const companyMissing = user && !user.isSuperAdmin && (!user.companyId || user.companyName === "Sin empresa");

  return (
    <ViewProvider value={viewContextValue}>
      <AppShell
        view={activeView}
        setView={setView}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        theme={theme}
        setTheme={setTheme}
        language={language}
        setLanguage={setLanguage}
        t={t}
        availableViews={gatedViews}
      >
        <ErrorBoundary>
        <Suspense fallback={<ViewLoader />}>
          <div key={activeView} className="page-enter">
          {companyMissing && activeView !== "organizaciones" && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-400/25 bg-amber-500/10 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span className="text-sm text-amber-200">Empresa no encontrada. Para continuar, creá tu empresa en Organizaciones.</span>
              </div>
              <button
                type="button"
                onClick={() => setView("organizaciones")}
                className="rounded-xl bg-amber-400 px-3 py-1.5 text-xs font-semibold text-[#0f172a] hover:bg-amber-300"
              >
                Ir a Organizaciones
              </button>
            </div>
          )}
          {activeView === "dashboard" && <DashboardPage />}
          {activeView === "novedades" && <AnnouncementsPage />}
          {activeView === "perfil" && <ProfilePage />}
          {activeView === "organizaciones" && <OrganizationsPage />}
          {activeView === "empleados" && <EmployeesPage />}
          {activeView === "competencias" && <CompetenciesPage />}
          {activeView === "metricas" && <PlanGate feature="Métricas y KPIs"><MetricsPage /></PlanGate>}
          {activeView === "metricas-ejecutivo" && (
            <PlanGate feature="Métricas y reporte ejecutivo">
              <div className="space-y-6">
                <MetricsPage />
                <ExecutiveReportPage />
              </div>
            </PlanGate>
          )}
          {activeView === "ciclos" && <EvaluationCyclesPage />}
          {activeView === "evaluaciones" && <EvaluationsPage />}
          {activeView === "planes" && <PlanGate feature="Planes de desarrollo"><DevelopmentPlansPage /></PlanGate>}
          {activeView === "bases-descargas" && <EducationalExportsPage />}
          {activeView === "reporte-ejecutivo" && <PlanGate feature="Reporte ejecutivo"><ExecutiveReportPage /></PlanGate>}
          {activeView === "carga-masiva" && <BulkImportPage />}
          {activeView === "excel-sync" && <ExcelSyncPage />}
          {activeView === "archivo-central" && <StorageCenterPage />}
          {activeView === "analytics" && <UsageAnalyticsPage />}
          {activeView === "usuarios" && <UsersPage />}
          {activeView === "roles" && <RolesPage />}
          {activeView === "settings" && <SettingsPage />}
          {activeView === "organigrama" && <PlanGate feature="Organigrama"><OrgChartPage /></PlanGate>}
          {activeView === "calibracion" && <PlanGate feature="Calibración"><CalibracionPage /></PlanGate>}
          {activeView === "billing" && <BillingPage />}
          {!KNOWN_VIEWS.has(activeView) && (
            <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-[#0c1e28]">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#7a9aaa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10"/><path d="M16.2 7.8l-2 3.2-3.4 3.4-3.2 2L7 18l1.6-.6 3.2-2 3.4-3.4 2-3.2.6-1.6z"/>
                </svg>
              </div>
              <p className="text-lg font-semibold text-white">Vista no encontrada</p>
              <p className="text-sm text-[#7a9aaa]">La sección <code className="rounded bg-white/8 px-1.5 py-0.5 text-xs text-[#14b8a6]">{activeView}</code> no existe.</p>
              <button
                type="button"
                onClick={() => setView(gatedViews[0] || "dashboard")}
                className="rounded-2xl bg-[#14b8a6] px-5 py-2.5 text-sm font-semibold text-[#0f172a]"
              >
                Volver al inicio
              </button>
            </div>
          )}
          </div>
        </Suspense>
        </ErrorBoundary>
      </AppShell>
    </ViewProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <CompactModeProvider>
          <AppContent />
        </CompactModeProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
