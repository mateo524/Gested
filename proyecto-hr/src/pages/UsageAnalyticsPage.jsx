import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// ─── Skeleton helpers ────────────────────────────────────────────────────────

function Bone({ className }) {
  return <div className={`skeleton animate-pulse rounded-xl bg-white/8 ${className}`} />;
}

function StatCardSkeleton() {
  return (
    <div className="rounded-2xl border border-white/8 bg-[#0c1e28] p-4 space-y-3">
      <Bone className="h-3 w-24" />
      <Bone className="h-7 w-16" />
      <Bone className="h-3 w-32" />
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, hint, accent = "teal" }) {
  const accentClass =
    accent === "green"
      ? "from-emerald-500/10 to-[#0c1920] border-emerald-400/15"
      : accent === "amber"
        ? "from-amber-500/10 to-[#0c1920] border-amber-300/15"
        : "from-[#14b8a6]/10 to-[#0c1920] border-[#14b8a6]/20";

  return (
    <article
      className={`rounded-2xl border bg-gradient-to-br p-4 ${accentClass}`}
    >
      <p className="text-[11px] text-[#7a98a8] uppercase tracking-[.1em] font-medium">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-white">
        {typeof value === "number" ? value.toLocaleString("es-AR") : value}
      </p>
      {hint ? <p className="mt-1 text-[11px] text-[#7a98a8]">{hint}</p> : null}
    </article>
  );
}

// ─── Section wrapper ─────────────────────────────────────────────────────────

