import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
import AppShell from "./components/AppShell";
import ForcePasswordPage from "./pages/ForcePasswordPage";

const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const CompaniesPage = lazy(() => import("./pages/CompaniesPage"));
const UsersPage = lazy(() => import("./pages/UsersPage"));
const RolesPage = lazy(() => import("./pages/RolesPage"));
const AuditPage = lazy(() => import("./pages/AuditPage"));
const AnnouncementsPage = lazy(() => import("./pages/AnnouncementsPage"));
const SchoolsPage = lazy(() => import("./pages/SchoolsPage"));
const EmployeesPage = lazy(() => import("./pages/EmployeesPage"));
const CompetenciesPage = lazy(() => import("./pages/CompetenciesPage"));
const MetricsPage = lazy(() => import("./pages/MetricsPage"));
const EvaluationCyclesPage = lazy(() => import("./pages/EvaluationCyclesPage"));
const EvaluationsPage = lazy(() => import("./pages/EvaluationsPage"));
const RecordsPage = lazy(() => import("./pages/RecordsPage"));
const ExportPage = lazy(() => import("./pages/ExportPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
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
        "novedades",
        hasPermission("manage_schools") || hasPermission("manage_companies") ? "colegios" : null,
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
        hasPermission("manage_users") ? "usuarios" : null,
        hasPermission("manage_settings") ? "parametros" : null,
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
        {view === "colegios" && <SchoolsPage />}
        {view === "empleados" && <EmployeesPage />}
        {view === "competencias" && <CompetenciesPage />}
        {view === "metricas" && <MetricsPage />}
        {view === "ciclos" && <EvaluationCyclesPage />}
        {view === "evaluaciones" && <EvaluationsPage />}
        {view === "empresas" && <CompaniesPage />}
        {view === "archivo-central" && <StorageCenterPage />}
        {view === "usuarios" && <UsersPage />}
        {view === "roles" && <RolesPage />}
        {view === "auditoria" && <AuditPage />}
        {view === "registros" && <RecordsPage />}
        {view === "exportaciones" && <ExportPage />}
        {view === "parametros" && <SettingsPage />}
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
