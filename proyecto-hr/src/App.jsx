import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ViewProvider } from "./context/ViewContext";
import LoginPage from "./pages/LoginPage";
import AppShell from "./components/AppShell";
import ForcePasswordPage from "./pages/ForcePasswordPage";

<<<<<<< HEAD
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
const loadStorageCenterPage = () => import("./pages/StorageCenterPage");
const loadSettingsPage = () => import("./pages/SettingsPage");

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
const StorageCenterPage = lazy(loadStorageCenterPage);
const SettingsPage = lazy(loadSettingsPage);
=======
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const OrganizationsPage = lazy(() => import("./pages/OrganizationsPage"));
const UsersPage = lazy(() => import("./pages/UsersPage"));
const RolesPage = lazy(() => import("./pages/RolesPage"));
const AnnouncementsPage = lazy(() => import("./pages/AnnouncementsPage"));
const EmployeesPage = lazy(() => import("./pages/EmployeesPage"));
const CompetenciesPage = lazy(() => import("./pages/CompetenciesPage"));
const MetricsPage = lazy(() => import("./pages/MetricsPage"));
const EvaluationCyclesPage = lazy(() => import("./pages/EvaluationCyclesPage"));
const EvaluationsPage = lazy(() => import("./pages/EvaluationsPage"));
const DevelopmentPlansPage = lazy(() => import("./pages/DevelopmentPlansPage"));
const EducationalExportsPage = lazy(() => import("./pages/EducationalExportsPage"));
const BulkImportPage = lazy(() => import("./pages/BulkImportPage"));
const StorageCenterPage = lazy(() => import("./pages/StorageCenterPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
>>>>>>> 31fdab3 (Add unified bulk import frontend flow)

function ViewLoader() {
  return (
    <div className="pf-card p-8 text-[#A9BFCA]">
      Cargando modulo...
    </div>
  );
}

function AppContent() {
  const { isAuthenticated, hasPermission, user } = useAuth();
  const [view, setView] = useState("dashboard");

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
        user?.isSuperAdmin ? "novedades" : null,
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
    if (!isAuthenticated || !user) return;

    const preloaders = [loadDashboardPage];
    const roleCode = user.roleCode || "";

    if (["ADMIN_COLEGIO", "RRHH", "JEFE", "EMPLEADO"].includes(roleCode)) {
      preloaders.push(loadEvaluationsPage, loadDevelopmentPlansPage);
    }
    if (["ADMIN_COLEGIO", "RRHH"].includes(roleCode)) {
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
    <AppShell view={view} setView={setView}>
      <ViewProvider value={{ view, setView }}>
        <Suspense fallback={<ViewLoader />}>
          {view === "dashboard" && <DashboardPage />}
          {view === "novedades" && <AnnouncementsPage />}
          {view === "organizaciones" && <OrganizationsPage />}
          {view === "empleados" && <EmployeesPage />}
          {view === "competencias" && <CompetenciesPage />}
          {view === "metricas" && <MetricsPage />}
          {view === "ciclos" && <EvaluationCyclesPage />}
          {view === "evaluaciones" && <EvaluationsPage />}
          {view === "planes" && <DevelopmentPlansPage />}
          {view === "bases-descargas" && <EducationalExportsPage />}
          {view === "carga-masiva" && <BulkImportPage />}
          {view === "archivo-central" && <StorageCenterPage />}
          {view === "usuarios" && <UsersPage />}
          {view === "roles" && <RolesPage />}
          {view === "settings" && <SettingsPage />}
        </Suspense>
      </ViewProvider>
    </AppShell>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
