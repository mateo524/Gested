import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { apiFetch } from "../lib/api";

function CancelConfirmModal({ onConfirm, onClose, loading }) {
  const overlayRef = useRef(null);
  function handleOverlayClick(e) {
    if (e.target === overlayRef.current) onClose();
  }
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div ref={overlayRef} onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      role="dialog" aria-modal="true" aria-labelledby="cancel-modal-title">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0d1f2b] p-6 shadow-2xl">
        <div className="mb-5 flex items-start gap-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-400/30 bg-rose-500/10">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5 text-rose-400">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </span>
          <div>
            <h2 id="cancel-modal-title" className="text-base font-semibold text-white">Cancelar suscripción</h2>
            <p className="mt-1.5 text-sm text-[#8fa9b7]">
              ¿Estás seguro que querés cancelar? El acceso a todas las funciones se desactivará inmediatamente.
            </p>
            <p className="mt-2 text-xs text-[#5e7d8e]">Esta acción no se puede deshacer. Para reactivar, deberás iniciar una nueva suscripción.</p>
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={loading}
            className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-[#c5d5de] transition hover:bg-white/5 disabled:opacity-50">
            Mantener plan
          </button>
          <button type="button" onClick={onConfirm} disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-600 disabled:opacity-50">
            {loading && (
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
            )}
            {loading ? "Cancelando…" : "Sí, cancelar"}
          </button>
        </div>
      </div>
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
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [addEmployees, setAddEmployees] = useState("");

  const [form, setForm] = useState({
    contactName:   user?.nombre ? `${user.nombre}${user.apellido ? " " + user.apellido : ""}` : "",
    contactEmail:  user?.email || "",
    companyName:   "",
    employeeCount: "",
  });

  async function refreshStatus() {
    try {
      const s = await apiFetch("/billing/status", { token });
      setStatus(s);
    } catch {
      addToast({ message: "No se pudo cargar el estado de facturación", type: "error" });
    }
  }

  useEffect(() => {
    refreshStatus().finally(() => setLoading(false));
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

  async function handleAddEmployees(e) {
    e.preventDefault();
    const add = parseInt(addEmployees, 10);
    if (!add || add < 1) { addToast({ message: "Ingresá una cantidad válida", type: "error" }); return; }
    setSubmitting(true);
    try {
      const data = await apiFetch("/billing/add-employees-checkout", {
        token, method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addEmployees: add }),
      });
      if (data.checkoutUrl) {
        window.open(data.checkoutUrl, "_blank", "noopener");
        addToast({ message: "Completá el pago en MercadoPago para activar los empleados adicionales", type: "info" });
      }
    } catch (err) {
      addToast({ message: err?.message || "No se pudo iniciar el pago", type: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel() {
    setCancelLoading(true);
    try {
      await apiFetch("/billing/cancel", { token, method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      await refreshStatus();
      addToast({ message: "Suscripción cancelada. El acceso continúa hasta el próximo vencimiento.", type: "success" });
      setShowCancelModal(false);
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
  const hasManualPlan = !hasActiveSub && !hasPendingSub && !!status?.planExpiresAt && !status?.expired;
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
                {hasManualPlan && (
                  <span className="rounded-full border border-emerald-400/25 bg-emerald-500/15 px-3 py-1 text-sm font-semibold text-emerald-300">
                    Plan activo
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

          {(hasActiveSub || hasManualPlan) && (
            <div className="mt-4 border-t border-white/8 pt-4">
              <button type="button" onClick={() => setShowCancelModal(true)}
                className="rounded-xl border border-rose-400/25 bg-rose-500/8 px-4 py-2 text-sm text-rose-300 transition hover:bg-rose-500/12">
                Cancelar suscripción
              </button>
            </div>
          )}
        </section>
      )}

      {/* Feature list + form/upgrade */}
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
        </div>

        {/* Upgrade form when MP sub active; activation form when manual or no plan */}
        {hasActiveSub ? (
          <form onSubmit={handleAddEmployees} className="rounded-2xl border border-white/10 bg-[#0c1e28] p-5 space-y-4">
            <div>
              <p className="text-sm font-semibold text-white">Agregar empleados al plan</p>
              <p className="mt-1 text-xs text-[#7a9aaa]">
                {sub?.employeeCount ? `Tenés ${sub.employeeCount} empleados en tu plan actual.` : ""}
                {" "}Indicá cuántos querés agregar — el nuevo monto se aplica desde el próximo ciclo.
              </p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#7a9aaa]">
                Empleados a agregar <span className="text-rose-400">*</span>
              </label>
              <input
                type="number" min="1" max="9999"
                value={addEmployees}
                onChange={e => setAddEmployees(e.target.value)}
                required placeholder="Ej: 10"
                className="w-full rounded-xl border border-white/10 bg-[#0a1822] px-3 py-2.5 text-sm text-white placeholder-[#4a6475] focus:border-[#14b8a6]/40 focus:outline-none"
              />
              {addEmployees && parseInt(addEmployees) > 0 && sub?.employeeCount && (
                <p className="mt-1.5 text-xs text-[#14b8a6]">
                  Nuevo total: {sub.employeeCount + parseInt(addEmployees)} empleados
                </p>
              )}
            </div>
            <button type="submit" disabled={submitting}
              className="w-full rounded-xl bg-[#14b8a6] py-2.5 text-sm font-semibold text-[#0f172a] transition hover:bg-[#0d9488] disabled:opacity-50">
              {submitting ? "Actualizando…" : "Confirmar ampliación →"}
            </button>
          </form>
        ) : (
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

        </form>
        )}
      </div>

      <p className="text-center text-xs text-[#5e7d8e]">
        Los pagos se procesan a través de MercadoPago. Podés cancelar en cualquier momento.
      </p>

      {showCancelModal && (
        <CancelConfirmModal
          loading={cancelLoading}
          onConfirm={handleCancel}
          onClose={() => setShowCancelModal(false)}
        />
      )}
    </div>
  );
}
