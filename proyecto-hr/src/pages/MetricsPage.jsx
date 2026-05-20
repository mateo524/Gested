import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useView } from "../context/ViewContext";
import { apiFetch } from "../lib/api";
import { EmptyState, ErrorState, LoadingState, PermissionState } from "../components/AppStates";

const PAGE_TABS = [
  { key: "resumen", label: "Resumen" },
  { key: "kpis", label: "KPIs" },
  { key: "okrs", label: "OKRs" },
  { key: "equipos", label: "Por equipo / departamento" },
  { key: "empleados", label: "Por empleado" },
];

const STATUS_OPTIONS = [
  { value: "active", label: "Activo" },
  { value: "on_track", label: "En curso" },
  { value: "at_risk", label: "En riesgo" },
  { value: "completed", label: "Cumplido" },
  { value: "draft", label: "Borrador" },
  { value: "paused", label: "Pausado" },
];

const KPI_FORM = {
  kpiCode: "",
  name: "",
  employeeId: "",
  departmentCode: "",
  teamId: "",
  cycleId: "",
  targetValue: "",
  currentValue: "",
  unit: "",
  period: "",
  weight: "",
  status: "active",
};

const OKR_FORM = {
  okrCode: "",
  objective: "",
  keyResult: "",
  employeeId: "",
  departmentCode: "",
  teamId: "",
  cycleId: "",
  targetValue: "",
  currentValue: "",
  period: "",
  weight: "",
  status: "active",
};

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("es-AR", { dateStyle: "medium" });
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return "-";
  return `${Math.round(value)}%`;
}

function formatNumber(value) {
  if (value === null || value === undefined || value === "") return "-";
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(number);
}

function toNullableNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeText(value) {
  return String(value || "").trim();
}

function calculateProgress(currentValue, targetValue) {
  const current = Number(currentValue);
  const target = Number(targetValue);
  if (!Number.isFinite(current) || !Number.isFinite(target) || target <= 0) return null;
  return Math.max(0, Math.min(100, (current / target) * 100));
}

function getVisualStatus(record) {
  const rawStatus = normalizeText(record.status).toLowerCase();
  const progress = calculateProgress(record.currentValue, record.targetValue);

  if (rawStatus === "completed" || rawStatus === "cumplido") {
    return { key: "completed", label: "Cumplido", tone: "success" };
  }
  if (rawStatus === "at_risk" || rawStatus === "en_riesgo") {
    return { key: "risk", label: "En riesgo", tone: "danger" };
  }
  if (rawStatus === "draft" || rawStatus === "borrador") {
    return { key: "draft", label: "Borrador", tone: "muted" };
  }
  if (progress === null) {
    return { key: "no_data", label: "Sin datos", tone: "muted" };
  }
  if (Number(record.currentValue) >= Number(record.targetValue)) {
    return { key: "completed", label: "Cumplido", tone: "success" };
  }
  if (progress < 70) {
    return { key: "risk", label: "En riesgo", tone: "danger" };
  }
  if (progress < 100) {
    return { key: "in_progress", label: "En curso", tone: "warning" };
  }
  return { key: "completed", label: "Cumplido", tone: "success" };
}

function getToneClass(tone) {
  if (tone === "success") return "border-emerald-300/30 bg-emerald-500/10 text-emerald-100";
  if (tone === "danger") return "border-rose-300/30 bg-rose-500/10 text-rose-100";
  if (tone === "warning") return "border-amber-300/30 bg-amber-500/10 text-amber-100";
  return "border-white/10 bg-[#122530] text-[#d5e2e9]";
}

function getRecordEmployeeName(record) {
  return record.employee?.fullName || record.employeeName || "Sin responsable asignado";
}

function getRecordDepartment(record) {
  return record.departmentCode || record.employee?.area || "Sin departamento";
}

function getRecordCode(record, kind) {
  return kind === "kpi" ? record.kpiCode || "Sin codigo" : record.okrCode || "Sin codigo";
}

function getRecordTitle(record, kind) {
  return kind === "kpi" ? record.name || "KPI sin nombre" : record.objective || record.objectiveTitle || "OKR sin objetivo";
}

function getRecordSubtitle(record, kind) {
  if (kind === "kpi") return getRecordEmployeeName(record);
  return record.keyResult || record.keyResultTitle || "Sin key result";
}

function buildRecordPayload(kind, form) {
  const payload = {
    employeeId: form.employeeId || undefined,
    departmentCode: normalizeText(form.departmentCode) || undefined,
    teamId: normalizeText(form.teamId) || undefined,
    cycleId: form.cycleId || undefined,
    targetValue: Number(form.targetValue),
    currentValue: toNullableNumber(form.currentValue),
    period: normalizeText(form.period),
    weight: toNullableNumber(form.weight),
    status: form.status || "active",
  };

  if (kind === "kpi") {
    return {
      ...payload,
      kpiCode: normalizeText(form.kpiCode) || undefined,
      name: normalizeText(form.name),
      unit: normalizeText(form.unit) || undefined,
    };
  }

  return {
    ...payload,
    okrCode: normalizeText(form.okrCode) || undefined,
    objective: normalizeText(form.objective),
    keyResult: normalizeText(form.keyResult),
  };
}

function validateRecordForm(kind, form) {
  const errors = {};

  if (kind === "kpi") {
    if (!normalizeText(form.name)) errors.name = "El nombre del KPI es obligatorio.";
  } else {
    if (!normalizeText(form.objective)) errors.objective = "El objetivo es obligatorio.";
    if (!normalizeText(form.keyResult)) errors.keyResult = "El key result es obligatorio.";
  }

  if (form.targetValue === "" || Number.isNaN(Number(form.targetValue))) {
    errors.targetValue = "La meta es obligatoria.";
  }

  if (form.currentValue !== "" && Number.isNaN(Number(form.currentValue))) {
    errors.currentValue = "El valor actual debe ser numerico.";
  }

  if (!normalizeText(form.period)) {
    errors.period = "El periodo es obligatorio o sugerido para guardar.";
  }

  if (form.weight !== "") {
    const weight = Number(form.weight);
    if (Number.isNaN(weight) || weight < 0 || weight > 100) {
      errors.weight = "El peso debe estar entre 0 y 100.";
    }
  }

  return errors;
}

