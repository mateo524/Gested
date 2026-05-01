import { useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";
import AppLogo from "./brand/AppLogo";

function NotificationBell({ announcementSummary, onMarkRead }) {
  const [open, setOpen] = useState(false);
  const unreadCount = announcementSummary?.unreadCount || 0;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-xl border border-white/10 bg-[#142028] px-3 py-2 text-white"
      >
        🔔
        {unreadCount ? (
          <span className="absolute -right-1 -top-1 rounded-full bg-[#22c55e] px-1.5 text-xs font-semibold text-white">
            {unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-80 rounded-2xl border border-white/10 bg-[#142028] p-3 shadow-xl">
          <p className="text-sm font-semibold text-white">Novedades</p>
          <div className="mt-3 space-y-2">
            {announcementSummary?.latest?.length ? (
              announcementSummary.latest.map((item) => (
                <button
                  key={item._id}
                  type="button"
                  onClick={() => onMarkRead(item)}
                  className="w-full rounded-xl border border-white/10 bg-[#1A2C38] px-3 py-2 text-left"
                >
                  <p className="text-sm font-medium text-white">{item.titulo}</p>
                  <p className="text-xs text-[#7A9AAA]">{item.cuerpo}</p>
                </button>
              ))
            ) : (
              <p className="text-sm text-[#7A9AAA]">Sin novedades.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function AppShell({ view, setView, children }) {
  const {
    user,
    logout,
    hasPermission,
    companies,
    activeCompanyId,
    setActiveCompanyId,
    announcementSummary,
    refreshAnnouncementSummary,
    token,
  } = useAuth();

  const grouped = useMemo(
    () => [
      { key: "dashboard", label: "Dashboard", show: true },
      {
        key: "empleados",
        label: "Empleados",
        show: hasPermission("manage_employees"),
      },
      {
        key: "evaluaciones",
        label: "Evaluaciones",
        show:
          hasPermission("manage_evaluations") ||
          hasPermission("evaluate_team") ||
          hasPermission("self_evaluate"),
      },
      { key: "competencias", label: "Competencias", show: hasPermission("manage_competencies") },
      { key: "metricas", label: "Metricas", show: hasPermission("manage_metrics") },
      { key: "ciclos", label: "Ciclos", show: hasPermission("manage_evaluation_cycles") },
      { key: "planes", label: "Desarrollo", show: hasPermission("manage_development_plans") },
      {
        key: "cargas",
        label: "Cargas",
        show:
          hasPermission("manage_employees") ||
          hasPermission("manage_metrics") ||
          hasPermission("manage_evaluation_cycles"),
      },
      {
        key: "bases-descargas",
        label: "Bases y descargas",
        show:
          hasPermission("view_reports") ||
          hasPermission("download_reports") ||
          hasPermission("download_team_reports") ||
          hasPermission("download_self_report"),
      },
      { key: "novedades", label: "Novedades", show: true },
      { key: "organizaciones", label: "Organizacion", show: user?.isSuperAdmin },
      { key: "usuarios", label: "Usuarios", show: hasPermission("manage_users") },
      { key: "roles", label: "Roles", show: hasPermission("manage_roles") },
      { key: "archivo-central", label: "Archivo central", show: user?.isSuperAdmin },
    ],
    [hasPermission, user]
  );

  async function handleMarkRead(item) {
    if (!token || item.isRead || user?.isSuperAdmin) return;
    await apiFetch(`/announcements/${item._id}/read`, { method: "POST", token });
    await refreshAnnouncementSummary();
  }

  return (
    <div className="min-h-screen bg-[#0E1A20] text-[#E8EEF1]">
      <div className="grid min-h-screen grid-cols-[250px_1fr]">
        <aside className="border-r border-white/10 bg-[#0E1A20] p-4">
          <AppLogo variant="dark" />
          <p className="mt-3 text-xs text-[#7A9AAA]">Gestion de desempeno institucional</p>

          <nav className="mt-6 space-y-1">
            {grouped
              .filter((item) => item.show)
              .map((item) => (
                <button
                  key={item.key}
                  onClick={() => setView(item.key)}
                  className={`w-full rounded-xl px-3 py-2 text-left text-sm transition ${
                    view === item.key
                      ? "bg-[#1e3a8a] text-white"
                      : "text-[#AFC3CE] hover:bg-[#142028] hover:text-white"
                  }`}
                >
                  {item.label}
                </button>
              ))}
          </nav>

          <div className="mt-8 rounded-2xl border border-white/10 bg-[#142028] p-3 text-xs text-[#7A9AAA]">
            <p className="font-semibold text-white">{user?.nombre}</p>
            <p>{user?.roleName}</p>
            <p>{user?.companyName}</p>
            <button
              onClick={logout}
              className="mt-3 w-full rounded-lg border border-white/15 bg-[#1A2C38] px-3 py-2 text-white"
            >
              Cerrar sesion
            </button>
          </div>
        </aside>

        <div>
          <header className="flex items-center justify-between border-b border-white/10 bg-[#142028] px-6 py-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[#7A9AAA]">Performia app</p>
              <h1 className="text-lg font-semibold text-white">{user?.companyName || "Organizacion"}</h1>
            </div>

            <div className="flex items-center gap-3">
              {user?.isSuperAdmin && companies.length ? (
                <select
                  className="rounded-xl border border-white/10 bg-[#0E1A20] px-3 py-2 text-sm text-white"
                  value={activeCompanyId}
                  onChange={(e) => setActiveCompanyId(e.target.value)}
                >
                  {companies.map((company) => (
                    <option key={company._id} value={company._id}>
                      {company.nombre}
                    </option>
                  ))}
                </select>
              ) : null}
              <NotificationBell announcementSummary={announcementSummary} onMarkRead={handleMarkRead} />
            </div>
          </header>

          <main className="p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}

