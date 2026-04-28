import { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
import AppShell from "./components/AppShell";
import DashboardPage from "./pages/DashboardPage";
import CompaniesPage from "./pages/CompaniesPage";
import UsersPage from "./pages/UsersPage";
import RolesPage from "./pages/RolesPage";
import AuditPage from "./pages/AuditPage";
import ExportPage from "./pages/ExportPage";
import SettingsPage from "./pages/SettingsPage";
import ForcePasswordPage from "./pages/ForcePasswordPage";

function AppContent() {
  const { isAuthenticated, hasPermission, user } = useAuth();
  const [view, setView] = useState("dashboard");

  const availableViews = [
    "dashboard",
    hasPermission("manage_companies") ? "empresas" : null,
    hasPermission("manage_users") ? "usuarios" : null,
    hasPermission("manage_roles") ? "roles" : null,
    hasPermission("view_audit") ? "auditoria" : null,
    hasPermission("export_reports") ? "exportaciones" : null,
    hasPermission("manage_settings") ? "parametros" : null,
  ].filter(Boolean);

  useEffect(() => {
    if (!availableViews.includes(view)) {
      setView(availableViews[0] || "dashboard");
    }
  }, [view, availableViews.join("|")]);

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  if (user?.mustChangePassword) {
    return <ForcePasswordPage />;
  }

  return (
    <AppShell view={view} setView={setView}>
      {view === "dashboard" && <DashboardPage />}
      {view === "empresas" && <CompaniesPage />}
      {view === "usuarios" && <UsersPage />}
      {view === "roles" && <RolesPage />}
      {view === "auditoria" && <AuditPage />}
      {view === "exportaciones" && <ExportPage />}
      {view === "parametros" && <SettingsPage />}
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
