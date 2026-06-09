import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useView } from "../context/ViewContext";
import { apiFetch } from "../lib/api";
import { EmptyState, ErrorState, LoadingState } from "../components/AppStates";
import ConfirmDialog from "../components/ConfirmDialog";

const TIPO_TO_CATEGORIA = {
  TRANSVERSAL: "soft",
  DOCENTE: "soft",
  LIDERAZGO: "soft",
  PERSONALIZADA: "technical",
};

const COMPONENTE_TO_NIVEL = { C: "basic", A: "intermediate", H: "advanced" };

const TEMPLATES = {
  logistica: { label: "Logística y transporte", icon: "🚛", items: [
    { nombre: "Gestión de rutas", descripcion: "Planifica y optimiza rutas de distribución" },
    { nombre: "Seguridad operacional", descripcion: "Cumplimiento de normas de seguridad vial y de carga" },
    { nombre: "Orientación al cliente", descripcion: "Atención y resolución de problemas con clientes" },
    { nombre: "Trabajo en equipo", descripcion: "Colaboración en operaciones de depósito y distribución" },
    { nombre: "Gestión del tiempo", descripcion: "Cumplimiento de ventanas de entrega" },
  ]},
  tech: { label: "Tecnología / IT", icon: "💻", items: [
    { nombre: "Calidad de código", descripcion: "Escribe código mantenible, testeable y documentado" },
    { nombre: "Resolución de problemas", descripcion: "Diagnóstico y solución efectiva de incidentes técnicos" },
    { nombre: "Comunicación técnica", descripcion: "Explica conceptos complejos a audiencias no técnicas" },
    { nombre: "Aprendizaje continuo", descripcion: "Actualización proactiva en tecnologías relevantes" },
    { nombre: "Colaboración", descripcion: "Trabajo efectivo en equipo ágil o multidisciplinario" },
  ]},
  rrhh: { label: "Recursos Humanos", icon: "👥", items: [
    { nombre: "Gestión del talento", descripcion: "Identificación y desarrollo de potencial en el equipo" },
    { nombre: "Comunicación organizacional", descripcion: "Transmisión efectiva de políticas y cultura" },
    { nombre: "Resolución de conflictos", descripcion: "Mediación y solución de situaciones interpersonales" },
    { nombre: "Planificación", descripcion: "Organización de procesos de RRHH y calendarios" },
    { nombre: "Confidencialidad", descripcion: "Manejo responsable de información sensible" },
  ]},
};

const emptyForm = {
  nombre: "", descripcion: "", tipo: "TRANSVERSAL", componente: "C",
  audienceType: "all", audienceDepartmentCodes: [], audienceEmployeeIds: [],
  metadata: { docenteCategory: "", transversalCategory: "", descriptores: "" },
};

function StatCard({ label, value, accent }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0c1e28] px-5 py-4">
      <p className="text-xs text-[#7f99a8]">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent ? "text-[#14b8a6]" : "text-white"}`}>{value}</p>
    </div>
  );
}

function Badge({ children, variant = "default" }) {
  const cls = variant === "soft" ? "bg-violet-500/15 text-violet-200"
    : variant === "technical" ? "bg-sky-500/15 text-sky-200"
    : variant === "active" ? "bg-emerald-500/15 text-emerald-200"
    : variant === "inactive" ? "bg-white/10 text-[#9fb6c4]"
    : "bg-white/10 text-[#c7d5dc]";
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${cls}`}>{children}</span>;
}

