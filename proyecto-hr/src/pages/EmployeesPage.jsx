import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { apiFetch, apiUrl } from "../lib/api";
import { useView } from "../context/ViewContext";
import { EmptyState, ErrorState, LoadingState } from "../components/AppStates";
import ConfirmDialog from "../components/ConfirmDialog";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// Chart color palette for competency lines
const CHART_COLORS = [
  "#14b8a6", // teal
  "#60a5fa", // blue
  "#f472b6", // pink
  "#a78bfa", // violet
  "#fb923c", // orange
  "#34d399", // emerald
  "#fbbf24", // amber
  "#f87171", // red
];

const PAGE_SIZE = 10;

const AREA_BADGE_STYLES = {
  ventas:      "bg-blue-500/15 text-blue-300 border-blue-400/30",
  comercial:   "bg-blue-500/15 text-blue-300 border-blue-400/30",
  tecnología:  "bg-emerald-500/15 text-emerald-300 border-emerald-400/30",
  tecnologia:  "bg-emerald-500/15 text-emerald-300 border-emerald-400/30",
  tech:        "bg-emerald-500/15 text-emerald-300 border-emerald-400/30",
  sistemas:    "bg-emerald-500/15 text-emerald-300 border-emerald-400/30",
  rrhh:        "bg-purple-500/15 text-purple-300 border-purple-400/30",
  "recursos humanos": "bg-purple-500/15 text-purple-300 border-purple-400/30",
  marketing:   "bg-pink-500/15 text-pink-300 border-pink-400/30",
  finanzas:    "bg-amber-500/15 text-amber-300 border-amber-400/30",
  administración: "bg-amber-500/15 text-amber-300 border-amber-400/30",
  administracion: "bg-amber-500/15 text-amber-300 border-amber-400/30",
  operaciones: "bg-orange-500/15 text-orange-300 border-orange-400/30",
  dirección:   "bg-violet-500/15 text-violet-300 border-violet-400/30",
  direccion:   "bg-violet-500/15 text-violet-300 border-violet-400/30",
};

function getAreaBadgeStyle(area) {
  if (!area) return "bg-white/10 text-[#9fb6c4] border-white/15";
  const key = area.toLowerCase().trim();
  for (const [pattern, style] of Object.entries(AREA_BADGE_STYLES)) {
    if (key.includes(pattern)) return style;
  }
  return "bg-white/10 text-[#9fb6c4] border-white/15";
}

function CustomEvolutionTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-[#0a1a22] p-3 text-xs shadow-xl max-w-xs">
      <p className="mb-1 font-semibold text-[#14b8a6]">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="mt-1">
          <span style={{ color: entry.color }} className="font-medium">{entry.name}:</span>{" "}
          <span className="text-white">{entry.value}</span>
          {entry.payload?.[`${entry.dataKey}_comentario`] ? (
            <p className="mt-0.5 text-[#9fb6c4] italic">
              "{entry.payload[`${entry.dataKey}_comentario`]}"
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function EvolutionPanel({ employeeId, token }) {
  const [state, setState] = useState({ status: "idle", data: null, error: null });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading", data: null, error: null });
    apiFetch(`/employees/${employeeId}/evolution`, { token })
      .then((data) => {
        if (!cancelled) setState({ status: "done", data, error: null });
      })
      .catch((err) => {
        if (!cancelled) setState({ status: "error", data: null, error: err.message });
      });
    return () => { cancelled = true; };
  }, [employeeId, token]);

  if (state.status === "loading") {
    return (
      <div className="mt-3 flex items-center gap-3 rounded-xl border border-white/10 bg-[#060f14] px-4 py-4">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0 animate-spin text-[#14b8a6]">
          <circle cx="8" cy="8" r="6" strokeDasharray="28" strokeDashoffset="10"/>
        </svg>
        <p className="text-xs text-[#9fb6c4]">Cargando historial de evaluaciones…</p>
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div className="mt-3 flex items-start gap-3 rounded-xl border border-rose-300/20 bg-rose-500/8 px-4 py-4">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-4 w-4 shrink-0 text-rose-300 mt-0.5">
          <circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>
        </svg>
        <div>
          <p className="text-xs font-semibold text-rose-200">No se pudo cargar la evolución</p>
          <p className="mt-0.5 text-xs text-rose-300/80">{state.error}</p>
        </div>
      </div>
    );
  }
  if (!state.data) return null;

  const cycles = Array.isArray(state.data?.cycles) ? state.data.cycles : [];

  if (!cycles.length) {
    return (
      <div className="mt-3 flex items-start gap-3 rounded-xl border border-white/10 bg-[#060f14] px-4 py-4">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5 shrink-0 text-[#7a9aaa] mt-0.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
        </svg>
        <div>
          <p className="text-xs font-semibold text-white">Sin historial de evaluaciones cerradas</p>
          <p className="mt-0.5 text-xs text-[#9fb6c4]">La evolución aparecerá cuando se cierren ciclos de evaluación para este empleado.</p>
        </div>
      </div>
    );
  }

  // Collect all unique competency names
  const competencySet = new Set();
  cycles.forEach((c) => c.scores.forEach((s) => competencySet.add(s.competencia)));
  const competencies = Array.from(competencySet);

  // Build chart data: one row per cycle
  const chartData = cycles.map((c) => {
    const row = { periodo: c.periodo };
    c.scores.forEach((s) => {
      const key = s.competencia;
      row[key] = s.nivel;
      if (s.comentario) row[`${key}_comentario`] = s.comentario;
    });
    return row;
  });

  // Summary stats
  const lastCycle = cycles[cycles.length - 1];
  const prevCycle = cycles.length >= 2 ? cycles[cycles.length - 2] : null;
  const promedioActual = lastCycle.resultadoFinal
    ? Number(lastCycle.resultadoFinal).toFixed(1)
    : lastCycle.scores.length
    ? (lastCycle.scores.reduce((s, x) => s + x.nivel, 0) / lastCycle.scores.length).toFixed(1)
    : "—";

  let tendencia = "→";
  if (prevCycle && lastCycle.resultadoFinal != null && prevCycle.resultadoFinal != null) {
    const diff = lastCycle.resultadoFinal - prevCycle.resultadoFinal;
    if (diff > 0.05) tendencia = "↑";
    else if (diff < -0.05) tendencia = "↓";
  }

  const useLine = cycles.length > 1;

  return (
    <div className="mt-3 space-y-3">
      {/* Summary stats */}
      <div className="flex flex-wrap gap-4 rounded-xl border border-white/10 bg-[#060f14] px-4 py-3 text-xs">
        <div>
          <span className="text-[#9fb6c4]">Promedio actual</span>
          <p className="mt-0.5 text-base font-bold text-[#14b8a6]">{promedioActual}</p>
        </div>
        <div>
          <span className="text-[#9fb6c4]">Tendencia</span>
          <p className={`mt-0.5 text-base font-bold ${tendencia === "↑" ? "text-emerald-400" : tendencia === "↓" ? "text-rose-400" : "text-[#9fb6c4]"}`}>
            {tendencia}
          </p>
        </div>
        <div>
          <span className="text-[#9fb6c4]">Ciclos evaluados</span>
          <p className="mt-0.5 text-base font-bold text-white">{cycles.length}</p>
        </div>
      </div>

      {/* Chart */}
      <div className="rounded-xl border border-white/10 bg-[#060f14] p-3">
        <ResponsiveContainer width="100%" height={220}>
          {useLine ? (
            <LineChart data={chartData} margin={{ top: 8, right: 16, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="periodo" tick={{ fill: "#9fb6c4", fontSize: 11 }} />
              <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fill: "#9fb6c4", fontSize: 11 }} />
              <Tooltip content={<CustomEvolutionTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, color: "#9fb6c4" }} />
              {competencies.map((comp, i) => (
                <Line
                  key={comp}
                  type="monotone"
                  dataKey={comp}
                  name={comp}
                  stroke={CHART_COLORS[i % CHART_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 4, fill: CHART_COLORS[i % CHART_COLORS.length] }}
                  activeDot={{ r: 6 }}
                />
              ))}
            </LineChart>
          ) : (
            <BarChart data={chartData} margin={{ top: 8, right: 16, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="periodo" tick={{ fill: "#9fb6c4", fontSize: 11 }} />
              <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fill: "#9fb6c4", fontSize: 11 }} />
              <Tooltip content={<CustomEvolutionTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, color: "#9fb6c4" }} />
              {competencies.map((comp, i) => (
                <Bar
                  key={comp}
                  dataKey={comp}
                  name={comp}
                  fill={CHART_COLORS[i % CHART_COLORS.length]}
                  radius={[4, 4, 0, 0]}
                />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

const emptyForm = {
  schoolId: "",
  nombre: "",
  apellido: "",
  email: "",
  cargo: "",
  area: "",
  tipoEmpleado: "DOCENTE",
  managerId: "",
  fechaIngreso: "",
  roleId: "",
  password: "",
};

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("es-AR", { dateStyle: "medium" });
}

export default function EmployeesPage() {
  const { token } = useAuth();
  const { addToast } = useToast();
  const { setView, searchQuery } = useView();
  const [employees, setEmployees] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [schools, setSchools] = useState([]);
  const [roles, setRoles] = useState([]);
  const [filters, setFilters] = useState({ q: "", schoolId: "" });
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [confirmState, setConfirmState] = useState({ open: false, mode: "", employee: null, count: 0 });
  const [isDeleting, setIsDeleting] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [evolutionOpenId, setEvolutionOpenId] = useState(null);
  const [isError, setIsError] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const initialSchoolSet = useRef(false);

  const deferredSearch = useDeferredValue(filters.q);
  const appliedFilters = useMemo(
    () => ({ ...filters, q: deferredSearch }),
    [filters, deferredSearch]
  );

  const filteredEmployees = useMemo(() => {
    const safeEmployees = Array.isArray(employees) ? employees : [];
    const term = String(searchQuery || "").trim().toLowerCase();
    if (!term) return safeEmployees;
    return safeEmployees.filter((employee) =>
      [employee.nombre, employee.apellido, employee.email, employee.cargo, employee.area]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(term))
    );
  }, [employees, searchQuery]);

  const allVisibleSelected =
    filteredEmployees.length > 0 &&
    filteredEmployees.every((emp) => selectedIds.includes(emp._id));

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const employeesById = useMemo(
    () => new Map((Array.isArray(employees) ? employees : []).map((employee) => [employee._id, employee])),
    [employees]
  );
  const availableRoles = useMemo(
    () => roles.filter((role) => String(role.code || role.nombre || "").toUpperCase() !== "SUPER_ADMIN"),
    [roles]
  );

  function buildEmployeeQuery(nextFilters, page) {
    const params = new URLSearchParams();
    if (nextFilters.q.trim()) params.set("q", nextFilters.q.trim());
    if (nextFilters.schoolId) params.set("schoolId", nextFilters.schoolId);
    params.set("page", String(page || 1));
    params.set("limit", String(PAGE_SIZE));
    return `?${params.toString()}`;
  }

  function buildExportQuery(nextFilters) {
    const params = new URLSearchParams();
    if (nextFilters.q.trim()) params.set("q", nextFilters.q.trim());
    if (nextFilters.schoolId) params.set("schoolId", nextFilters.schoolId);
    const query = params.toString();
    return query ? `?${query}` : "";
  }

  const loadBase = useCallback(async (page) => {
    try {
      setIsLoading(true);
      setIsError(false);
      const pageToLoad = page || currentPage;
      const [schoolsData, employeesResponse, rolesData] = await Promise.all([
        apiFetch("/schools", { token }),
        apiFetch(`/employees${buildEmployeeQuery(appliedFilters, pageToLoad)}`, { token }),
        apiFetch("/roles", { token }),
      ]);
      const safeSchools = Array.isArray(schoolsData) ? schoolsData : [];
      setSchools(safeSchools);
      // Support both a plain array response and a { employees, total } envelope
      if (Array.isArray(employeesResponse)) {
        setEmployees(employeesResponse);
        setTotalCount(employeesResponse.length);
      } else {
        setEmployees(Array.isArray(employeesResponse.employees) ? employeesResponse.employees : []);
        setTotalCount(typeof employeesResponse.total === "number" ? employeesResponse.total : 0);
      }
      setRoles(Array.isArray(rolesData) ? rolesData : []);
      if (!initialSchoolSet.current && safeSchools[0]?._id) {
        initialSchoolSet.current = true;
        setForm((current) => ({ ...current, schoolId: schoolsData[0]._id }));
      }
    } catch (error) {
      setIsError(true);
      setMessageType("error");
      setMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedFilters, token]);

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [appliedFilters]);

  useEffect(() => {
    loadBase(currentPage);
  }, [loadBase, currentPage]);

  async function exportEmployeesCsv() {
    try {
      setIsExporting(true);
      const queryString = buildExportQuery(appliedFilters);
      const response = await fetch(`${apiUrl}/employees/export${queryString}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error("No se pudo exportar la lista de empleados");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "empleados.csv";
      anchor.click();
      window.URL.revokeObjectURL(url);
      addToast({ message: "Exportación generada correctamente.", type: "success" });
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    } finally {
      setIsExporting(false);
    }
  }

  function toggleSelection(employeeId) {
    setSelectedIds((current) =>
      current.includes(employeeId)
        ? current.filter((id) => id !== employeeId)
        : [...current, employeeId]
    );
  }

  function toggleSelectAll() {
    if (allVisibleSelected) {
      setSelectedIds((current) =>
        current.filter((id) => !filteredEmployees.some((emp) => emp._id === id))
      );
      return;
    }
    setSelectedIds((current) => {
      const next = new Set(current);
      filteredEmployees.forEach((emp) => next.add(emp._id));
      return [...next];
    });
  }

  async function runBulkAction(action) {
    if (!selectedIds.length) {
      addToast({ message: "Selecciona al menos un empleado.", type: "warning" });
      return;
    }
    if (action === "delete") {
      setConfirmState({ open: true, mode: "bulk-delete", employee: null, count: selectedIds.length });
      return;
    }
    try {
      const data = await apiFetch("/employees/bulk", {
        method: "POST",
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, employeeIds: selectedIds }),
      });
      addToast({ message: data.mensaje || "Acción masiva aplicada.", type: "success" });
      setSelectedIds([]);
      await loadBase(currentPage);
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = {};
    if (!form.nombre?.trim()) nextErrors.nombre = "Nombre obligatorio.";
    if (!form.apellido?.trim()) nextErrors.apellido = "Apellido obligatorio.";
    if (!form.cargo?.trim()) nextErrors.cargo = "Cargo obligatorio.";
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setMessageType("warning");
      setMessage("Completa nombre, apellido y cargo para guardar.");
      return;
    }
    try {
      setIsSubmitting(true);
      setMessage("");
      setTemporaryPassword("");
      const isEditing = Boolean(editingId);
      const data = await apiFetch(isEditing ? `/employees/${editingId}` : "/employees", {
        method: isEditing ? "PUT" : "POST",
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setForm((current) => ({ ...emptyForm, schoolId: current.schoolId }));
      setEditingId("");
      setFieldErrors({});
      setMessageType("success");
      setMessage(isEditing ? "Empleado actualizado correctamente." : "Empleado creado correctamente.");
      addToast({ message: isEditing ? "Empleado actualizado." : "Empleado creado.", type: "success" });
      if (!isEditing && data?.temporaryPassword) {
        setTemporaryPassword(data.temporaryPassword);
      }
      await loadBase(currentPage);
    } catch (error) {
      setMessageType("error");
      setMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleEdit(employee) {
    setEditingId(employee._id);
    setForm({
      schoolId: employee.schoolId || "",
      nombre: employee.nombre || "",
      apellido: employee.apellido || "",
      email: employee.email || "",
      cargo: employee.cargo || "",
      area: employee.area || "",
      tipoEmpleado: employee.tipoEmpleado || "DOCENTE",
      managerId: employee.managerId || "",
      fechaIngreso: employee.fechaIngreso ? new Date(employee.fechaIngreso).toISOString().slice(0, 10) : "",
      roleId: "",
      password: "",
    });
    setMessageType("info");
    setMessage("Editando empleado seleccionado.");
    setFieldErrors({});
  }

  function cancelEdit() {
    setEditingId("");
    setForm((current) => ({ ...emptyForm, schoolId: current.schoolId }));
    setMessageType("info");
    setMessage("Edición cancelada.");
    setFieldErrors({});
  }

  async function confirmDeleteEmployee() {
    const employee = confirmState.employee;
    if (!employee) return;
    try {
      setIsDeleting(true);
      await apiFetch(`/employees/${employee._id}`, { method: "DELETE", token });
      if (editingId === employee._id) {
        cancelEdit();
      }
      setConfirmState({ open: false, mode: "", employee: null, count: 0 });
      setMessageType("success");
      setMessage("Empleado eliminado.");
      addToast({ message: "Empleado eliminado.", type: "success" });
      await loadBase(currentPage);
    } catch (error) {
      setMessageType("error");
      setMessage(error.message);
    } finally {
      setIsDeleting(false);
    }
  }

  async function confirmBulkDelete() {
    try {
      setIsDeleting(true);
      const data = await apiFetch("/employees/bulk", {
        method: "POST",
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", employeeIds: selectedIds }),
      });
      addToast({ message: data.mensaje || "Empleados eliminados.", type: "success" });
      setSelectedIds([]);
      setConfirmState({ open: false, mode: "", employee: null, count: 0 });
      await loadBase(currentPage);
    } catch (error) {
      addToast({ message: error.message, type: "error" });
    } finally {
      setIsDeleting(false);
    }
  }

  function handleConfirmAction() {
    if (confirmState.mode === "bulk-delete") return confirmBulkDelete();
    return confirmDeleteEmployee();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[#14b8a6]">Talento</p>
          <h2 className="mt-1 text-xl font-semibold text-white">Personas</h2>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="pf-card p-6">
          <h4 className="text-xl font-semibold text-white">{editingId ? "Editar empleado" : "Nuevo empleado"}</h4>
          <p className="mt-2 text-sm text-[#9fb6c4]">Completa los datos mínimos y guarda. Luego puedes editar cuando quieras.</p>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-[#9fb6c4]">Nombre</label>
                <input className={`pf-input ${fieldErrors.nombre ? "border-rose-400/70" : ""}`} placeholder="Ej: Mateo" value={form.nombre} onChange={(event) => setForm({ ...form, nombre: event.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#9fb6c4]">Apellido</label>
                <input className={`pf-input ${fieldErrors.apellido ? "border-rose-400/70" : ""}`} placeholder="Ej: Sánchez" value={form.apellido} onChange={(event) => setForm({ ...form, apellido: event.target.value })} />
              </div>
            </div>
            {(fieldErrors.nombre || fieldErrors.apellido) ? <p className="text-xs text-rose-300">{fieldErrors.nombre || fieldErrors.apellido}</p> : null}

            <div>
              <label className="mb-1 block text-xs text-[#9fb6c4]">Correo institucional</label>
              <input className="pf-input" placeholder="Ej: nombre@colegio.com" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
              <div className="mt-2 rounded-xl border border-[#14B8A6]/30 bg-[#14B8A6]/10 px-3 py-2 text-xs text-[#7de8dc]">
                Si completás el email, se crea automáticamente un usuario con acceso a la plataforma.
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-[#9fb6c4]">Cargo</label>
                <input className={`pf-input ${fieldErrors.cargo ? "border-rose-400/70" : ""}`} placeholder="Ej: Docente de Matemática" value={form.cargo} onChange={(event) => setForm({ ...form, cargo: event.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#9fb6c4]">Área / Departamento</label>
                <input className="pf-input" placeholder="Ej: Ciencias Exactas" value={form.area} onChange={(event) => setForm({ ...form, area: event.target.value })} />
              </div>
            </div>
            {fieldErrors.cargo ? <p className="text-xs text-rose-300">{fieldErrors.cargo}</p> : null}

            {!editingId ? (
              <div className="rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
                <p className="mb-3 text-xs uppercase tracking-[0.08em] text-[#9fb6c4]">Crear usuario (opcional)</p>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs text-[#9fb6c4]">Rol del usuario</label>
                    <select className="pf-select" value={form.roleId} onChange={(event) => setForm({ ...form, roleId: event.target.value })}>
                      <option value="">Sin acceso</option>
                      {availableRoles.map((role) => (
                        <option key={role._id} value={role._id}>
                          {role.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-[#9fb6c4]">Contraseña (opcional)</label>
                    <input className="pf-input" type="password" placeholder="Auto-generada si se deja vacío" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
                  </div>
                </div>
                <p className="mt-2 text-xs text-[#7f99a8]">Elegí un rol y contraseña para que el empleado acceda a la plataforma.</p>
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-[#9fb6c4]">Tipo de perfil</label>
                <select className="pf-select" value={form.tipoEmpleado} onChange={(event) => setForm({ ...form, tipoEmpleado: event.target.value })}>
                  <option value="DOCENTE">Docente</option>
                  <option value="NO_DOCENTE">No docente</option>
                  <option value="DIRECTIVO">Directivo</option>
                  <option value="RRHH">RRHH</option>
                  <option value="OTRO">Otro</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#9fb6c4]">Fecha de ingreso</label>
                <input type="date" className="pf-input" value={form.fechaIngreso} onChange={(event) => setForm({ ...form, fechaIngreso: event.target.value })} />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs text-[#9fb6c4]">Responsable directo</label>
              <select className="pf-select" value={form.managerId} onChange={(event) => setForm({ ...form, managerId: event.target.value })}>
                <option value="">Sin jefe asignado</option>
                {(Array.isArray(employees) ? employees : []).map((employee) => (
                  <option key={employee._id} value={employee._id}>
                    {employee.apellido}, {employee.nombre}
                  </option>
                ))}
              </select>
            </div>

            <button type="submit" disabled={isSubmitting} className="pf-button-primary w-full">
              {isSubmitting ? "Guardando..." : editingId ? "Guardar cambios" : "Crear empleado"}
            </button>
            {editingId ? (
              <button type="button" onClick={cancelEdit} className="pf-button-secondary w-full">
                Cancelar edición
              </button>
            ) : null}
          </form>
        </section>

        <section className="pf-card p-6">
          <div className="mb-4 rounded-xl border border-white/10 bg-[#0f1f28] p-3">
            <p className="text-xs uppercase tracking-[0.14em] text-[#9fb6c4]">Atajos útiles</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => setView("competencias")} className="rounded-lg border border-white/20 px-3 py-2 text-xs text-[#c5d5de]">Competencias</button>
              <button type="button" onClick={() => setView("metricas")} className="rounded-lg border border-white/20 px-3 py-2 text-xs text-[#c5d5de]">Indicadores</button>
              <button type="button" onClick={() => setView("ciclos")} className="rounded-lg border border-white/20 px-3 py-2 text-xs text-[#c5d5de]">Períodos</button>
              <button type="button" onClick={() => setView("evaluaciones")} className="rounded-lg border border-white/20 px-3 py-2 text-xs text-[#c5d5de]">Evaluación</button>
            </div>
          </div>

          {/* Filters row + Export CSV button */}
          <div className="flex flex-wrap items-end gap-3">
            <input
              className="pf-input min-w-48 flex-1"
              placeholder="Buscar por nombre, cargo o mail"
              value={filters.q}
              onChange={(event) => setFilters({ ...filters, q: event.target.value })}
            />
            <select
              className="pf-select min-w-48"
              value={filters.schoolId}
              onChange={(event) => setFilters({ ...filters, schoolId: event.target.value })}
            >
              <option value="">Todos los colegios</option>
              {(Array.isArray(schools) ? schools : []).map((school) => (
                <option key={school._id} value={school._id}>
                  {school.nombre}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={exportEmployeesCsv}
              disabled={isExporting}
              className="flex shrink-0 items-center gap-2 rounded-2xl border border-[#14b8a6]/40 bg-[#14b8a6]/10 px-4 py-2.5 text-sm font-medium text-[#14b8a6] transition hover:bg-[#14b8a6]/20 disabled:cursor-wait disabled:opacity-60"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {isExporting ? "Exportando..." : "Exportar CSV"}
            </button>
          </div>
          {filters.q !== deferredSearch ? (
            <p className="mt-2 text-xs text-[#9fb6c4]">Actualizando búsqueda...</p>
          ) : null}

          {/* Bulk action bar */}
          <div className="mt-4 rounded-xl border border-white/10 bg-[#0f1f28] p-3">
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-[#9fb6c4]">
                <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll} />
                Seleccionar visibles
              </label>
              <span className="text-sm text-[#9fb6c4]">{selectedIds.length} seleccionados</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-3">
              <button type="button" onClick={() => runBulkAction("activate")} className="rounded-xl border border-white/15 px-4 py-2 text-sm text-[#c5d5de] transition hover:bg-white/5">
                Activar
              </button>
              <button type="button" onClick={() => runBulkAction("deactivate")} className="rounded-xl border border-amber-300/40 px-4 py-2 text-sm text-amber-200">
                Desactivar
              </button>
              <button type="button" onClick={() => runBulkAction("delete")} className="rounded-xl border border-rose-300/40 px-4 py-2 text-sm text-rose-200">
                Eliminar seleccionados
              </button>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {isLoading ? (
              <LoadingState
                compact
                title="Cargando empleados"
                description="Estamos actualizando la nomina y sus responsables."
              />
            ) : null}
            {!isLoading && isError ? (
              <ErrorState
                compact
                title="No pudimos cargar los empleados"
                description={employees.length ? "Los datos mostrados pueden estar desactualizados. Reintenta para actualizar la lista." : "Reintenta para recuperar la lista de personas."}
                actionLabel="Reintentar"
                onAction={() => loadBase(currentPage)}
              />
            ) : null}
            {!isLoading && filteredEmployees.length ? (
              <>
                {filteredEmployees.map((employee) => {
                  const manager = employeesById.get(employee.managerId);
                  return (
                    <article key={employee._id} className="rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
                      <div className="flex items-start gap-3">
                        <label className="mt-1 flex shrink-0 items-center">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(employee._id)}
                            onChange={() => toggleSelection(employee._id)}
                          />
                        </label>
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#14b8a6]/15 text-sm font-bold text-[#14b8a6]">
                          {(employee.nombre?.[0] || "").toUpperCase()}{(employee.apellido?.[0] || "").toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-white truncate">{employee.apellido}, {employee.nombre}</p>
                            <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${employee.activo === false ? "border-white/15 bg-white/5 text-[#9fb6c4]" : "border-emerald-400/30 bg-emerald-500/15 text-emerald-300"}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${employee.activo === false ? "bg-[#9fb6c4]" : "bg-emerald-400"}`} />
                              {employee.activo === false ? "Inactivo" : "Activo"}
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            {employee.cargo ? (
                              <span className="text-xs text-[#9fb6c4]">{employee.cargo}</span>
                            ) : null}
                            {employee.cargo && employee.area ? (
                              <span className="text-[#6a8a9a] text-xs">·</span>
                            ) : null}
                            {employee.area ? (
                              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${getAreaBadgeStyle(employee.area)}`}>
                                {employee.area}
                              </span>
                            ) : null}
                            {employee.tipoEmpleado ? (
                              <span className="text-xs text-[#6a8a9a]">· {employee.tipoEmpleado}</span>
                            ) : null}
                          </div>
                          <p className="mt-0.5 text-xs text-[#6a8a9a]">
                            {manager ? `Jefe: ${manager.apellido}, ${manager.nombre}` : "Sin jefe asignado"}
                            {employee.fechaIngreso ? ` · Ingreso: ${formatDate(employee.fechaIngreso)}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" onClick={() => handleEdit(employee)} className="rounded-xl border border-white/15 px-4 py-2 text-sm text-[#c5d5de] transition hover:bg-white/5">
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => setEvolutionOpenId((prev) => prev === employee._id ? null : employee._id)}
                          className={`rounded-xl border px-4 py-2 text-sm transition ${evolutionOpenId === employee._id ? "border-[#14b8a6]/60 bg-[#14b8a6]/15 text-[#14b8a6]" : "border-white/15 text-[#c5d5de] hover:bg-white/5"}`}
                        >
                          {evolutionOpenId === employee._id ? "Ocultar evolución" : "Evolución"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmState({ open: true, mode: "delete", employee, count: 0 })}
                          className="rounded-xl border border-rose-400/50 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-200 transition hover:bg-rose-500/20"
                        >
                          Eliminar
                        </button>
                      </div>
                      {evolutionOpenId === employee._id ? (
                        <EvolutionPanel employeeId={employee._id} token={token} />
                      ) : null}
                    </article>
                  );
                })}

                {/* Pagination */}
                {totalPages > 1 ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <p className="text-xs text-[#9fb6c4]">
                      Página {currentPage} de {totalPages} &middot; {totalCount} empleados
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={currentPage <= 1}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        className="rounded-xl border border-white/15 px-3 py-2 text-sm text-[#c5d5de] transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <polyline points="15 18 9 12 15 6" />
                        </svg>
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                        .reduce((acc, p, idx, arr) => {
                          if (idx > 0 && p - arr[idx - 1] > 1) acc.push("...");
                          acc.push(p);
                          return acc;
                        }, [])
                        .map((item, idx) =>
                          item === "..." ? (
                            <span key={`ellipsis-${idx}`} className="px-1 text-xs text-[#9fb6c4]">...</span>
                          ) : (
                            <button
                              key={item}
                              type="button"
                              onClick={() => setCurrentPage(item)}
                              className={`rounded-xl border px-3 py-2 text-sm transition ${
                                item === currentPage
                                  ? "border-[#14b8a6]/60 bg-[#14b8a6]/15 text-[#14b8a6]"
                                  : "border-white/15 text-[#c5d5de] hover:bg-white/5"
                              }`}
                            >
                              {item}
                            </button>
                          )
                        )}
                      <button
                        type="button"
                        disabled={currentPage >= totalPages}
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        className="rounded-xl border border-white/15 px-3 py-2 text-sm text-[#c5d5de] transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}
            {!isLoading && !isError && !filteredEmployees.length ? (
              (() => {
                const isFiltered = filters.q || filters.schoolId || searchQuery;
                return (
                  <EmptyState
                    compact
                    title={isFiltered ? "Sin resultados para tu búsqueda" : "Todavía no hay personas en la nómina"}
                    description={
                      isFiltered
                        ? `Ningún empleado coincide con "${filters.q || searchQuery || ""}". Probá con otro término, cambiá el colegio o limpiá los filtros.`
                        : "Tu nómina está vacía. Podés crear el primer empleado con el formulario de la izquierda, o importar toda la plantilla de una sola vez desde carga masiva."
                    }
                    actionLabel={isFiltered ? "Limpiar filtros" : "Ir a carga masiva"}
                    onAction={
                      isFiltered
                        ? () => setFilters({ q: "", schoolId: "" })
                        : () => setView("carga-masiva")
                    }
                  />
                );
              })()
            ) : null}
          </div>
        </section>
      </div>

      {message && messageType !== "success" ? (
        <p className={messageType === "error" ? "pf-alert-error" : messageType === "warning" ? "pf-alert-warning" : "pf-alert-info"}>
          {messageType === "error" ? "No se pudo guardar. " : ""}
          {message}
        </p>
      ) : null}

      {temporaryPassword ? (
        <div className="mt-4 rounded-2xl border border-amber-300/40 bg-amber-500/10 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-amber-200">Password temporal del usuario vinculado</p>
          <p className="mt-2 text-sm text-[#f7e9c2]">{temporaryPassword}</p>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmState.open}
        title={confirmState.mode === "bulk-delete" ? "¿Eliminar empleados seleccionados?" : "¿Eliminar este empleado?"}
        message={
          confirmState.mode === "bulk-delete"
            ? `Vas a eliminar ${confirmState.count} empleado(s). Esta acción no se puede deshacer.`
            : confirmState.employee
            ? `Vas a eliminar a ${confirmState.employee.apellido}, ${confirmState.employee.nombre}. Esta acción no se puede deshacer.`
            : ""
        }
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        destructive
        loading={isDeleting}
        onCancel={() => setConfirmState({ open: false, mode: "", employee: null, count: 0 })}
        onConfirm={handleConfirmAction}
      />
    </div>
  );
}
