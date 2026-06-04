import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
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
      setFieldErrors({});
      const hadSearch = Boolean(String(searchQuery || "").trim());
      if (hadSearch) setSearchQuery("");
      setMessageType("success");
      setMessage(
        `${isEditing ? "Ciclo actualizado." : "Ciclo creado."}${
          hadSearch ? " Limpiamos la búsqueda activa para mostrarlo en la lista." : ""
        }`
      );
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
    setForm({ ...emptyForm, anio: new Date().getFullYear() });
    setMessageType("info");
    setMessage("Edición cancelada.");
    setFieldErrors({});
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
      await loadData();
    } catch (error) {
      setMessageType("error");
      setMessage(error.message);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-5 overflow-x-hidden">
      <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-6 md:p-7">
        <p className="text-sm uppercase tracking-[0.22em] text-[#22c55e]">Calendario institucional</p>
        <h3 className="mt-3 text-3xl font-bold text-white">Ciclos de evaluación</h3>
        <p className="mt-3 max-w-3xl text-[#9fb6c4]">
          Un <span title="Período de tiempo en el que se realizan evaluaciones de desempeño. Agrupa evaluaciones, metas y seguimiento bajo un mismo contexto temporal." className="cursor-help underline decoration-dotted text-[#c5d5de]">ciclo</span> define el período y las fechas clave para ordenar evaluaciones y seguimiento.
        </p>
      </section>

      <div className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
        <section ref={formRef} className="rounded-[2rem] border border-white/10 bg-[#122530] p-5 md:p-6">
          <h4 className="text-xl font-semibold text-white">{editingId ? "Editar ciclo" : "Nuevo ciclo"}</h4>
          <p className="mt-2 text-sm text-[#9fb6c4]">
            Completá período, etapa y rango de fechas.
          </p>

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
                  onChange={(e) => setForm({ ...form, periodo: e.target.value })}
                />
                {fieldErrors.periodo ? <p className="mt-1 text-xs text-rose-300">{fieldErrors.periodo}</p> : null}
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
                  onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#9fb6c4]">Fecha de cierre</label>
                <input
                  type="date"
                  className={`w-full rounded-2xl border bg-[#0f1f28] px-4 py-3 text-white ${
                    fieldErrors.fechaFin ? "border-rose-400/70" : "border-white/15"
                  }`}
                  value={form.fechaFin}
                  onChange={(e) => setForm({ ...form, fechaFin: e.target.value })}
                />
              </div>
            </div>
            {fieldErrors.fechaInicio || fieldErrors.fechaFin ? (
              <p className="text-xs text-rose-300">{fieldErrors.fechaInicio || fieldErrors.fechaFin}</p>
            ) : null}

            <button type="submit" disabled={isSubmitting} className="pf-button-primary w-full disabled:opacity-60">
              {isSubmitting ? "Guardando..." : editingId ? "Guardar cambios" : "Crear ciclo"}
            </button>

            {editingId ? (
              <button
                type="button"
                onClick={cancelEdit}
                className="w-full rounded-2xl border border-white/20 py-3 font-semibold text-[#c5d5de]"
              >
                Cancelar edición
              </button>
            ) : null}
          </form>
        </section>

        <section ref={listRef} className="rounded-[2rem] border border-white/10 bg-[#122530] p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 className="text-xl font-semibold text-white">Ciclos cargados</h4>
              <p className="mt-1 text-sm text-[#9fb6c4]">
                Priorizamos período, etapa, estado y fechas para que la lectura sea simple.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#0f1f28] px-4 py-3 text-right">
              <p className="text-xs uppercase tracking-[0.14em] text-[#7f99a8]">Registros</p>
              <p className="mt-1 text-lg font-semibold text-white">{visibleCycles.length}</p>
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
            {isLoading ? <p className="pf-alert-info">Cargando ciclos...</p> : null}
            {!isLoading && visibleCycles.length
              ? <CollapsibleList
                  items={visibleCycles}
                  initialCount={3}
                  buttonLabelMore={`Ver más (${visibleCycles.length - 3})`}
                  renderItem={(cycle) => (
                    <article key={cycle._id} className="rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-lg font-semibold text-white">
                          {cycle.periodo} {cycle.anio}
                        </p>
                        <span className="rounded-full bg-[#1e293b] px-3 py-1 text-xs text-[#b8c9d4]">
                          {formatStage(cycle.etapa)}
                        </span>
                        <span className="rounded-full bg-[#123224] px-3 py-1 text-xs text-[#8be6ac]">
                          {cycle.estado}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-[#9fb6c4]">
                        {cycle.fechaInicio ? new Date(cycle.fechaInicio).toLocaleDateString("es-AR") : "-"} al{" "}
                        {cycle.fechaFin ? new Date(cycle.fechaFin).toLocaleDateString("es-AR") : "-"}
                      </p>
                      <div className="mt-3 flex gap-2">
                        <button type="button" onClick={() => handleEdit(cycle)} className="rounded-xl border border-[#22c55e]/50 px-4 py-2 text-sm text-[#8be6ac]">
                          Editar
                        </button>
                        <button type="button" onClick={() => setConfirmState({ open: true, cycle })} className="rounded-xl border border-rose-300/40 px-4 py-2 text-sm text-rose-200">
                          Eliminar
                        </button>
                      </div>
                    </article>
                  )}
                />
              : null}
            {!isLoading && !visibleCycles.length ? (
              <p className="pf-alert-warning">
                {searchQuery ? "No encontramos ciclos para la búsqueda actual." : "Todavía no hay ciclos definidos."}
              </p>
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
