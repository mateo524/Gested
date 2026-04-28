import { useAuth } from "../context/AuthContext";

export default function AppShell({ view, setView, children }) {
  const {
    user,
    logout,
    hasPermission,
    companies,
    activeCompanyId,
    setActiveCompanyId,
  } = useAuth();

  const menuItems = [
    { key: "dashboard", label: "Panel", show: true },
    { key: "empresas", label: "Empresas", show: hasPermission("manage_companies") },
    { key: "usuarios", label: "Usuarios", show: hasPermission("manage_users") },
    { key: "roles", label: "Roles", show: hasPermission("manage_roles") },
    { key: "auditoria", label: "Auditoria", show: hasPermission("view_audit") },
    { key: "exportaciones", label: "Exportaciones", show: hasPermission("export_reports") },
    { key: "parametros", label: "Parametros", show: hasPermission("manage_settings") },
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.14),_transparent_24%),linear-gradient(180deg,_#f7f1e7,_#f5f7fb)]">
      <div className="flex min-h-screen">
        <aside className="w-72 border-r border-black/5 bg-[#111111] p-6 text-white">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/5 text-sm font-semibold text-amber-200">
              G
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.26em] text-amber-200">
                Gested
              </p>
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
                    view === item.key
                      ? "bg-emerald-500 text-white"
                      : "text-slate-200 hover:bg-slate-800"
                  }`}
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
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Gested</p>
            <h2 className="mt-2 text-2xl font-semibold capitalize text-slate-950">
              {view}
            </h2>
          </header>

          <main className="p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
