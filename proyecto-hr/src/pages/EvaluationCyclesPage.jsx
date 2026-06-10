import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useView } from "../context/ViewContext";
import { apiFetch } from "../lib/api";
import ConfirmDialog from "../components/ConfirmDialog";
import CollapsibleList from "../components/CollapsibleList";

function CycleProgressPanel({ cycleId, token, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!cycleId) return;
    setLoading(true);
    apiFetch(`/evaluation-cycles/${cycleId}/progress`, { token })
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [cycleId, token]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#0c1e28] shadow-[0_24px_60px_rgba(2,8,23,0.6)]">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-[#14b8a6]">Progreso del ciclo</p>
            {data ? <h3 className="mt-0.5 text-lg font-semibold text-white">{data.periodo}</h3> : null}
          </div>
          <button type="button" onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-[#12222d] text-[#8ea5b3] hover:text-white">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-6">
          {loading ? (
            <p className="text-center text-sm text-[#8fa9b7]">Cargando estadísticas...</p>
          ) : !data ? (
            <p className="text-center text-sm text-rose-300">Error al cargar el progreso.</p>
          ) : (
            <div className="space-y-5">
              {/* Summary */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "Personas", value: data.summary.total },
                  { label: "Con evaluaciones", value: data.summary.withEvals },
                  { label: "Completadas", value: data.summary.allDone },
                  { label: "Completitud", value: `${data.summary.pct}%` },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-2xl border border-white/10 bg-[#0f1f28] p-3 text-center">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-[#5e7d8e]">{label}</p>
                    <p className="mt-1.5 text-xl font-bold text-white">{value}</p>
                  </div>
                ))}
              </div>
              {/* Progress bar */}
              <div className="space-y-1.5">
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/8">
                  <div
                    className={`h-full rounded-full transition-all ${data.summary.pct >= 80 ? "bg-emerald-400" : data.summary.pct >= 50 ? "bg-amber-400" : "bg-rose-400"}`}
                    style={{ width: `${data.summary.pct}%` }}
                  />
                </div>
                <p className="text-xs text-[#6a8a9a]">{data.summary.allDone} de {data.summary.total} personas con evaluaciones cerradas</p>
              </div>
              {/* Employee table */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5e7d8e]">Por persona</p>
                <div className="max-h-64 overflow-y-auto space-y-1.5">
                  {data.rows.map((row) => (
                    <div key={row.employeeId} className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-sm ${row.done ? "border-emerald-300/20 bg-emerald-500/5" : row.total > 0 ? "border-amber-300/20 bg-amber-500/5" : "border-white/10 bg-[#0f1f28]"}`}>
                      <span className={`h-2 w-2 rounded-full shrink-0 ${row.done ? "bg-emerald-400" : row.total > 0 ? "bg-amber-400" : "bg-[#3d5a6a]"}`} />
                      <span className="flex-1 font-medium text-white truncate">{row.nombre}</span>
                      <span className="text-[11px] text-[#7a9aaa] shrink-0">{row.area || "—"}</span>
                      <span className="text-[11px] shrink-0">{row.done ? <span className="text-emerald-300">✓ Listo</span> : row.total > 0 ? <span className="text-amber-300">{row.pending} pend.</span> : <span className="text-[#5e7d8e]">Sin eval.</span>}</span>
                      {row.avgScore !== null ? (
                        <span className="text-[11px] font-semibold text-white shrink-0">{row.avgScore.toFixed(1)}</span>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const emptyForm = {
  anio: new Date().getFullYear(),
  periodo: "",
  etapa: "INICIO",
  fechaInicio: "",
  fechaFin: "",
};

function formatStage(value) {
  if (value === "REVISION_INTERMEDIA") return "Seguimiento";
  if (value === "EVALUACION_FINAL") return "Evaluación final";
  return "Inicio";
}

export default function EvaluationCyclesPage() {
  const { token } = useAuth();
  const { addToast } = useToast();
  const { searchQuery, setSearchQuery } = useView();
  const [cycles, setCycles] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [confirmState, setConfirmState] = useState({ open: false, cycle: null });
  const [isDeleting, setIsDeleting] = useState(false);
  const [cloneMode, setCloneMode] = useState(false);
  const [progressPanelId, setProgressPanelId] = useState(null);
  const [closeConfirm, setCloseConfirm] = useState({ open: false, cycle: null });
  const [isClosing, setIsClosing] = useState(false);
  const [reminderState, setReminderState] = useState({ open: false, cycle: null });
  const [isSendingReminders, setIsSendingReminders] = useState(false);
  const formRef = useRef(null);
  const listRef = useRef(null);

  const visibleCycles = useMemo(() => {
    const term = String(searchQuery || "").trim().toLowerCase();
    if (!term) return cycles;
    return cycles.filter((cycle) =>
      [cycle.periodo, cycle.etapa, cycle.estado, cycle.anio]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(term))
    );
  }, [cycles, searchQuery]);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const cyclesData = await apiFetch("/evaluation-cycles", { token });
      setCycles(cyclesData);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadData().catch((error) => {
      setMessageType("error");
      setMessage(error.message);
    });
  }, [loadData]);

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = {};
    if (!form.periodo?.trim()) nextErrors.periodo = "El período es obligatorio.";
    if (!form.fechaInicio) nextErrors.fechaInicio = "La fecha de inicio es obligatoria.";
    if (!form.fechaFin) nextErrors.fechaFin = "La fecha de cierre es obligatoria.";
    setFieldErrors(nextErrors);

    if (Object.keys(nextErrors).length) {
      setMessage("Completá período y rango de fechas para guardar el ciclo.");
      setMessageType("warning");
      return;
    }

    try {
      setIsSubmitting(true);
      setMessage("");
      setMessageType("info");
      const isEditing = Boolean(editingId);
      await apiFetch(isEditing ? `/evaluation-cycles/${editingId}` : "/evaluation-cycles", {
        method: isEditing ? "PUT" : "POST",
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, estado: "BORRADOR" }),
      });
      setForm({ ...emptyForm, anio: new Date().getFullYear() });
      setEditingId("");
      setCloneMode(false);
      setFieldErrors({});
      const hadSearch = Boolean(String(searchQuery || "").trim());
      if (hadSearch) setSearchQuery("");
      setMessageType("success");
      setMessage(`${isEditing ? "Ciclo actualizado." : "Ciclo creado."}${hadSearch ? " Limpiamos la búsqueda activa para mostrarlo en la lista." : ""}`);
      addToast({ message: isEditing ? "Ciclo actualizado." : "Ciclo creado.", type: "success" });
      await loadData();
      window.requestAnimationFrame(() => {
        listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (error) {
      setMessageType("error");
      setMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleEdit(cycle) {
    setEditingId(cycle._id);
    setForm({
      anio: Number(cycle.anio || new Date().getFullYear()),
      periodo: cycle.periodo || "",
      etapa: cycle.etapa || "INICIO",
      fechaInicio: cycle.fechaInicio ? new Date(cycle.fechaInicio).toISOString().slice(0, 10) : "",
      fechaFin: cycle.fechaFin ? new Date(cycle.fechaFin).toISOString().slice(0, 10) : "",
    });
    setMessageType("info");
    setMessage("Editando ciclo seleccionado.");
    setFieldErrors({});
    window.requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function cancelEdit() {
    setEditingId("");
    setCloneMode(false);
    setForm({ ...emptyForm, anio: new Date().getFullYear() });
    setMessageType("info");
    setMessage("Edición cancelada.");
    setFieldErrors({});
  }

  function handleClone(cycle) {
    setEditingId("");
    setCloneMode(true);
    setForm({
      anio: Number(cycle.anio || new Date().getFullYear()),
      periodo: cycle.periodo || "",
      etapa: cycle.etapa || "INICIO",
      fechaInicio: "",
      fechaFin: "",
    });
    setFieldErrors({});
    setMessageType("info");
    setMessage("");
    window.requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  async function handleCloseCycle() {
    if (!closeConfirm.cycle) return;
    setIsClosing(true);
    try {
      await apiFetch(`/evaluation-cycles/${closeConfirm.cycle._id}`, {
        method: "PUT",
        token,
        body: { estado: "CERRADO" },
      });
      addToast({ message: "Ciclo cerrado y resultados congelados.", type: "success" });
      setCloseConfirm({ open: false, cycle: null });
      loadData();
    } catch (err) {
      addToast({ message: err.message || "Error al cerrar el ciclo.", type: "error" });
    } finally {
      setIsClosing(false);
    }
  }

  async function handleSendReminders() {
    if (!reminderState.cycle) return;
    setIsSendingReminders(true);
    try {
      const result = await apiFetch("/evaluations/send-reminders", {
        method: "POST",
        token,
        body: { cycleId: reminderState.cycle._id },
      });
      addToast({ message: `Se enviaron ${result.sent} recordatorio${result.sent !== 1 ? "s" : ""}${result.failed ? ` (${result.failed} fallido${result.failed !== 1 ? "s" : ""})` : ""}.`, type: result.sent > 0 ? "success" : "info" });
      setReminderState({ open: false, cycle: null });
    } catch (err) {
      addToast({ message: err.message || "Error al enviar recordatorios.", type: "error" });
    } finally {
      setIsSendingReminders(false);
    }
  }

  async function confirmDeleteCycle() {
    const cycle = confirmState.cycle;
    if (!cycle) return;
    try {
      setIsDeleting(true);
      await apiFetch(`/evaluation-cycles/${cycle._id}`, { method: "DELETE", token });
      if (editingId === cycle._id) {
        cancelEdit();
      }
      setConfirmState({ open: false, cycle: null });
      setMessageType("success");
      setMessage("Ciclo eliminado.");
      addToast({ message: "Ciclo eliminado.", type: "success" });
      await loadData();
    } catch (error) {
      setMessageType("error");
      setMessage(error.message);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-4 overflow-x-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[#14b8a6]">Calendario</p>
          <h2 className="mt-1 text-xl font-semibold text-white">Ciclos de evaluación</h2>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
        <section ref={formRef} className="rounded-[2rem] border border-white/10 bg-[#122530] p-5 md:p-6">
          <h4 className="text-xl font-semibold text-white">{editingId ? "Editar ciclo" : cloneMode ? "Clonar ciclo" : "Nuevo ciclo"}</h4>
          <p className="mt-2 text-sm text-[#9fb6c4]">
            {cloneMode ? "Completá las fechas para el nuevo ciclo." : "Completá período, etapa y rango de fechas."}
          </p>
          {cloneMode ? (
            <div className="mt-3 rounded-2xl border border-[#14b8a6]/30 bg-[#14b8a6]/8 px-4 py-3 text-sm text-[#14b8a6]">
              Clonando ciclo — completá las fechas del nuevo período
            </div>
          ) : null}

          <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-[#9fb6c4]">Año</label>
                <input
                  type="number"
                  className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white"
                  value={form.anio}
                  onChange={(e) => setForm({ ...form, anio: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#9fb6c4]">Período</label>
                <input
                  className={`w-full rounded-2xl border bg-[#0f1f28] px-4 py-3 text-white ${
                    fieldErrors.periodo ? "border-rose-400/70" : "border-white/15"
                  }`}
                  placeholder="Ej: Anual 2026 o Segundo semestre"
                  value={form.periodo}
                  onChange={(e) => {
                    setForm({ ...form, periodo: e.target.value });
                    if (fieldErrors.periodo) setFieldErrors((prev) => ({ ...prev, periodo: "" }));
                  }}
                  onBlur={() => {
                    if (!form.periodo?.trim()) setFieldErrors((prev) => ({ ...prev, periodo: "Este campo es obligatorio" }));
                    else setFieldErrors((prev) => ({ ...prev, periodo: "" }));
                  }}
                />
                {fieldErrors.periodo && <p className="mt-1 px-1 text-xs text-rose-300">{fieldErrors.periodo}</p>}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs text-[#9fb6c4]">Etapa</label>
              <select
                className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white"
                value={form.etapa}
                onChange={(e) => setForm({ ...form, etapa: e.target.value })}
              >
                <option value="INICIO">Inicio</option>
                <option value="REVISION_INTERMEDIA">Seguimiento</option>
                <option value="EVALUACION_FINAL">Evaluación final</option>
              </select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-[#9fb6c4]">Fecha de inicio</label>
                <input
                  type="date"
                  className={`w-full rounded-2xl border bg-[#0f1f28] px-4 py-3 text-white ${
                    fieldErrors.fechaInicio ? "border-rose-400/70" : "border-white/15"
                  }`}
                  value={form.fechaInicio}
                  onChange={(e) => {
                    setForm({ ...form, fechaInicio: e.target.value });
                    if (fieldErrors.fechaInicio) setFieldErrors((prev) => ({ ...prev, fechaInicio: "" }));
                  }}
                  onBlur={() => {
                    if (!form.fechaInicio) setFieldErrors((prev) => ({ ...prev, fechaInicio: "Este campo es obligatorio" }));
                    else setFieldErrors((prev) => ({ ...prev, fechaInicio: "" }));
                  }}
                />
                {fieldErrors.fechaInicio && <p className="mt-1 px-1 text-xs text-rose-300">{fieldErrors.fechaInicio}</p>}
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#9fb6c4]">Fecha de cierre</label>
                <input
                  type="date"
                  className={`w-full rounded-2xl border bg-[#0f1f28] px-4 py-3 text-white ${
                    fieldErrors.fechaFin ? "border-rose-400/70" : "border-white/15"
                  }`}
                  value={form.fechaFin}
                  onChange={(e) => {
                    setForm({ ...form, fechaFin: e.target.value });
                    if (fieldErrors.fechaFin) setFieldErrors((prev) => ({ ...prev, fechaFin: "" }));
                  }}
                  onBlur={() => {
                    if (!form.fechaFin) setFieldErrors((prev) => ({ ...prev, fechaFin: "Este campo es obligatorio" }));
                    else setFieldErrors((prev) => ({ ...prev, fechaFin: "" }));
                  }}
                />
                {fieldErrors.fechaFin && <p className="mt-1 px-1 text-xs text-rose-300">{fieldErrors.fechaFin}</p>}
              </div>
            </div>

            <button type="submit" disabled={isSubmitting} className="pf-button-primary w-full disabled:opacity-60">
              {isSubmitting ? "Guardando..." : editingId ? "Guardar cambios" : cloneMode ? "Crear ciclo clonado" : "Crear ciclo"}
            </button>

            {editingId || cloneMode ? (
              <button
                type="button"
                onClick={cancelEdit}
                className="w-full rounded-2xl border border-white/20 py-3 font-semibold text-[#c5d5de]"
              >
                {cloneMode ? "Cancelar clonado" : "Cancelar edición"}
              </button>
            ) : null}
          </form>
        </section>

        <section ref={listRef} className="rounded-[2rem] border border-white/10 bg-[#122530] p-5 md:p-6">
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <div className="relative">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#7f99a8]">
                <circle cx="6.5" cy="6.5" r="4.5" /><path d="M11 11l3 3" />
              </svg>
              <input
                className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] py-3 pl-8 pr-4 text-sm text-white outline-none transition focus:border-[#14b8a6] placeholder:text-[#7f99a8]"
                placeholder="Buscar ciclo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#0f1f28] px-4 py-3 text-right">
              <p className="text-[10px] uppercase tracking-[0.14em] text-[#7f99a8]">Registros</p>
              <p className="mt-1 text-sm font-semibold text-white">{visibleCycles.length}</p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {searchQuery ? (
              <div className="pf-alert-info flex flex-wrap items-center justify-between gap-3">
                <span>Hay una búsqueda activa. Limpiála para ver todos los ciclos cargados.</span>
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="rounded-xl border border-white/15 px-3 py-2 text-xs font-semibold text-white"
                >
                  Limpiar búsqueda
                </button>
              </div>
            ) : null}
            {!isLoading && visibleCycles.length
              ? <CollapsibleList
                  items={visibleCycles}
                  initialCount={3}
                  buttonLabelMore={`Ver más (${visibleCycles.length - 3})`}
                  renderItem={(cycle) => {
                    const now = new Date();
                    const end = cycle.fechaFin ? new Date(cycle.fechaFin) : null;
                    const start = cycle.fechaInicio ? new Date(cycle.fechaInicio) : null;
                    const isManuallyClosed = cycle.estado === "CERRADO";
                    const isActive = !isManuallyClosed && start && end && now >= start && now <= end;
                    const isExpired = !isManuallyClosed && end && now > end;
                    const estadoLabel = isManuallyClosed ? "Cerrado" : isActive ? "Activo" : isExpired ? "Vencido" : "Programado";
                    const estadoCls = isManuallyClosed
                      ? "border-white/10 bg-[#0c1e28] text-[#6a8a9a]"
                      : isActive
                        ? "border-[#14b8a6]/30 bg-[#14b8a6]/10 text-[#14b8a6]"
                        : isExpired
                          ? "border-amber-300/25 bg-amber-500/8 text-amber-300"
                          : "border-indigo-300/25 bg-indigo-500/8 text-indigo-300";
                    return (
                    <article key={cycle._id} className={`rounded-2xl border p-4 ${isActive ? "border-[#14b8a6]/15 bg-[#0d1e22]" : "border-white/10 bg-[#0f1f28]"}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-white">{cycle.periodo} {cycle.anio}</p>
                        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${estadoCls}`}>{estadoLabel}</span>
                        <span className="rounded-full border border-white/10 bg-[#0c1e28] px-2.5 py-0.5 text-xs text-[#8fa9b7]">{formatStage(cycle.etapa)}</span>
                      </div>
                      <p className="mt-2 text-sm text-[#8fa9b7]">
                        {start ? start.toLocaleDateString("es-AR", { dateStyle: "medium" }) : "—"}
                        {" → "}
                        {end ? end.toLocaleDateString("es-AR", { dateStyle: "medium" }) : "—"}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" onClick={() => setProgressPanelId(cycle._id)} className="rounded-xl border border-indigo-300/25 bg-indigo-500/8 px-4 py-2 text-sm text-indigo-300 transition hover:bg-indigo-500/15">
                          Progreso
                        </button>
                        <button
                          type="button"
                          onClick={() => setReminderState({ open: true, cycle })}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-[#14b8a6]/30 px-4 py-2 text-sm text-[#14b8a6] transition hover:bg-[#14b8a6]/10"
                        >
                          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-3.5 w-3.5 shrink-0">
                            <path d="M10 2a6 6 0 00-6 6c0 3.5-1.5 5-1.5 5h15S16 11.5 16 8a6 6 0 00-6-6z" />
                            <path d="M8.5 17a1.5 1.5 0 003 0" />
                          </svg>
                          Recordatorios
                        </button>
                        {!isManuallyClosed && (
                          <button type="button" onClick={() => setCloseConfirm({ open: true, cycle })} className="rounded-xl border border-amber-300/30 bg-amber-500/8 px-4 py-2 text-sm text-amber-200 transition hover:bg-amber-500/15">
                            Cerrar ciclo
                          </button>
                        )}
                        <button type="button" onClick={() => handleEdit(cycle)} className="rounded-xl border border-white/15 px-4 py-2 text-sm text-[#c5d5de] transition hover:bg-white/5">
                          Editar
                        </button>
                        <button type="button" onClick={() => handleClone(cycle)} className="rounded-xl border border-[#14b8a6]/30 px-4 py-2 text-sm text-[#14b8a6] transition hover:bg-[#14b8a6]/10">
                          Clonar
                        </button>
                        <button type="button" onClick={() => setConfirmState({ open: true, cycle })} className="rounded-xl border border-rose-400/50 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-200 transition hover:bg-rose-500/20">
                          Eliminar
                        </button>
                      </div>
                    </article>
                    );
                  }}
                />
              : null}
            {!isLoading && !visibleCycles.length ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-[#0c1e28] px-5 py-6 text-center">
                <p className="text-sm font-semibold text-white">{searchQuery ? "Sin ciclos para la búsqueda actual" : "Todavía no hay ciclos definidos"}</p>
                <p className="mt-1 text-xs text-[#7a9aaa]">{searchQuery ? "Limpiá la búsqueda para ver todos." : "Creá el primer ciclo para empezar a organizar evaluaciones."}</p>
              </div>
            ) : null}
          </div>
        </section>
      </div>

      {message ? (
        <p
          className={
            messageType === "error"
              ? "pf-alert-error"
              : messageType === "success"
                ? "pf-alert-success"
                : messageType === "warning"
                  ? "pf-alert-warning"
                  : "pf-alert-info"
          }
        >
          {message}
        </p>
      ) : null}

      <ConfirmDialog
        open={confirmState.open}
        title="¿Eliminar este ciclo?"
        message={
          confirmState.cycle
            ? `Vas a eliminar el ciclo "${confirmState.cycle.periodo} ${confirmState.cycle.anio}". Esta acción no se puede deshacer.`
            : ""
        }
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        destructive
        loading={isDeleting}
        onCancel={() => setConfirmState({ open: false, cycle: null })}
        onConfirm={confirmDeleteCycle}
      />

      <ConfirmDialog
        open={closeConfirm.open}
        title="¿Cerrar este ciclo?"
        message={
          closeConfirm.cycle
            ? `Vas a cerrar el ciclo "${closeConfirm.cycle.periodo} ${closeConfirm.cycle.anio}". Los resultados quedarán congelados y no se podrán agregar nuevas evaluaciones.`
            : ""
        }
        confirmLabel="Cerrar ciclo"
        cancelLabel="Cancelar"
        loading={isClosing}
        onCancel={() => setCloseConfirm({ open: false, cycle: null })}
        onConfirm={handleCloseCycle}
      />

      <ConfirmDialog
        open={reminderState.open}
        title="¿Enviar recordatorios?"
        message={
          reminderState.cycle
            ? `Se enviará un email a todos los empleados con evaluaciones en estado BORRADOR en el ciclo "${reminderState.cycle.periodo} ${reminderState.cycle.anio}".`
            : ""
        }
        confirmLabel={isSendingReminders ? "Enviando..." : "Enviar recordatorios"}
        cancelLabel="Cancelar"
        loading={isSendingReminders}
        onCancel={() => setReminderState({ open: false, cycle: null })}
        onConfirm={handleSendReminders}
      />

      {progressPanelId && (
        <CycleProgressPanel
          cycleId={progressPanelId}
          token={token}
          onClose={() => setProgressPanelId(null)}
        />
      )}
    </div>
  );
}
