import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useView } from "../context/ViewContext";
import { apiFetch } from "../lib/api";
import ConfirmDialog from "../components/ConfirmDialog";
import CollapsibleList from "../components/CollapsibleList";

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
                    const isActive = start && end && now >= start && now <= end;
                    const isExpired = end && now > end;
                    const estadoLabel = isActive ? "Activo" : isExpired ? "Cerrado" : "Programado";
                    const estadoCls = isActive
                      ? "border-[#14b8a6]/30 bg-[#14b8a6]/10 text-[#14b8a6]"
                      : isExpired
                        ? "border-white/10 bg-[#0c1e28] text-[#6a8a9a]"
                        : "border-amber-300/25 bg-amber-500/8 text-amber-300";
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
                      <div className="mt-3 flex gap-2">
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
    </div>
  );
}
