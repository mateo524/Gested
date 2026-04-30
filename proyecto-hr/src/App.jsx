import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
import AppShell from "./components/AppShell";
import ForcePasswordPage from "./pages/ForcePasswordPage";

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
const StorageCenterPage = lazy(() => import("./pages/StorageCenterPage"));

function ViewLoader() {
  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-8 text-slate-500 shadow-sm">
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
        hasPermission("manage_roles") ? "roles" : null,
        "novedades",
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
        hasPermission("view_reports")
          ? "planes"
          : null,
        hasPermission("view_reports") ||
        hasPermission("download_team_reports") ||
        hasPermission("download_self_report")
          ? "bases-descargas"
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

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  if (user?.mustChangePassword) {
    return <ForcePasswordPage />;
  }

  return (
    <AppShell view={view} setView={setView}>
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
        {view === "archivo-central" && <StorageCenterPage />}
        {view === "usuarios" && <UsersPage />}
        {view === "roles" && <RolesPage />}
      </Suspense>
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
