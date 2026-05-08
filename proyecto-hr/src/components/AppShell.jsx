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
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          className="h-5 w-5"
        >
          <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V10a6 6 0 1 0-12 0v4.2a2 2 0 0 1-.6 1.4L4 17h5" />
          <path d="M9.5 19a2.5 2.5 0 0 0 5 0" />
        </svg>
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
    tokenExpiresAt,
    tokenNearExpiry,
  } = useAuth();

  const roleCode = user?.roleCode || "";
  const isBasicUser = ["EMPLEADO", "LECTOR", "LECTOR_AUDITOR"].includes(roleCode);
  const isManagerUser = ["JEFE", "RRHH", "ADMIN_COLEGIO"].includes(roleCode);

  const allViews = useMemo(
    () =>
      [
        { key: "dashboard", label: "Panel", show: true, group: "panel" },
        {
          key: "empleados",
          label: isBasicUser ? "Mi ficha" : "Plantilla",
          show: hasPermission("manage_employees"),
          group: "gestion",
        },
        { key: "competencias", label: "Competencias", show: hasPermission("manage_competencies"), group: "gestion" },
        { key: "metricas", label: "Indicadores", show: hasPermission("manage_metrics"), group: "gestion" },
        { key: "ciclos", label: "Periodos", show: hasPermission("manage_evaluation_cycles"), group: "gestion" },
        { key: "usuarios", label: "Accesos", show: hasPermission("manage_users"), group: "gestion" },
        { key: "roles", label: "Perfiles", show: hasPermission("manage_roles"), group: "gestion" },
        { key: "settings", label: "Configuración", show: hasPermission("manage_settings") || user?.isSuperAdmin, group: "gestion" },
        {
          key: "evaluaciones",
          label: "Evaluación",
          show:
            hasPermission("manage_evaluations") ||
            hasPermission("evaluate_team") ||
            hasPermission("self_evaluate"),
          group: "evaluacion",
        },
        { key: "planes", label: "Desarrollo", show: hasPermission("manage_development_plans"), group: "evaluacion" },
        {
          key: "bases-descargas",
          label: "Cargas y descargas",
          show:
            hasPermission("view_reports") ||
            hasPermission("download_reports") ||
            hasPermission("download_team_reports") ||
            hasPermission("download_self_report"),
          group: "datos",
        },
        { key: "novedades", label: "Comunicados", show: true, group: "datos" },
        { key: "organizaciones", label: "Organización", show: user?.isSuperAdmin, group: "datos" },
      ].filter((item) => item.show),
    [hasPermission, user, isBasicUser]
  );

  const primaryTabs = [
    { key: "panel", label: "Panel", defaultView: "dashboard" },
    { key: "evaluacion", label: "Evaluación", defaultView: "evaluaciones" },
    { key: "gestion", label: "Gestión", defaultView: "empleados" },
    {
      key: "datos",
      label: user?.isSuperAdmin ? "Datos" : "Novedades",
      defaultView: user?.isSuperAdmin ? "bases-descargas" : "novedades",
    },
  ];
  const visiblePrimaryTabs = primaryTabs.filter((item) => item.show !== false);

  const activePrimary = allViews.find((item) => item.key === view)?.group || "panel";
  const secondaryTabs = allViews.filter((item) => item.group === activePrimary);

  async function handleMarkRead(item) {
    if (!token || item.isRead || user?.isSuperAdmin) return;
    await apiFetch(`/announcements/${item._id}/read`, { method: "POST", token });
    await refreshAnnouncementSummary();
  }

  function openPrimary(groupKey, fallback) {
    const priorityByGroup = {
      panel: ["dashboard"],
      evaluacion: ["evaluaciones", "planes"],
      gestion: isBasicUser
        ? ["empleados", "evaluaciones", "planes"]
        : isManagerUser
          ? ["empleados", "competencias", "metricas", "ciclos", "usuarios", "roles", "settings"]
          : ["empleados", "usuarios", "roles", "competencias", "metricas", "ciclos", "settings"],
      datos: ["bases-descargas", "organizaciones", "novedades"],
    };

    const groupViews = allViews.filter((item) => item.group === groupKey).map((item) => item.key);
    const priority = priorityByGroup[groupKey] || [];
    const preferred = priority.find((key) => groupViews.includes(key));
    const first = preferred || groupViews[0] || fallback;
    if (first) setView(first);
  }

  const contextualSubtitle = user?.isSuperAdmin
    ? "Gestión global multi-organización"
    : user?.companyName
      ? `Operación en ${user.companyName}`
      : "Gestión de desempeño institucional";

  return (
    <div className="min-h-screen bg-[#0E1A20] text-[#E8EEF1]">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0E1A20]/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1280px] items-center justify-between gap-4 px-4 py-4">
          <div className="min-w-0">
            <AppLogo variant="dark" />
            <p className="mt-1 text-sm text-[#7A9AAA]">{contextualSubtitle}</p>
          </div>

          <div className="hidden items-center gap-2 lg:flex">
            {visiblePrimaryTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => openPrimary(tab.key, tab.defaultView)}
                className={`rounded-xl px-5 py-3 text-base font-medium transition ${
                  activePrimary === tab.key
                    ? "bg-[#28964D] text-white"
                    : "border border-white/10 bg-[#142028] text-[#AFC3CE] hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {user?.isSuperAdmin && companies.length ? (
              <select
                className="max-w-56 rounded-xl border border-white/10 bg-[#142028] px-3 py-3 text-sm text-white"
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
            <button onClick={logout} className="rounded-xl border border-white/15 bg-[#1A2C38] px-4 py-3 text-sm text-white">
              Salir
            </button>
          </div>
        </div>

        <div className="mx-auto w-full max-w-[1280px] px-4 pb-4">
          <div className="flex flex-wrap gap-2">
            {secondaryTabs.map((item) => (
              <button
                key={item.key}
                onClick={() => setView(item.key)}
                className={`rounded-xl px-4 py-2.5 text-sm transition ${
                  view === item.key
                    ? "bg-[#1e3a8a] text-white"
                    : "border border-white/10 bg-[#142028] text-[#AFC3CE] hover:text-white"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1280px] px-4 py-6">
        <div className="mb-4 rounded-2xl border border-white/10 bg-[#142028] px-4 py-3 text-sm text-[#AFC3CE]">
          {user?.nombre} - {user?.roleName} - {user?.companyName || "Organización"}
        </div>
        {tokenNearExpiry ? (
          <div className="mb-4 rounded-2xl border border-amber-300/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            Tu sesión vence pronto ({tokenExpiresAt?.toLocaleString("es-AR")}). Guarda cambios y vuelve a iniciar sesión.
          </div>
        ) : null}
        {children}
      </main>
    </div>
  );
}

