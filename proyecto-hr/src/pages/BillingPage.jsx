import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { apiFetch } from "../lib/api";

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5 shrink-0 text-[#14b8a6]">
      <path d="M3 8l3.5 3.5L13 4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

const FEATURES = [
  "Evaluaciones de desempeño 360°",
  "Planes de desarrollo individualizados",
  "Reportes ejecutivos y exportación",
  "Métricas y KPIs de desempeño",
  "Organigrama interactivo",
  "Carga masiva de empleados",
  "Soporte incluido",
];

export default function BillingPage() {
  const { token, user } = useAuth();
  const { addToast } = useToast();

  const [status, setStatus]         = useState(null);
  const [loading, setLoading]       = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  const [form, setForm] = useState({
    contactName:   user?.nombre ? `${user.nombre}${user.apellido ? " " + user.apellido : ""}` : "",
    contactEmail:  user?.email || "",
    companyName:   "",
    employeeCount: "",
  });

  useEffect(() => {
    apiFetch("/billing/status", { token })
      .then(s => setStatus(s))
      .catch(() => addToast({ message: "No se pudo cargar el estado de facturación", type: "error" }))
      .finally(() => setLoading(false));
  }, [token]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const count = parseInt(form.employeeCount, 10);
    if (!count || count < 1) {
      addToast({ message: "Ingresá la cantidad de empleados", type: "error" });
      return;
    }
    setSubmitting(true);
    try {
      const data = await apiFetch("/billing/create-checkout", {
        token, method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeCount: count,
          contactName:   form.contactName,
          contactEmail:  form.contactEmail,
          companyName:   form.companyName,
        }),
      });
      if (data.checkoutUrl) {
        window.open(data.checkoutUrl, "_blank", "noopener");
        addToast({ message: "Completá el pago en MercadoPago para activar el plan", type: "info" });
      }
    } catch (err) {
      addToast({ message: err?.message || "No se pudo iniciar el proceso de pago", type: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel() {
    if (!window.confirm("¿Cancelar la suscripción? El plan seguirá activo hasta el próximo vencimiento.")) return;
    setCancelLoading(true);
    try {
      await apiFetch("/billing/cancel", { token, method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
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

  const sub = status?.subscription;
  const hasActiveSub = sub?.status === "authorized";
  const hasPendingSub = sub?.status === "pending";
  const needsSubscription = !hasActiveSub && !hasPendingSub && !status?.planExpiresAt;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white">Facturación y suscripción</h2>
        <p className="mt-1 text-sm text-[#7a9aaa]">Activá o administrá tu suscripción a Zentor.</p>
      </div>

      {needsSubscription && (
        <div className="rounded-2xl border border-amber-400/20 bg-amber-500/8 px-5 py-4">
          <p className="text-sm font-semibold text-amber-300">Tu cuenta no tiene una suscripción activa</p>
          <p className="mt-1 text-xs text-amber-200/70">Completá el formulario para activar el acceso a todas las funciones.</p>
        </div>
      )}

      {/* Current status */}
      {(hasActiveSub || hasPendingSub || status?.planExpiresAt) && (
        <section className="rounded-2xl border border-white/10 bg-[#0c1e28] p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#5e7d8e]">Estado actual</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {hasActiveSub && (
                  <span className="rounded-full border border-emerald-400/25 bg-emerald-500/15 px-3 py-1 text-sm font-semibold text-emerald-300">
                    Suscripción activa
                  </span>
                )}
                {hasPendingSub && (
                  <span className="rounded-full border border-amber-400/25 bg-amber-500/15 px-3 py-1 text-sm font-semibold text-amber-300">
                    Pago pendiente
                  </span>
                )}
                {status?.expired && (
                  <span className="rounded-full border border-rose-400/25 bg-rose-500/10 px-2.5 py-0.5 text-xs font-semibold text-rose-300">
                    Vencido
                  </span>
                )}
              </div>
              {status?.planExpiresAt && (
                <p className="mt-1.5 text-xs text-[#7a9aaa]">
                  {status.expired ? "Venció el" : "Próximo vencimiento:"}{" "}
                  {new Date(status.planExpiresAt).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" })}
                </p>
              )}
              {sub?.employeeCount && (
                <p className="mt-1 text-xs text-[#7a9aaa]">{sub.employeeCount} empleados facturados</p>
              )}
            </div>

            {sub?.lastPaymentDate && (
              <div className="text-right">
                <p className="text-xs text-[#5e7d8e]">Último pago</p>
                <p className="mt-0.5 text-xs font-medium text-[#9fb6c4]">
                  {new Date(sub.lastPaymentDate).toLocaleDateString("es-AR")}
                </p>
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
      )}

      {/* Feature list + form */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Features */}
        <div className="rounded-2xl border border-white/10 bg-[#0c1e28] p-5">
          <p className="text-sm font-semibold text-white">Todo incluido</p>
          <p className="mt-0.5 text-xs text-[#7a9aaa]">Una sola suscripción, todas las funciones.</p>
          <ul className="mt-4 space-y-2.5">
            {FEATURES.map(f => (
              <li key={f} className="flex items-center gap-2 text-sm text-[#9fb6c4]">
                <CheckIcon /> {f}
              </li>
            ))}
          </ul>
          <div className="mt-5 rounded-xl border border-[#14b8a6]/20 bg-[#14b8a6]/5 p-3">
            <p className="text-xs text-[#14b8a6]">Precio según cantidad de empleados. Se calcula al finalizar el formulario.</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="rounded-2xl border border-white/10 bg-[#0c1e28] p-5 space-y-4">
          <p className="text-sm font-semibold text-white">Activar suscripción</p>
          <p className="text-xs text-[#7a9aaa]">Completá tus datos para continuar al pago.</p>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#7a9aaa]">Nombre de contacto</label>
              <input
                name="contactName"
                value={form.contactName}
                onChange={handleChange}
                required
                placeholder="Tu nombre"
                className="w-full rounded-xl border border-white/10 bg-[#0a1822] px-3 py-2.5 text-sm text-white placeholder-[#4a6475] focus:border-[#14b8a6]/40 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[#7a9aaa]">Email de contacto</label>
              <input
                name="contactEmail"
                type="email"
                value={form.contactEmail}
                onChange={handleChange}
                required
                placeholder="tu@empresa.com"
                className="w-full rounded-xl border border-white/10 bg-[#0a1822] px-3 py-2.5 text-sm text-white placeholder-[#4a6475] focus:border-[#14b8a6]/40 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[#7a9aaa]">Nombre de la empresa</label>
              <input
                name="companyName"
                value={form.companyName}
                onChange={handleChange}
                placeholder="Acme S.A."
                className="w-full rounded-xl border border-white/10 bg-[#0a1822] px-3 py-2.5 text-sm text-white placeholder-[#4a6475] focus:border-[#14b8a6]/40 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[#7a9aaa]">
                Cantidad de empleados <span className="text-rose-400">*</span>
              </label>
              <input
                name="employeeCount"
                type="number"
                min="1"
                max="9999"
                value={form.employeeCount}
                onChange={handleChange}
                required
                placeholder="Ej: 50"
                className="w-full rounded-xl border border-white/10 bg-[#0a1822] px-3 py-2.5 text-sm text-white placeholder-[#4a6475] focus:border-[#14b8a6]/40 focus:outline-none"
              />
              <p className="mt-1 text-[11px] text-[#5e7d8e]">Aproximado. El precio final se muestra en MercadoPago.</p>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || hasActiveSub}
            className="w-full rounded-xl bg-[#14b8a6] py-2.5 text-sm font-semibold text-[#0f172a] transition hover:bg-[#0d9488] disabled:opacity-50"
          >
            {submitting ? "Procesando…" : hasActiveSub ? "Suscripción activa" : "Continuar al pago →"}
          </button>

          {hasActiveSub && (
            <p className="text-center text-xs text-[#5e7d8e]">Ya tenés una suscripción activa.</p>
          )}
        </form>
      </div>

      <p className="text-center text-xs text-[#5e7d8e]">
        Los pagos se procesan a través de MercadoPago. Podés cancelar en cualquier momento.
      </p>
    </div>
  );
}
