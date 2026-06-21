import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { apiFetch } from "../lib/api";

const PLAN_COLORS = {
  base: { badge: "bg-amber-500/15 text-amber-300 border-amber-400/25", btn: "bg-amber-500 hover:bg-amber-400" },
  pro:  { badge: "bg-violet-500/15 text-violet-300 border-violet-400/25", btn: "bg-violet-500 hover:bg-violet-400" },
};

function formatARS(n) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);
}

function PlanCard({ planKey, planDef, current, onSelect, loading }) {
  const colors = PLAN_COLORS[planKey];
  const isCurrent = current === planKey;
  return (
    <div className={`rounded-2xl border p-5 transition ${isCurrent ? "border-[#14b8a6]/40 bg-[#14b8a6]/5" : "border-white/10 bg-[#0c1e28]"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${colors.badge}`}>
              {planKey === "base" ? "Base" : "Pro"}
            </span>
            {isCurrent && <span className="rounded-full bg-[#14b8a6]/15 px-2 py-0.5 text-[10px] font-semibold text-[#14b8a6]">Plan actual</span>}
          </div>
          <p className="mt-2 text-2xl font-bold text-white">{formatARS(planDef.price / 100)}<span className="ml-1 text-sm font-normal text-[#7a9aaa]">/mes</span></p>
          <p className="mt-1 text-sm text-[#9fb6c4]">{planDef.description}</p>
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {planKey === "base" ? (
          <>
            <li className="flex items-center gap-2 text-sm text-[#9fb6c4]"><CheckIcon /> Hasta 50 empleados</li>
            <li className="flex items-center gap-2 text-sm text-[#9fb6c4]"><CheckIcon /> Evaluaciones de desempeño</li>
            <li className="flex items-center gap-2 text-sm text-[#9fb6c4]"><CheckIcon /> Reportes básicos</li>
            <li className="flex items-center gap-2 text-sm text-[#5e7d8e]"><XIcon /> Planes de desarrollo</li>
            <li className="flex items-center gap-2 text-sm text-[#5e7d8e]"><XIcon /> Exportación PDF</li>
            <li className="flex items-center gap-2 text-sm text-[#5e7d8e]"><XIcon /> Métricas avanzadas</li>
          </>
        ) : (
          <>
            <li className="flex items-center gap-2 text-sm text-[#9fb6c4]"><CheckIcon /> Empleados ilimitados</li>
            <li className="flex items-center gap-2 text-sm text-[#9fb6c4]"><CheckIcon /> Evaluaciones de desempeño</li>
            <li className="flex items-center gap-2 text-sm text-[#9fb6c4]"><CheckIcon /> Reportes ejecutivos</li>
            <li className="flex items-center gap-2 text-sm text-[#9fb6c4]"><CheckIcon /> Planes de desarrollo</li>
            <li className="flex items-center gap-2 text-sm text-[#9fb6c4]"><CheckIcon /> Exportación PDF</li>
            <li className="flex items-center gap-2 text-sm text-[#9fb6c4]"><CheckIcon /> Métricas avanzadas</li>
          </>
        )}
      </ul>

      {!isCurrent && (
        <button type="button" onClick={() => onSelect(planKey)} disabled={loading}
          className="mt-5 w-full rounded-xl bg-[#14b8a6] py-2.5 text-sm font-semibold text-[#0f172a] transition hover:bg-[#0d9488] disabled:opacity-50">
          {loading ? "Procesando…" : planKey === "pro" ? "Actualizar a Pro" : "Cambiar a Base"}
        </button>
      )}
      {isCurrent && (
        <div className="mt-5 w-full rounded-xl border border-[#14b8a6]/20 py-2.5 text-center text-sm font-medium text-[#14b8a6]">
          Plan activo
        </div>
      )}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5 shrink-0 text-[#14b8a6]">
      <path d="M3 8l3.5 3.5L13 4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function XIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5 shrink-0 text-[#5e7d8e]">
      <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round"/>
    </svg>
  );
}

export default function BillingPage() {
  const { token } = useAuth();
  const { addToast } = useToast();
  const [status, setStatus] = useState(null);
  const [plans, setPlans]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      apiFetch("/billing/status", { token }),
      apiFetch("/billing/plans",  { token }),
    ]).then(([s, p]) => {
      setStatus(s);
      setPlans(Array.isArray(p.plans) ? p.plans : []);
    }).catch(() => {
      addToast({ message: "No se pudo cargar la información de facturación", type: "error" });
    }).finally(() => setLoading(false));
  }, [token]);

  async function handleSelectPlan(planKey) {
    setCheckoutLoading(true);
    try {
      const data = await apiFetch("/billing/create-checkout", {
        token, method: "POST",
        body: JSON.stringify({ plan: planKey }),
      });
      if (data.checkoutUrl) {
        window.open(data.checkoutUrl, "_blank", "noopener");
        addToast({ message: "Completá el pago en MercadoPago para activar el plan", type: "info" });
      }
    } catch (err) {
      addToast({ message: err?.message || "No se pudo iniciar el proceso de pago", type: "error" });
    } finally {
      setCheckoutLoading(false);
    }
  }

  async function handleCancel() {
    if (!window.confirm("¿Cancelar la suscripción? El plan seguirá activo hasta el próximo vencimiento.")) return;
    setCancelLoading(true);
    try {
      await apiFetch("/billing/cancel", { token, method: "POST", body: JSON.stringify({}) });
      addToast({ message: "Suscripción cancelada", type: "success" });
      setStatus(s => ({ ...s, subscription: { ...s.subscription, status: "cancelled" } }));
    } catch {
      addToast({ message: "No se pudo cancelar la suscripción", type: "error" });
    } finally {
      setCancelLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-[#7a9aaa]">
        <svg className="mr-2 h-5 w-5 animate-spin text-[#14b8a6]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
        </svg>
        Cargando…
      </div>
    );
  }

  const planMap = Object.fromEntries((plans || []).map(p => [p.key, p]));
  const sub = status?.subscription;
  const hasActiveSub = sub?.status === "authorized";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white">Facturación y plan</h2>
        <p className="mt-1 text-sm text-[#7a9aaa]">Administrá tu suscripción y método de pago.</p>
      </div>

      {/* Current plan summary */}
      <section className="rounded-2xl border border-white/10 bg-[#0c1e28] p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#5e7d8e]">Plan actual</p>
            <div className="mt-1 flex items-center gap-3">
              <span className={`rounded-full border px-3 py-1 text-sm font-semibold ${PLAN_COLORS[status?.plan || "pro"].badge}`}>
                {status?.plan === "base" ? "Base" : "Pro"}
              </span>
              {status?.expired && (
                <span className="rounded-full border border-rose-400/25 bg-rose-500/10 px-2.5 py-0.5 text-xs font-semibold text-rose-300">Vencido</span>
              )}
            </div>
            {status?.planExpiresAt && (
              <p className="mt-1.5 text-xs text-[#7a9aaa]">
                {status.expired ? "Venció el" : "Próximo vencimiento:"} {new Date(status.planExpiresAt).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" })}
              </p>
            )}
          </div>

          {sub && (
            <div className="text-right">
              <p className="text-xs text-[#5e7d8e]">Suscripción MP</p>
              <p className={`mt-0.5 text-xs font-semibold ${hasActiveSub ? "text-emerald-300" : "text-[#9fb6c4]"}`}>
                {sub.status === "authorized" ? "Activa" : sub.status === "cancelled" ? "Cancelada" : sub.status === "paused" ? "Pausada" : "Pendiente"}
              </p>
              {sub.lastPaymentDate && (
                <p className="mt-0.5 text-[11px] text-[#5e7d8e]">
                  Último pago: {new Date(sub.lastPaymentDate).toLocaleDateString("es-AR")}
                  {sub.lastPaymentAmount ? ` · ${formatARS(sub.lastPaymentAmount / 100)}` : ""}
                </p>
              )}
            </div>
          )}
        </div>

        {hasActiveSub && (
          <div className="mt-4 border-t border-white/8 pt-4">
            <button type="button" onClick={handleCancel} disabled={cancelLoading}
              className="rounded-xl border border-rose-400/25 bg-rose-500/8 px-4 py-2 text-sm text-rose-300 transition hover:bg-rose-500/12 disabled:opacity-50">
              {cancelLoading ? "Cancelando…" : "Cancelar suscripción"}
            </button>
            <p className="mt-1.5 text-[11px] text-[#5e7d8e]">Al cancelar, el plan sigue activo hasta el próximo vencimiento.</p>
          </div>
        )}
      </section>

      {/* Plan cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {["base", "pro"].map(key => planMap[key] ? (
          <PlanCard
            key={key}
            planKey={key}
            planDef={planMap[key]}
            current={status?.plan}
            onSelect={handleSelectPlan}
            loading={checkoutLoading}
          />
        ) : null)}
      </div>

      <p className="text-center text-xs text-[#5e7d8e]">
        Los pagos se procesan a través de MercadoPago. Podés cancelar en cualquier momento.
      </p>
    </div>
  );
}
