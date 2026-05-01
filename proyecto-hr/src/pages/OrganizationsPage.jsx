import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";
import CompaniesPage from "./CompaniesPage";
import SchoolsPage from "./SchoolsPage";

export default function OrganizationsPage() {
  const { user, activeCompany, token } = useAuth();
  const canManageCompanies = !!user?.isSuperAdmin;
  const [tab, setTab] = useState(canManageCompanies ? "empresas" : "colegios");
  const [qualityItems, setQualityItems] = useState([]);

  useEffect(() => {
    if (!canManageCompanies) return;
    apiFetch("/automation/quality-by-company", { token })
      .then((data) => setQualityItems(data.items || []))
      .catch(() => {});
  }, [canManageCompanies, token]);

  const tabs = useMemo(() => {
    const base = [{ key: "colegios", label: canManageCompanies ? "Colegios" : "Mi colegio" }];
    return canManageCompanies ? [{ key: "empresas", label: "Empresas" }, ...base] : base;
  }, [canManageCompanies]);

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-emerald-600">Organizacion</p>
        <h3 className="mt-2 text-2xl font-semibold text-slate-950">
          {activeCompany?.nombre
            ? canManageCompanies
              ? `Empresas y colegios - ${activeCompany.nombre}`
              : activeCompany.nombre
            : canManageCompanies
              ? "Empresas y colegios"
              : "Mi colegio"}
        </h3>
        <p className="mt-2 text-slate-500">
          {canManageCompanies
            ? "Todo el alta institucional en una sola pantalla, con permisos por rol."
            : "Espacio personalizado de tu institucion, con acceso solo a tu entorno."}
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

      {canManageCompanies ? (
        <section className="pf-card p-6">
          <h4 className="text-lg font-semibold text-slate-950">Salud de datos por empresa</h4>
          <div className="mt-4 grid gap-3">
            {qualityItems.length ? (
              qualityItems.map((item) => (
                <article key={item.companyId} className="rounded-xl border border-white/10 bg-[#1A2C38] px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-[#E8EEF1]">{item.nombre}</p>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        (item.score ?? 0) < 70 ? "bg-amber-500/20 text-amber-200" : "bg-emerald-500/20 text-emerald-200"
                      }`}
                    >
                      Score {item.score ?? "-"}
                    </span>
                  </div>
                </article>
              ))
            ) : (
              <p className="text-sm text-[#A9BFCA]">Aun no hay controles nocturnos ejecutados.</p>
            )}
          </div>
        </section>
      ) : null}

      {tab === "empresas" && canManageCompanies ? <CompaniesPage /> : null}
      {tab === "colegios" ? <SchoolsPage /> : null}
    </div>
  );
}
