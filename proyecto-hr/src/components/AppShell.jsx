import { useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";

function LogoMark({ branding }) {
  if (branding?.logoUrl) {
    return (
      <img
        src={branding.logoUrl}
        alt={branding.nombreVisible || "Gested"}
        className="h-11 w-11 rounded-full border border-white/10 bg-white/5 object-cover"
      />
    );
  }

  return (
    <div
      className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/5 text-sm font-semibold text-amber-200"
      style={{ boxShadow: `0 0 0 1px ${branding?.primaryColor || "#10b981"}33 inset` }}
    >
      G
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
    { key: "novedades", label: "Novedades", show: true },
    { key: "empresas", label: "Empresas", show: hasPermission("manage_companies") },
    { key: "archivo-central", label: "Archivo central", show: hasPermission("manage_companies") },
    { key: "usuarios", label: "Usuarios", show: hasPermission("manage_users") },
    { key: "roles", label: "Roles", show: hasPermission("manage_roles") },
    { key: "auditoria", label: "Auditoria", show: hasPermission("view_audit") },
    { key: "registros", label: "Registros", show: hasPermission("export_reports") },
    { key: "exportaciones", label: "Exportaciones", show: hasPermission("export_reports") },
    { key: "parametros", label: "Parametros", show: hasPermission("manage_settings") },
  ];

  const viewMeta = {
    dashboard: {
      eyebrow: "Vision general",
      title: "Panel ejecutivo",
      description: "Indicadores, trazabilidad y foco operativo para la empresa seleccionada.",
    },
    empresas: {
      eyebrow: "Crecimiento",
      title: "Empresas cliente",
      description: "Alta, activacion y control de acceso para cada cuenta administrada por Gested.",
    },
    novedades: {
      eyebrow: "Comunicacion",
      title: "Novedades",
      description: "Informacion compartida dentro de la app entre Gested y cada empresa.",
    },
    "archivo-central": {
      eyebrow: "Supervision",
      title: "Archivo central",
      description: "Vista consolidada de archivos y contenido subido por todas las empresas.",
    },
    usuarios: {
      eyebrow: "Accesos",
      title: "Usuarios",
      description: "Personas habilitadas para trabajar con datos y modulos dentro de cada empresa.",
    },
    roles: {
      eyebrow: "Gobernanza",
      title: "Roles y permisos",
      description: "Definicion clara de quien puede ver, editar, exportar o administrar.",
    },
    auditoria: {
      eyebrow: "Trazabilidad",
      title: "Auditoria",
      description: "Registro de movimientos y decisiones sensibles dentro del sistema.",
    },
    registros: {
      eyebrow: "Datos",
      title: "Registros importados",
      description: "Lectura operativa de la informacion ya procesada para la empresa activa.",
    },
    exportaciones: {
      eyebrow: "Datos",
      title: "Importacion y reportes",
      description: "Carga de bases, lectura visual y exportacion de informacion lista para usar.",
    },
    parametros: {
      eyebrow: "Configuracion",
      title: "Parametros",
      description: "Identidad visible, limites de carga y ajustes operativos por empresa.",
    },
  };

  const currentView = viewMeta[view] || viewMeta.dashboard;
  const brandName = branding?.nombreVisible || "Gested";
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
      setView("empresas");
      if (item._id) {
        setActiveCompanyId(item._id);
      }
    } else if (groupLabel === "Archivos") {
      setView(hasPermission("manage_companies") ? "archivo-central" : "exportaciones");
      if (item.companyId && hasPermission("manage_companies")) {
        setActiveCompanyId(item.companyId);
      }
    } else {
      setView("novedades");
      if (item.companyId && hasPermission("manage_companies")) {
        setActiveCompanyId(item.companyId);
      }
    }

    setSearchTerm("");
  }

  return (
    <div
      className="min-h-screen"
      style={{
        background: `radial-gradient(circle at top left, ${primaryColor}22, transparent 24%), linear-gradient(180deg, #f7f1e7, #f5f7fb)`,
      }}
    >
      <div className="flex min-h-screen">
        <aside className="w-72 border-r border-black/5 bg-[#111111] p-6 text-white">
          <div className="flex items-center gap-3">
            <LogoMark branding={branding} />
            <div>
              <p className="text-xs uppercase tracking-[0.26em] text-amber-200">{brandName}</p>
              <p className="text-sm text-slate-400">Gestion de datos</p>
            </div>
          </div>

          <h1 className="mt-8 text-2xl font-semibold">Centro de clientes</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Informacion ordenada, accesos controlados y operacion clara para cada empresa.
          </p>

          <div className="mt-8 space-y-2">
            {hasPermission("manage_companies") && companies.length ? (
              <select
                className="mb-4 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white"
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

            {menuItems
              .filter((item) => item.show)
              .map((item) => (
                <button
                  key={item.key}
                  onClick={() => setView(item.key)}
                  className={`w-full rounded-2xl px-4 py-3 text-left transition ${
                    view === item.key ? "text-white" : "text-slate-200 hover:bg-slate-800"
                  }`}
                  style={view === item.key ? { backgroundColor: primaryColor } : {}}
                >
                  {item.label}
                </button>
              ))}
          </div>

          <div className="mt-10 border-t border-slate-800 pt-6">
            <p className="text-sm text-slate-300">{user?.nombre}</p>
            <p className="text-xs text-slate-500">{user?.email}</p>
            <p className="mt-1 text-xs text-slate-500">{user?.roleName}</p>
            <p className="mt-1 text-xs text-slate-500">{user?.companyName}</p>

            <button
              onClick={logout}
              className="mt-4 rounded-xl bg-slate-800 px-4 py-2 transition hover:bg-slate-700"
            >
              Salir
            </button>
          </div>
        </aside>

        <div className="flex-1">
          <header className="border-b border-black/5 bg-white/80 px-8 py-5 backdrop-blur">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{currentView.eyebrow}</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">{currentView.title}</h2>
                <p className="mt-2 max-w-3xl text-sm text-slate-500">{currentView.description}</p>
              </div>

              <div className="flex flex-wrap items-start gap-3">
                {user?.isSuperAdmin ? (
                  <div className="relative min-w-80">
                    <input
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
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
                            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{group.label}</p>
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

                <NotificationBell
                  announcementSummary={announcementSummary}
                  onMarkRead={handleMarkRead}
                />
              </div>
            </div>
          </header>

          <main className="p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
