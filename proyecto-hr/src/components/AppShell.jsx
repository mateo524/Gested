import { useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";
import { isEmployeeUser, isManagerUser } from "../lib/roleHelpers";
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
                {unreadCount ? `${unreadCount} nuevas` : t("topbar.upToDate", "Al día")}
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
                    item.isRead ? "border-white/10 bg-[#0f1d26]" : "border-[#4f7cff]/30 bg-[#12243b]"
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
                      <p className="mt-1 text-xs leading-relaxed text-[#8ea5b3]">{item.body || item.cuerpo}</p>
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

function LanguageMenu({ setLanguage, t }) {
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
        ES
      </button>
      {open ? (
        <div className="absolute right-0 z-30 mt-3 w-44 rounded-3xl border border-white/10 bg-[#12222d] p-2 shadow-[0_18px_40px_rgba(2,8,23,0.4)]">
          <button
            type="button"
            onClick={() => {
              setLanguage("es");
              setOpen(false);
            }}
            className="flex w-full items-center justify-between rounded-2xl bg-[#122f55] px-3 py-2 text-left text-sm text-white"
          >
            <span>{t("common.spanish", "Español")}</span>
            <span className="h-2 w-2 rounded-full bg-[#7ea3ff]" />
          </button>
          <div className="mt-2 rounded-2xl border border-white/10 bg-[#0f1d26] px-3 py-2 text-left text-xs text-[#8ea5b3]">
            English próximamente
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SearchResultItem({ item, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className="flex w-full items-start justify-between gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-white/5"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-white">{item.label}</p>
        <p className="mt-1 text-xs text-[#8ea5b3]">{item.detail}</p>
      </div>
      <span className="shrink-0 rounded-full border border-white/10 bg-[#122530] px-2.5 py-1 text-[11px] text-[#c7d5dc]">
        {item.group}
      </span>
    </button>
  );
}

function AppIcon({ name, active }) {
  const className = `h-5 w-5 ${active ? "text-white" : "text-[#8ea5b3]"}`;
  switch (name) {
    case "inicio":
    case "dashboard":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
          <path d="M3 10.5L12 3l9 7.5" />
          <path d="M5.5 9.5V20h13V9.5" />
        </svg>
      );
    case "personas":
    case "empleados":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
          <path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
          <path d="M16 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />
          <path d="M3.5 20a5.5 5.5 0 0 1 9 0" />
          <path d="M13 20a4.5 4.5 0 0 1 7.5-2.8" />
        </svg>
      );
    case "usuarios":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
          <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
          <path d="M4 20a8 8 0 0 1 16 0" />
        </svg>
      );
    case "ciclos":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
          <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
          <path d="M7 3v4M17 3v4M3.5 10h17" />
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
    case "competencias":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
          <path d="M12 3l7 4v5c0 5-3 7.5-7 9-4-1.5-7-4-7-9V7l7-4z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      );
    case "objetivos":
    case "metricas":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
          <path d="M12 12m-8 0a8 8 0 1 0 16 0 8 8 0 1 0-16 0" />
          <path d="M12 12l5-5" />
          <path d="M12 12l-3 1" />
          <path d="M17 7h2v2" />
        </svg>
      );
    case "desarrollo":
    case "planes":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
          <path d="M8 16l-2 5" />
          <path d="M16 16l2 5" />
          <path d="M12 3l6 6-6 6-6-6 6-6z" />
        </svg>
      );
    case "reportes":
    case "reporte-ejecutivo":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
          <path d="M5 20V8" />
          <path d="M12 20V4" />
          <path d="M19 20v-6" />
        </svg>
      );
    case "importacion":
    case "carga-masiva":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
          <path d="M12 4v10" />
          <path d="M8 10l4 4 4-4" />
          <path d="M4 20h16" />
        </svg>
      );
    case "novedades":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
          <path d="M6 5h12" />
          <path d="M6 10h12" />
          <path d="M6 15h8" />
          <rect x="4" y="3" width="16" height="18" rx="2.5" />
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

