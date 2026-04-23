import { useAuth } from "../context/AuthContext";

export default function AppShell({ view, setView, children }) {
  const { user, logout, hasPermission } = useAuth();

  const menuItems = [
    { key: "dashboard", label: "Dashboard", show: true },
    { key: "usuarios", label: "Usuarios", show: hasPermission("manage_users") },
    { key: "roles", label: "Roles", show: hasPermission("manage_roles") },
    { key: "auditoría", label: "Auditoría", show: hasPermission("view_audit") },
    { key: "exportaciones", label: "Exportaciones", show: hasPermission("export_reports") },
    { key: "parámetros", label: "Parámetros", show: hasPermission("manage_settings") },
  ];

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="flex min-h-screen">
        <aside className="w-72 bg-slate-950 text-white p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Enterprise HR
          </p>

          <h1 className="text-2xl mt-2">PeopleOps Hub</h1>

          <div className="mt-8 space-y-2">
            {menuItems
              .filter((item) => item.show)
              .map((item) => (
                <button
                  key={item.key}
                  onClick={() => setView(item.key)}
                  className={`w-full text-left rounded-2xl px-4 py-3 ${
                    view === item.key
                      ? "bg-emerald-500"
                      : "hover:bg-slate-800 text-slate-200"
                  }`}
                >
                  {item.label}
                </button>
              ))}
          </div>

          <div className="mt-10 border-t border-slate-800 pt-6">
            <p className="text-sm text-slate-300">{user?.nombre}</p>
            <p className="text-xs text-slate-500">{user?.email}</p>

            <button
              onClick={logout}
              className="mt-4 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700"
            >
              Salir
            </button>
          </div>
        </aside>

        <div className="flex-1">
          <header className="bg-white border-b border-slate-200 px-8 py-5">
            <h2 className="text-2xl font-semibold capitalize">{view}</h2>
          </header>

          <main className="p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}