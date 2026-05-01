import { useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";

function LogoMark({ branding }) {
  if (branding?.logoUrl) {
    return (
      <img
        src={branding.logoUrl}
        alt={branding.nombreVisible || "Performia"}
        className="h-10 w-10 rounded-full border border-white/10 bg-white/5 object-cover"
      />
    );
  }

  return (
    <div
      className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5 text-sm font-semibold text-amber-200"
      style={{ boxShadow: `0 0 0 1px ${branding?.primaryColor || "#10b981"}33 inset` }}
    >
      P
    </div>
  );
}

function BellIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 17h5l-1.4-1.4a2 2 0 0 1-.6-1.42V11a6 6 0 1 0-12 0v3.18a2 2 0 0 1-.59 1.41L4 17h5" />
      <path d="M9 17a3 3 0 0 0 6 0" />
    </svg>
  );
}

function NotificationBell({ announcementSummary, onMarkRead }) {
  const [open, setOpen] = useState(false);
  const unreadCount = announcementSummary?.unreadCount || 0;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="relative rounded-full border border-slate-200 bg-white px-3 py-2 text-slate-700 shadow-sm transition hover:border-slate-300"
        aria-label="Abrir novedades"
      >
        <BellIcon />
        {unreadCount ? (
          <span className="absolute -right-1 -top-1 rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-semibold text-white">
            {unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-20 mt-3 w-96 rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-xl">
          <div className="flex items-center justify-between gap-4">
            <h4 className="font-semibold text-slate-950">Novedades</h4>
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
              {unreadCount} sin leer
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {announcementSummary?.latest?.length ? (
              announcementSummary.latest.map((item) => (
                <button
                  key={item._id}
                  type="button"
                  onClick={() => onMarkRead(item)}
                  className="block w-full rounded-2xl border border-slate-200 px-4 py-3 text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-950">{item.titulo}</p>
                      <p className="mt-1 line-clamp-2 text-sm text-slate-500">{item.cuerpo}</p>
                    </div>
                    {!item.isRead ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                        Nueva
                      </span>
                    ) : null}
                  </div>
                </button>
              ))
            ) : (
              <p className="text-sm text-slate-500">No hay novedades recientes.</p>
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
    branding,
    announcementSummary,
    globalSearchResults,
    refreshAnnouncementSummary,
    searchGlobally,
    token,
    activeCompanyId,
    setActiveCompanyId,
  } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");

  const menuItems = [
    { key: "dashboard", label: "Panel", show: true },
    {
      key: "organizaciones",
      label: "Organizaciones",
      show: hasPermission("manage_companies") || hasPermission("manage_schools"),
    },
    { key: "usuarios", label: "Usuarios", show: hasPermission("manage_users") },
    { key: "roles", label: "Roles", show: hasPermission("manage_roles") },
    { key: "novedades", label: "Novedades", show: true },
    { key: "empleados", label: "Empleados", show: hasPermission("manage_employees") },
    { key: "competencias", label: "Competencias", show: hasPermission("manage_competencies") },
    { key: "metricas", label: "Metricas", show: hasPermission("manage_metrics") },
    {
      key: "ciclos",
      label: "Ciclos",
      show: hasPermission("manage_evaluation_cycles") || hasPermission("view_reports"),
    },
    {
      key: "evaluaciones",
      label: "Evaluaciones",
      show:
        hasPermission("manage_evaluations") ||
        hasPermission("evaluate_team") ||
        hasPermission("self_evaluate") ||
        hasPermission("view_reports"),
    },
    {
      key: "planes",
      label: "Desarrollo",
      show:
        hasPermission("manage_development_plans") ||
        hasPermission("evaluate_team") ||
        hasPermission("view_reports"),
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
      label: "Bases y Descargas",
      show:
        hasPermission("view_reports") ||
        hasPermission("download_team_reports") ||
        hasPermission("download_self_report"),
    },
    { key: "archivo-central", label: "Archivo central", show: !!user?.isSuperAdmin },
  ];

  const groupedMenu = [
    {
      key: "panel",
      label: "Panel",
      items: menuItems.filter((item) => item.show && item.key === "dashboard"),
    },
    {
      key: "gestion",
      label: "Gestion",
      items: menuItems.filter(
        (item) => item.show && ["organizaciones", "usuarios", "roles"].includes(item.key)
      ),
    },
    {
      key: "evaluacion",
      label: "Evaluacion",
      items: menuItems.filter(
        (item) =>
          item.show &&
          ["empleados", "competencias", "metricas", "ciclos", "evaluaciones", "planes"].includes(
            item.key
          )
      ),
    },
    {
      key: "comunicacion",
      label: "Comunicacion",
      items: menuItems.filter((item) => item.show && ["novedades"].includes(item.key)),
    },
    {
      key: "datos",
      label: user?.isSuperAdmin ? "Datos" : "Novedades",
      items: menuItems.filter(
        (item) => item.show && ["cargas", "bases-descargas", "archivo-central"].includes(item.key)
      ),
    },
  ].filter((group) => group.items.length);

  const viewMeta = {
    organizaciones: {
      eyebrow: "Clientes",
      title: "Organizaciones",
      description: "Empresas y colegios en una sola vista, con acceso segun rol.",
    },
    dashboard: {
      eyebrow: "Vision institucional",
      title: "Panel de desempeno",
      description: "Indicadores, seguimiento y foco operativo para el colegio activo.",
    },
    roles: {
      eyebrow: "Permisos",
      title: "Roles",
      description: "Define permisos por perfil para controlar lo que puede ver y descargar cada usuario.",
    },
    novedades: {
      eyebrow: "Comunicacion",
      title: "Novedades",
      description: "Avisos, recordatorios y mensajes importantes para el trabajo de cada colegio.",
    },
    empleados: {
      eyebrow: "Talento",
      title: "Empleados",
      description: "Docentes y colaboradores organizados por colegio, cargo, area y responsable.",
    },
    competencias: {
      eyebrow: "Modelo",
      title: "Competencias",
      description: "Marco competencial para evaluar conocimientos, actitudes y habilidades.",
    },
    metricas: {
      eyebrow: "Modelo",
      title: "Metricas",
      description: "Indicadores observables y niveles 1 a 5 para una evaluacion consistente.",
    },
    ciclos: {
      eyebrow: "Calendario",
      title: "Ciclos de evaluacion",
      description: "Periodos que ordenan autoevaluacion, jefatura y cierre final.",
    },
    evaluaciones: {
      eyebrow: "Desempeno",
      title: "Evaluaciones",
      description: "Cargas por empleado con puntajes, comentarios y trazabilidad por ciclo.",
    },
    planes: {
      eyebrow: "Desarrollo",
      title: "Desarrollo",
      description: "Seguimiento de fortalezas, mejora y compromisos de evolucion por persona.",
    },
    usuarios: {
      eyebrow: "Accesos",
      title: "Usuarios",
      description: "Accesos habilitados para directivos, RRHH, jefes, docentes y auditores.",
    },
    "bases-descargas": {
      eyebrow: "Datos institucionales",
      title: "Bases y Descargas",
      description: "Consulta, filtra y descarga informacion educativa con validacion por rol.",
    },
    cargas: {
      eyebrow: "Operacion de datos",
      title: "Cargas",
      description: "Sube archivos, importa informacion y valida resultados antes de descargar.",
    },
    "archivo-central": {
      eyebrow: "Control global",
      title: "Archivo central",
      description: "Carga y supervision de archivos por empresa y tipo de documento.",
    },
  };

  const currentView = viewMeta[view] || viewMeta.dashboard;
  const currentGroup =
    groupedMenu.find((group) => group.items.some((item) => item.key === view)) || groupedMenu[0];
  const brandName = branding?.nombreVisible || "Performia";
  const primaryColor = branding?.primaryColor || "#10b981";

  const searchGroups = useMemo(
    () => [
      { label: "Empresas", items: globalSearchResults.companies || [] },
      { label: "Archivos", items: globalSearchResults.files || [] },
      { label: "Mensajes", items: globalSearchResults.announcements || [] },
    ],
    [globalSearchResults]
  );

  async function handleMarkRead(item) {
    if (!token || item.isRead || user?.isSuperAdmin) return;
    await apiFetch(`/announcements/${item._id}/read`, { method: "POST", token });
    await refreshAnnouncementSummary();
  }

  function handleSearchSelection(groupLabel, item) {
    if (groupLabel === "Empresas") {
      setActiveCompanyId(item._id);
      setView("organizaciones");
    } else if (groupLabel === "Archivos") {
      setView("bases-descargas");
      if (item.companyId && hasPermission("manage_companies")) setActiveCompanyId(item.companyId);
    } else {
      setView("novedades");
      if (item.companyId && hasPermission("manage_companies")) setActiveCompanyId(item.companyId);
    }
    setSearchTerm("");
  }

  return (
    <div
      className="min-h-screen"
      style={{
        background: `radial-gradient(circle at top center, ${primaryColor}18, transparent 30%), #0E1A20`,
      }}
    >
      <div className="min-h-screen">
        <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0E1A20]/90 px-6 py-3 backdrop-blur">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <LogoMark branding={branding} />
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-[#FAD564]">{brandName}</p>
                <p className="text-xs text-[#7A9AAA]">Desempeno educativo</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {hasPermission("manage_companies") && companies.length ? (
                <select
                  className="w-52 rounded-xl border border-white/15 bg-[#142028] px-3 py-2 text-sm text-[#E8EEF1]"
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
              <button
                onClick={logout}
                className="rounded-xl border border-white/15 bg-[#142028] px-3 py-2 text-sm font-medium text-[#E8EEF1]"
              >
                Salir
              </button>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {groupedMenu.map((group) => {
              const isActiveGroup = group.items.some((item) => item.key === view);
              return (
                <button
                  key={group.key}
                  onClick={() => setView(group.items[0].key)}
                  className={`whitespace-nowrap rounded-xl px-3 py-1.5 text-sm font-semibold transition ${
                    isActiveGroup
                      ? "text-white"
                      : "border border-white/15 bg-[#142028] text-[#E8EEF1] hover:border-white/25"
                  }`}
                  style={isActiveGroup ? { backgroundColor: primaryColor } : {}}
                >
                  {group.label}
                </button>
              );
            })}
          </div>
        </header>

        <header className="border-b border-white/10 bg-[#142028]/85 px-6 py-4 backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-[#7A9AAA]">{currentView.eyebrow}</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">{currentView.title}</h2>
              <p className="mt-2 max-w-3xl text-sm text-[#AFC3CE]">{currentView.description}</p>
              {currentGroup?.items?.length > 1 ? (
                <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                  {currentGroup.items.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setView(item.key)}
                        className={`whitespace-nowrap rounded-xl border px-3 py-1.5 text-sm font-medium transition ${
                          view === item.key
                            ? "border-transparent text-white"
                            : "border-white/15 bg-[#1A2C38] text-[#E8EEF1] hover:border-white/25"
                        }`}
                      style={view === item.key ? { backgroundColor: primaryColor } : {}}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap items-start gap-3">
              {user?.isSuperAdmin ? (
                <div className="relative min-w-64">
                  <input
                    className="w-full rounded-2xl border border-white/15 bg-[#1A2C38] px-4 py-3 text-sm text-white placeholder:text-[#7A9AAA]"
                    placeholder="Buscar empresas, archivos o mensajes"
                    value={searchTerm}
                    onChange={(event) => {
                      const next = event.target.value;
                      setSearchTerm(next);
                      searchGlobally(next);
                    }}
                  />

                  {searchTerm.trim() ? (
                    <div className="absolute right-0 z-20 mt-3 w-full rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-xl">
                      {searchGroups.map((group) => (
                        <div key={group.label} className="mb-4 last:mb-0">
                          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                            {group.label}
                          </p>
                          <div className="mt-2 space-y-2">
                            {group.items.length ? (
                              group.items.map((item, index) => (
                                <button
                                  key={`${group.label}-${index}`}
                                  type="button"
                                  onClick={() => handleSearchSelection(group.label, item)}
                                  className="block w-full rounded-2xl bg-slate-50 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100"
                                >
                                  <span className="block font-medium text-slate-900">
                                    {item.nombre || item.nombreVisible || item.titulo || item.slug}
                                  </span>
                                  <span className="mt-1 block text-xs text-slate-500">
                                    {item.slug || item.tipoArchivo || item.categoria || item.companyName || ""}
                                  </span>
                                </button>
                              ))
                            ) : (
                              <p className="text-sm text-slate-500">Sin resultados.</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <NotificationBell announcementSummary={announcementSummary} onMarkRead={handleMarkRead} />
            </div>
          </div>
        </header>

        <main className="performia-night p-8">
          <div className="mb-4 rounded-2xl border border-white/10 bg-[#142028] px-4 py-3 text-sm text-[#AFC3CE]">
            {user?.nombre} - {user?.roleName} - {user?.companyName}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
