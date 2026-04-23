import { useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
import AppShell from "./components/AppShell";
import DashboardPage from "./pages/DashboardPage";
import UsersPage from "./pages/UsersPage";
import RolesPage from "./pages/RolesPage";
import AuditPage from "./pages/AuditPage";
import ExportPage from "./pages/ExportPage";
import SettingsPage from "./pages/SettingsPage";

function AppContent() {
  const { isAuthenticated } = useAuth();
  const [view, setView] = useState("dashboard");

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <AppShell view={view} setView={setView}>
      {view === "dashboard" && <DashboardPage />}
      {view === "usuarios" && <UsersPage />}
      {view === "roles" && <RolesPage />}
      {view === "auditoría" && <AuditPage />}
      {view === "exportaciones" && <ExportPage />}
      {view === "parámetros" && <SettingsPage />}
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