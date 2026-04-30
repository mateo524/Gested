import { useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import CompaniesPage from "./CompaniesPage";
import SchoolsPage from "./SchoolsPage";

export default function OrganizationsPage() {
  const { user } = useAuth();
  const canManageCompanies = !!user?.isSuperAdmin;
  const [tab, setTab] = useState(canManageCompanies ? "empresas" : "colegios");

  const tabs = useMemo(() => {
    const base = [{ key: "colegios", label: "Colegios" }];
    return canManageCompanies ? [{ key: "empresas", label: "Empresas" }, ...base] : base;
  }, [canManageCompanies]);

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-emerald-600">Organizacion</p>
        <h3 className="mt-2 text-2xl font-semibold text-slate-950">Empresas y colegios</h3>
        <p className="mt-2 text-slate-500">
          Todo el alta institucional en una sola pantalla, con permisos por rol.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {tabs.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`rounded-xl border px-4 py-2 text-sm font-medium ${
                tab === item.key
                  ? "border-transparent bg-emerald-500 text-white"
                  : "border-slate-200 bg-white text-slate-700"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      {tab === "empresas" && canManageCompanies ? <CompaniesPage /> : null}
      {tab === "colegios" ? <SchoolsPage /> : null}
    </div>
  );
}
