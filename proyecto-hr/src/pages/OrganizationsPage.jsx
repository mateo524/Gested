import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useView } from "../context/ViewContext";
import { apiFetch } from "../lib/api";
import CompaniesPage from "./CompaniesPage";
import SchoolsPage from "./SchoolsPage";

function SetupCompanyForm({ token, login }) {
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!companyName.trim()) return;
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch("/auth/setup-company", {
        method: "POST",
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName: companyName.trim() }),
      });
      await login(data);
    } catch (err) {
      setError(err?.message || "No se pudo crear la empresa.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-[2rem] border border-amber-400/30 bg-amber-500/5 p-6">
      <div className="mb-4 flex items-center gap-2.5">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <h4 className="text-lg font-semibold text-slate-950">Configurar empresa</h4>
      </div>
      <p className="mb-4 text-sm text-slate-500">Tu cuenta no tiene una empresa asociada. Ingresá el nombre de tu organización para comenzar.</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="mb-1.5 block text-xs font-medium text-slate-600">Nombre de la empresa</label>
          <input
            type="text"
            value={companyName}
            onChange={e => setCompanyName(e.target.value)}
            placeholder="Ej: Acme S.A."
            required
            minLength={2}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !companyName.trim()}
          className="rounded-xl bg-emerald-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-50"
        >
          {loading ? "Creando…" : "Crear empresa"}
        </button>
      </form>
      {error ? <p className="mt-2 text-sm text-red-500">{error}</p> : null}
    </section>
  );
}

function SpreadsheetBadge({ token, companyId }) {
  const [url, setUrl] = useState(null);
  const [lastSync, setLastSync] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;
    apiFetch(`/companies/${companyId}`, { token })
      .then(data => {
        setUrl(data?.spreadsheetUrl || null);
        setLastSync(data?.spreadsheetLastSync || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [companyId, token]);

  if (loading) return <span className="text-[11px] text-[#7f99a8]">…</span>;
  if (!url) return <span className="text-[11px] text-[#7f99a8]">Sin Excel conectado</span>;

  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      onClick={e => e.stopPropagation()}
      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300 transition hover:bg-emerald-500/20">
      <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 shrink-0">
        <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M5 6h6M5 8h6M5 10h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
      Ver Excel
      {lastSync ? <span className="text-emerald-400/70 font-normal">· {new Date(lastSync).toLocaleDateString("es-AR")}</span> : null}
    </a>
  );
}

export default function OrganizationsPage() {
  const { user, activeCompany, token, login } = useAuth();
  const canManageCompanies = !!user?.isSuperAdmin;
  const canManageOwnCompany = !user?.isSuperAdmin && !!user?.permisos?.includes("manage_companies");
  const needsCompanySetup = canManageOwnCompany && !user?.companyId;
  const [tab, setTab] = useState(canManageCompanies ? "empresas" : "colegios");
  const [qualityItems, setQualityItems] = useState([]);
  const [isLoadingQuality, setIsLoadingQuality] = useState(false);
  const qualityCacheKey = "pf_org_quality_superadmin";

  useEffect(() => {
    if (!canManageCompanies) return;
    const cached = sessionStorage.getItem(qualityCacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setQualityItems(Array.isArray(parsed) ? parsed : []);
      } catch {
        sessionStorage.removeItem(qualityCacheKey);
      }
    }

    const controller = new AbortController();
    setIsLoadingQuality(true);
    apiFetch("/automation/quality-by-company", { token, signal: controller.signal, timeoutMs: 20000 })
      .then((data) => {
        const items = data.items || [];
        setQualityItems(items);
        sessionStorage.setItem(qualityCacheKey, JSON.stringify(items));
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingQuality(false);
      });
    return () => controller.abort();
  }, [canManageCompanies, token]);

  const tabs = useMemo(() => {
    if (canManageCompanies) return [{ key: "empresas", label: "Organizaciones" }];
    return [{ key: "colegios", label: "Mi colegio" }];
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
            : "Espacio personalizado de tu institución, con acceso solo a tu entorno."}
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
          <div className="mb-4 rounded-xl border border-white/10 bg-[#1A2C38] p-3 text-sm text-[#D4E1E8]">
            Flujo guiado recomendado: 1) Crear empresa, 2) Crear colegio, 3) Generar admin de colegio, 4) Probar login con rol cliente.
          </div>
          <h4 className="text-lg font-semibold text-slate-950">Salud de datos por empresa</h4>
          {isLoadingQuality ? (
            <p className="mt-2 text-xs text-[#A9BFCA]">Actualizando controles...</p>
          ) : null}
          <div className="mt-4 grid gap-3">
            {qualityItems.length ? (
              qualityItems.map((item) => (
                <article key={item.companyId} className="rounded-xl border border-white/10 bg-[#1A2C38] px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-[#E8EEF1]">{item.nombre}</p>
                    <div className="flex items-center gap-2">
                      <SpreadsheetBadge token={token} companyId={item.companyId}/>
                      <span className={`h-2.5 w-2.5 rounded-full ${(item.score ?? 0) < 50 ? "bg-red-400" : (item.score ?? 0) < 70 ? "bg-amber-400" : "bg-emerald-400"}`} />
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          (item.score ?? 0) < 70 ? "bg-amber-500/20 text-amber-200" : "bg-emerald-500/20 text-emerald-200"
                        }`}
                      >
                        Score {item.score ?? "-"}
                      </span>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <p className="text-sm text-[#A9BFCA]">Aun no hay controles nocturnos ejecutados.</p>
            )}
          </div>
        </section>
      ) : null}

      {needsCompanySetup ? (
        <SetupCompanyForm token={token} login={login} />
      ) : null}

      {tab === "empresas" && canManageCompanies ? <CompaniesPage /> : null}
      {tab === "colegios" && !canManageCompanies ? <SchoolsPage /> : null}
    </div>
  );
}