function SurfaceCard({ title, subtitle, actions, children }) {
  return (
    <section className="pf-card p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          {subtitle ? <p className="mt-1 text-sm text-[#93acbb]">{subtitle}</p> : null}
        </div>
        {actions}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function SummaryCard({ label, value, hint, tone = "default" }) {
  return (
    <article className={`rounded-3xl border p-4 ${getToneClass(tone)}`}>
      <p className="text-xs uppercase tracking-[0.14em] text-[#7f99a8]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      {hint ? <p className="mt-2 text-sm text-[#9ab0bc]">{hint}</p> : null}
    </article>
  );
}

function StatusBadge({ status }) {
  return <span className={`pf-badge ${getToneClass(status.tone)}`}>{status.label}</span>;
}

function ProgressBar({ progress }) {
  const width = Number.isFinite(progress) ? Math.max(0, Math.min(100, progress)) : 0;
  const tone =
    !Number.isFinite(progress) ? "bg-slate-500/40" : width >= 100 ? "bg-emerald-500" : width >= 70 ? "bg-amber-400" : "bg-rose-400";
  return (
    <div className="w-full">
      <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${width}%` }} />
      </div>
      <p className="mt-2 text-xs text-[#8fa9b7]">{Number.isFinite(progress) ? `${Math.round(width)}% de avance` : "Sin avance medible"}</p>
    </div>
  );
}

function RecordCard({ kind, record, canManage, onEdit, onDelete }) {
  const progress = calculateProgress(record.currentValue, record.targetValue);
  const visualStatus = getVisualStatus(record);

  return (
    <article className="rounded-3xl border border-white/10 bg-[#0f1f28] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-lg font-semibold text-white">{getRecordTitle(record, kind)}</p>
            <StatusBadge status={visualStatus} />
          </div>
          <p className="mt-2 text-sm text-[#9fb6c4]">{getRecordSubtitle(record, kind)}</p>
          <p className="mt-1 text-xs text-[#7f99a8]">
            {getRecordCode(record, kind)} · {getRecordDepartment(record)} · {record.period || "Sin periodo"}
          </p>
        </div>
        <div className="text-right text-xs text-[#8fa9b7]">
          <p>Actualizado {formatDate(record.updatedAt)}</p>
          {record.cycle?.label ? <p className="mt-1">{record.cycle.label}</p> : null}
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-[#122530] px-4 py-3">
            <p className="text-xs uppercase tracking-[0.08em] text-[#7f99a8]">Meta</p>
            <p className="mt-2 text-base font-semibold text-white">
              {formatNumber(record.targetValue)} {kind === "kpi" ? record.unit || "" : ""}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#122530] px-4 py-3">
            <p className="text-xs uppercase tracking-[0.08em] text-[#7f99a8]">Actual</p>
            <p className="mt-2 text-base font-semibold text-white">
              {formatNumber(record.currentValue)} {kind === "kpi" ? record.unit || "" : ""}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#122530] px-4 py-3">
            <p className="text-xs uppercase tracking-[0.08em] text-[#7f99a8]">Peso</p>
            <p className="mt-2 text-base font-semibold text-white">{record.weight ?? 1}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#122530] px-4 py-3">
            <p className="text-xs uppercase tracking-[0.08em] text-[#7f99a8]">Origen</p>
            <p className="mt-2 text-base font-semibold text-white">{record.source || "manual"}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#122530] px-4 py-3">
          <ProgressBar progress={progress} />
        </div>
      </div>

      {canManage ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => onEdit(record)} className="rounded-2xl border border-white/15 px-4 py-2 text-sm text-white">
            Editar
          </button>
          <button type="button" onClick={() => onDelete(record)} className="rounded-2xl border border-rose-300/30 px-4 py-2 text-sm text-rose-200">
            Eliminar
          </button>
        </div>
      ) : null}
    </article>
  );
}

function GroupSummaryCard({ title, stats, onSelect }) {
  return (
    <article className="rounded-3xl border border-white/10 bg-[#0f1f28] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-white">{title}</p>
          <p className="mt-2 text-sm text-[#9fb6c4]">
            {stats.kpis} KPIs · {stats.okrs} OKRs
          </p>
        </div>
        <StatusBadge status={stats.mainStatus} />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-[#122530] px-4 py-3">
          <p className="text-xs uppercase tracking-[0.08em] text-[#7f99a8]">Total</p>
          <p className="mt-2 text-base font-semibold text-white">{stats.total}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#122530] px-4 py-3">
          <p className="text-xs uppercase tracking-[0.08em] text-[#7f99a8]">En riesgo</p>
          <p className="mt-2 text-base font-semibold text-white">{stats.atRisk}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#122530] px-4 py-3">
          <p className="text-xs uppercase tracking-[0.08em] text-[#7f99a8]">Cumplidos</p>
          <p className="mt-2 text-base font-semibold text-white">{stats.completed}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#122530] px-4 py-3">
          <p className="text-xs uppercase tracking-[0.08em] text-[#7f99a8]">Promedio</p>
          <p className="mt-2 text-base font-semibold text-white">{formatPercent(stats.averageProgress)}</p>
        </div>
      </div>
      {onSelect ? (
        <div className="mt-4">
          <button type="button" onClick={onSelect} className="rounded-2xl border border-white/15 px-4 py-2 text-sm text-white">
            Ver detalle
          </button>
        </div>
      ) : null}
    </article>
  );
}

function RecordForm({
  kind,
  form,
  errors,
  employees,
  cycles,
  departmentOptions,
  teamOptions,
  periodOptions,
  submitting,
  onChange,
  onSubmit,
  onCancel,
  editing,
}) {
  const isKpi = kind === "kpi";

  return (
    <SurfaceCard
      title={editing ? `Editar ${isKpi ? "KPI" : "OKR"}` : `Nuevo ${isKpi ? "KPI" : "OKR"}`}
      subtitle={
        isKpi
          ? "Registra un KPI real del tenant con periodo, responsable y seguimiento."
          : "Registra un OKR con objetivo, key result y avance real."
      }
      actions={
        <button type="button" onClick={onCancel} className="rounded-2xl border border-white/15 px-4 py-2 text-sm text-white">
          Cerrar
        </button>
      }
    >
      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-[#9fb6c4]">{isKpi ? "Codigo KPI" : "Codigo OKR"}</label>
            <input
              className="pf-input"
              value={isKpi ? form.kpiCode : form.okrCode}
              onChange={(event) => onChange(isKpi ? "kpiCode" : "okrCode", event.target.value)}
              placeholder={isKpi ? "Ej: SAT-ALUMNOS" : "Ej: OKR-EVAL-01"}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-[#9fb6c4]">Periodo</label>
            <input
              list={`periods-${kind}`}
              className={`pf-input ${errors.period ? "border-rose-400/70" : ""}`}
              value={form.period}
              onChange={(event) => onChange("period", event.target.value)}
              placeholder="Ej: 2026-Q2 o Ciclo Anual 2026"
            />
            <datalist id={`periods-${kind}`}>
              {periodOptions.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
            {errors.period ? <p className="mt-1 text-xs text-rose-300">{errors.period}</p> : null}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs text-[#9fb6c4]">{isKpi ? "Nombre" : "Objetivo"}</label>
          <input
            className={`pf-input ${isKpi ? (errors.name ? "border-rose-400/70" : "") : errors.objective ? "border-rose-400/70" : ""}`}
            value={isKpi ? form.name : form.objective}
            onChange={(event) => onChange(isKpi ? "name" : "objective", event.target.value)}
            placeholder={isKpi ? "Ej: Satisfaccion del estudiante" : "Ej: Mejorar la participacion en evaluaciones"}
          />
          {isKpi && errors.name ? <p className="mt-1 text-xs text-rose-300">{errors.name}</p> : null}
          {!isKpi && errors.objective ? <p className="mt-1 text-xs text-rose-300">{errors.objective}</p> : null}
        </div>

        {!isKpi ? (
          <div>
            <label className="mb-1 block text-xs text-[#9fb6c4]">Key result</label>
            <input
              className={`pf-input ${errors.keyResult ? "border-rose-400/70" : ""}`}
              value={form.keyResult}
              onChange={(event) => onChange("keyResult", event.target.value)}
              placeholder="Ej: Alcanzar 90% de participacion"
            />
            {errors.keyResult ? <p className="mt-1 text-xs text-rose-300">{errors.keyResult}</p> : null}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs text-[#9fb6c4]">Empleado</label>
            <select className="pf-select" value={form.employeeId} onChange={(event) => onChange("employeeId", event.target.value)}>
              <option value="">Sin empleado puntual</option>
              {employees.map((employee) => (
                <option key={employee._id} value={employee._id}>
                  {employee.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs text-[#9fb6c4]">Departamento</label>
            <input
              list={`departments-${kind}`}
              className="pf-input"
              value={form.departmentCode}
              onChange={(event) => onChange("departmentCode", event.target.value)}
              placeholder="Ej: Academica"
            />
            <datalist id={`departments-${kind}`}>
              {departmentOptions.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="mb-1 block text-xs text-[#9fb6c4]">Equipo</label>
            <input
              list={`teams-${kind}`}
              className="pf-input"
              value={form.teamId}
              onChange={(event) => onChange("teamId", event.target.value)}
              placeholder="Ej: TEAM-ACAD"
            />
            <datalist id={`teams-${kind}`}>
              {teamOptions.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="mb-1 block text-xs text-[#9fb6c4]">Ciclo</label>
            <select className="pf-select" value={form.cycleId} onChange={(event) => onChange("cycleId", event.target.value)}>
              <option value="">Sin ciclo asociado</option>
              {cycles.map((cycle) => (
                <option key={cycle._id} value={cycle._id}>
                  {[cycle.anio, cycle.periodo, cycle.etapa].filter(Boolean).join(" - ")}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div>
            <label className="mb-1 block text-xs text-[#9fb6c4]">Meta</label>
            <input
              type="number"
              className={`pf-input ${errors.targetValue ? "border-rose-400/70" : ""}`}
              value={form.targetValue}
              onChange={(event) => onChange("targetValue", event.target.value)}
              placeholder="Ej: 90"
            />
            {errors.targetValue ? <p className="mt-1 text-xs text-rose-300">{errors.targetValue}</p> : null}
          </div>

          <div>
            <label className="mb-1 block text-xs text-[#9fb6c4]">Actual</label>
            <input
              type="number"
              className={`pf-input ${errors.currentValue ? "border-rose-400/70" : ""}`}
              value={form.currentValue}
              onChange={(event) => onChange("currentValue", event.target.value)}
              placeholder="Ej: 72"
            />
            {errors.currentValue ? <p className="mt-1 text-xs text-rose-300">{errors.currentValue}</p> : null}
          </div>

          {isKpi ? (
            <div>
              <label className="mb-1 block text-xs text-[#9fb6c4]">Unidad</label>
              <input
                className="pf-input"
                value={form.unit}
                onChange={(event) => onChange("unit", event.target.value)}
                placeholder="Ej: %"
              />
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-xs text-[#9fb6c4]">Peso</label>
              <input
                type="number"
                min="0"
                max="100"
                className={`pf-input ${errors.weight ? "border-rose-400/70" : ""}`}
                value={form.weight}
                onChange={(event) => onChange("weight", event.target.value)}
                placeholder="Ej: 25"
              />
              {errors.weight ? <p className="mt-1 text-xs text-rose-300">{errors.weight}</p> : null}
            </div>
          )}

          {isKpi ? (
            <div>
              <label className="mb-1 block text-xs text-[#9fb6c4]">Peso</label>
              <input
                type="number"
                min="0"
                max="100"
                className={`pf-input ${errors.weight ? "border-rose-400/70" : ""}`}
                value={form.weight}
                onChange={(event) => onChange("weight", event.target.value)}
                placeholder="Ej: 25"
              />
              {errors.weight ? <p className="mt-1 text-xs text-rose-300">{errors.weight}</p> : null}
            </div>
          ) : null}

          <div>
            <label className="mb-1 block text-xs text-[#9fb6c4]">Estado</label>
            <select className="pf-select" value={form.status} onChange={(event) => onChange("status", event.target.value)}>
              {STATUS_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={submitting} className="pf-button-primary">
            {submitting ? "Guardando..." : editing ? "Guardar cambios" : `Crear ${isKpi ? "KPI" : "OKR"}`}
          </button>
          <button type="button" onClick={onCancel} className="pf-button-secondary">
            Cancelar
          </button>
        </div>
      </form>
    </SurfaceCard>
  );
}

export default function MetricsPage() {
  const { token, hasPermission } = useAuth();
  const { setView } = useView();

  const [activeTab, setActiveTab] = useState("resumen");
  const [activeEditor, setActiveEditor] = useState(null);
  const [editorRecordId, setEditorRecordId] = useState("");
  const [baseMetrics, setBaseMetrics] = useState([]);
  const [kpiRecords, setKpiRecords] = useState([]);
  const [okrRecords, setOkrRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [cycles, setCycles] = useState([]);
  const [query, setQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [periodFilter, setPeriodFilter] = useState("");
  const [selectedGroupKey, setSelectedGroupKey] = useState("");
  const [selectedEmployeeKey, setSelectedEmployeeKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [error, setError] = useState("");
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [kpiForm, setKpiForm] = useState(KPI_FORM);
  const [okrForm, setOkrForm] = useState(OKR_FORM);
  const [kpiErrors, setKpiErrors] = useState({});
  const [okrErrors, setOkrErrors] = useState({});

  const canManage = hasPermission("manage_metrics");
  const canRead =
    canManage ||
    hasPermission("view_reports") ||
    hasPermission("download_reports") ||
    hasPermission("download_team_reports") ||
    hasPermission("download_self_report") ||
    hasPermission("read_only_access") ||
    hasPermission("view_audit");

  const employeeOptions = useMemo(() => {
    const byId = new Map();

    employees.forEach((item) => {
      byId.set(item._id, {
        _id: item._id,
        label: [item.apellido, item.nombre].filter(Boolean).join(", ") || item.nombre || item.email || item._id,
      });
    });

    [...kpiRecords, ...okrRecords].forEach((item) => {
      if (item.employee?._id && !byId.has(item.employee._id)) {
        byId.set(item.employee._id, {
          _id: item.employee._id,
          label: item.employee.fullName || item.employee.email || item.employee._id,
        });
      }
    });

    return [...byId.values()].sort((left, right) => left.label.localeCompare(right.label));
  }, [employees, kpiRecords, okrRecords]);

  const departmentOptions = useMemo(() => {
    const values = new Set();
    [...kpiRecords, ...okrRecords].forEach((item) => {
      if (item.departmentCode) values.add(item.departmentCode);
      if (item.employee?.area) values.add(item.employee.area);
    });
    employees.forEach((item) => {
      if (item.area) values.add(item.area);
    });
    return [...values].sort();
  }, [employees, kpiRecords, okrRecords]);

  const teamOptions = useMemo(() => {
    const values = new Set();
    [...kpiRecords, ...okrRecords].forEach((item) => {
      if (item.teamId) values.add(item.teamId);
    });
    return [...values].sort();
  }, [kpiRecords, okrRecords]);

  const periodOptions = useMemo(() => {
    const values = new Set();
    [...kpiRecords, ...okrRecords].forEach((item) => {
      if (item.period) values.add(item.period);
    });
    return [...values].sort();
  }, [kpiRecords, okrRecords]);

  const filteredKpis = useMemo(() => {
    const term = query.trim().toLowerCase();
    return kpiRecords.filter((item) => {
      const visualStatus = getVisualStatus(item);
      const matchesQuery =
        !term ||
        [item.name, item.kpiCode, item.employee?.fullName, item.departmentCode, item.period]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(term));
      const matchesDepartment = !departmentFilter || getRecordDepartment(item) === departmentFilter;
      const matchesStatus = !statusFilter || visualStatus.key === statusFilter;
      const matchesPeriod = !periodFilter || item.period === periodFilter;
      return matchesQuery && matchesDepartment && matchesStatus && matchesPeriod;
    });
  }, [departmentFilter, kpiRecords, periodFilter, query, statusFilter]);

  const filteredOkrs = useMemo(() => {
    const term = query.trim().toLowerCase();
    return okrRecords.filter((item) => {
      const visualStatus = getVisualStatus(item);
      const matchesQuery =
        !term ||
        [item.objective, item.objectiveTitle, item.keyResult, item.keyResultTitle, item.okrCode, item.employee?.fullName, item.departmentCode, item.period]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(term));
      const matchesDepartment = !departmentFilter || getRecordDepartment(item) === departmentFilter;
      const matchesStatus = !statusFilter || visualStatus.key === statusFilter;
      const matchesPeriod = !periodFilter || (item.period || item.quarter) === periodFilter;
      return matchesQuery && matchesDepartment && matchesStatus && matchesPeriod;
    });
  }, [departmentFilter, okrRecords, periodFilter, query, statusFilter]);

  const filteredOperationalRecords = useMemo(
    () => [
      ...filteredKpis.map((item) => ({ ...item, kind: "kpi" })),
      ...filteredOkrs.map((item) => ({ ...item, kind: "okr" })),
    ],
    [filteredKpis, filteredOkrs]
  );

  const summary = useMemo(() => {
    const records = [...kpiRecords, ...okrRecords];
    const total = records.length;
    const active = records.filter((item) => item.active !== false).length;
    const completed = records.filter((item) => getVisualStatus(item).key === "completed").length;
    const atRisk = records.filter((item) => getVisualStatus(item).key === "risk").length;
    const noProgress = records.filter((item) => !Number(item.currentValue)).length;
    const progresses = records.map((item) => calculateProgress(item.currentValue, item.targetValue)).filter(Number.isFinite);
    const averageProgress = progresses.length ? progresses.reduce((acc, value) => acc + value, 0) / progresses.length : null;

    return {
      total,
      activeKpis: kpiRecords.filter((item) => item.active !== false).length,
      activeOkrs: okrRecords.filter((item) => item.active !== false).length,
      atRisk,
      completed,
      noProgress,
      averageProgress,
      active,
    };
  }, [kpiRecords, okrRecords]);

  const groupedByArea = useMemo(() => {
    const groups = new Map();

    filteredOperationalRecords.forEach((item) => {
      const key = item.departmentCode || item.teamId || "sin-asignacion";
      const label = item.departmentCode || (item.teamId ? `Equipo ${item.teamId}` : "Sin asignacion");
      const visualStatus = getVisualStatus(item);
      const progress = calculateProgress(item.currentValue, item.targetValue);

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          label,
          items: [],
          total: 0,
          kpis: 0,
          okrs: 0,
          atRisk: 0,
          completed: 0,
          progresses: [],
        });
      }

      const target = groups.get(key);
      target.items.push(item);
      target.total += 1;
      target.kpis += item.kind === "kpi" ? 1 : 0;
      target.okrs += item.kind === "okr" ? 1 : 0;
      target.atRisk += visualStatus.key === "risk" ? 1 : 0;
      target.completed += visualStatus.key === "completed" ? 1 : 0;
      if (Number.isFinite(progress)) target.progresses.push(progress);
    });

    return [...groups.values()]
      .map((group) => ({
        ...group,
        averageProgress: group.progresses.length
          ? group.progresses.reduce((acc, value) => acc + value, 0) / group.progresses.length
          : null,
        mainStatus:
          group.completed === group.total && group.total > 0
            ? { key: "completed", label: "Cumplido", tone: "success" }
            : group.atRisk > 0
              ? { key: "risk", label: "En riesgo", tone: "danger" }
              : { key: "in_progress", label: "En curso", tone: "warning" },
      }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [filteredOperationalRecords]);

  const groupedByEmployee = useMemo(() => {
    const groups = new Map();

    filteredOperationalRecords.forEach((item) => {
      const employeeId = item.employee?._id || item.employeeId || `sin-empleado-${item._id}`;
      const employeeLabel = item.employee?.fullName || "Sin empleado asignado";
      const departmentLabel = getRecordDepartment(item);
      const progress = calculateProgress(item.currentValue, item.targetValue);
      const visualStatus = getVisualStatus(item);

      if (!groups.has(employeeId)) {
        groups.set(employeeId, {
          key: employeeId,
          label: employeeLabel,
          department: departmentLabel,
          items: [],
          kpis: 0,
          okrs: 0,
          pending: 0,
          progresses: [],
        });
      }

      const target = groups.get(employeeId);
      target.items.push(item);
      target.kpis += item.kind === "kpi" ? 1 : 0;
      target.okrs += item.kind === "okr" ? 1 : 0;
      target.pending += visualStatus.key === "completed" ? 0 : 1;
      if (Number.isFinite(progress)) target.progresses.push(progress);
    });

    return [...groups.values()]
      .map((group) => ({
        ...group,
        averageProgress: group.progresses.length
          ? group.progresses.reduce((acc, value) => acc + value, 0) / group.progresses.length
          : null,
      }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [filteredOperationalRecords]);

  const selectedGroup = useMemo(
    () => groupedByArea.find((item) => item.key === selectedGroupKey) || null,
    [groupedByArea, selectedGroupKey]
  );

  const selectedEmployee = useMemo(
    () => groupedByEmployee.find((item) => item.key === selectedEmployeeKey) || null,
    [groupedByEmployee, selectedEmployeeKey]
  );

  const resetEditor = useCallback(() => {
    setActiveEditor(null);
    setEditorRecordId("");
    setKpiForm(KPI_FORM);
    setOkrForm(OKR_FORM);
    setKpiErrors({});
    setOkrErrors({});
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      setPermissionDenied(false);

      const [metricsResult, kpiResult, okrResult, employeesResult, cyclesResult] = await Promise.allSettled([
        apiFetch("/metrics", { token }),
        apiFetch("/metrics/kpi-records", { token }),
        apiFetch("/metrics/okr-records", { token }),
        apiFetch("/employees", { token }),
        apiFetch("/evaluation-cycles", { token }),
      ]);

      if (kpiResult.status === "rejected" || okrResult.status === "rejected") {
        const combinedMessage = [
          kpiResult.status === "rejected" ? kpiResult.reason?.message : "",
          okrResult.status === "rejected" ? okrResult.reason?.message : "",
        ]
          .filter(Boolean)
          .join(" ");

        if (/permiso|acceso|autoriz/i.test(combinedMessage)) {
          setPermissionDenied(true);
          setError("");
        } else {
          setError(combinedMessage || "No pudimos cargar los objetivos e indicadores.");
        }
      }

      setBaseMetrics(metricsResult.status === "fulfilled" ? metricsResult.value : []);
      setKpiRecords(kpiResult.status === "fulfilled" ? kpiResult.value : []);
      setOkrRecords(okrResult.status === "fulfilled" ? okrResult.value : []);
      setEmployees(employeesResult.status === "fulfilled" ? employeesResult.value : []);
      setCycles(cyclesResult.status === "fulfilled" ? cyclesResult.value : []);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!canRead) {
      setPermissionDenied(true);
      setLoading(false);
      return;
    }

    loadData().catch((nextError) => {
      const message = nextError?.message || "No pudimos cargar los objetivos e indicadores.";
      if (/permiso|acceso|autoriz/i.test(message)) {
        setPermissionDenied(true);
      } else {
        setError(message);
      }
      setLoading(false);
    });
  }, [canRead, loadData]);

  function openCreateEditor(kind) {
    setActiveEditor(kind);
    setEditorRecordId("");
    setKpiForm(KPI_FORM);
    setOkrForm(OKR_FORM);
    setKpiErrors({});
    setOkrErrors({});
    setMessage("");
  }

  function openEditEditor(kind, record) {
    setActiveEditor(kind);
    setEditorRecordId(record._id);
    setMessage("");

    if (kind === "kpi") {
      setKpiForm({
        kpiCode: record.kpiCode || "",
        name: record.name || "",
        employeeId: record.employeeId || record.employee?._id || "",
        departmentCode: record.departmentCode || "",
        teamId: record.teamId || "",
        cycleId: record.cycleId || record.cycle?._id || "",
        targetValue: record.targetValue ?? "",
        currentValue: record.currentValue ?? "",
        unit: record.unit || "",
        period: record.period || "",
        weight: record.weight ?? "",
        status: record.status || "active",
      });
      setKpiErrors({});
    } else {
      setOkrForm({
        okrCode: record.okrCode || "",
        objective: record.objective || record.objectiveTitle || "",
        keyResult: record.keyResult || record.keyResultTitle || "",
        employeeId: record.employeeId || record.employee?._id || "",
        departmentCode: record.departmentCode || "",
        teamId: record.teamId || "",
        cycleId: record.cycleId || record.cycle?._id || "",
        targetValue: record.targetValue ?? "",
        currentValue: record.currentValue ?? "",
        period: record.period || record.quarter || "",
        weight: record.weight ?? "",
        status: record.status || "active",
      });
      setOkrErrors({});
    }
  }

  function updateForm(kind, field, value) {
    if (kind === "kpi") {
      setKpiForm((current) => ({ ...current, [field]: value }));
      if (kpiErrors[field]) setKpiErrors((current) => ({ ...current, [field]: "" }));
      return;
    }
    setOkrForm((current) => ({ ...current, [field]: value }));
    if (okrErrors[field]) setOkrErrors((current) => ({ ...current, [field]: "" }));
  }

  async function handleSaveRecord(event) {
    event.preventDefault();
    if (!activeEditor) return;

    const form = activeEditor === "kpi" ? kpiForm : okrForm;
    const errors = validateRecordForm(activeEditor, form);
    if (Object.keys(errors).length) {
      if (activeEditor === "kpi") setKpiErrors(errors);
      else setOkrErrors(errors);
      setMessageType("warning");
      setMessage("Revisa los campos obligatorios antes de guardar.");
      return;
    }

    try {
      setSubmitting(true);
      setMessage("");
      const payload = buildRecordPayload(activeEditor, form);
      const endpoint = activeEditor === "kpi" ? "/metrics/kpi-records" : "/metrics/okr-records";
      const method = editorRecordId ? "PUT" : "POST";
      const path = editorRecordId ? `${endpoint}/${editorRecordId}` : endpoint;
      const response = await apiFetch(path, {
        method,
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      setMessageType("success");
      setMessage(response?.mensaje || `${activeEditor.toUpperCase()} guardado.`);
      resetEditor();
      await loadData();
    } catch (nextError) {
      if (/permiso|acceso|autoriz/i.test(nextError.message)) {
        setPermissionDenied(true);
      }
      setMessageType("error");
      setMessage(nextError.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteRecord(kind, record) {
    const label = kind === "kpi" ? record.name : record.objective || record.objectiveTitle;
    const confirmed = window.confirm(`¿Eliminar "${label}"?`);
    if (!confirmed) return;

    try {
      const endpoint = kind === "kpi" ? "/metrics/kpi-records" : "/metrics/okr-records";
      const response = await apiFetch(`${endpoint}/${record._id}`, {
        method: "DELETE",
        token,
      });
      setMessageType("success");
      setMessage(response?.mensaje || `${kind.toUpperCase()} eliminado.`);
      if (editorRecordId === record._id) resetEditor();
      await loadData();
    } catch (nextError) {
      if (/permiso|acceso|autoriz/i.test(nextError.message)) {
        setPermissionDenied(true);
      }
      setMessageType("error");
      setMessage(nextError.message);
    }
  }

  if (permissionDenied || !canRead) {
    return (
      <div className="space-y-5">
        <section className="pf-surface pf-surface-pad">
          <p className="pf-section-title">Objetivos / Indicadores</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">Objetivos / Indicadores</h1>
          <p className="mt-3 text-sm leading-relaxed text-[#a8bdc8] md:text-base">
            Gestiona KPIs y OKRs por ciclo, equipo, departamento y persona.
          </p>
        </section>
        <PermissionState
          title="No tienes acceso a esta vista"
          description="Tu rol actual no puede gestionar o consultar objetivos e indicadores dentro de este alcance."
          actionLabel="Volver al inicio"
          onAction={() => setView("dashboard")}
        />
      </div>
    );
  }

  const emptyOperational = !kpiRecords.length && !okrRecords.length;

  return (
    <div className="space-y-5">
      <section className="pf-surface pf-surface-pad">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-4xl">
            <p className="pf-section-title">Desempeno / Objetivos</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">Objetivos / Indicadores</h1>
            <p className="mt-3 text-sm leading-relaxed text-[#a8bdc8] md:text-base">
              Gestiona KPIs y OKRs por ciclo, equipo, departamento y persona.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {canManage ? (
              <>
                <button type="button" onClick={() => openCreateEditor("kpi")} className="pf-button-primary">
                  Nuevo KPI
                </button>
                <button type="button" onClick={() => openCreateEditor("okr")} className="pf-button-secondary">
                  Nuevo OKR
                </button>
              </>
            ) : null}
            <button type="button" onClick={() => setView("carga-masiva")} className="pf-button-secondary">
              Importar desde plantilla
            </button>
            <button type="button" onClick={loadData} className="pf-button-secondary">
              Actualizar
            </button>
          </div>
        </div>
      </section>

      {activeEditor === "kpi" ? (
        <RecordForm
          kind="kpi"
          form={kpiForm}
          errors={kpiErrors}
          employees={employeeOptions}
          cycles={cycles}
          departmentOptions={departmentOptions}
          teamOptions={teamOptions}
          periodOptions={periodOptions}
          submitting={submitting}
          onChange={(field, value) => updateForm("kpi", field, value)}
          onSubmit={handleSaveRecord}
          onCancel={resetEditor}
          editing={Boolean(editorRecordId)}
        />
      ) : null}

      {activeEditor === "okr" ? (
        <RecordForm
          kind="okr"
          form={okrForm}
          errors={okrErrors}
          employees={employeeOptions}
          cycles={cycles}
          departmentOptions={departmentOptions}
          teamOptions={teamOptions}
          periodOptions={periodOptions}
          submitting={submitting}
          onChange={(field, value) => updateForm("okr", field, value)}
          onSubmit={handleSaveRecord}
          onCancel={resetEditor}
          editing={Boolean(editorRecordId)}
        />
      ) : null}

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

      <SurfaceCard title="Filtros activos" subtitle="Usa la misma vista para explorar estado, responsable y alcance operativo.">
        <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <input
            className="pf-input"
            placeholder="Buscar por nombre, codigo, responsable o periodo"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />

          <select className="pf-select" value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}>
            <option value="">Todos los equipos / departamentos</option>
            {departmentOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <select className="pf-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">Todos los estados visuales</option>
            <option value="completed">Cumplidos</option>
            <option value="risk">En riesgo</option>
            <option value="in_progress">En curso</option>
            <option value="no_data">Sin datos</option>
          </select>

          <select className="pf-select" value={periodFilter} onChange={(event) => setPeriodFilter(event.target.value)}>
            <option value="">Todos los periodos</option>
            {periodOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
      </SurfaceCard>

      <SurfaceCard title="Vista" subtitle="Cambia entre resumen, registros operativos y agrupaciones.">
        <div className="flex flex-wrap gap-2">
          {PAGE_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-2xl px-4 py-2.5 text-sm transition ${
                activeTab === tab.key ? "bg-[#1e3a8a] text-white" : "border border-white/10 bg-[#122530] text-[#afc3ce]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </SurfaceCard>

      {loading ? (
        <LoadingState
          title="Cargando objetivos e indicadores"
          description="Estamos trayendo indicadores base, KPIs y OKRs persistidos para este alcance."
        />
      ) : error && !baseMetrics.length && emptyOperational ? (
        <ErrorState
          title="No pudimos cargar la vista"
          description={error}
          actionLabel="Reintentar"
          onAction={loadData}
        />
      ) : (
        <>
          {activeTab === "resumen" ? (
            <div className="space-y-5">
              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
                <SummaryCard label="KPIs activos" value={summary.activeKpis} hint="Registros KPI visibles" />
                <SummaryCard label="OKRs activos" value={summary.activeOkrs} hint="Registros OKR visibles" />
                <SummaryCard label="En riesgo" value={summary.atRisk} hint="Items debajo del umbral visual" tone="danger" />
                <SummaryCard label="Cumplidos" value={summary.completed} hint="Objetivos ya alcanzados" tone="success" />
                <SummaryCard label="Sin avance" value={summary.noProgress} hint="Sin valor actual o en cero" tone="warning" />
                <SummaryCard label="Promedio de avance" value={formatPercent(summary.averageProgress)} hint="Promedio general del alcance" />
              </section>

              {emptyOperational ? (
                <EmptyState
                  title="No hay KPIs/OKRs cargados todavia"
                  description="Podés crearlos manualmente o importarlos desde la plantilla oficial."
                  actionLabel="Ir a Carga masiva"
                  onAction={() => setView("carga-masiva")}
                />
              ) : null}

              <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
                <SurfaceCard
                  title="Indicadores base"
                  subtitle="Base comun para evaluaciones y lectura operativa del ciclo."
                  actions={
                    <button type="button" onClick={() => setView("competencias")} className="rounded-2xl border border-white/15 px-3 py-2 text-sm text-white">
                      Ver competencias
                    </button>
                  }
                >
                  {baseMetrics.length ? (
                    <div className="space-y-3">
                      {baseMetrics.slice(0, 5).map((metric) => (
                        <article key={metric._id} className="rounded-2xl border border-white/10 bg-[#0f1f28] px-4 py-3">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-white">{metric.nombre}</p>
                              <p className="mt-1 text-sm text-[#9fb6c4]">{metric.descripcion || "Sin descripcion operativa."}</p>
                            </div>
                            <span className="rounded-full border border-white/10 bg-[#122530] px-3 py-1 text-xs text-[#d5e2e9]">
                              Peso {metric.ponderacion || 1}
                            </span>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      compact
                      title="No hay indicadores base cargados"
                      description="Cuando existan indicadores base, esta seccion mostrara la referencia comun del tenant."
                    />
                  )}
                </SurfaceCard>

                <SurfaceCard title="Lectura ejecutiva" subtitle="Resumen rapido para direccion, RR. HH. y managers.">
                  <div className="space-y-3">
                    <article className="rounded-2xl border border-white/10 bg-[#0f1f28] px-4 py-4">
                      <p className="text-sm font-semibold text-white">Carga operativa</p>
                      <p className="mt-2 text-sm text-[#9fb6c4]">
                        {summary.total
                          ? `Hay ${summary.total} registros operativos visibles entre KPIs y OKRs dentro del alcance actual.`
                          : "Todavia no hay registros operativos persistidos para este alcance."}
                      </p>
                    </article>
                    <article className="rounded-2xl border border-white/10 bg-[#0f1f28] px-4 py-4">
                      <p className="text-sm font-semibold text-white">Cobertura por equipos</p>
                      <p className="mt-2 text-sm text-[#9fb6c4]">
                        {groupedByArea.length
                          ? `${groupedByArea.length} equipos o departamentos tienen al menos un KPI u OKR visible.`
                          : "No hay equipos o departamentos con objetivos persistidos todavia."}
                      </p>
                    </article>
                    <article className="rounded-2xl border border-white/10 bg-[#0f1f28] px-4 py-4">
                      <p className="text-sm font-semibold text-white">Seguimiento por persona</p>
                      <p className="mt-2 text-sm text-[#9fb6c4]">
                        {groupedByEmployee.length
                          ? `${groupedByEmployee.length} personas muestran objetivos o indicadores con avance visible.`
                          : "No hay personas con objetivos persistidos en este momento."}
                      </p>
                    </article>
                  </div>
                </SurfaceCard>
              </div>
            </div>
          ) : null}

          {activeTab === "kpis" ? (
            filteredKpis.length ? (
              <SurfaceCard title="KPIs persistidos" subtitle="Gestion operativa real conectada al nuevo dominio persistente.">
                <div className="space-y-4">
                  {filteredKpis.map((item) => (
                    <RecordCard
                      key={item._id}
                      kind="kpi"
                      record={item}
                      canManage={canManage}
                      onEdit={(record) => openEditEditor("kpi", record)}
                      onDelete={(record) => handleDeleteRecord("kpi", record)}
                    />
                  ))}
                </div>
              </SurfaceCard>
            ) : (
              <EmptyState
                title="No hay KPIs para mostrar"
                description="Ajusta los filtros o crea el primer KPI manual desde esta pantalla."
                actionLabel={canManage ? "Nuevo KPI" : undefined}
                onAction={canManage ? () => openCreateEditor("kpi") : undefined}
              />
            )
          ) : null}

          {activeTab === "okrs" ? (
            filteredOkrs.length ? (
              <SurfaceCard title="OKRs persistidos" subtitle="Objetivos y key results reales dentro del tenant actual.">
                <div className="space-y-4">
                  {filteredOkrs.map((item) => (
                    <RecordCard
                      key={item._id}
                      kind="okr"
                      record={item}
                      canManage={canManage}
                      onEdit={(record) => openEditEditor("okr", record)}
                      onDelete={(record) => handleDeleteRecord("okr", record)}
                    />
                  ))}
                </div>
              </SurfaceCard>
            ) : (
              <EmptyState
                title="No hay OKRs para mostrar"
                description="Ajusta los filtros o crea el primer OKR manual desde esta pantalla."
                actionLabel={canManage ? "Nuevo OKR" : undefined}
                onAction={canManage ? () => openCreateEditor("okr") : undefined}
              />
            )
          ) : null}

          {activeTab === "equipos" ? (
            groupedByArea.length ? (
              <div className="space-y-5">
                <SurfaceCard title="Por equipo / departamento" subtitle="Agrupacion operativa usando departmentCode o teamId cuando existen.">
                  <div className="grid gap-4 xl:grid-cols-2">
                    {groupedByArea.map((group) => (
                      <GroupSummaryCard key={group.key} title={group.label} stats={group} onSelect={() => setSelectedGroupKey(group.key)} />
                    ))}
                  </div>
                </SurfaceCard>

                {selectedGroup ? (
                  <SurfaceCard title={`Detalle de ${selectedGroup.label}`} subtitle="Lista resumida de KPIs y OKRs dentro del grupo seleccionado.">
                    <div className="space-y-3">
                      {selectedGroup.items.map((item) => (
                        <article key={`${selectedGroup.key}-${item.kind}-${item._id}`} className="rounded-2xl border border-white/10 bg-[#0f1f28] px-4 py-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-white">{getRecordTitle(item, item.kind)}</p>
                              <p className="mt-1 text-sm text-[#9fb6c4]">
                                {item.kind === "kpi" ? "KPI" : "OKR"} · {getRecordEmployeeName(item)} · {item.period || "Sin periodo"}
                              </p>
                            </div>
                            <StatusBadge status={getVisualStatus(item)} />
                          </div>
                        </article>
                      ))}
                    </div>
                  </SurfaceCard>
                ) : null}
              </div>
            ) : (
              <EmptyState
                title="No hay grupos para mostrar"
                description="Cuando existan departmentCode o teamId operativos, esta vista agrupara KPIs y OKRs por alcance."
              />
            )
          ) : null}

          {activeTab === "empleados" ? (
            groupedByEmployee.length ? (
              <div className="space-y-5">
                <SurfaceCard title="Por empleado" subtitle="Seguimiento individual con KPIs, OKRs, avance promedio y pendientes.">
                  <div className="grid gap-4 xl:grid-cols-2">
                    {groupedByEmployee.map((group) => (
                      <article key={group.key} className="rounded-3xl border border-white/10 bg-[#0f1f28] p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-lg font-semibold text-white">{group.label}</p>
                            <p className="mt-1 text-sm text-[#9fb6c4]">{group.department}</p>
                          </div>
                          <span className="rounded-full border border-white/10 bg-[#122530] px-3 py-1 text-xs text-[#d5e2e9]">
                            Pendientes {group.pending}
                          </span>
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-3">
                          <div className="rounded-2xl border border-white/10 bg-[#122530] px-4 py-3">
                            <p className="text-xs uppercase tracking-[0.08em] text-[#7f99a8]">KPIs</p>
                            <p className="mt-2 text-base font-semibold text-white">{group.kpis}</p>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-[#122530] px-4 py-3">
                            <p className="text-xs uppercase tracking-[0.08em] text-[#7f99a8]">OKRs</p>
                            <p className="mt-2 text-base font-semibold text-white">{group.okrs}</p>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-[#122530] px-4 py-3">
                            <p className="text-xs uppercase tracking-[0.08em] text-[#7f99a8]">Promedio</p>
                            <p className="mt-2 text-base font-semibold text-white">{formatPercent(group.averageProgress)}</p>
                          </div>
                        </div>
                        <div className="mt-4">
                          <button type="button" onClick={() => setSelectedEmployeeKey(group.key)} className="rounded-2xl border border-white/15 px-4 py-2 text-sm text-white">
                            Ver detalle
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </SurfaceCard>

                {selectedEmployee ? (
                  <SurfaceCard title={`Detalle de ${selectedEmployee.label}`} subtitle="KPIs y OKRs visibles para la persona seleccionada.">
                    <div className="space-y-3">
                      {selectedEmployee.items.map((item) => (
                        <article key={`${selectedEmployee.key}-${item.kind}-${item._id}`} className="rounded-2xl border border-white/10 bg-[#0f1f28] px-4 py-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-white">{getRecordTitle(item, item.kind)}</p>
                              <p className="mt-1 text-sm text-[#9fb6c4]">
                                {item.kind === "kpi" ? "KPI" : "OKR"} · {getRecordDepartment(item)} · {item.period || "Sin periodo"}
                              </p>
                            </div>
                            <StatusBadge status={getVisualStatus(item)} />
                          </div>
                        </article>
                      ))}
                    </div>
                  </SurfaceCard>
                ) : null}
              </div>
            ) : (
              <EmptyState
                title="No hay empleados con objetivos visibles"
                description="Cuando haya KPIs u OKRs asociados a personas, esta vista mostrara su distribucion y avance."
              />
            )
          ) : null}
        </>
      )}
    </div>
  );
}
