import { useEffect, useMemo, useRef, useState } from "react";
import { apiUrl } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";
import { isEmployeeUser, isManagerUser } from "../lib/roleHelpers";
import NpsModal from "./NpsModal";
import AppLogo from "./brand/AppLogo";
import useClickOutside from "../hooks/useClickOutside";

function formatAnnouncementTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
}

function NotificationBell({ announcementSummary, notifFeed, onMarkRead, onMarkAllRead, onViewAll, onOpenAnnouncement, t }) {
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [markingAll, setMarkingAll] = useState(false);
  const containerRef = useRef(null);
  useClickOutside(containerRef, () => setOpen(false), open);

  // Merge announcements + system notifications into one unified list
  const announcements = (announcementSummary?.latest || []).map(a => ({
    ...a,
    _notifType: "announcement",
    isRead: Boolean(a.isRead),
    title: a.title || a.titulo,
    body: a.body || a.cuerpo,
  }));
  const systemNotifs = (notifFeed?.notifications || []).map(n => ({
    ...n,
    _notifType: "system",
    isRead: Boolean(n.read),
    title: n.title || n.titulo || "Notificación",
    body: n.body || n.mensaje || "",
    type: n.type || n.tipo || "info",
  }));
  const allItems = [...announcements, ...systemNotifs]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 15);

  const unreadCount = allItems.filter(i => !i.isRead).length;

  async function handleMarkRead(item) {
    if (item.isRead || busyId) return;
    try { setBusyId(item._id); await onMarkRead?.(item); } finally { setBusyId(""); }
  }

  async function handleMarkAllRead() {
    if (!unreadCount || markingAll) return;
    try { setMarkingAll(true); await onMarkAllRead?.(); } finally { setMarkingAll(false); }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-[#12222d] text-white transition hover:bg-[#172c39]"
        aria-label={t("topbar.notifications", "Notificaciones")}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
          <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V10a6 6 0 1 0-12 0v4.2a2 2 0 0 1-.6 1.4L4 17h5" />
          <path d="M9.5 19a2.5 2.5 0 0 0 5 0" />
        </svg>
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#14b8a6] px-1 text-[10px] font-semibold text-white">{unreadCount > 9 ? "9+" : unreadCount}</span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 z-30 mt-3 w-[22rem] rounded-2xl border border-white/10 bg-[#12222d] shadow-[0_18px_40px_rgba(2,8,23,0.4)]">
          <div className="flex items-center justify-between gap-3 border-b border-white/8 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-white">Notificaciones</p>
              <span className="text-xs text-[#89a3b1]">{unreadCount > 0 ? `${unreadCount} sin leer` : "Todo al día"}</span>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" disabled={!unreadCount || markingAll} onClick={handleMarkAllRead}
                className="rounded-xl border border-white/10 px-2.5 py-1 text-xs text-[#c7d5dc] transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50">
                {markingAll ? "..." : "Marcar todas"}
              </button>
              <button type="button" onClick={() => { onViewAll?.(); setOpen(false); }}
                className="rounded-xl bg-[#14b8a6] px-2.5 py-1 text-xs font-medium text-[#0f172a] transition hover:bg-[#0d9488]">
                Ver novedades
              </button>
            </div>
          </div>
          <div className="max-h-[420px] overflow-y-auto p-2 space-y-1">
            {allItems.length ? (
              allItems.map(item => (
                <div key={`${item._notifType}-${item._id}`}
                  role={item._notifType === "announcement" ? "button" : undefined}
                  tabIndex={item._notifType === "announcement" ? 0 : undefined}
                  onClick={item._notifType === "announcement" ? () => { onOpenAnnouncement?.(item); setOpen(false); } : undefined}
                  onKeyDown={item._notifType === "announcement" ? e => { if (e.key === "Enter") { onOpenAnnouncement?.(item); setOpen(false); } } : undefined}
                  className={`rounded-xl border px-3 py-2.5 ${item._notifType === "announcement" ? "cursor-pointer" : ""} ${!item.isRead ? "border-[#14b8a6]/25 bg-[#0d1e22]" : "border-white/8 bg-[#0f1d26]"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {item._notifType === "system" && (
                          <span className="shrink-0 h-1.5 w-1.5 rounded-full bg-violet-400" />
                        )}
                        <p className="truncate text-sm font-medium text-white">{item.title}</p>
                        {!item.isRead ? <span className="shrink-0 rounded-full bg-[#14b8a6] px-1.5 py-0.5 text-[9px] font-semibold text-white">Nueva</span> : null}
                      </div>
                      {item.body ? <p className="mt-0.5 text-xs text-[#8ea5b3] line-clamp-2">{item.body}</p> : null}
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase ${item.type === "warning" ? "bg-amber-500/15 text-amber-200" : item.type === "success" ? "bg-emerald-500/15 text-emerald-200" : item._notifType === "system" ? "bg-violet-500/15 text-violet-200" : "bg-white/10 text-[#c7d5dc]"}`}>
                      {item._notifType === "system" ? "sistema" : item.type || "info"}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <span className="text-[10px] text-[#7f99a8]">{formatAnnouncementTime(item.createdAt)}</span>
                    {!item.isRead && item._notifType === "announcement" ? (
                      <button type="button" disabled={busyId === item._id}
                        onClick={e => { e.stopPropagation(); handleMarkRead(item); }}
                        className="rounded-lg border border-[#14b8a6]/30 px-2 py-0.5 text-[10px] text-[#ccfbf1] transition hover:bg-[#0d2826] disabled:opacity-60">
                        {busyId === item._id ? "..." : "Marcar vista"}
                      </button>
                    ) : item.isRead ? <span className="text-[10px] text-[#7f99a8]">Vista</span> : null}
                  </div>
                </div>
              ))
            ) : (
              <div className="px-3 py-5 text-center text-sm text-[#8ea5b3]">Sin notificaciones nuevas.</div>
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
  const current = language === "en" ? "EN" : "ES";

  return (
    <div ref={containerRef} className="relative">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="rounded-xl border border-white/10 bg-[#12222d] px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-[#172c39]"
        aria-label={t("common.language", "Idioma")}>
        {current}
      </button>
      {open ? (
        <div className="absolute right-0 z-30 mt-2 w-40 rounded-2xl border border-white/10 bg-[#12222d] p-1.5 shadow-[0_18px_40px_rgba(2,8,23,0.4)]">
          {[{ code: "es", label: "Español" }].map(lang => (
            <button key={lang.code} type="button" onClick={() => { setLanguage(lang.code); setOpen(false); }}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-white transition hover:bg-white/5 ${language === lang.code ? "bg-[#122f55]" : ""}`}>
              <span>{lang.label}</span>
              {language === lang.code ? <span className="h-2 w-2 rounded-full bg-[#14b8a6]" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SearchResultItem({ item, onSelect, focused }) {
  return (
    <button type="button" onClick={() => onSelect(item)}
      className={`flex w-full items-start justify-between gap-3 rounded-xl px-3 py-2 text-left transition ${focused ? "bg-[#14b8a6]/10 ring-1 ring-[#14b8a6]/30" : "hover:bg-white/5"}`}>
      <div className="min-w-0">
        <p className={`truncate text-sm font-semibold ${focused ? "text-[#14b8a6]" : "text-white"}`}>{item.label}</p>
        <p className="mt-0.5 text-xs text-[#8ea5b3]">{item.detail}</p>
      </div>
      <span className="shrink-0 rounded-full border border-white/10 bg-[#122530] px-2 py-0.5 text-[10px] text-[#c7d5dc]">{item.group}</span>
    </button>
  );
}

function getUserDisplayName(user) {
  return [user?.nombre, user?.apellido].filter(Boolean).join(" ").trim() || user?.nombre || "Usuario";
}

function getUserInitials(user) {
  const parts = getUserDisplayName(user).split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map(p => p[0]?.toUpperCase() || "").join("") || "U";
}

function AppIcon({ name, active, size = "md" }) {
  const sz = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  const className = `${sz} ${active ? "text-white" : "text-[#8ea5b3]"}`;
  switch (name) {
    case "inicio": case "dashboard":
      return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}><path d="M3 10.5L12 3l9 7.5"/><path d="M5.5 9.5V20h13V9.5"/></svg>;
    case "personas": case "empleados":
      return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}><path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M16 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"/><path d="M3.5 20a5.5 5.5 0 0 1 9 0"/><path d="M13 20a4.5 4.5 0 0 1 7.5-2.8"/></svg>;
    case "usuarios":
      return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/><path d="M4 20a8 8 0 0 1 16 0"/></svg>;
    case "roles": case "accesos":
      return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;
    case "ciclos":
      return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M7 3v4M17 3v4M3.5 10h17"/></svg>;
    case "evaluaciones":
      return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}><path d="M7 4.5h10"/><path d="M7 8.5h10"/><path d="M7 12.5h5"/><rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M14.5 16.5l1.7 1.7 3.3-4"/></svg>;
    case "competencias": case "skills":
      return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}><path d="M12 3l7 4v5c0 5-3 7.5-7 9-4-1.5-7-4-7-9V7l7-4z"/><path d="M9 12l2 2 4-4"/></svg>;
    case "metricas":
      return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}><path d="M12 12m-8 0a8 8 0 1 0 16 0 8 8 0 1 0-16 0"/><path d="M12 12l5-5"/><path d="M12 12l-3 1"/><path d="M17 7h2v2"/></svg>;
    case "planes": case "desarrollo":
      return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}><path d="M8 16l-2 5"/><path d="M16 16l2 5"/><path d="M12 3l6 6-6 6-6-6 6-6z"/></svg>;
    case "reporte-ejecutivo": case "reportes":
      return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}><path d="M5 20V8"/><path d="M12 20V4"/><path d="M19 20v-6"/></svg>;
    case "carga-masiva":
      return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}><path d="M12 4v10"/><path d="M8 10l4 4 4-4"/><path d="M4 20h16"/></svg>;
    case "excel-sync":
      return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}><path d="M4 6h16M4 12h16M4 18h10"/><path d="M17 15l3 3-3 3"/></svg>;
    case "novedades":
      return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}><path d="M6 5h12"/><path d="M6 10h12"/><path d="M6 15h8"/><rect x="4" y="3" width="16" height="18" rx="2.5"/></svg>;
    case "organigrama":
      return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}><rect x="9" y="2" width="6" height="4" rx="1"/><rect x="2" y="18" width="6" height="4" rx="1"/><rect x="9" y="18" width="6" height="4" rx="1"/><rect x="16" y="18" width="6" height="4" rx="1"/><path d="M12 6v4M12 10H5v4M12 10h7v4"/></svg>;
    case "calibracion":
      return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>;
    case "organizaciones":
      return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;
    case "billing":
      return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>;
    case "settings":
      return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
    case "analytics": case "archivo-central":
      return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>;
    default:
      return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}><path d="M4 12h16"/></svg>;
  }
}

export default function AppShell({
  view, setView, searchQuery, setSearchQuery, language, setLanguage, t, availableViews, children,
}) {
  const { user, logout, hasPermission, companies, activeCompanyId, setActiveCompanyId, announcementSummary, refreshAnnouncementSummary, token, tokenExpiresAt, tokenNearExpiry } = useAuth();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchFocusedIdx, setSearchFocusedIdx] = useState(-1);
  const [backendDown, setBackendDown] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [apiSearchResults, setApiSearchResults] = useState(null);
  const [apiSearchLoading, setApiSearchLoading] = useState(false);
  const [activeGroup, setActiveGroup] = useState(null);
  const [notifFeed, setNotifFeed] = useState({ notifications: [], unreadCount: 0 });

  const isSuperAdmin = Boolean(user?.isSuperAdmin);
  const isEmployee = isEmployeeUser(user);
  const isManager = isManagerUser(user);
  const searchRef = useRef(null);
  useClickOutside(searchRef, () => setSearchOpen(false), searchOpen);

  // Cmd+K search
  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setSearchOpen(true); setSearchFocusedIdx(-1); searchRef.current?.querySelector("input")?.focus(); }
      if (e.key === "Escape") { setSearchOpen(false); setSearchFocusedIdx(-1); setMobileMenuOpen(false); }
      if (!searchOpen) return;
      if (e.key === "ArrowDown") { e.preventDefault(); setSearchFocusedIdx(i => i + 1); }
      if (e.key === "ArrowUp") { e.preventDefault(); setSearchFocusedIdx(i => Math.max(-1, i - 1)); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [searchOpen]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e) {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const shortcuts = { i: "dashboard", p: "empleados", e: "evaluaciones", c: "ciclos", r: "reporte-ejecutivo", d: "planes" };
      const target = shortcuts[e.key.toLowerCase()];
      if (target && availableViews?.includes(target)) { e.preventDefault(); setView(target); return; }
      if (e.key === "?") { e.preventDefault(); setShowShortcuts(v => !v); }
      if (e.key === "Escape") setShowShortcuts(false);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [availableViews, setView]);

  // Backend health check
  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 8000);
        const res = await fetch(`${apiUrl}/health`, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
        if (!cancelled) setBackendDown(!res.ok);
      } catch { if (!cancelled) setBackendDown(true); }
    }
    check();
    const id = setInterval(check, 5 * 60 * 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // Allow child pages to navigate
  useEffect(() => {
    function handleSetView(e) { const target = e?.detail?.view; if (target) setView(target); }
    window.addEventListener("performia:set-view", handleSetView);
    return () => window.removeEventListener("performia:set-view", handleSetView);
  }, [setView]);

  // Debounced API search (superadmin)
  useEffect(() => {
    const term = String(searchQuery || "").trim();
    if (!term || !isSuperAdmin) { setApiSearchResults(null); return; }
    setApiSearchLoading(true);
    const timerId = setTimeout(async () => {
      try {
        const data = await apiFetch(`/search/global?q=${encodeURIComponent(term)}`, { token });
        setApiSearchResults(data);
      } catch { setApiSearchResults(null); } finally { setApiSearchLoading(false); }
    }, 300);
    return () => { clearTimeout(timerId); setApiSearchLoading(false); };
  }, [searchQuery, token, isSuperAdmin]);

  const allViews = useMemo(() => [
    { key: "dashboard", label: "Inicio", show: true, keywords: ["inicio", "dashboard", "panel", "resumen"] },
    { key: "empleados", label: isEmployee ? "Mi perfil" : isManager ? "Mi equipo" : "Personas", show: hasPermission("manage_employees"), keywords: ["personas", "empleados", "equipo", "perfil"] },
    { key: "organigrama", label: "Organigrama", show: hasPermission("manage_employees"), keywords: ["organigrama", "org chart", "jerarquía"] },
    { key: "usuarios", label: "Usuarios", show: hasPermission("manage_users"), keywords: ["usuarios", "credenciales", "accesos"] },
    { key: "ciclos", label: "Ciclos", show: hasPermission("manage_evaluation_cycles") || (hasPermission("view_reports") && !isEmployee), keywords: ["ciclos", "periodo", "período"] },
    { key: "evaluaciones", label: "Evaluaciones", show: hasPermission("manage_evaluations") || hasPermission("evaluate_team") || hasPermission("self_evaluate") || hasPermission("view_reports"), keywords: ["evaluaciones", "autoevaluacion", "feedback", "desempeño"] },
    { key: "competencias", label: "Habilidades", show: hasPermission("manage_competencies"), keywords: ["competencias", "habilidades", "skills"] },
    { key: "metricas", label: "Mediciones", show: false, keywords: [] },
    { key: "planes", label: isEmployee ? "Mi desarrollo" : "Planes de acción", show: hasPermission("manage_development_plans") || hasPermission("evaluate_team") || hasPermission("self_evaluate") || hasPermission("download_self_report") || hasPermission("view_reports"), keywords: ["desarrollo", "planes", "seguimiento"] },
    { key: "reporte-ejecutivo", label: "Reportes", show: hasPermission("view_reports") || hasPermission("download_reports") || hasPermission("download_team_reports") || hasPermission("view_audit"), keywords: ["reportes", "reporte ejecutivo", "insights"] },
    { key: "carga-masiva", label: "Importación", show: hasPermission("manage_users") || hasPermission("manage_school_users") || hasPermission("manage_employees") || hasPermission("manage_roles") || hasPermission("view_audit"), keywords: ["importacion", "importación", "carga", "plantilla", "migracion"] },
    { key: "excel-sync", label: "Sincronizar Excel", show: hasPermission("manage_employees") || hasPermission("manage_users"), keywords: ["excel", "sync", "sincronizar", "sincronizacion", "sincronización", "excel online", "onedrive", "google sheets"] },
    { key: "novedades", label: "Novedades", show: true, keywords: ["novedades", "anuncios", "notificaciones"] },
    { key: "organizaciones", label: "Organizaciones", show: isSuperAdmin, keywords: ["organizaciones", "tenants", "empresas"] },
    { key: "roles", label: "Accesos", show: isSuperAdmin && (hasPermission("manage_roles") || hasPermission("view_audit")), keywords: ["roles", "accesos", "permisos"] },
    { key: "settings", label: "Configuración", show: isSuperAdmin, keywords: ["configuracion", "configuración", "ajustes"] },
    { key: "billing", label: "Facturación", show: !isEmployee && !isManager && (isSuperAdmin || hasPermission("manage_users")), keywords: ["facturacion", "facturación", "plan", "suscripcion", "pago"] },
    { key: "archivo-central", label: "Plataforma", show: isSuperAdmin, keywords: ["plataforma", "archivo central"] },
    { key: "analytics", label: "Analytics", show: isSuperAdmin, keywords: ["analytics", "uso", "estadísticas"] },
    { key: "calibracion", label: "Calibración", show: hasPermission("manage_evaluations") || hasPermission("view_reports"), keywords: ["calibracion", "calibración", "notas", "matriz"] },
  ], [hasPermission, isEmployee, isManager, isSuperAdmin]);

  const visibleViews = useMemo(() => allViews.filter(item => item.show), [allViews]);

  // Sidebar nav structure (groups + standalone items)
  const sidebarNav = useMemo(() => {
    const byKey = Object.fromEntries(visibleViews.map(v => [v.key, v]));
    const L = (es, en) => language === "en" ? en : es;

    // Employee-only (no manager, no superadmin)
    if (isEmployee && !isManager && !isSuperAdmin) {
      const items = [];
      if (byKey["evaluaciones"]) items.push({ type: "item", key: "evaluaciones", label: L("Mi evaluación", "My Evaluation"), icon: "evaluaciones" });
      return items;
    }

    const items = [];

    // Inicio
    if (byKey["dashboard"]) items.push({ type: "item", key: "dashboard", label: L("Inicio", "Home"), icon: "dashboard" });

    // Personas group
    const personasKids = [
      byKey["empleados"] && { key: "empleados", label: L("Personas", "People"), icon: "personas" },
      byKey["organigrama"] && { key: "organigrama", label: L("Organigrama", "Org Chart"), icon: "organigrama" },
      byKey["usuarios"] && { key: "usuarios", label: L("Usuarios", "Users"), icon: "usuarios" },
      isSuperAdmin && byKey["roles"] && { key: "roles", label: L("Accesos", "Access"), icon: "roles" },
    ].filter(Boolean);
    if (personasKids.length) {
      items.push({ type: "group", key: "personas-group", label: L("Personas", "People"), icon: "personas", children: personasKids });
    }

    // Habilidades standalone
    if (byKey["competencias"]) {
      items.push({ type: "item", key: "competencias", label: L("Habilidades", "Skills"), icon: "competencias" });
    }

    // Evaluación de desempeño group
    const evalKids = [
      { key: "evaluaciones", es: "Evaluaciones", en: "Evaluations" },
      { key: "planes", es: "Planes de acción", en: "Action Plans" },
      { key: "ciclos", es: "Ciclos", en: "Cycles" },
      { key: "metricas", es: "Mediciones", en: "Metrics" },
      { key: "calibracion", es: "Calibración", en: "Calibration" },
    ].filter(item => byKey[item.key]).map(item => ({ key: item.key, label: L(item.es, item.en), icon: item.key }));
    if (evalKids.length) {
      items.push({ type: "group", key: "eval-group", label: L("Evaluaciones", "Evaluations"), icon: "evaluaciones", children: evalKids });
    }

    // Standalone items: Reportes, Sync Excel (reemplaza Importación), Novedades
    [
      { key: "reporte-ejecutivo", es: "Reportes",           en: "Reports" },
      { key: "excel-sync",        es: "Sincronizar Excel",  en: "Excel Sync" },
      { key: "novedades",         es: "Novedades",          en: "Updates" },
    ].forEach(item => {
      if (byKey[item.key]) items.push({ type: "item", key: item.key, label: L(item.es, item.en), icon: item.key });
    });

    // Plataforma group (superadmin)
    if (isSuperAdmin) {
      const platKids = [
        { key: "organizaciones", es: "Organizaciones", en: "Organizations" },
        { key: "billing", es: "Facturación", en: "Billing" },
        { key: "settings", es: "Configuración", en: "Settings" },
        { key: "analytics", es: "Analytics", en: "Analytics" },
      ].filter(item => byKey[item.key]).map(item => ({ key: item.key, label: L(item.es, item.en), icon: item.key }));
      if (platKids.length) {
        items.push({ type: "group", key: "plataforma-group", label: L("Plataforma", "Platform"), icon: "analytics", children: platKids });
      }
    }

    // Facturación — solo para admins de empresa (no superadmin, no empleado, no manager)
    if (!isSuperAdmin && !isEmployee && !isManager && byKey["billing"]) {
      items.push({ type: "item", key: "billing", label: "Facturación", icon: "billing" });
    }

    return items;
  }, [visibleViews, isSuperAdmin, isEmployee, isManager, language]);

  // Auto-set activeGroup when view changes into a group
  useEffect(() => {
    const found = sidebarNav.find(item => item.type === "group" && item.children?.some(c => c.key === view));
    if (found) setActiveGroup(found.key);
    else if (sidebarNav.some(item => item.type === "item" && item.key === view)) setActiveGroup(null);
  }, [view, sidebarNav]);

  // Sub-items for the currently active group (shown in top tab bar)
  const activeGroupDef = useMemo(() => sidebarNav.find(g => g.key === activeGroup && g.type === "group") || null, [sidebarNav, activeGroup]);

  const organizationLabel = user?.companyName || "Organización activa";
  const displayName = getUserDisplayName(user);
  const userInitials = getUserInitials(user);
  const contextualSubtitle = isSuperAdmin ? "Gestión global multi-organización" : `${organizationLabel}`;

  const globalSearchItems = useMemo(() => visibleViews.map(item => ({
    viewKey: item.key,
    label: item.label,
    group: item.key === "dashboard" ? "Inicio" : item.key === "carga-masiva" ? "Importación" : item.key === "reporte-ejecutivo" ? "Reportes" : "Módulo",
    detail: `Abrir ${item.label.toLowerCase()}`,
    searchable: [item.label, ...(item.keywords || [])].join(" ").toLowerCase(),
  })), [visibleViews]);

  const searchResults = useMemo(() => {
    const term = String(searchQuery || "").trim().toLowerCase();
    if (!term) return globalSearchItems.slice(0, 8);
    return globalSearchItems.filter(item => item.searchable.includes(term)).slice(0, 8);
  }, [globalSearchItems, searchQuery]);

  useEffect(() => {
    if (!token) return;
    function fetchNotifs() {
      apiFetch("/notifications-feed/feed", { token })
        .then(data => { if (data?.ok !== false) setNotifFeed(data); })
        .catch(() => {});
    }
    fetchNotifs();
    const iv = setInterval(fetchNotifs, 60000);
    return () => clearInterval(iv);
  }, [token]);

  async function handleMarkRead(item) {
    if (!token || item.isRead) return;
    if (item._notifType === "system") {
      await apiFetch(`/notifications-feed/feed/${item._id}/read`, { method: "PATCH", token });
      setNotifFeed(prev => ({ ...prev, notifications: prev.notifications.map(n => n._id === item._id ? { ...n, read: true } : n), unreadCount: Math.max(0, prev.unreadCount - 1) }));
    } else {
      await apiFetch(`/announcements/${item._id}/read`, { method: "POST", token });
      await refreshAnnouncementSummary();
    }
  }

  async function handleMarkAllRead() {
    if (!token) return;
    await Promise.all([
      apiFetch("/announcements/read-all", { method: "POST", token }),
      apiFetch("/notifications-feed/feed/read", { method: "PATCH", token }),
    ]);
    await refreshAnnouncementSummary();
    setNotifFeed(prev => ({ ...prev, notifications: prev.notifications.map(n => ({ ...n, read: true })), unreadCount: 0 }));
  }

  function handleSearchSelect(item) {
    setView(item.viewKey); setSearchQuery(""); setSearchOpen(false); setSearchFocusedIdx(-1);
  }

  function handleOpenAnnouncement(item) {
    setView("novedades");
    window.setTimeout(() => window.dispatchEvent(new CustomEvent("performia:announcement-focus", { detail: { announcementId: item._id } })), 80);
  }

  // Sidebar item: standalone view
  function renderNavItem(item, onClickOverride) {
    const active = view === item.key && activeGroup === null;
    return (
      <button key={item.key} type="button"
        onClick={() => { setView(item.key); setActiveGroup(null); onClickOverride?.(); }}
        className={`relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all duration-150 ${
          active
            ? "text-[#14b8a6]"
            : "text-[#8fa8b6] hover:text-white"
        }`}
        style={active ? {
          background: "linear-gradient(90deg, rgba(20,184,166,0.12) 0%, rgba(20,184,166,0.04) 100%)",
          boxShadow: "inset 2px 0 0 #14b8a6",
        } : {}}>
        {!active && <span className="pointer-events-none absolute inset-0 rounded-xl opacity-0 transition-opacity duration-150 hover:opacity-100" style={{ background: "rgba(255,255,255,0.04)" }} />}
        <AppIcon name={item.icon || item.key} active={active} />
        {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
      </button>
    );
  }

  // Sidebar group: large button — clicking opens first child + sets activeGroup
  function renderNavGroup(group, onClickOverride) {
    const isActive = activeGroup === group.key;
    return (
      <button key={group.key} type="button"
        onClick={() => {
          const first = group.children?.[0];
          setActiveGroup(group.key);
          if (first) setView(first.key);
          onClickOverride?.();
        }}
        className={`relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all duration-150 ${
          isActive
            ? "text-[#14b8a6]"
            : "text-[#8fa8b6] hover:text-white"
        }`}
        style={isActive ? {
          background: "linear-gradient(90deg, rgba(20,184,166,0.12) 0%, rgba(20,184,166,0.04) 100%)",
          boxShadow: "inset 2px 0 0 #14b8a6",
        } : {}}>
        {!isActive && <span className="pointer-events-none absolute inset-0 rounded-xl opacity-0 transition-opacity duration-150 hover:opacity-100" style={{ background: "rgba(255,255,255,0.04)" }} />}
        <AppIcon name={group.icon} active={isActive} />
        {!sidebarCollapsed && (
          <>
            <span className="flex-1 truncate">{group.label}</span>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"
              className={`h-3 w-3 shrink-0 transition-transform duration-200 ${isActive ? "rotate-90 text-[#14b8a6]" : "text-[#4a6878]"}`}>
              <path d="M6 3l5 5-5 5"/>
            </svg>
          </>
        )}
      </button>
    );
  }

  function renderCollapsedIcon(item) {
    const active = item.type === "item" ? (view === item.key && !activeGroup) : activeGroup === item.key;
    return (
      <button key={item.key} type="button"
        onClick={() => {
          if (item.type === "item") { setView(item.key); setActiveGroup(null); }
          else { setActiveGroup(item.key); const first = item.children?.[0]; if (first) setView(first.key); }
        }}
        title={item.label}
        className={`flex w-full items-center justify-center rounded-xl py-2.5 transition ${active ? "bg-[#14b8a6] text-[#0f172a]" : "text-[#9ab0bc] hover:bg-white/5 hover:text-white"}`}>
        <AppIcon name={item.icon || item.key} active={active} />
      </button>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-[#091319] text-[#E8EEF1]">
      <NpsModal />
      <div className="flex h-full">
        {/* Sidebar */}
        <aside className={`hidden h-screen shrink-0 border-r border-white/[0.07] transition-all lg:flex lg:flex-col ${sidebarCollapsed ? "w-[72px]" : "w-[256px]"}`}
          style={{ background: "linear-gradient(180deg, #0d1e2b 0%, #091520 60%, #071219 100%)" }}>
          {/* Top glow accent */}
          <div className="pointer-events-none absolute left-0 top-0 h-[180px] w-full opacity-40"
            style={{ background: "radial-gradient(ellipse 120% 60% at 50% 0%, rgba(20,184,166,0.12) 0%, transparent 70%)" }} />
          <div className="flex items-center justify-between border-b border-white/[0.07] px-3 py-3.5 relative">
            {!sidebarCollapsed ? (
              <div className="min-w-0 overflow-hidden">
                <AppLogo variant="dark" compact={false} />
              </div>
            ) : null}
            <button type="button" onClick={() => setSidebarCollapsed(v => !v)}
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-[#8fb0c2] transition hover:bg-white/[0.08] hover:text-white hover:border-white/15 ${sidebarCollapsed ? "mx-auto" : ""}`}
              aria-label="Colapsar sidebar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                {sidebarCollapsed ? <path d="M9 6l6 6-6 6"/> : <path d="M15 6l-6 6 6 6"/>}
              </svg>
            </button>
          </div>
          {!sidebarCollapsed && contextualSubtitle ? (
            <div className="px-4 py-2 border-b border-white/[0.05]">
              <p className="text-[10px] font-medium text-[#4a6878] truncate tracking-wide">{contextualSubtitle}</p>
            </div>
          ) : null}

          <div className="flex-1 overflow-y-auto px-2 py-3 sidebar-scroll relative">
            {!sidebarCollapsed ? (
              <nav className="space-y-0.5">
                {sidebarNav.map((item, idx) => {
                  const groupLabels = {
                    "personas-group": "Personas",
                    "eval-group": "Evaluaciones",
                    "reporte-ejecutivo": "Reportes",
                    "plataforma-group": "Plataforma",
                  };
                  const labelKey = item.key === "reporte-ejecutivo" ? "reporte-ejecutivo" : item.type === "group" ? item.key : null;
                  const sectionLabel = labelKey && groupLabels[labelKey] ? groupLabels[labelKey] : null;
                  const prevItem = sidebarNav[idx - 1];
                  const showLabel = sectionLabel && prevItem;
                  return (
                    <div key={item.key}>
                      {showLabel ? (
                        <div className="flex items-center gap-2 px-3 pt-4 pb-1.5">
                          <span className="h-px flex-1 bg-white/[0.06]" />
                          <p className="text-[9px] uppercase tracking-[.18em] text-white/20 font-semibold">{sectionLabel}</p>
                          <span className="h-px flex-1 bg-white/[0.06]" />
                        </div>
                      ) : null}
                      {item.type === "item" ? renderNavItem(item) : renderNavGroup(item)}
                    </div>
                  );
                })}
              </nav>
            ) : (
              <nav className="space-y-1">
                {sidebarNav.map(item => renderCollapsedIcon(item))}
              </nav>
            )}
          </div>

          <div className="border-t border-white/[0.07] px-2 py-2.5">
            {!sidebarCollapsed ? (
              <button type="button" onClick={() => setView("perfil")}
                className="group flex w-full items-center gap-2.5 rounded-xl border border-white/[0.08] px-3 py-2.5 text-left transition-all hover:border-white/15 hover:bg-white/[0.04]"
                style={{ background: "rgba(255,255,255,0.02)" }}>
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt={displayName} className="h-7 w-7 shrink-0 rounded-lg object-cover ring-1 ring-white/10 group-hover:ring-[#14b8a6]/40 transition-all"/>
                ) : (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#14b8a6] to-[#0d9488] text-[11px] font-bold text-[#0f172a] shadow-[0_0_12px_rgba(20,184,166,0.25)] transition-all group-hover:shadow-[0_0_16px_rgba(20,184,166,0.35)]">{userInitials}</div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-white/90">{displayName}</p>
                  <p className="truncate text-[10px] text-[#14b8a6]/80 font-medium">{user?.roleLabel || user?.roleName || user?.roleKey || user?.roleCode}</p>
                </div>
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3 w-3 shrink-0 text-[#5e7d8e] group-hover:text-[#14b8a6] transition-colors"><path d="M6 3l5 5-5 5"/></svg>
              </button>
            ) : (
              <div className="flex justify-center">
                <button type="button" onClick={() => setView("perfil")}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-xs font-semibold text-white"
                  aria-label="Mi perfil">
                  {user?.avatarUrl ? <img src={user.avatarUrl} alt={displayName} className="h-9 w-9 rounded-xl object-cover"/> : userInitials.slice(0, 1)}
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* Main content */}
        <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
          <header className="sticky top-0 z-20 border-b border-white/[0.06]" style={{ background: "rgba(9,19,25,0.97)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}>
            <div className="flex items-center gap-3 px-4 py-3 md:px-5">
              {/* Mobile menu */}
              <button type="button" onClick={() => setMobileMenuOpen(true)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[#12222d] text-white transition hover:bg-[#172c39] lg:hidden"
                aria-label="Abrir menú">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                  <path d="M4 6h16M4 12h16M4 18h10"/>
                </svg>
              </button>
              <div className="lg:hidden"><AppLogo variant="dark" compact /></div>

              {/* Org selector */}
              {isSuperAdmin && companies.length ? (
                <select className="hidden min-w-[200px] rounded-xl border border-white/10 bg-[#12222d] px-3 py-2 text-sm text-white md:block"
                  value={activeCompanyId} onChange={e => setActiveCompanyId(e.target.value)}>
                  {companies.map(c => <option key={c._id} value={c._id}>{c.nombre}</option>)}
                </select>
              ) : (
                <div className="hidden rounded-xl border border-white/10 bg-[#12222d] px-3 py-2 md:block">
                  <p className="text-[10px] text-[#7f99a8]">{t("topbar.organization", "Organización")}</p>
                  <p className="text-sm font-medium text-white leading-none mt-0.5">{organizationLabel}</p>
                </div>
              )}

              {/* Breadcrumb */}
              {(() => {
                const currentView = allViews.find(v => v.key === view);
                const parentGroup = activeGroupDef;
                return (
                  <div className="hidden md:flex items-center gap-1.5 text-sm shrink-0">
                    <span className="text-[#5e7d8e] font-medium">ZENTOR</span>
                    <span className="text-[#14b8a6]/40 font-medium">›</span>
                    {parentGroup ? (
                      <>
                        <span className="text-[#7f99a8]">{parentGroup.label}</span>
                        <span className="text-[#14b8a6]/40 font-medium">›</span>
                      </>
                    ) : null}
                    <span className="text-white font-semibold">{currentView?.label || view}</span>
                  </div>
                );
              })()}

              {/* Search */}
              <div ref={searchRef} className="relative flex-1 max-w-xl mx-auto">
                <div className="flex w-full items-center gap-2.5 rounded-xl border border-white/10 bg-[#12222d] px-3 py-2 transition-all duration-150 focus-within:border-[#14b8a6]/50 focus-within:shadow-[0_0_0_3px_rgba(20,184,166,0.1)]">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0 text-[#7f99a8]">
                    <path d="M11 19a8 8 0 1 1 5.3-14l4.2 4.2"/><path d="M21 21l-4.35-4.35"/>
                  </svg>
                  <input
                    className="w-full bg-transparent text-sm text-[#e8eef1] outline-none placeholder:text-[#7f99a8]"
                    placeholder={language === "en" ? "Search… (Ctrl+K)" : "Buscar… (Ctrl+K)"}
                    value={searchQuery}
                    onFocus={() => { setSearchOpen(true); setSearchFocusedIdx(-1); }}
                    onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true); setSearchFocusedIdx(-1); }}
                    onKeyDown={e => {
                      if (e.key === "Enter" && searchResults[searchFocusedIdx]) { e.preventDefault(); handleSearchSelect(searchResults[searchFocusedIdx]); }
                      else if (e.key === "Enter" && searchResults.length === 1) { e.preventDefault(); handleSearchSelect(searchResults[0]); }
                    }}
                    aria-label="Buscar en ZENTOR"
                  />
                </div>
                {searchOpen && searchQuery.trim() ? (
                  <div className="absolute inset-x-0 z-30 mt-2 rounded-2xl border border-white/10 bg-[#12222d] p-2 shadow-[0_18px_32px_rgba(2,8,23,0.35)]">
                    {searchResults.length ? (
                      <div>
                        <p className="px-3 pb-1 pt-1 text-[10px] uppercase tracking-[0.16em] text-[#5e7d8e] font-semibold">Navegación</p>
                        {searchResults.map((item, idx) => <SearchResultItem key={item.viewKey} item={item} onSelect={handleSearchSelect} focused={searchFocusedIdx === idx}/>)}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-white/10 bg-[#0f1d26] px-3 py-3 text-sm text-[#8ea5b3]">Sin coincidencias.</div>
                    )}
                    {isSuperAdmin && (
                      <>
                        <div className="my-2 border-t border-white/10"/>
                        {apiSearchLoading ? (
                          <div className="px-3 py-2 text-xs text-[#5e7d8e]">Buscando…</div>
                        ) : apiSearchResults ? (
                          <>
                            {apiSearchResults.companies?.length > 0 && (
                              <div>
                                <p className="px-3 pb-1 text-[10px] uppercase tracking-[0.16em] text-[#5e7d8e] font-semibold">Empresas</p>
                                {apiSearchResults.companies.slice(0, 3).map(item => (
                                  <button key={item._id} type="button" onClick={() => { setView("organizaciones"); setSearchQuery(item.nombre); setSearchOpen(false); }}
                                    className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-white/5">
                                    <p className="truncate text-sm font-semibold text-white">{item.nombre}</p>
                                    <span className="shrink-0 rounded-full border border-white/10 bg-[#122530] px-2 py-0.5 text-[10px] text-[#c7d5dc]">{item.activa ? "Activa" : "Inactiva"}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                            {apiSearchResults.announcements?.length > 0 && (
                              <div>
                                <p className="px-3 pb-1 text-[10px] uppercase tracking-[0.16em] text-[#5e7d8e] font-semibold">Novedades</p>
                                {apiSearchResults.announcements.slice(0, 3).map(item => (
                                  <button key={item._id} type="button" onClick={() => { setView("novedades"); setSearchQuery(""); setSearchOpen(false); }}
                                    className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-white/5">
                                    <p className="truncate text-sm font-semibold text-white">{item.titulo}</p>
                                    <span className="shrink-0 rounded-full border border-white/10 bg-[#122530] px-2 py-0.5 text-[10px] text-[#c7d5dc]">Novedad</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </>
                        ) : null}
                      </>
                    )}
                  </div>
                ) : null}
              </div>

              {/* Right actions */}
              <div className="flex items-center gap-2">
                <NotificationBell
                  announcementSummary={announcementSummary}
                  notifFeed={notifFeed}
                  onMarkRead={handleMarkRead}
                  onMarkAllRead={handleMarkAllRead}
                  onViewAll={() => setView("novedades")}
                  onOpenAnnouncement={handleOpenAnnouncement}
                  t={t}
                />
                <button type="button" onClick={() => setShowShortcuts(true)}
                  className="hidden sm:flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-[#12222d] text-[#8ea5b3] transition hover:bg-[#172c39] hover:text-white"
                  aria-label="Atajos de teclado" title="Atajos (?)">
                  <span className="text-sm font-semibold">?</span>
                </button>

                <button onClick={logout}
                  className="rounded-xl border border-white/15 bg-[#152833] px-3 py-2 text-sm text-white transition hover:bg-[#1a3240]">
                  {t("topbar.logout", "Salir")}
                </button>
              </div>
            </div>
          </header>

          {/* Sub-nav tab bar — shown when a group is active */}
          {activeGroupDef ? (
            <div className="shrink-0 border-b border-white/[0.07] bg-[#091319]/80 px-4 md:px-5">
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
                {activeGroupDef.children.map(child => {
                  const isActive = view === child.key;
                  return (
                    <button key={child.key} type="button"
                      onClick={() => setView(child.key)}
                      className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition ${isActive ? "border-[#14b8a6] text-[#14b8a6]" : "border-transparent text-[#7f99a8] hover:text-[#c7d5dc]"}`}>
                      <AppIcon name={child.icon || child.key} active={isActive} size="sm" />
                      <span>{child.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <main className="flex-1 overflow-y-auto px-4 py-5 md:px-5">
            <div key={view} className="mx-auto w-full max-w-[1440px] pf-page-enter">
              {backendDown ? (
                <div className="mb-4 flex items-center gap-3 rounded-2xl border border-amber-300/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0"><path d="M8 5v3M8 10h.01"/><path d="M7.1 2.5L1.5 13h13L9 2.5a1.1 1.1 0 00-1.9 0z"/></svg>
                  <span>El servidor está iniciando — las primeras solicitudes pueden tardar unos segundos.</span>
                  <button type="button" onClick={() => setBackendDown(false)} className="ml-auto shrink-0 opacity-60 hover:opacity-100" aria-label="Cerrar">
                    <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3"><path d="M2 2l8 8M10 2l-8 8"/></svg>
                  </button>
                </div>
              ) : null}
              {tokenNearExpiry ? (
                <div className="mb-5 rounded-2xl border border-amber-300/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                  Tu sesión vence pronto ({tokenExpiresAt?.toLocaleString("es-AR")}). Guardá cambios y volvé a iniciar sesión.
                </div>
              ) : null}
              {children}
            </div>
          </main>
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)}/>
          <div className="absolute left-0 top-0 bottom-0 flex w-64 flex-col border-r border-white/10 bg-[#0b1620] shadow-[4px_0_32px_rgba(2,8,23,0.6)]">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3.5">
              <AppLogo variant="dark"/>
              <button type="button" onClick={() => setMobileMenuOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-xl border border-white/10 bg-[#12222d] text-white" aria-label="Cerrar menú">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3"><path d="M3 3l10 10M13 3L3 13"/></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-2.5 py-3">
              <nav className="space-y-1">
                {sidebarNav.map(item =>
                  item.type === "item" ? renderNavItem(item, () => setMobileMenuOpen(false)) : renderNavGroup(item, () => setMobileMenuOpen(false))
                )}
              </nav>
            </div>
            <div className="border-t border-white/10 px-2.5 py-2.5">
              <button type="button" onClick={() => { setView("perfil"); setMobileMenuOpen(false); }}
                className="flex w-full items-center gap-2.5 rounded-xl border border-white/10 bg-[#101d25] px-3 py-2.5 text-left transition hover:bg-[#13232d]">
                {user?.avatarUrl ? <img src={user.avatarUrl} alt={displayName} className="h-7 w-7 shrink-0 rounded-lg object-cover"/> : <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#14b8a6] text-[11px] font-semibold text-[#0f172a]">{userInitials}</div>}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-white">{displayName}</p>
                  <p className="truncate text-[10px] text-[#14b8a6]">{user?.roleLabel || user?.roleName || user?.roleKey || user?.roleCode}</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Keyboard shortcuts modal */}
      {showShortcuts ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowShortcuts(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0c1e28] p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-base font-semibold text-white">Atajos de teclado</p>
              <button type="button" onClick={() => setShowShortcuts(false)}
                className="flex h-7 w-7 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-[#8ea5b3] transition hover:text-white" aria-label="Cerrar">
                <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3"><path d="M2 2l8 8M10 2l-8 8"/></svg>
              </button>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-white/10"><th className="pb-2 text-left text-xs uppercase tracking-[0.14em] text-[#5e7d8e]">Tecla</th><th className="pb-2 text-left text-xs uppercase tracking-[0.14em] text-[#5e7d8e]">Acción</th></tr></thead>
              <tbody className="divide-y divide-white/5">
                {[
                  { key: "Ctrl+K", action: "Abrir búsqueda global" },
                  { key: "I", action: "Ir a Inicio" },
                  { key: "P", action: "Ir a Personas" },
                  { key: "E", action: "Ir a Evaluaciones" },
                  { key: "C", action: "Ir a Ciclos" },
                  { key: "R", action: "Ir a Reportes" },
                  { key: "D", action: "Ir a Desarrollo" },
                  { key: "?", action: "Mostrar/ocultar atajos" },
                  { key: "Esc", action: "Cerrar paneles" },
                ].map(({ key, action }) => (
                  <tr key={key}>
                    <td className="py-2 pr-4"><kbd className="rounded-lg border border-white/15 bg-[#12222d] px-2 py-0.5 text-xs font-mono font-semibold text-[#c7d5dc]">{key}</kbd></td>
                    <td className="py-2 text-[#c7d5dc]">{action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-4 text-xs text-[#5e7d8e]">Las teclas solo funcionan cuando el cursor no está en un campo de texto.</p>
          </div>
        </div>
      ) : null}

    </div>
  );
}
