import { useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";
import { isEmployeeUser, isManagerUser, isReadOnlyUser } from "../lib/roleHelpers";
import AppLogo from "./brand/AppLogo";
import useClickOutside from "../hooks/useClickOutside";

function formatAnnouncementTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleString("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function NotificationBell({ announcementSummary, onMarkRead, onMarkAllRead, onViewAll, t }) {
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [markingAll, setMarkingAll] = useState(false);
  const unreadCount = announcementSummary?.unreadCount || 0;
  const containerRef = useRef(null);
  useClickOutside(containerRef, () => setOpen(false), open);

  async function handleMarkRead(item) {
    if (item.isRead || busyId) return;
    try {
      setBusyId(item._id);
      await onMarkRead?.(item);
    } finally {
      setBusyId("");
    }
  }

  async function handleMarkAllRead() {
    if (!unreadCount || markingAll) return;
    try {
      setMarkingAll(true);
      await onMarkAllRead?.();
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-[#12222d] text-white transition hover:bg-[#172c39]"
        aria-label={t("topbar.news", "Novedades")}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
          <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V10a6 6 0 1 0-12 0v4.2a2 2 0 0 1-.6 1.4L4 17h5" />
          <path d="M9.5 19a2.5 2.5 0 0 0 5 0" />
        </svg>
        {unreadCount ? (
          <span className="absolute -right-1 -top-1 rounded-full bg-[#2563eb] px-1.5 text-[11px] font-semibold text-white">
            {unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-30 mt-3 w-[24rem] rounded-3xl border border-white/10 bg-[#12222d] p-3 shadow-[0_18px_40px_rgba(2,8,23,0.4)]">
          <div className="flex items-center justify-between gap-3 px-2 pb-2">
            <div>
              <p className="text-sm font-semibold text-white">{t("topbar.news", "Novedades")}</p>
              <span className="text-xs text-[#89a3b1]">
                {unreadCount ? `${unreadCount} nuevas` : t("topbar.upToDate", "Al d?a")}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!unreadCount || markingAll}
                onClick={handleMarkAllRead}
                className="rounded-2xl border border-white/10 px-3 py-1.5 text-xs text-[#c7d5dc] transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {markingAll ? "Marcando..." : "Marcar todas"}
              </button>
              <button
                type="button"
                onClick={() => {
                  onViewAll?.();
                  setOpen(false);
                }}
                className="rounded-2xl bg-[#1e3a8a] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#2a4db8]"
              >
                Ver todas
              </button>
            </div>
          </div>
          <div className="space-y-2">
            {announcementSummary?.latest?.length ? (
              announcementSummary.latest.map((item) => (
                <div
                  key={item._id}
                  className={`rounded-2xl border px-3 py-3 text-left ${
                    item.isRead
                      ? "border-white/10 bg-[#0f1d26]"
                      : "border-[#4f7cff]/30 bg-[#12243b]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-white">{item.title || item.titulo}</p>
                        {!item.isRead ? (
                          <span className="rounded-full bg-[#2563eb] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white">
                            Nueva
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-[#8ea5b3]">
                        {item.body || item.cuerpo}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                        item.type === "warning"
                          ? "bg-amber-500/15 text-amber-200"
                          : item.type === "success"
                            ? "bg-emerald-500/15 text-emerald-200"
                            : item.type === "update"
                              ? "bg-violet-500/15 text-violet-200"
                              : "bg-white/10 text-[#c7d5dc]"
                      }`}
                    >
                      {item.type || "info"}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="text-[11px] text-[#7f99a8]">{formatAnnouncementTime(item.createdAt)}</span>
                    {!item.isRead ? (
                      <button
                        type="button"
                        disabled={busyId === item._id}
                        onClick={() => handleMarkRead(item)}
                        className="rounded-2xl border border-[#4f7cff]/30 px-3 py-1.5 text-xs font-medium text-[#d8e4ff] transition hover:bg-[#173150] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {busyId === item._id ? "Marcando..." : "Marcar como vista"}
                      </button>
                    ) : (
                      <span className="text-[11px] text-[#7f99a8]">Vista</span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-white/10 bg-[#0f1d26] px-3 py-4 text-sm text-[#8ea5b3]">
                No hay novedades nuevas.
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function LanguageMenu({ language, setLanguage, t }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  useClickOutside(containerRef, () => setOpen(false), open);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="rounded-2xl border border-white/10 bg-[#12222d] px-3 py-2 text-sm text-white transition hover:bg-[#172c39]"
        aria-label={t("common.language", "Idioma")}
      >
        {language === "en" ? "EN" : "ES"}
      </button>
      {open ? (
        <div className="absolute right-0 z-30 mt-3 w-40 rounded-3xl border border-white/10 bg-[#12222d] p-2 shadow-[0_18px_40px_rgba(2,8,23,0.4)]">
          {[
            { key: "es", label: t("common.spanish", "Español") },
            { key: "en", label: t("common.english", "English") },
          ].map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => {
                setLanguage(option.key);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left text-sm transition ${
                language === option.key ? "bg-[#122f55] text-white" : "text-[#c7d5dc] hover:bg-white/5 hover:text-white"
              }`}
            >
              <span>{option.label}</span>
              {language === option.key ? <span className="h-2 w-2 rounded-full bg-[#7ea3ff]" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function AppIcon({ name, active }) {
  const className = `h-5 w-5 ${active ? "text-white" : "text-[#8ea5b3]"}`;
  switch (name) {
    case "inicio":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
          <path d="M3 10.5L12 3l9 7.5" />
          <path d="M5.5 9.5V20h13V9.5" />
        </svg>
      );
    case "personas":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
          <path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
          <path d="M16 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />
          <path d="M3.5 20a5.5 5.5 0 0 1 9 0" />
          <path d="M13 20a4.5 4.5 0 0 1 7.5-2.8" />
        </svg>
      );
    case "evaluaciones":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
          <path d="M7 4.5h10" />
          <path d="M7 8.5h10" />
          <path d="M7 12.5h5" />
          <rect x="4" y="3" width="16" height="18" rx="2.5" />
          <path d="M14.5 16.5l1.7 1.7 3.3-4" />
        </svg>
      );
    case "objetivos":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
          <path d="M12 12m-8 0a8 8 0 1 0 16 0 8 8 0 1 0-16 0" />
          <path d="M12 12l5-5" />
          <path d="M12 12l-3 1" />
          <path d="M17 7h2v2" />
        </svg>
      );
    case "desarrollo":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
          <path d="M8 16l-2 5" />
          <path d="M16 16l2 5" />
          <path d="M12 3l6 6-6 6-6-6 6-6z" />
        </svg>
      );
    case "reportes":
    case "reportes-globales":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
          <path d="M5 20V8" />
          <path d="M12 20V4" />
          <path d="M19 20v-6" />
        </svg>
      );
    case "datos":
    case "importacion":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
          <path d="M12 4v10" />
          <path d="M8 10l4 4 4-4" />
          <path d="M4 20h16" />
        </svg>
      );
    case "configuracion":
    case "plataforma":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
          <path d="M12 8.5A3.5 3.5 0 1 0 12 15.5A3.5 3.5 0 1 0 12 8.5z" />
          <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2 2 0 0 1-4 0v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a2 2 0 0 1 0-4h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V4a2 2 0 0 1 4 0v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6h.2a2 2 0 0 1 0 4h-.2a1 1 0 0 0-.9.6z" />
        </svg>
      );
    case "organizaciones":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
          <path d="M4 20V6l8-3 8 3v14" />
          <path d="M9 20v-4h6v4" />
          <path d="M8 9h.01" />
          <path d="M12 9h.01" />
          <path d="M16 9h.01" />
          <path d="M8 13h.01" />
          <path d="M12 13h.01" />
          <path d="M16 13h.01" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
          <path d="M4 12h16" />
        </svg>
      );
  }
}

function firstVisibleView(items) {
  return items.find((item) => item.show)?.key || null;
}

function buildConfigSubmenu(visibleViews) {
  return [
    { label: "Organización", viewKey: visibleViews.some((item) => item.key === "settings") ? "settings" : null },
    { label: "Usuarios", viewKey: visibleViews.some((item) => item.key === "usuarios") ? "usuarios" : null },
    { label: "Ciclos", viewKey: visibleViews.some((item) => item.key === "ciclos") ? "ciclos" : null },
    { label: "Importación", viewKey: visibleViews.some((item) => item.key === "carga-masiva") ? "carga-masiva" : null },
  ].filter((item) => item.viewKey);
}

function translateNavLabel(key, fallback, t) {
  const map = {
    dashboard: "nav.home",
    empleados: "nav.people",
    evaluaciones: "nav.evaluations",
    ciclos: "nav.cycles",
    metricas: "nav.metrics",
    competencias: "nav.skills",
    planes: "nav.development",
    "reporte-ejecutivo": "nav.report",
    "bases-descargas": "nav.dataCenter",
    "carga-masiva": "nav.import",
    usuarios: "nav.users",
    roles: "nav.settings",
    settings: "nav.settings",
    organizaciones: "nav.organizations",
    "archivo-central": "nav.platform",
    inicio: "nav.home",
    personas: "nav.people",
    objetivos: "nav.metricsShort",
    desarrollo: "nav.development",
    reportes: "nav.report",
    datos: "nav.import",
    configuracion: "nav.settings",
    plataforma: "nav.platform",
    importacion: "nav.import",
    "reportes-globales": "nav.report",
    novedades: "nav.news",
  };
  return t(map[key] || "", fallback);
}

export default function AppShell({
  view,
  setView,
  searchQuery,
  setSearchQuery,
  theme,
  setTheme,
  language,
  setLanguage,
  t,
  children,
}) {
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

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const isSuperAdmin = Boolean(user?.isSuperAdmin);
  const isEmployee = isEmployeeUser(user);
  const isManager = isManagerUser(user);
  const isReadOnly = isReadOnlyUser(user, hasPermission);

  const allViews = useMemo(
    () => [
      { key: "dashboard", label: "Inicio", shortLabel: "Inicio", show: true, section: isSuperAdmin ? "plataforma" : "inicio" },
      {
        key: "novedades",
        label: "Novedades",
        shortLabel: "Novedades",
        show: true,
        section: "inicio",
      },
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
        label: "Ciclos",
        shortLabel: "Ciclos",
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
        label: isManager ? "Centro de datos del equipo" : "Centro de datos",
        shortLabel: "Centro de datos",
        show:
          hasPermission("view_reports") ||
          hasPermission("download_reports") ||
          hasPermission("download_team_reports") ||
          hasPermission("download_self_report"),
        section: "reportes",
      },
      {
        key: "carga-masiva",
        label: "Importación",
        shortLabel: "Importación",
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
        label: "Usuarios y credenciales",
        shortLabel: "Usuarios",
        show: hasPermission("manage_users"),
        section: "personas",
      },
      {
        key: "roles",
        label: "Roles y accesos",
        shortLabel: "Roles y accesos",
        show: isSuperAdmin && (hasPermission("manage_roles") || hasPermission("view_audit")),
        section: "configuracion",
      },
      {
        key: "settings",
        label: isSuperAdmin ? "Configuración global" : "Configuración",
        shortLabel: "Configuración",
        show: isSuperAdmin ? false : hasPermission("manage_settings"),
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
    ],
    [hasPermission, isEmployee, isManager, isSuperAdmin]
  );

  const visibleViews = allViews.filter((item) => item.show);

  const primaryTabs = useMemo(() => {
    if (isSuperAdmin) {
      return [
        { key: "organizaciones", label: "Organizaciones" },
        { key: "reportes-globales", label: "Reportes globales" },
        { key: "importacion", label: "Importación" },
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
        { key: "datos", label: "Importación" },
      ];
    }
    return [
      { key: "inicio", label: "Inicio" },
      { key: "personas", label: "Personas" },
      { key: "evaluaciones", label: "Evaluaciones" },
      { key: "objetivos", label: "Objetivos / Indicadores" },
      { key: "desarrollo", label: "Desarrollo" },
      { key: "reportes", label: "Reportes" },
      { key: "datos", label: "Importación" },
    ];
  }, [isEmployee, isManager, isReadOnly, isSuperAdmin]);

  const visiblePrimaryTabs = primaryTabs.filter((tab) => visibleViews.some((item) => item.section === tab.key));
  const viewSection = visibleViews.find((item) => item.key === view)?.section;
  const activePrimary = visiblePrimaryTabs.some((tab) => tab.key === viewSection)
    ? viewSection
    : visiblePrimaryTabs[0]?.key || "inicio";
  const secondaryTabs = visibleViews.filter((item) => item.section === activePrimary);
  const configSubmenu = buildConfigSubmenu(visibleViews);

  const contextualSubtitle = isSuperAdmin
    ? "Gestión global multi-organización"
    : user?.companyName
      ? `Operaci?n en ${user.companyName}`
      : "Gestión del desempeño institucional";

  async function handleMarkRead(item) {
    if (!token || item.isRead) return;
    await apiFetch(`/announcements/${item._id}/read`, { method: "POST", token });
    await refreshAnnouncementSummary();
  }

  async function handleMarkAllRead() {
    if (!token) return;
    await apiFetch("/announcements/read-all", { method: "POST", token });
    await refreshAnnouncementSummary();
  }

  function openPrimary(groupKey) {
    const items = visibleViews.filter((item) => item.section === groupKey);
    const nextView = firstVisibleView(items);
    if (nextView) setView(nextView);
  }

  return (
    <div className="min-h-screen bg-[#091319] text-[#E8EEF1]">
      <div className="flex min-h-screen">
        <aside
          className={`hidden border-r border-white/10 bg-[#0c171d] transition-all lg:flex lg:flex-col ${
            sidebarCollapsed ? "w-[92px]" : "w-[288px]"
          }`}
        >
          <div className="border-b border-white/10 px-4 py-5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 overflow-hidden">
                <AppLogo variant="dark" compact={sidebarCollapsed} />
              </div>
              <button
                type="button"
                onClick={() => setSidebarCollapsed((value) => !value)}
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-[#12222d] text-[#c7d5dc]"
                aria-label="Colapsar sidebar"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                  {sidebarCollapsed ? <path d="M9 6l6 6-6 6" /> : <path d="M15 6l-6 6 6 6" />}
                </svg>
              </button>
            </div>
            {!sidebarCollapsed ? <p className="mt-3 text-sm text-[#7c97a6]">{contextualSubtitle}</p> : null}
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-4">
            <nav className="space-y-2">
              {visiblePrimaryTabs.map((tab) => {
                const isActive = activePrimary === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => openPrimary(tab.key)}
                    className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-medium transition ${
                      isActive
                        ? "bg-[#1e3a8a] text-white shadow-[0_10px_24px_rgba(30,58,138,0.28)]"
                        : "text-[#9ab0bc] hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <AppIcon name={tab.key} active={isActive} />
                    {!sidebarCollapsed ? <span>{translateNavLabel(tab.key, tab.label, t)}</span> : null}
                  </button>
                );
              })}
            </nav>

            {!sidebarCollapsed && activePrimary === "configuracion" && configSubmenu.length ? (
              <div className="mt-6 rounded-3xl border border-white/10 bg-[#101d25] p-3">
                <p className="px-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#7f99a8]">Configuración</p>
                <div className="mt-3 space-y-1.5">
                  {configSubmenu.map((item) => {
                    const isActive = view === item.viewKey;
                    return (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => setView(item.viewKey)}
                        className={`flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm transition ${
                          isActive ? "bg-[#122f55] text-white" : "text-[#9ab0bc] hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        <span>{translateNavLabel(item.viewKey, item.label, t)}</span>
                        {isActive ? <span className="h-2 w-2 rounded-full bg-[#7ea3ff]" /> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>

          <div className="border-t border-white/10 px-3 py-4">
            {!sidebarCollapsed ? (
              <div className="rounded-3xl border border-white/10 bg-[#101d25] p-4">
                <p className="text-sm font-semibold text-white">{user?.nombre || "Usuario"}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.14em] text-[#7ea3ff]">
                  {user?.roleKey || user?.roleCode || "ROL"}
                </p>
                <p className="mt-2 text-xs text-[#7c97a6]">{user?.companyName || "Organización activa"}</p>
              </div>
            ) : (
              <div className="flex justify-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-[#101d25] text-sm font-semibold text-white">
                  {(user?.nombre || "U").slice(0, 1)}
                </div>
              </div>
            )}
          </div>
        </aside>

        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-white/10 bg-[#091319]/95 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-4 md:px-6">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="lg:hidden">
                  <AppLogo variant="dark" compact />
                </div>
                {isSuperAdmin && companies.length ? (
                  <select
                    className="min-w-[220px] rounded-2xl border border-white/10 bg-[#12222d] px-4 py-3 text-sm text-white"
                    value={activeCompanyId}
                    onChange={(event) => setActiveCompanyId(event.target.value)}
                  >
                    {companies.map((company) => (
                      <option key={company._id} value={company._id}>
                        {company.nombre}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-[#12222d] px-4 py-3">
                    <p className="text-xs text-[#7f99a8]">{t("topbar.organization", "Organización activa")}</p>
                    <p className="text-sm font-medium text-white">{user?.companyName || t("common.organization", "Organización")}</p>
                  </div>
                )}

                <div className="hidden min-w-[320px] flex-1 items-center gap-3 rounded-2xl border border-white/10 bg-[#12222d] px-4 py-3 md:flex">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5 text-[#7f99a8]">
                    <path d="M11 19a8 8 0 1 1 5.3-14l4.2 4.2" />
                    <path d="M21 21l-4.35-4.35" />
                  </svg>
                  <input
                    className="w-full bg-transparent text-sm text-[#e8eef1] outline-none placeholder:text-[#7f99a8]"
                    placeholder={t("topbar.searchPlaceholder", "Buscar en la pantalla actual...")}
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    aria-label={t("topbar.searchPlaceholder", "Buscar en la pantalla actual...")}
                  />
                  <span className="rounded-xl border border-white/10 px-2 py-1 text-xs text-[#7f99a8]">
                    {t("topbar.searchHint", "Filtra listas visibles")}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <NotificationBell
                  announcementSummary={announcementSummary}
                  onMarkRead={handleMarkRead}
                  onMarkAllRead={handleMarkAllRead}
                  onViewAll={() => setView("novedades")}
                  t={t}
                />
                <LanguageMenu language={language} setLanguage={setLanguage} t={t} />
                <button
                  type="button"
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-[#12222d] text-[#9fb6c4] transition hover:bg-[#172c39] hover:text-white"
                  title={theme === "dark" ? t("topbar.light", "Cambiar a modo claro") : t("topbar.dark", "Cambiar a modo oscuro")}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                    {theme === "dark" ? (
                      <path d="M21 12.8A9 9 0 0 1 11.2 3 7 7 0 1 0 21 12.8z" />
                    ) : (
                      <>
                        <circle cx="12" cy="12" r="4" />
                        <path d="M12 2v2.5M12 19.5V22M4.93 4.93l1.77 1.77M17.3 17.3l1.77 1.77M2 12h2.5M19.5 12H22M4.93 19.07l1.77-1.77M17.3 6.7l1.77-1.77" />
                      </>
                    )}
                  </svg>
                </button>
                <div className="hidden items-center gap-3 rounded-2xl border border-white/10 bg-[#12222d] px-3 py-2 md:flex">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#1e3a8a] text-sm font-semibold text-white">
                    {(user?.nombre || "U").slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{user?.nombre || "Usuario actual"}</p>
                    <p className="truncate text-xs text-[#7ea3ff]">{user?.roleLabel || user?.roleName || user?.roleKey || user?.roleCode}</p>
                  </div>
                </div>
                <button
                  onClick={logout}
                  className="rounded-2xl border border-white/15 bg-[#152833] px-4 py-3 text-sm text-white transition hover:bg-[#1a3240]"
                >
                  {t("topbar.logout", "Salir")}
                </button>
              </div>
            </div>

            {searchQuery?.trim() ? (
              <div className="px-4 pb-3 md:px-6">
                <div className="rounded-2xl border border-white/10 bg-[#12222d] px-4 py-3 text-sm text-[#a8bdc8]">
                  {t("common.searchApplies", "La búsqueda se aplica a las listas visibles de esta pantalla.")}
                </div>
              </div>
            ) : null}

            {secondaryTabs.length ? (
              <div className="border-t border-white/10 px-4 pb-4 pt-3 md:px-6">
                <div className="flex flex-wrap gap-2">
                  {secondaryTabs.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setView(item.key)}
                      className={`rounded-2xl px-4 py-2.5 text-sm transition ${
                        view === item.key
                          ? "bg-[#1e3a8a] text-white"
                          : "border border-white/10 bg-[#12222d] text-[#a8bdc8] hover:text-white"
                      }`}
                    >
                      {translateNavLabel(item.key, item.shortLabel || item.label, t)}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </header>

          <main className="flex-1 px-4 py-6 md:px-6">
            <div className="mx-auto w-full max-w-[1440px]">
              {tokenNearExpiry ? (
                <div className="mb-5 rounded-2xl border border-amber-300/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                  Tu sesión vence pronto ({tokenExpiresAt?.toLocaleString("es-AR")}). Guarda cambios y vuelve a iniciar sesión.
                </div>
              ) : null}
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

