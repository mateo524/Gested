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
        aria-label="Novedades"
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

  const navItems = useMemo(
    () =>
      [
        { key: "dashboard", label: "Panel", show: true },
        { key: "empleados", label: "Empleados", show: hasPermission("manage_employees") },
        {
          key: "evaluaciones",
          label: "Evaluación",
          show:
            hasPermission("manage_evaluations") ||
            hasPermission("evaluate_team") ||
            hasPermission("self_evaluate"),
        },
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
        { key: "novedades", label: user?.isSuperAdmin ? "Datos" : "Novedades", show: true },
        { key: "organizaciones", label: "Organización", show: user?.isSuperAdmin },
        { key: "usuarios", label: "Usuarios", show: hasPermission("manage_users") },
        { key: "roles", label: "Roles", show: hasPermission("manage_roles") },
        { key: "archivo-central", label: "Archivo central", show: user?.isSuperAdmin },
      ].filter((item) => item.show),
    [hasPermission, user]
  );

  async function handleMarkRead(item) {
    if (!token || item.isRead || user?.isSuperAdmin) return;
    await apiFetch(`/announcements/${item._id}/read`, { method: "POST", token });
    await refreshAnnouncementSummary();
  }

  return (
    <div className="min-h-screen bg-[#0E1A20] text-[#E8EEF1]">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0E1A20]/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1280px] items-center justify-between gap-4 px-4 py-3">
          <div className="min-w-0">
            <AppLogo variant="dark" />
            <p className="mt-1 text-xs text-[#7A9AAA]">Gestión de desempeño institucional</p>
          </div>

          <div className="hidden min-w-0 flex-1 items-center justify-center gap-2 overflow-x-auto lg:flex">
            {navItems.map((item) => (
              <button
                key={item.key}
                onClick={() => setView(item.key)}
                className={`whitespace-nowrap rounded-xl px-3 py-2 text-sm transition ${
                  view === item.key
                    ? "bg-[#28964D] text-white"
                    : "border border-white/10 bg-[#142028] text-[#AFC3CE] hover:text-white"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {user?.isSuperAdmin && companies.length ? (
              <select
                className="max-w-44 rounded-xl border border-white/10 bg-[#142028] px-3 py-2 text-sm text-white"
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
            <button
              onClick={logout}
              className="rounded-xl border border-white/15 bg-[#1A2C38] px-3 py-2 text-sm text-white"
            >
              Salir
            </button>
          </div>
        </div>
        <div className="mx-auto flex w-full max-w-[1280px] gap-2 overflow-x-auto px-4 pb-3 lg:hidden">
          {navItems.map((item) => (
            <button
              key={item.key}
              onClick={() => setView(item.key)}
              className={`whitespace-nowrap rounded-xl px-3 py-2 text-sm transition ${
                view === item.key
                  ? "bg-[#28964D] text-white"
                  : "border border-white/10 bg-[#142028] text-[#AFC3CE]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1280px] px-4 py-6">
        <div className="mb-4 rounded-2xl border border-white/10 bg-[#142028] px-4 py-3 text-sm text-[#AFC3CE]">
          {user?.nombre} · {user?.roleName} · {user?.companyName || "Organización"}
        </div>
        {children}
      </main>
    </div>
  );
}