function Section({ title, subtitle, children }) {
  return (
    <section className="rounded-2xl border border-white/8 bg-[#0c1820] p-5 md:p-6">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-xs text-[#7a98a8]">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ value }) {
  const pct = Math.round((value || 0) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-[#14b8a6] transition-all"
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <span className="text-xs text-[#8ea5b3] w-10 text-right">{pct}%</span>
    </div>
  );
}

// ─── Custom tooltip for Recharts ─────────────────────────────────────────────

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-[#0c1820] px-3 py-2 shadow-lg">
      <p className="text-xs text-[#8ea5b3]">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-white">{payload[0].value} evaluaciones</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UsageAnalyticsPage() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const result = await apiFetch("/analytics/usage", { token });
        if (result?.ok) {
          setData(result);
        } else {
          setError(result?.message || "No pudimos cargar los datos de analytics.");
        }
      } catch (err) {
        setError(err?.message || "Error al cargar analytics.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  // ── Page header ──────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div className="pf-surface p-5 md:p-6">
        <div>
          <p className="text-[11px] uppercase tracking-[.12em] text-[#14b8a6] font-semibold mb-1">
            Superadmin
          </p>
          <h1 className="text-xl font-bold text-white">Usage Analytics</h1>
          <p className="mt-1 text-sm text-[#7a98a8]">
            Visión global de actividad en todas las organizaciones de la plataforma.
          </p>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-300/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      {/* ── Overview cards ─────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[...Array(6)].map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
      ) : data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard
            label="Organizaciones totales"
            value={data.overview.totalOrgs}
            hint={`${data.overview.activeOrgs} activas en los últimos 30 días`}
          />
          <StatCard
            label="Organizaciones activas"
            value={data.overview.activeOrgs}
            hint="Con al menos 1 evaluación en los últimos 30 días"
            accent="green"
          />
          <StatCard
            label="Usuarios totales"
            value={data.overview.totalUsers}
            hint="En todas las organizaciones"
          />
          <StatCard
            label="Empleados totales"
            value={data.overview.totalEmployees}
            hint="Perfiles cargados en la plataforma"
          />
          <StatCard
            label="Evaluaciones totales"
            value={data.overview.totalEvaluations}
            hint="Históricas en toda la plataforma"
          />
          <StatCard
            label="Evaluaciones este mes"
            value={data.overview.evaluationsThisMonth}
            hint="Creadas en el mes en curso"
            accent="amber"
          />
        </div>
      ) : null}

      {/* ── Evaluaciones por mes + Distribución de roles ───────────────── */}
      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-2xl border border-white/8 bg-[#0c1820] p-5 space-y-3">
              <Bone className="h-4 w-40" />
              <Bone className="h-48 w-full" />
            </div>
          ))}
        </div>
      ) : data ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Bar chart */}
          <Section title="Evaluaciones por mes" subtitle="Últimos 6 meses en toda la plataforma">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.evaluationsByMonth} barSize={28}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fill: "#7a98a8", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#7a98a8", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={32}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                <Bar dataKey="count" fill="#14b8a6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Section>

          {/* Role distribution */}
          <Section title="Distribución de roles" subtitle="Usuarios por rol en toda la plataforma">
            <div className="space-y-2">
              {Object.entries(data.roleDistribution)
                .sort((a, b) => b[1] - a[1])
                .map(([role, count]) => (
                  <div key={role} className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-[#0f1d27] px-3 py-2.5">
                    <span className="text-sm text-[#c7d5dc] font-medium">{role}</span>
                    <span className="rounded-full border border-[#14b8a6]/30 bg-[#14b8a6]/10 px-3 py-0.5 text-xs font-semibold text-[#ccfbf1]">
                      {count.toLocaleString("es-AR")}
                    </span>
                  </div>
                ))}
              {Object.keys(data.roleDistribution).length === 0 ? (
                <p className="text-sm text-[#8ea5b3]">Sin datos de roles disponibles.</p>
              ) : null}
            </div>
          </Section>
        </div>
      ) : null}

      {/* ── Feature usage ──────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[...Array(4)].map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
      ) : data ? (
        <Section title="Uso de funcionalidades" subtitle="Registros totales por módulo">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-white/8 bg-[#0f1d27] px-4 py-3">
              <p className="text-[11px] text-[#7a98a8] uppercase tracking-[.1em] font-medium">Evaluaciones</p>
              <p className="mt-1.5 text-xl font-bold text-white">{data.featureUsage.evaluations.toLocaleString("es-AR")}</p>
            </div>
            <div className="rounded-xl border border-white/8 bg-[#0f1d27] px-4 py-3">
              <p className="text-[11px] text-[#7a98a8] uppercase tracking-[.1em] font-medium">Planes de desarrollo</p>
              <p className="mt-1.5 text-xl font-bold text-white">{data.featureUsage.developmentPlans.toLocaleString("es-AR")}</p>
            </div>
            <div className="rounded-xl border border-white/8 bg-[#0f1d27] px-4 py-3">
              <p className="text-[11px] text-[#7a98a8] uppercase tracking-[.1em] font-medium">Ciclos</p>
              <p className="mt-1.5 text-xl font-bold text-white">{data.featureUsage.cycles.toLocaleString("es-AR")}</p>
            </div>
            <div className="rounded-xl border border-white/8 bg-[#0f1d27] px-4 py-3">
              <p className="text-[11px] text-[#7a98a8] uppercase tracking-[.1em] font-medium">Reportes</p>
              <p className="mt-1.5 text-xl font-bold text-white">{data.featureUsage.reports.toLocaleString("es-AR")}</p>
            </div>
          </div>
        </Section>
      ) : null}

      {/* ── Org activity table ─────────────────────────────────────────── */}
      {loading ? (
        <div className="rounded-2xl border border-white/8 bg-[#0c1820] p-5 space-y-3">
          <Bone className="h-4 w-56" />
          {[...Array(5)].map((_, i) => <Bone key={i} className="h-12 w-full" />)}
        </div>
      ) : data ? (
        <Section
          title="Actividad por organización"
          subtitle="Top 10 organizaciones por número de evaluaciones"
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="py-2.5 pr-4 text-left text-[11px] font-semibold uppercase tracking-[.1em] text-[#7a98a8]">
                    Empresa
                  </th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[.1em] text-[#7a98a8]">
                    Empleados
                  </th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[.1em] text-[#7a98a8]">
                    Evaluaciones
                  </th>
                  <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[.1em] text-[#7a98a8]">
                    Última actividad
                  </th>
                  <th className="pl-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[.1em] text-[#7a98a8]">
                    Tasa completado
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.orgActivity.map((org, idx) => (
                  <tr
                    key={org.nombre + idx}
                    className="border-b border-white/[0.05] transition hover:bg-white/[0.02]"
                  >
                    <td className="py-3 pr-4 font-medium text-white">{org.nombre}</td>
                    <td className="px-4 py-3 text-right text-[#c7d5dc]">{org.employees.toLocaleString("es-AR")}</td>
                    <td className="px-4 py-3 text-right text-[#c7d5dc]">{org.evaluations.toLocaleString("es-AR")}</td>
                    <td className="px-4 py-3 text-right text-[#8ea5b3] text-xs">
                      {org.lastActivity
                        ? new Date(org.lastActivity).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })
                        : "—"}
                    </td>
                    <td className="pl-4 py-3 w-40">
                      <ProgressBar value={org.completionRate} />
                    </td>
                  </tr>
                ))}
                {data.orgActivity.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-sm text-[#8ea5b3]">
                      No hay actividad registrada aún.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Section>
      ) : null}
    </div>
  );
}