export default function CompetenciesPage() {
  const { token } = useAuth();
  const { language, searchQuery } = useView();
  const L = (es, en) => language === "en" ? en : es;

  const [competencies, setCompetencies] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState({ open: false, editId: "" });
  const [form, setForm] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState({ text: "", type: "info" });
  const [confirmState, setConfirmState] = useState({ open: false, item: null });
  const [isDeleting, setIsDeleting] = useState(false);
  const [filters, setFilters] = useState({ q: "", categoria: "", nivel: "", estado: "" });
  const [templateModal, setTemplateModal] = useState({ open: false, selected: null });
  const [templateProgress, setTemplateProgress] = useState(null);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true); setError("");
      const [comp, emp] = await Promise.all([
        apiFetch("/competencies", { token }),
        apiFetch("/employees", { token }).catch(() => []),
      ]);
      setCompetencies(comp);
      setEmployees(emp || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = useMemo(() => {
    let list = competencies;
    const q = (filters.q || searchQuery || "").trim().toLowerCase();
    if (q) list = list.filter(c => [c.nombre, c.descripcion, c.tipo].filter(Boolean).some(v => String(v).toLowerCase().includes(q)));
    if (filters.categoria) {
      list = list.filter(c => {
        const cat = TIPO_TO_CATEGORIA[c.tipo] || "technical";
        return cat === filters.categoria;
      });
    }
    if (filters.nivel) list = list.filter(c => (COMPONENTE_TO_NIVEL[c.componente] || "basic") === filters.nivel);
    if (filters.estado) {
      list = list.filter(c => {
        const active = c.activa !== false;
        return filters.estado === "active" ? active : !active;
      });
    }
    return list;
  }, [competencies, filters, searchQuery]);

  const stats = useMemo(() => ({
    total: competencies.length,
    active: competencies.filter(c => c.activa !== false).length,
    technical: competencies.filter(c => (TIPO_TO_CATEGORIA[c.tipo] || "technical") === "technical").length,
    soft: competencies.filter(c => (TIPO_TO_CATEGORIA[c.tipo] || "technical") === "soft").length,
  }), [competencies]);

  const departmentOptions = useMemo(() =>
    [...new Set(employees.map(e => String(e.area || "").trim()).filter(Boolean))].sort()
  , [employees]);

  function openNew() {
    setForm(emptyForm);
    setModal({ open: true, editId: "" });
    setSubmitMsg({ text: "", type: "info" });
  }

  function openEdit(c) {
    setForm({
      nombre: c.nombre || "",
      descripcion: c.descripcion || "",
      tipo: c.tipo || "TRANSVERSAL",
      componente: c.componente || "C",
      audienceType: c.audienceType || "all",
      audienceDepartmentCodes: c.audienceDepartmentCodes || [],
      audienceEmployeeIds: (c.audienceEmployeeIds || []).map(e => String(e?._id || e)),
      metadata: { docenteCategory: c.metadata?.docenteCategory || "", transversalCategory: c.metadata?.transversalCategory || "", descriptores: c.metadata?.descriptores || "" },
    });
    setModal({ open: true, editId: c._id });
    setSubmitMsg({ text: "", type: "info" });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.nombre.trim()) { setSubmitMsg({ text: L("Completá el nombre.", "Name is required."), type: "warning" }); return; }
    try {
      setIsSubmitting(true); setSubmitMsg({ text: "", type: "info" });
      const editing = Boolean(modal.editId);
      await apiFetch(editing ? `/competencies/${modal.editId}` : "/competencies", {
        method: editing ? "PUT" : "POST",
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setModal({ open: false, editId: "" });
      await loadData();
    } catch (err) {
      setSubmitMsg({ text: err.message, type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    const item = confirmState.item;
    if (!item) return;
    try {
      setIsDeleting(true);
      await apiFetch(`/competencies/${item._id}`, { method: "DELETE", token });
      setConfirmState({ open: false, item: null });
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleCreateFromTemplate() {
    const tpl = TEMPLATES[templateModal.selected];
    if (!tpl) return;
    setTemplateProgress({ done: 0, total: tpl.items.length });
    let created = 0;
    for (const item of tpl.items) {
      try {
        await apiFetch("/competencies", {
          method: "POST", token,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nombre: item.nombre, descripcion: item.descripcion, tipo: "TRANSVERSAL", componente: "C", audienceType: "all", audienceDepartmentCodes: [], audienceEmployeeIds: [], metadata: { docenteCategory: "", transversalCategory: "", descriptores: "" } }),
        });
      } catch { /* continue */ }
      created++;
      setTemplateProgress({ done: created, total: tpl.items.length });
    }
    setTemplateModal({ open: false, selected: null });
    setTemplateProgress(null);
    await loadData();
  }

  function categoriaLabel(tipo) {
    const cat = TIPO_TO_CATEGORIA[tipo] || "technical";
    return cat === "soft" ? L("Blanda", "Soft") : L("Técnica", "Technical");
  }

  function nivelLabel(componente) {
    const n = COMPONENTE_TO_NIVEL[componente] || "basic";
    if (n === "basic") return L("Básico", "Basic");
    if (n === "intermediate") return L("Intermedio", "Intermediate");
    return L("Avanzado", "Advanced");
  }

  function audienceLabel(c) {
    if (c.audienceType === "department") return c.audienceDepartmentCodes?.length ? `Área: ${c.audienceDepartmentCodes.join(", ")}` : L("Área específica", "Specific area");
    if (c.audienceType === "employees" || c.audienceType === "singleEmployee") {
      const n = (c.audienceEmployeeIds || []).length;
      return `${n} ${L("empleado(s)", "employee(s)")}`;
    }
    return L("Toda la organización", "Entire organization");
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[#14b8a6]">{L("Modelo de desempeño", "Performance model")}</p>
          <h2 className="mt-0.5 text-xl font-semibold text-white">{L("Habilidades", "Skills")}</h2>
          <p className="mt-1 text-sm text-[#7f99a8]">{L("Gestioná las habilidades que se evalúan en la organización.", "Manage the skills evaluated in your organization.")}</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setTemplateModal({ open: true, selected: null })}
            className="rounded-xl border border-[#14b8a6]/40 bg-[#14b8a6]/10 px-4 py-2 text-sm font-medium text-[#14b8a6] transition hover:bg-[#14b8a6]/20">
            {L("Templates", "Templates")}
          </button>
          <button type="button" onClick={openNew}
            className="rounded-xl bg-[#14b8a6] px-4 py-2 text-sm font-semibold text-[#0f172a] transition hover:bg-[#0d9488]">
            + {L("Nueva habilidad", "New skill")}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label={L("Total", "Total")} value={stats.total}/>
        <StatCard label={L("Activas", "Active")} value={stats.active} accent/>
        <StatCard label={L("Técnicas", "Technical")} value={stats.technical}/>
        <StatCard label={L("Blandas", "Soft")} value={stats.soft}/>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="rounded-xl border border-white/10 bg-[#0c1e28] px-3 py-2 text-sm text-white placeholder:text-[#7f99a8] outline-none flex-1 min-w-[160px]"
          placeholder={L("Buscar habilidad…", "Search skill…")}
          value={filters.q}
          onChange={e => setFilters(f => ({ ...f, q: e.target.value }))}
        />
        <select className="rounded-xl border border-white/10 bg-[#0c1e28] px-3 py-2 text-sm text-white outline-none"
          value={filters.categoria} onChange={e => setFilters(f => ({ ...f, categoria: e.target.value }))}>
          <option value="">{L("Categoría", "Category")}</option>
          <option value="technical">{L("Técnica", "Technical")}</option>
          <option value="soft">{L("Blanda", "Soft")}</option>
        </select>
        <select className="rounded-xl border border-white/10 bg-[#0c1e28] px-3 py-2 text-sm text-white outline-none"
          value={filters.nivel} onChange={e => setFilters(f => ({ ...f, nivel: e.target.value }))}>
          <option value="">{L("Nivel", "Level")}</option>
          <option value="basic">{L("Básico", "Basic")}</option>
          <option value="intermediate">{L("Intermedio", "Intermediate")}</option>
          <option value="advanced">{L("Avanzado", "Advanced")}</option>
        </select>
        <select className="rounded-xl border border-white/10 bg-[#0c1e28] px-3 py-2 text-sm text-white outline-none"
          value={filters.estado} onChange={e => setFilters(f => ({ ...f, estado: e.target.value }))}>
          <option value="">{L("Estado", "Status")}</option>
          <option value="active">{L("Activa", "Active")}</option>
          <option value="inactive">{L("Inactiva", "Inactive")}</option>
        </select>
        {(filters.q || filters.categoria || filters.nivel || filters.estado) ? (
          <button type="button" onClick={() => setFilters({ q: "", categoria: "", nivel: "", estado: "" })}
            className="rounded-xl border border-white/10 px-3 py-2 text-sm text-[#9fb6c4] transition hover:bg-white/5">
            {L("Limpiar", "Clear")}
          </button>
        ) : null}
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-white/10 bg-[#0c1e28] overflow-hidden">
        {isLoading ? (
          <LoadingState compact title={L("Cargando habilidades…", "Loading skills…")} description=""/>
        ) : error ? (
          <ErrorState compact title={L("Error al cargar", "Failed to load")} description={error} actionLabel={L("Reintentar", "Retry")} onAction={loadData}/>
        ) : filtered.length === 0 ? (
          <EmptyState compact
            title={competencies.length === 0 ? L("Sin habilidades aún", "No skills yet") : L("Sin resultados", "No results")}
            description={competencies.length === 0 ? L("Creá la primera habilidad para comenzar.", "Create the first skill to get started.") : L("Probá ajustando los filtros.", "Try adjusting the filters.")}
            actionLabel={competencies.length === 0 ? L("+ Nueva habilidad", "+ New skill") : ""}
            onAction={competencies.length === 0 ? openNew : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  {[L("Habilidad", "Skill"), L("Categoría", "Category"), L("Descripción", "Description"), L("Nivel", "Level"), L("Alcance", "Scope"), L("Acciones", "Actions")].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-[#5e7d8e]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map(c => {
                  const cat = TIPO_TO_CATEGORIA[c.tipo] || "technical";
                  const active = c.activa !== false;
                  return (
                    <tr key={c._id} className="hover:bg-white/[0.02] transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-white">{c.nombre}</p>
                          {!active ? <Badge variant="inactive">{L("Inactiva", "Inactive")}</Badge> : null}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={cat === "soft" ? "soft" : "technical"}>{categoriaLabel(c.tipo)}</Badge>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <p className="text-[#9fb6c4] truncate">{c.descripcion || "—"}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[#c7d5dc]">{nivelLabel(c.componente)}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#9fb6c4]">{audienceLabel(c)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => openEdit(c)}
                            className="rounded-lg border border-white/10 px-2.5 py-1 text-xs text-[#c7d5dc] transition hover:bg-white/5">
                            {L("Editar", "Edit")}
                          </button>
                          <button type="button" onClick={() => setConfirmState({ open: true, item: c })}
                            className="rounded-lg border border-rose-300/30 px-2.5 py-1 text-xs text-rose-300 transition hover:bg-rose-500/10">
                            {L("Eliminar", "Delete")}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {modal.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0c1e28] p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">{modal.editId ? L("Editar habilidad", "Edit skill") : L("Nueva habilidad", "New skill")}</h3>
              <button type="button" onClick={() => setModal({ open: false, editId: "" })}
                className="flex h-7 w-7 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-[#8ea5b3] transition hover:text-white" aria-label="Cerrar">
                <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3"><path d="M2 2l8 8M10 2l-8 8"/></svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs text-[#7f99a8]">{L("Nombre *", "Name *")}</label>
                <input className="w-full rounded-xl border border-white/10 bg-[#12222d] px-3 py-2.5 text-sm text-white outline-none focus:border-[#14b8a6]/40"
                  placeholder={L("Ej: Comunicación efectiva", "E.g. Effective communication")}
                  value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}/>
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#7f99a8]">{L("Descripción", "Description")}</label>
                <textarea className="w-full rounded-xl border border-white/10 bg-[#12222d] px-3 py-2.5 text-sm text-white outline-none focus:border-[#14b8a6]/40 min-h-20 resize-none"
                  placeholder={L("Definición de la habilidad…", "Skill definition…")}
                  value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-[#7f99a8]">{L("Categoría", "Category")}</label>
                  <select className="w-full rounded-xl border border-white/10 bg-[#12222d] px-3 py-2.5 text-sm text-white outline-none"
                    value={TIPO_TO_CATEGORIA[form.tipo] === "soft" ? "soft" : "technical"}
                    onChange={e => setForm(f => ({ ...f, tipo: e.target.value === "soft" ? "TRANSVERSAL" : "PERSONALIZADA" }))}>
                    <option value="soft">{L("Blanda", "Soft")}</option>
                    <option value="technical">{L("Técnica", "Technical")}</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[#7f99a8]">{L("Nivel", "Level")}</label>
                  <select className="w-full rounded-xl border border-white/10 bg-[#12222d] px-3 py-2.5 text-sm text-white outline-none"
                    value={form.componente}
                    onChange={e => setForm(f => ({ ...f, componente: e.target.value }))}>
                    <option value="C">{L("Básico", "Basic")}</option>
                    <option value="A">{L("Intermedio", "Intermediate")}</option>
                    <option value="H">{L("Avanzado", "Advanced")}</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#7f99a8]">{L("Alcance", "Scope")}</label>
                <select className="w-full rounded-xl border border-white/10 bg-[#12222d] px-3 py-2.5 text-sm text-white outline-none"
                  value={form.audienceType}
                  onChange={e => setForm(f => ({ ...f, audienceType: e.target.value, audienceDepartmentCodes: [], audienceEmployeeIds: [] }))}>
                  <option value="all">{L("Toda la organización", "Entire organization")}</option>
                  <option value="department">{L("Área específica", "Specific area")}</option>
                  <option value="employees">{L("Grupo de empleados", "Employee group")}</option>
                </select>
              </div>
              {form.audienceType === "department" ? (
                <div>
                  <label className="mb-1 block text-xs text-[#7f99a8]">{L("Área", "Area")}</label>
                  <select className="w-full rounded-xl border border-white/10 bg-[#12222d] px-3 py-2.5 text-sm text-white outline-none"
                    value={form.audienceDepartmentCodes[0] || ""}
                    onChange={e => setForm(f => ({ ...f, audienceDepartmentCodes: e.target.value ? [e.target.value] : [] }))}>
                    <option value="">{L("Seleccioná un área", "Select an area")}</option>
                    {departmentOptions.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              ) : null}
              {submitMsg.text ? (
                <p className={`text-sm px-3 py-2 rounded-xl ${submitMsg.type === "error" ? "bg-rose-500/10 text-rose-200" : submitMsg.type === "warning" ? "bg-amber-500/10 text-amber-200" : "bg-[#14b8a6]/10 text-[#14b8a6]"}`}>{submitMsg.text}</p>
              ) : null}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setModal({ open: false, editId: "" })}
                  className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm text-[#c7d5dc] transition hover:bg-white/5">
                  {L("Cancelar", "Cancel")}
                </button>
                <button type="submit" disabled={isSubmitting}
                  className="flex-1 rounded-xl bg-[#14b8a6] py-2.5 text-sm font-semibold text-[#0f172a] transition hover:bg-[#0d9488] disabled:opacity-60">
                  {isSubmitting ? L("Guardando…", "Saving…") : modal.editId ? L("Guardar cambios", "Save changes") : L("Crear habilidad", "Create skill")}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Templates modal */}
      {templateModal.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0c1e28] p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">{L("Templates de industria", "Industry templates")}</h3>
              <button type="button" onClick={() => { setTemplateModal({ open: false, selected: null }); setTemplateProgress(null); }}
                className="flex h-7 w-7 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-[#8ea5b3] transition hover:text-white">
                <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3"><path d="M2 2l8 8M10 2l-8 8"/></svg>
              </button>
            </div>
            {!templateModal.selected ? (
              <>
                <p className="mb-4 text-sm text-[#9fb6c4]">{L("Elegí un template para pre-cargar habilidades típicas de tu industria.", "Choose a template to pre-load typical skills for your industry.")}</p>
                <div className="grid grid-cols-3 gap-3">
                  {Object.entries(TEMPLATES).map(([key, tpl]) => (
                    <button key={key} type="button" onClick={() => setTemplateModal(p => ({ ...p, selected: key }))}
                      className="flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-[#122530] p-4 text-center transition hover:border-[#14b8a6]/40 hover:bg-[#14b8a6]/10">
                      <span className="text-2xl">{tpl.icon}</span>
                      <span className="text-xs font-medium text-[#d6e2e8]">{tpl.label}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <button type="button" onClick={() => setTemplateModal(p => ({ ...p, selected: null }))} className="mb-4 text-sm text-[#14b8a6] hover:underline">
                  ← {L("Volver", "Back")}
                </button>
                <p className="mb-3 text-sm font-semibold text-white">{TEMPLATES[templateModal.selected].icon} {TEMPLATES[templateModal.selected].label}</p>
                <div className="mb-5 space-y-2">
                  {TEMPLATES[templateModal.selected].items.map(item => (
                    <div key={item.nombre} className="rounded-xl border border-white/10 bg-[#122530] px-3 py-2.5">
                      <p className="text-sm font-medium text-white">{item.nombre}</p>
                      <p className="mt-0.5 text-xs text-[#9fb6c4]">{item.descripcion}</p>
                    </div>
                  ))}
                </div>
                {templateProgress ? (
                  <div className="rounded-xl border border-white/10 bg-[#122530] px-4 py-3 text-sm text-[#14b8a6]">
                    {L("Creando", "Creating")} {templateProgress.done}/{templateProgress.total}…
                  </div>
                ) : (
                  <button type="button" onClick={handleCreateFromTemplate}
                    className="w-full rounded-xl bg-[#14b8a6] py-2.5 text-sm font-semibold text-[#0f172a] transition hover:bg-[#0d9488]">
                    {L("Crear habilidades", "Create skills")} ({TEMPLATES[templateModal.selected].items.length})
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmState.open}
        title={L("¿Eliminar esta habilidad?", "Delete this skill?")}
        message={confirmState.item ? `${L("Vas a eliminar", "You're deleting")} "${confirmState.item.nombre}".` : ""}
        confirmLabel={L("Eliminar", "Delete")}
        cancelLabel={L("Cancelar", "Cancel")}
        destructive loading={isDeleting}
        onCancel={() => setConfirmState({ open: false, item: null })}
        onConfirm={handleDelete}
      />
    </div>
  );
}
