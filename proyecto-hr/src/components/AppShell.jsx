import { useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";
import { isEmployeeUser, isManagerUser, isReadOnlyUser } from "../lib/roleHelpers";
import AppLogo from "./brand/AppLogo";

function NotificationBell({ announcementSummary, onMarkRead }) {
  const [open, setOpen] = useState(false);
  const unreadCount = announcementSummary?.unreadCount || 0;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
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

function firstVisibleView(items) {
  return items.find((item) => item.show)?.key || null;
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

  const isSuperAdmin = Boolean(user?.isSuperAdmin);
  const isEmployee = isEmployeeUser(user);
  const isManager = isManagerUser(user);
  const isReadOnly = isReadOnlyUser(user, hasPermission);

  const allViews = useMemo(
    () => [
      { key: "dashboard", label: "Inicio", shortLabel: "Inicio", show: true, section: isSuperAdmin ? "plataforma" : "inicio" },
      {
        key: "empleados",
        label: isEmployee ? "Mi perfil" : isManager ? "Mi equipo" : "Personas",
        shortLabel: isEmployee ? "Mi perfil" : isManager ? "Mi equipo" : "Personas",
        show: hasPermission("manage_employees"),
        section: "personas",
      },
      {
        key: "evaluaciones",
        label: isEmployee ? "Mis evaluaciones" : "Evaluaciones",
        shortLabel: isEmployee ? "Mis evaluaciones" : "Evaluaciones",
        show:
          hasPermission("manage_evaluations") ||
          hasPermission("evaluate_team") ||
          hasPermission("self_evaluate") ||
          hasPermission("view_reports"),
        section: "evaluaciones",
      },
      {
        key: "ciclos",
        label: "Periodos",
        shortLabel: "Periodos",
        show: hasPermission("manage_evaluation_cycles") || (hasPermission("view_reports") && !isEmployee),
        section: "evaluaciones",
      },
      {
        key: "metricas",
        label: "Objetivos / Indicadores",
        shortLabel: "Indicadores",
        show: hasPermission("manage_metrics"),
        section: "objetivos",
      },
      {
        key: "competencias",
        label: "Competencias",
        shortLabel: "Competencias",
        show: hasPermission("manage_competencies"),
        section: "objetivos",
      },
      {
        key: "planes",
        label: isEmployee ? "Mi desarrollo" : "Desarrollo",
        shortLabel: isEmployee ? "Mi desarrollo" : "Desarrollo",
        show:
          hasPermission("manage_development_plans") ||
          hasPermission("evaluate_team") ||
          hasPermission("self_evaluate") ||
          hasPermission("download_self_report") ||
          hasPermission("view_reports"),
        section: "desarrollo",
      },
      {
        key: "reporte-ejecutivo",
        label: "Reporte ejecutivo",
        shortLabel: "Reporte ejecutivo",
        show:
          hasPermission("view_reports") ||
          hasPermission("download_reports") ||
          hasPermission("download_team_reports") ||
          hasPermission("view_audit"),
        section: isSuperAdmin ? "reportes-globales" : "reportes",
      },
      {
        key: "bases-descargas",
        label: isManager ? "Reportes de equipo" : "Reportes",
        shortLabel: "Reportes",
        show:
          hasPermission("view_reports") ||
          hasPermission("download_reports") ||
          hasPermission("download_team_reports") ||
          hasPermission("download_self_report"),
        section: "reportes",
      },
      {
        key: "carga-masiva",
        label: isSuperAdmin ? "Importacion" : isReadOnly ? "Datos" : "Carga masiva",
        shortLabel: isSuperAdmin ? "Importacion" : isReadOnly ? "Datos" : "Carga masiva",
        show:
          hasPermission("manage_users") ||
          hasPermission("manage_school_users") ||
          hasPermission("manage_employees") ||
          hasPermission("manage_roles") ||
          hasPermission("view_audit"),
        section: isSuperAdmin ? "importacion" : "datos",
      },
      {
        key: "usuarios",
        label: "Usuarios",
        shortLabel: "Usuarios",
        show: hasPermission("manage_users"),
        section: "configuracion",
      },
      {
        key: "roles",
        label: "Roles y accesos",
        shortLabel: "Roles",
        show: hasPermission("manage_roles") || hasPermission("view_audit"),
        section: "configuracion",
      },
      {
        key: "settings",
        label: isSuperAdmin ? "Configuracion global" : "Configuracion",
        shortLabel: "Configuracion",
        show: !isSuperAdmin && hasPermission("manage_settings"),
        section: isSuperAdmin ? "plataforma" : "configuracion",
      },
      {
        key: "organizaciones",
        label: "Organizaciones",
        shortLabel: "Organizaciones",
        show: isSuperAdmin,
        section: "organizaciones",
      },
      {
        key: "archivo-central",
        label: "Plataforma",
        shortLabel: "Plataforma",
        show: isSuperAdmin,
        section: "plataforma",
      },
      {
        key: "novedades",
        label: "Comunicados",
        shortLabel: "Comunicados",
        show: false,
        section: "inicio",
      },
    ],
    [hasPermission, isEmployee, isManager, isReadOnly, isSuperAdmin]
  );

  const visibleViews = allViews.filter((item) => item.show);

  const primaryTabs = useMemo(() => {
    if (isSuperAdmin) {
      return [
        { key: "organizaciones", label: "Organizaciones" },
        { key: "reportes-globales", label: "Reportes globales" },
        { key: "importacion", label: "Importacion" },
        { key: "plataforma", label: "Plataforma" },
      ];
    }

    if (isEmployee) {
      return [
        { key: "inicio", label: "Inicio" },
        { key: "evaluaciones", label: "Evaluaciones" },
        { key: "desarrollo", label: "Desarrollo" },
      ];
    }

    if (isManager) {
      return [
        { key: "inicio", label: "Inicio" },
        { key: "personas", label: "Personas" },
        { key: "evaluaciones", label: "Evaluaciones" },
        { key: "desarrollo", label: "Desarrollo" },
        { key: "reportes", label: "Reportes" },
      ];
    }

    if (isReadOnly) {
      return [
        { key: "inicio", label: "Inicio" },
        { key: "reportes", label: "Reportes" },
        { key: "datos", label: "Datos" },
      ];
    }

    return [
      { key: "inicio", label: "Inicio" },
      { key: "personas", label: "Personas" },
      { key: "evaluaciones", label: "Evaluaciones" },
      { key: "objetivos", label: "Objetivos / Indicadores" },
      { key: "desarrollo", label: "Desarrollo" },
      { key: "reportes", label: "Reportes" },
      { key: "datos", label: "Datos / Carga masiva" },
      { key: "configuracion", label: "Configuracion" },
    ];
  }, [isEmployee, isManager, isReadOnly, isSuperAdmin]);

  const visiblePrimaryTabs = primaryTabs.filter((tab) =>
    visibleViews.some((item) => item.section === tab.key)
  );

  const viewSection = visibleViews.find((item) => item.key === view)?.section;
  const activePrimary = visiblePrimaryTabs.some((tab) => tab.key === viewSection)
    ? viewSection
    : visiblePrimaryTabs[0]?.key || "inicio";

  const secondaryTabs = visibleViews.filter((item) => item.section === activePrimary);

  async function handleMarkRead(item) {
    if (!token || item.isRead || isSuperAdmin) return;
    await apiFetch(`/announcements/${item._id}/read`, { method: "POST", token });
    await refreshAnnouncementSummary();
  }

  function openPrimary(groupKey) {
    const items = visibleViews.filter((item) => item.section === groupKey);
    const nextView = firstVisibleView(items);
    if (nextView) setView(nextView);
  }

  const contextualSubtitle = isSuperAdmin
    ? "Gestion global multi-organizacion"
    : user?.companyName
      ? `Operacion en ${user.companyName}`
      : "Gestion de desempeño institucional";

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
                onClick={() => openPrimary(tab.key)}
                className={`rounded-xl px-4 py-3 text-sm font-medium transition ${
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
            {isSuperAdmin && companies.length ? (
              <select
                className="max-w-56 rounded-xl border border-white/10 bg-[#142028] px-3 py-3 text-sm text-white"
                value={activeCompanyId}
                onChange={(event) => setActiveCompanyId(event.target.value)}
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
              className="rounded-xl border border-white/15 bg-[#1A2C38] px-4 py-3 text-sm text-white"
            >
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
                {item.shortLabel || item.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1280px] px-4 py-6">
        <div className="mb-4 rounded-2xl border border-white/10 bg-[#142028] px-4 py-3 text-sm text-[#AFC3CE]">
          {user?.nombre} - {user?.roleLabel || user?.roleName} - {user?.companyName || "Organizacion"}
        </div>
        {tokenNearExpiry ? (
          <div className="mb-4 rounded-2xl border border-amber-300/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            Tu sesion vence pronto ({tokenExpiresAt?.toLocaleString("es-AR")}). Guarda cambios y vuelve a iniciar sesion.
          </div>
        ) : null}
        {children}
      </main>
    </div>
  );
}