function translateNavLabel(key, fallback, t) {
  const map = {
    dashboard: "nav.home",
    empleados: "nav.people",
    usuarios: "nav.users",
    ciclos: "nav.cycles",
    evaluaciones: "nav.evaluations",
    competencias: "nav.skills",
    metricas: "nav.metrics",
    planes: "nav.development",
    "reporte-ejecutivo": "nav.report",
    "carga-masiva": "nav.import",
    novedades: "nav.news",
    organizaciones: "nav.organizations",
    settings: "nav.settings",
    roles: "nav.settings",
    "archivo-central": "nav.platform",
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
  const [searchOpen, setSearchOpen] = useState(false);
  const isSuperAdmin = Boolean(user?.isSuperAdmin);
  const isEmployee = isEmployeeUser(user);
  const isManager = isManagerUser(user);
  const searchRef = useRef(null);
  useClickOutside(searchRef, () => setSearchOpen(false), searchOpen);

  const allViews = useMemo(
    () => [
      { key: "dashboard", label: "Inicio", show: true, keywords: ["inicio", "dashboard", "panel", "resumen"] },
      { key: "empleados", label: isEmployee ? "Mi perfil" : isManager ? "Mi equipo" : "Personas", show: hasPermission("manage_employees"), keywords: ["personas", "empleados", "equipo", "perfil"] },
      { key: "usuarios", label: "Usuarios", show: hasPermission("manage_users"), keywords: ["usuarios", "credenciales", "accesos"] },
      { key: "ciclos", label: "Ciclos", show: hasPermission("manage_evaluation_cycles") || (hasPermission("view_reports") && !isEmployee), keywords: ["ciclos", "periodo", "período", "calendario"] },
      { key: "evaluaciones", label: "Evaluaciones", show: hasPermission("manage_evaluations") || hasPermission("evaluate_team") || hasPermission("self_evaluate") || hasPermission("view_reports"), keywords: ["evaluaciones", "autoevaluacion", "autoevaluación", "feedback", "desempeño"] },
      { key: "competencias", label: "Competencias", show: hasPermission("manage_competencies"), keywords: ["competencias", "transversales", "docentes"] },
      { key: "metricas", label: "Objetivos / Indicadores", show: hasPermission("manage_metrics"), keywords: ["objetivos", "indicadores", "kpi", "okr", "metas", "mediciones"] },
      { key: "planes", label: isEmployee ? "Mi desarrollo" : "Desarrollo", show: hasPermission("manage_development_plans") || hasPermission("evaluate_team") || hasPermission("self_evaluate") || hasPermission("download_self_report") || hasPermission("view_reports"), keywords: ["desarrollo", "planes", "seguimiento"] },
      { key: "reporte-ejecutivo", label: "Reportes", show: hasPermission("view_reports") || hasPermission("download_reports") || hasPermission("download_team_reports") || hasPermission("view_audit"), keywords: ["reportes", "reporte ejecutivo", "personas", "acciones", "insights"] },
      { key: "carga-masiva", label: "Importación", show: hasPermission("manage_users") || hasPermission("manage_school_users") || hasPermission("manage_employees") || hasPermission("manage_roles") || hasPermission("view_audit"), keywords: ["importacion", "importación", "excel", "carga", "plantilla"] },
      { key: "novedades", label: "Novedades", show: true, keywords: ["novedades", "anuncios", "notificaciones"] },
      { key: "organizaciones", label: "Organizaciones", show: isSuperAdmin, keywords: ["organizaciones", "tenants", "empresas"] },
      { key: "roles", label: "Roles y accesos", show: isSuperAdmin && (hasPermission("manage_roles") || hasPermission("view_audit")), keywords: ["roles", "accesos", "scope", "permisos"] },
      { key: "settings", label: "Configuración", show: isSuperAdmin ? false : hasPermission("manage_settings"), keywords: ["configuracion", "configuración", "ajustes"] },
      { key: "archivo-central", label: "Plataforma", show: isSuperAdmin, keywords: ["plataforma", "archivo central"] },
    ],
    [hasPermission, isEmployee, isManager, isSuperAdmin]
  );

  const visibleViews = useMemo(() => allViews.filter((item) => item.show), [allViews]);
  const sidebarViews = useMemo(
    () =>
      visibleViews.filter(
        (item) => !["roles", "settings", "archivo-central", "organizaciones"].includes(item.key) && item.key !== "bases-descargas"
      ),
    [visibleViews]
  );

  const organizationLabel = user?.companyName || "Organización activa";
  const contextualSubtitle = isSuperAdmin
    ? "Gestión global multi-organización"
    : `Operación en ${organizationLabel}`;

  const globalSearchItems = useMemo(() => {
    return visibleViews.map((item) => ({
      viewKey: item.key,
      label: translateNavLabel(item.key, item.label, t),
      group:
        item.key === "dashboard"
          ? "Inicio"
          : item.key === "carga-masiva"
            ? "Importación"
            : item.key === "reporte-ejecutivo"
              ? "Reportes"
              : item.key === "planes"
                ? "Desarrollo"
                : "Módulo",
      detail: item.key === "metricas"
        ? "Abrir mediciones, metas, KPIs y OKRs"
        : item.key === "evaluaciones"
          ? "Abrir ciclos, formularios y seguimiento"
          : item.key === "planes"
            ? "Abrir sugerencias y planes de desarrollo"
            : `Abrir ${translateNavLabel(item.key, item.label, t).toLowerCase()}`,
      searchable: [item.label, ...(item.keywords || [])].join(" ").toLowerCase(),
    }));
  }, [t, visibleViews]);

  const searchResults = useMemo(() => {
    const term = String(searchQuery || "").trim().toLowerCase();
    if (!term) return globalSearchItems.slice(0, 8);
    return globalSearchItems.filter((item) => item.searchable.includes(term)).slice(0, 8);
  }, [globalSearchItems, searchQuery]);

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

  function handleSearchSelect(item) {
    setView(item.viewKey);
    setSearchOpen(false);
  }

  return (
    <div className="min-h-screen bg-[#091319] text-[#E8EEF1]">
      <div className="flex min-h-screen">
        <aside
          className={`hidden border-r border-white/10 bg-[#0c171d] transition-all lg:flex lg:flex-col ${
            sidebarCollapsed ? "w-[92px]" : "w-[288px]"
          }`}
        >
          <div className="border-b border-white/10 px-4 py-4">
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
              {sidebarViews.map((item) => {
                const isActive = view === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setView(item.key)}
                    className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-medium transition ${
                      isActive
                        ? "bg-[#1e3a8a] text-white shadow-[0_10px_24px_rgba(30,58,138,0.28)]"
                        : "text-[#9ab0bc] hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <AppIcon name={item.key} active={isActive} />
                    {!sidebarCollapsed ? <span>{translateNavLabel(item.key, item.label, t)}</span> : null}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="border-t border-white/10 px-3 py-4">
            {!sidebarCollapsed ? (
              <div className="rounded-3xl border border-white/10 bg-[#101d25] p-4">
                <p className="text-sm font-semibold text-white">{user?.nombre || "Usuario"}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.14em] text-[#7ea3ff]">
                  {user?.roleKey || user?.roleCode || "ROL"}
                </p>
                <p className="mt-2 text-xs text-[#7c97a6]">{organizationLabel}</p>
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
            <div className="grid gap-4 px-4 py-4 md:grid-cols-[240px_minmax(0,1fr)_auto] md:px-6">
              <div className="flex min-w-0 items-center gap-3">
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
                    <p className="text-sm font-medium text-white">{organizationLabel}</p>
                  </div>
                )}
              </div>

              <div ref={searchRef} className="relative mx-auto w-full max-w-2xl">
                <div className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-[#12222d] px-4 py-3">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5 text-[#7f99a8]">
                    <path d="M11 19a8 8 0 1 1 5.3-14l4.2 4.2" />
                    <path d="M21 21l-4.35-4.35" />
                  </svg>
                  <input
                    className="w-full bg-transparent text-sm text-[#e8eef1] outline-none placeholder:text-[#7f99a8]"
                    placeholder="Buscar módulos, secciones o acciones"
                    value={searchQuery}
                    onFocus={() => setSearchOpen(true)}
                    onChange={(event) => {
                      setSearchQuery(event.target.value);
                      setSearchOpen(true);
                    }}
                    aria-label="Buscar módulos, secciones o acciones"
                  />
                  <span className="hidden rounded-xl border border-white/10 px-2 py-1 text-xs text-[#7f99a8] lg:inline-flex">
                    Busca y navega
                  </span>
                </div>
                {searchOpen ? (
                  <div className="absolute inset-x-0 z-30 mt-3 rounded-3xl border border-white/10 bg-[#12222d] p-2 shadow-[0_18px_40px_rgba(2,8,23,0.4)]">
                    {searchResults.length ? (
                      searchResults.map((item) => (
                        <SearchResultItem key={item.viewKey} item={item} onSelect={handleSearchSelect} />
                      ))
                    ) : (
                      <div className="rounded-2xl border border-white/10 bg-[#0f1d26] px-3 py-4 text-sm text-[#8ea5b3]">
                        No encontramos coincidencias en la navegación visible.
                      </div>
                    )}
                  </div>
                ) : null}
              </div>

              <div className="flex items-center justify-end gap-2">
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
          </header>

          <main className="flex-1 px-4 py-5 md:px-6">
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
