import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "../context/AuthContext";
import { useView } from "../context/ViewContext";
import { apiFetch } from "../lib/api";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PermissionState,
} from "../components/AppStates";

const TABS = [
  { key: "resumen", label: "Resumen" },
  { key: "individual", label: "Evaluación individual" },
  { key: "auto", label: "Autoevaluación" },
  { key: "manager", label: "Evaluación del jefe" },
  { key: "summary", label: "Resumen evaluativo" },
  { key: "visual", label: "Visualización" },
];

const STATUS_OPTIONS = [
  { value: "BORRADOR", label: "Borrador" },
  { value: "ENVIADA", label: "Enviada" },
  { value: "REVISADA", label: "Revisada" },
  { value: "CERRADA", label: "Cerrada" },
];

const EVALUATION_TYPES = {
  AUTOEVALUACION: "Autoevaluación",
  JEFATURA: "Evaluación del jefe",
  FINAL: "Cierre final",
};

const emptyEditor = {
  id: "",
  employeeId: "",
  cycleId: "",
  tipo: "AUTOEVALUACION",
  estado: "BORRADOR",
  comentariosGenerales: "",
  acuerdoEmpleado: "PENDIENTE",
  scores: [],
};

function normalizeText(value) {
  return String(value || "").trim();
}

function formatDate(value) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("es-AR", { dateStyle: "medium" });
}

function formatScore(value) {
  if (value === null || value === undefined || value === "") return "-";
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(1) : String(value);
}

function average(values) {
  const valid = values.map(Number).filter((value) => Number.isFinite(value));
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function clampLevel(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 3;
  return Math.max(1, Math.min(5, Math.round(number)));
}

function buildCycleLabel(cycle) {
  return [cycle?.anio, cycle?.periodo, cycle?.etapa].filter(Boolean).join(" · ");
}

function buildEmployeeLabel(employee) {
  return [employee?.apellido, employee?.nombre].filter(Boolean).join(", ");
}

function mapDetailScores(rawScores = []) {
  return rawScores.map((score) => ({
    id: score._id,
    metricId: score.metricId?._id || score.metricId,
    nivel: clampLevel(score.nivel),
    comentario: score.comentario || "",
    evidenciaUrls: Array.isArray(score.evidenciaUrls) ? score.evidenciaUrls : [],
    metric: score.metricId || null,
  }));
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
  const toneClass =
    tone === "success"
      ? "border-emerald-300/20 bg-emerald-500/10"
      : tone === "warning"
        ? "border-amber-300/20 bg-amber-500/10"
        : tone === "danger"
          ? "border-rose-300/20 bg-rose-500/10"
          : "border-white/10 bg-[#0f1f28]";

  return (
    <article className={`rounded-3xl border p-4 ${toneClass}`}>
      <p className="text-xs uppercase tracking-[0.14em] text-[#7f99a8]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      {hint ? <p className="mt-2 text-sm text-[#9ab0bc]">{hint}</p> : null}
    </article>
  );
}

function StatusPill({ label, tone = "default" }) {
  const toneClass =
    tone === "success"
      ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-100"
      : tone === "warning"
        ? "border-amber-300/20 bg-amber-500/10 text-amber-100"
        : tone === "danger"
          ? "border-rose-300/20 bg-rose-500/10 text-rose-100"
          : "border-white/10 bg-[#122530] text-[#d5e2e9]";

  return <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${toneClass}`}>{label}</span>;
}

function ScoreButtons({ value, disabled, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {[1, 2, 3, 4, 5].map((level) => (
        <button
          key={level}
          type="button"
          disabled={disabled}
          onClick={() => onChange(level)}
          className={`flex h-9 w-9 items-center justify-center rounded-2xl border text-sm font-semibold transition ${
            value === level
              ? "border-[#4f7cff] bg-[#1e3a8a] text-white shadow-[0_8px_20px_rgba(30,58,138,0.28)]"
              : "border-white/10 bg-[#122530] text-[#d4e1e8] hover:bg-[#17313f]"
          } disabled:cursor-not-allowed disabled:opacity-60`}
        >
          {level}
        </button>
      ))}
    </div>
  );
}

function MetricDescriptorCard({
  groupTitle,
  groupDefinition,
  descriptors,
  canEdit,
  onLevelChange,
  onCommentChange,
  highlightedMetricIds,
}) {
  return (
    <article className="rounded-3xl border border-white/10 bg-[#0f1f28] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-white">{groupTitle}</p>
          {groupDefinition ? <p className="mt-1 text-sm text-[#9fb6c4]">{groupDefinition}</p> : null}
        </div>
        <StatusPill label={`${descriptors.length} descriptores`} />
      </div>

      <div className="mt-4 space-y-3">
        {descriptors.map((descriptor) => {
          const isHighlighted = highlightedMetricIds.has(String(descriptor.metricId));
          return (
            <div
              key={descriptor.metricId}
              className={`rounded-2xl border px-4 py-4 ${
                isHighlighted
                  ? "border-emerald-300/30 bg-emerald-500/10"
                  : "border-white/10 bg-[#122530]"
              }`}
            >
              <div className="grid gap-4 xl:grid-cols-[1.2fr_0.5fr_0.9fr]">
                <div>
                  <p className="text-sm font-semibold text-white">{descriptor.name}</p>
                  <p className="mt-1 text-sm text-[#9fb6c4]">{descriptor.description || "Sin descriptor ampliado."}</p>
                </div>
                <div>
                  <p className="mb-2 text-xs uppercase tracking-[0.08em] text-[#7f99a8]">Escala 1–5</p>
                  <ScoreButtons
                    value={descriptor.nivel}
                    disabled={!canEdit}
                    onChange={(level) => onLevelChange(descriptor.metricId, level)}
                  />
                </div>
                <div>
                  <p className="mb-2 text-xs uppercase tracking-[0.08em] text-[#7f99a8]">Evidencia / comentario</p>
                  <textarea
                    className="min-h-20 w-full rounded-2xl border border-white/10 bg-[#0c171d] px-3 py-3 text-sm text-white outline-none placeholder:text-[#7f99a8]"
                    placeholder="Opcional: evidencia, observación o ejemplo concreto"
                    value={descriptor.comentario}
                    disabled={!canEdit}
                    onChange={(event) => onCommentChange(descriptor.metricId, event.target.value)}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function EvaluationHeader({ employee, cycle, status, tipo, score, selfOnly }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="rounded-3xl border border-white/10 bg-[#0f1f28] p-5">
        <p className="text-xs uppercase tracking-[0.14em] text-[#7f99a8]">Evaluado</p>
        <h3 className="mt-2 text-2xl font-semibold text-white">{buildEmployeeLabel(employee) || "Sin empleado seleccionado"}</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <StatusPill label={employee?.cargo || "Sin cargo"} />
          <StatusPill label={employee?.area || "Sin área"} />
          <StatusPill label={cycle ? buildCycleLabel(cycle) : "Sin ciclo"} />
        </div>
        <p className="mt-4 text-sm text-[#9fb6c4]">
          {selfOnly
            ? "Ves tu autoevaluación visible dentro del alcance permitido."
            : "Comparamos autoevaluación y evaluación del jefe para construir un resumen claro."}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
        <SummaryCard label="Estado" value={status || "-"} hint={tipo ? EVALUATION_TYPES[tipo] || tipo : "Sin evaluación"} />
        <SummaryCard label="Resultado" value={formatScore(score)} hint="Promedio visible hoy" tone="success" />
        <SummaryCard label="Autoevaluación" value={tipo === "AUTOEVALUACION" ? "Disponible" : "Comparada"} hint="Lectura por rol y ciclo" />
      </div>
    </div>
  );
}

function EvaluationEditor({
  title,
  form,
  groups,
  saving,
  canDelete,
  onFieldChange,
  onScoreChange,
  onCommentChange,
  onSubmit,
  onCancel,
  onDelete,
  highlight,
}) {
  const highlightedMetricIds = useMemo(
    () => new Set(highlight ? form.scores.map((score) => String(score.metricId)) : []),
    [form.scores, highlight]
  );

  return (
    <SurfaceCard
      title={title}
      subtitle="Revisá y ajustá la evaluación antes de guardarla. La escala es 1–5 y cada descriptor admite evidencia o comentario breve."
      actions={
        <div className="flex flex-wrap gap-2">
          {canDelete ? (
            <button
              type="button"
              onClick={onDelete}
              className="rounded-2xl border border-rose-300/30 px-4 py-2 text-sm text-rose-200"
            >
              Eliminar
            </button>
          ) : null}
          <button
            type="button"
            onClick={onCancel}
            className="rounded-2xl border border-white/15 px-4 py-2 text-sm text-white"
          >
            Cerrar
          </button>
        </div>
      }
    >
      <form className="space-y-5" onSubmit={onSubmit}>
        <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          Revisá y ajustá el plan de evaluación antes de guardarlo. Esta pantalla prioriza metas, competencias, autoevaluación y evidencias.
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-emerald-300/20 bg-[#122530] px-4 py-3">
            <label className="mb-1 block text-xs uppercase tracking-[0.08em] text-[#7f99a8]">Empleado</label>
            <input
              className="w-full bg-transparent text-sm text-white outline-none"
              value={buildEmployeeLabel(form.employee) || "-"}
              readOnly
            />
          </div>
          <div className="rounded-2xl border border-emerald-300/20 bg-[#122530] px-4 py-3">
            <label className="mb-1 block text-xs uppercase tracking-[0.08em] text-[#7f99a8]">Ciclo / período</label>
            <input
              className="w-full bg-transparent text-sm text-white outline-none"
              value={buildCycleLabel(form.cycle) || "-"}
              readOnly
            />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-[0.08em] text-[#7f99a8]">Estado</label>
            <select
              className="pf-select"
              value={form.estado}
              onChange={(event) => onFieldChange("estado", event.target.value)}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-[0.08em] text-[#7f99a8]">Acuerdo</label>
            <select
              className="pf-select"
              value={form.acuerdoEmpleado}
              onChange={(event) => onFieldChange("acuerdoEmpleado", event.target.value)}
            >
              <option value="PENDIENTE">Pendiente</option>
              <option value="ACUERDO">De acuerdo</option>
              <option value="DESACUERDO">En desacuerdo</option>
            </select>
          </div>
        </div>

        <div className="space-y-4">
          {groups.map((group) => (
            <MetricDescriptorCard
              key={group.id}
              groupTitle={group.title}
              groupDefinition={group.description}
              descriptors={group.descriptors.map((descriptor) => {
                const score = form.scores.find((item) => String(item.metricId) === String(descriptor.metricId));
                return {
                  ...descriptor,
                  nivel: score?.nivel ?? 3,
                  comentario: score?.comentario ?? "",
                };
              })}
              canEdit
              highlightedMetricIds={highlightedMetricIds}
              onLevelChange={onScoreChange}
              onCommentChange={onCommentChange}
            />
          ))}
        </div>

        <div>
          <label className="mb-1 block text-xs uppercase tracking-[0.08em] text-[#7f99a8]">Observaciones</label>
          <textarea
            className="min-h-24 w-full rounded-2xl border border-white/10 bg-[#0f1f28] px-4 py-3 text-white outline-none placeholder:text-[#7f99a8]"
            placeholder="Observación general, contexto o siguiente paso."
            value={form.comentariosGenerales}
            onChange={(event) => onFieldChange("comentariosGenerales", event.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-2xl bg-[#1e3a8a] px-5 py-3 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60"
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </form>
    </SurfaceCard>
  );
}

function buildGroups(metrics, competencyMap) {
  const groups = new Map();
  metrics.forEach((metric, index) => {
    const competencyId = metric.competencyId?._id || metric.competencyId || `group-${index}`;
    const competency = competencyMap.get(String(competencyId));
    const key = String(competencyId);
    if (!groups.has(key)) {
      groups.set(key, {
        id: key,
        title: competency?.nombre || competency?.name || metric.nombre || `Competencia ${groups.size + 1}`,
        description: competency?.descripcion || metric.descripcion || "",
        descriptors: [],
      });
    }
    groups.get(key).descriptors.push({
      metricId: metric._id,
      name: metric.nombre || "Descriptor",
      description: metric.descripcion || "",
      levels: Array.isArray(metric.levels) ? metric.levels : [],
    });
  });
  return [...groups.values()];
}

function inferStrengths(scores, metricMap) {
  return scores
    .filter((score) => Number(score.nivel) >= 4)
    .slice()
    .sort((a, b) => Number(b.nivel) - Number(a.nivel))
    .slice(0, 3)
    .map((score) => metricMap.get(String(score.metricId))?.nombre || "Descriptor");
}

function inferImprovements(scores, metricMap) {
  return scores
    .filter((score) => Number(score.nivel) <= 3)
    .slice()
    .sort((a, b) => Number(a.nivel) - Number(b.nivel))
    .slice(0, 3)
    .map((score) => metricMap.get(String(score.metricId))?.nombre || "Descriptor");
}

function hasMeaningfulText(value) {
  return Boolean(normalizeText(value));
}

export default function MetricsPage() {
  const { token, user, hasPermission } = useAuth();
  const { setView, searchQuery } = useView();

  const editorRef = useRef(null);
  const detailRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("resumen");
  const [metrics, setMetrics] = useState([]);
  const [competencies, setCompetencies] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [cycles, setCycles] = useState([]);
  const [evaluations, setEvaluations] = useState([]);
  const [kpis, setKpis] = useState([]);
  const [okrs, setOkrs] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [selectedCycleId, setSelectedCycleId] = useState("");
  const [autoDetail, setAutoDetail] = useState(null);
  const [managerDetail, setManagerDetail] = useState(null);
  const [detailError, setDetailError] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [editor, setEditor] = useState({ open: false, mode: "create", type: "AUTOEVALUACION" });
  const [editorForm, setEditorForm] = useState(emptyEditor);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const canReadMetrics = Boolean(
    hasPermission("manage_metrics") ||
      hasPermission("manage_evaluations") ||
      hasPermission("evaluate_team") ||
      hasPermission("self_evaluate") ||
      hasPermission("view_reports")
  );
  const canCreateAuto = Boolean(hasPermission("manage_evaluations") || hasPermission("self_evaluate"));
  const canCreateManager = Boolean(hasPermission("manage_evaluations") || hasPermission("evaluate_team"));
  const canSeeManagerSection = !(
    user?.roleKey === "EMPLOYEE" ||
    user?.roleCode === "EMPLEADO"
  );

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const results = await Promise.allSettled([
        apiFetch("/metrics", { token }),
        apiFetch("/competencies", { token }),
        apiFetch("/employees", { token }),
        apiFetch("/evaluation-cycles", { token }),
        apiFetch("/evaluations", { token }),
        apiFetch("/metrics/kpi-records", { token }),
        apiFetch("/metrics/okr-records", { token }),
      ]);

      const [metricsResult, competenciesResult, employeesResult, cyclesResult, evaluationsResult, kpisResult, okrsResult] = results;

      if (metricsResult.status === "fulfilled") setMetrics(metricsResult.value || []);
      if (competenciesResult.status === "fulfilled") setCompetencies(competenciesResult.value || []);
      if (employeesResult.status === "fulfilled") setEmployees(employeesResult.value || []);
      if (cyclesResult.status === "fulfilled") setCycles(cyclesResult.value || []);
      if (evaluationsResult.status === "fulfilled") setEvaluations(evaluationsResult.value || []);
      if (kpisResult.status === "fulfilled") setKpis(kpisResult.value || []);
      if (okrsResult.status === "fulfilled") setOkrs(okrsResult.value || []);

      const fatal =
        [evaluationsResult, kpisResult, okrsResult].every((result) => result.status === "rejected") &&
        metricsResult.status === "rejected";

      if (fatal) {
        throw new Error(evaluationsResult.reason?.message || metricsResult.reason?.message || "No pudimos cargar la evaluación de desempeño.");
      }
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!canReadMetrics) return;
    loadData();
  }, [canReadMetrics, loadData]);

  const competencyMap = useMemo(
    () => new Map(competencies.map((item) => [String(item._id), item])),
    [competencies]
  );
  const metricMap = useMemo(
    () => new Map(metrics.map((item) => [String(item._id), item])),
    [metrics]
  );
  const groups = useMemo(() => buildGroups(metrics, competencyMap), [competencyMap, metrics]);

  const visibleEmployees = useMemo(() => {
    const term = normalizeText(searchQuery).toLowerCase();
    const base = employees.length
      ? employees
      : [...new Map(
          evaluations
            .filter((evaluation) => evaluation.employeeId?._id)
            .map((evaluation) => [String(evaluation.employeeId._id), evaluation.employeeId])
        ).values()];
    if (!term) return base;
    return base.filter((employee) =>
      [employee.nombre, employee.apellido, employee.area, employee.cargo]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(term))
    );
  }, [employees, evaluations, searchQuery]);

  useEffect(() => {
    if (!selectedEmployeeId && visibleEmployees.length) {
      setSelectedEmployeeId(String(visibleEmployees[0]._id));
    }
  }, [selectedEmployeeId, visibleEmployees]);

  const employeeEvaluations = useMemo(() => {
    return evaluations.filter((evaluation) => {
      if (!selectedEmployeeId) return false;
      if (String(evaluation.employeeId?._id || evaluation.employeeId) !== String(selectedEmployeeId)) return false;
      if (selectedCycleId && String(evaluation.cycleId?._id || evaluation.cycleId) !== String(selectedCycleId)) return false;
      if (!canSeeManagerSection && evaluation.tipo !== "AUTOEVALUACION") return false;
      return true;
    });
  }, [canSeeManagerSection, evaluations, selectedCycleId, selectedEmployeeId]);

  const selectedEmployee = useMemo(
    () => visibleEmployees.find((employee) => String(employee._id) === String(selectedEmployeeId)) || null,
    [selectedEmployeeId, visibleEmployees]
  );

  const cycleOptionsForEmployee = useMemo(() => {
    const ids = new Set(
      evaluations
        .filter((evaluation) => String(evaluation.employeeId?._id || evaluation.employeeId) === String(selectedEmployeeId))
        .map((evaluation) => String(evaluation.cycleId?._id || evaluation.cycleId))
    );
    const scoped = cycles.filter((cycle) => ids.has(String(cycle._id)));
    return scoped.length ? scoped : cycles;
  }, [cycles, evaluations, selectedEmployeeId]);

  useEffect(() => {
    if (selectedCycleId) return;
    if (cycleOptionsForEmployee.length) {
      setSelectedCycleId(String(cycleOptionsForEmployee[0]._id));
    }
  }, [cycleOptionsForEmployee, selectedCycleId]);

  const autoEvaluation = useMemo(
    () =>
      employeeEvaluations.find((evaluation) => evaluation.tipo === "AUTOEVALUACION") || null,
    [employeeEvaluations]
  );

  const managerEvaluation = useMemo(
    () =>
      employeeEvaluations.find((evaluation) => evaluation.tipo === "JEFATURA") ||
      employeeEvaluations.find((evaluation) => evaluation.tipo === "FINAL") ||
      null,
    [employeeEvaluations]
  );

  const loadEvaluationDetail = useCallback(
    async (evaluation, setter) => {
      if (!evaluation?._id) {
        setter(null);
        return;
      }
      const data = await apiFetch(`/evaluations/${evaluation._id}`, { token });
      setter({
        ...data.evaluation,
        scores: mapDetailScores(data.scores),
      });
    },
    [token]
  );

  useEffect(() => {
    let cancelled = false;
    if (!selectedEmployeeId) return undefined;

    async function run() {
      try {
        setDetailLoading(true);
        setDetailError("");
        const tasks = [loadEvaluationDetail(autoEvaluation, setAutoDetail)];
        if (canSeeManagerSection) {
          tasks.push(loadEvaluationDetail(managerEvaluation, setManagerDetail));
        } else {
          setManagerDetail(null);
        }
        await Promise.all(tasks);
        if (!cancelled) {
          window.requestAnimationFrame(() => {
            detailRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
          });
        }
      } catch (nextError) {
        if (!cancelled) {
          setDetailError(nextError.message);
          setAutoDetail(null);
          setManagerDetail(null);
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [autoEvaluation, canSeeManagerSection, loadEvaluationDetail, managerEvaluation, selectedEmployeeId, selectedCycleId]);

  const operationalSummary = useMemo(() => {
    const totalEvaluations = evaluations.length;
    const autoCount = evaluations.filter((evaluation) => evaluation.tipo === "AUTOEVALUACION").length;
    const managerCount = evaluations.filter((evaluation) => evaluation.tipo === "JEFATURA").length;
    const overallAverage = average(evaluations.map((evaluation) => evaluation.resultadoFinal));
    const pending = evaluations.filter((evaluation) => evaluation.estado !== "CERRADA").length;
    return {
      totalEvaluations,
      autoCount,
      managerCount,
      overallAverage,
      pending,
      activeKpis: kpis.length,
      activeOkrs: okrs.length,
    };
  }, [evaluations, kpis.length, okrs.length]);

  const currentAutoAverage = useMemo(() => average(autoDetail?.scores?.map((item) => item.nivel) || []), [autoDetail]);
  const currentManagerAverage = useMemo(() => average(managerDetail?.scores?.map((item) => item.nivel) || []), [managerDetail]);

  const comparisonRows = useMemo(() => {
    return groups
      .map((group) => {
        const autoScores = group.descriptors
          .map((descriptor) => autoDetail?.scores?.find((item) => String(item.metricId) === String(descriptor.metricId))?.nivel)
          .filter((value) => value !== undefined);
        const managerScores = group.descriptors
          .map((descriptor) => managerDetail?.scores?.find((item) => String(item.metricId) === String(descriptor.metricId))?.nivel)
          .filter((value) => value !== undefined);
        return {
          name: group.title,
          auto: average(autoScores) ?? 0,
          jefe: average(managerScores) ?? 0,
        };
      })
      .filter((row) => row.auto || row.jefe);
  }, [autoDetail, groups, managerDetail]);

  const distributionRows = useMemo(() => {
    const buckets = [1, 2, 3, 4, 5].map((level) => ({ level: `Nivel ${level}`, auto: 0, jefe: 0 }));
    (autoDetail?.scores || []).forEach((score) => {
      const bucket = buckets.find((item) => item.level === `Nivel ${score.nivel}`);
      if (bucket) bucket.auto += 1;
    });
    (managerDetail?.scores || []).forEach((score) => {
      const bucket = buckets.find((item) => item.level === `Nivel ${score.nivel}`);
      if (bucket) bucket.jefe += 1;
    });
    return buckets;
  }, [autoDetail, managerDetail]);

  const selectedEmployeeOperational = useMemo(() => {
    const employeeId = String(selectedEmployeeId || "");
    return {
      kpis: kpis.filter((item) => String(item.employeeId || "") === employeeId),
      okrs: okrs.filter((item) => String(item.employeeId || "") === employeeId),
    };
  }, [kpis, okrs, selectedEmployeeId]);

  const evaluationEvidence = useMemo(() => {
    const merged = [...(autoDetail?.scores || []), ...(managerDetail?.scores || [])]
      .filter((score) => hasMeaningfulText(score.comentario))
      .map((score) => ({
        metric: metricMap.get(String(score.metricId))?.nombre || "Descriptor",
        comment: score.comentario,
      }));
    return merged.slice(0, 8);
  }, [autoDetail, managerDetail, metricMap]);

  const strengths = useMemo(
    () => inferStrengths(managerDetail?.scores || autoDetail?.scores || [], metricMap),
    [autoDetail, managerDetail, metricMap]
  );
  const improvements = useMemo(
    () => inferImprovements(managerDetail?.scores || autoDetail?.scores || [], metricMap),
    [autoDetail, managerDetail, metricMap]
  );

  function buildEditorForm(type, detail) {
    const cycle = cycles.find((item) => String(item._id) === String(selectedCycleId)) || null;
    return {
      id: detail?._id || "",
      employeeId: selectedEmployee?._id || "",
      cycleId: cycle?._id || "",
      tipo: type,
      estado: detail?.estado || "BORRADOR",
      comentariosGenerales: detail?.comentariosGenerales || "",
      acuerdoEmpleado: detail?.acuerdoEmpleado || "PENDIENTE",
      employee: selectedEmployee,
      cycle,
      scores:
        detail?.scores?.map((score) => ({
          metricId: score.metricId,
          nivel: clampLevel(score.nivel),
          comentario: score.comentario || "",
        })) ||
        metrics.map((metric) => ({
          metricId: metric._id,
          nivel: 3,
          comentario: "",
        })),
    };
  }

  function openEditor(type, detail = null) {
    setEditor({
      open: true,
      mode: detail ? "edit" : "create",
      type,
    });
    setEditorForm(buildEditorForm(type, detail));
    window.requestAnimationFrame(() => {
      editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function closeEditor() {
    setEditor({ open: false, mode: "create", type: "AUTOEVALUACION" });
    setEditorForm(emptyEditor);
  }

  function updateEditorScore(metricId, nextLevel) {
    setEditorForm((current) => ({
      ...current,
      scores: current.scores.map((score) =>
        String(score.metricId) === String(metricId)
          ? { ...score, nivel: clampLevel(nextLevel) }
          : score
      ),
    }));
  }

  function updateEditorComment(metricId, comment) {
    setEditorForm((current) => ({
      ...current,
      scores: current.scores.map((score) =>
        String(score.metricId) === String(metricId)
          ? { ...score, comentario: comment }
          : score
      ),
    }));
  }

  async function refreshEvaluationsAfterSave() {
    const nextEvaluations = await apiFetch("/evaluations", { token });
    setEvaluations(nextEvaluations);
  }

  async function handleSaveEditor(event) {
    event.preventDefault();
    if (!editorForm.employeeId || !editorForm.cycleId) {
      setMessage({ type: "warning", text: "Seleccioná empleado y ciclo antes de guardar la evaluación." });
      return;
    }

    try {
      setSaving(true);
      const payload = {
        employeeId: editorForm.employeeId,
        cycleId: editorForm.cycleId,
        tipo: editorForm.tipo,
        estado: editorForm.estado,
        comentariosGenerales: editorForm.comentariosGenerales,
        acuerdoEmpleado: editorForm.acuerdoEmpleado,
        scores: editorForm.scores.map((score) => ({
          metricId: score.metricId,
          nivel: score.nivel,
          comentario: score.comentario,
        })),
      };

      if (editor.mode === "edit" && editorForm.id) {
        await apiFetch(`/evaluations/${editorForm.id}`, {
          method: "PUT",
          token,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch("/evaluations", {
          method: "POST",
          token,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      await refreshEvaluationsAfterSave();
      setMessage({ type: "success", text: "Evaluación guardada." });
      closeEditor();
    } catch (nextError) {
      setMessage({ type: "error", text: nextError.message });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteEvaluation(id) {
    const ok = window.confirm("Vas a eliminar esta evaluación. Esta acción no se puede deshacer.");
    if (!ok) return;
    try {
      await apiFetch(`/evaluations/${id}`, { method: "DELETE", token });
      await refreshEvaluationsAfterSave();
      setMessage({ type: "success", text: "Evaluación eliminada." });
      closeEditor();
    } catch (nextError) {
      setMessage({ type: "error", text: nextError.message });
    }
  }

  if (!canReadMetrics) {
    return (
      <PermissionState
        title="No tienes acceso a esta evaluación de desempeño"
        description="Tu rol actual no tiene permisos para ver esta sección."
      />
    );
  }

  if (loading) {
    return (
      <LoadingState
        title="Cargando evaluación de desempeño"
        description="Estamos preparando personas, ciclos, evaluaciones y mediciones visibles para tu alcance."
      />
    );
  }

  if (error) {
    return (
      <ErrorState
        title="No pudimos cargar la evaluación de desempeño"
        description={error}
        actionLabel="Reintentar"
        onAction={loadData}
      />
    );
  }

  return (
    <div className="space-y-5">
      <section className="pf-surface pf-surface-pad">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-4xl">
            <p className="pf-section-title">Desempeño</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">Mediciones de desempeño</h1>
            <p className="mt-3 text-sm leading-relaxed text-[#a8bdc8] md:text-base">
              Las mediciones de desempeño combinan metas, competencias, autoevaluaciones y evidencias para construir el resumen evaluativo.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canCreateAuto ? (
              <button
                type="button"
                onClick={() => openEditor("AUTOEVALUACION", autoDetail)}
                className="rounded-2xl border border-white/15 bg-[#122530] px-4 py-3 text-sm font-medium text-white"
              >
                {autoDetail ? "Editar autoevaluación" : "Crear autoevaluación"}
              </button>
            ) : null}
            {canSeeManagerSection && canCreateManager ? (
              <button
                type="button"
                onClick={() => openEditor("JEFATURA", managerDetail)}
                className="rounded-2xl bg-[#1e3a8a] px-4 py-3 text-sm font-semibold text-white"
              >
                {managerDetail ? "Editar evaluación del jefe" : "Crear evaluación del jefe"}
              </button>
            ) : null}
          </div>
        </div>
      </section>

      {message.text ? (
        <div
          className={
            message.type === "error"
              ? "pf-alert-error"
              : message.type === "success"
                ? "pf-alert-success"
                : "pf-alert-warning"
          }
        >
          {message.text}
        </div>
      ) : null}

      <SurfaceCard
        title="Vista"
        subtitle="Menos ruido, más claridad: primero desempeño por persona y después objetivos complementarios."
      >
        <div className="flex flex-wrap gap-2">
          {TABS.filter((tab) => canSeeManagerSection || tab.key !== "manager").map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-2xl px-4 py-2.5 text-sm transition ${
                activeTab === tab.key
                  ? "bg-[#1e3a8a] text-white"
                  : "border border-white/10 bg-[#122530] text-[#afc3ce]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </SurfaceCard>

      <div ref={detailRef}>
        <EvaluationHeader
          employee={selectedEmployee}
          cycle={cycleOptionsForEmployee.find((item) => String(item._id) === String(selectedCycleId)) || null}
          status={managerDetail?.estado || autoDetail?.estado || "-"}
          tipo={managerDetail?.tipo || autoDetail?.tipo || ""}
          score={currentManagerAverage ?? currentAutoAverage}
          selfOnly={!canSeeManagerSection}
        />
      </div>

      {activeTab === "resumen" ? (
        <div className="space-y-5">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <SummaryCard label="Evaluaciones visibles" value={operationalSummary.totalEvaluations} hint="Dentro de tu alcance" />
            <SummaryCard label="Autoevaluaciones" value={operationalSummary.autoCount} hint="Registradas" />
            <SummaryCard label="Evaluación jefe" value={operationalSummary.managerCount} hint="Registradas" />
            <SummaryCard
              label="Promedio general"
              value={formatScore(operationalSummary.overallAverage)}
              hint="Resultado visible hoy"
              tone="success"
            />
            <SummaryCard label="Pendientes" value={operationalSummary.pending} hint="Sin cierre todavía" tone="warning" />
            <SummaryCard label="KPIs / OKRs" value={operationalSummary.activeKpis + operationalSummary.activeOkrs} hint="Contexto complementario" />
          </section>

          <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
            <SurfaceCard
              title="Siguiente lectura sugerida"
              subtitle="Qué conviene mirar primero para entender el desempeño de esta persona."
            >
              <div className="grid gap-3 md:grid-cols-3">
                <SummaryCard label="Autoevaluación" value={formatScore(currentAutoAverage)} hint="Promedio actual" />
                <SummaryCard label="Jefatura" value={formatScore(currentManagerAverage)} hint="Promedio actual" />
                <SummaryCard
                  label="Brecha"
                  value={formatScore(
                    currentAutoAverage !== null && currentManagerAverage !== null
                      ? Math.abs(currentManagerAverage - currentAutoAverage)
                      : null
                  )}
                  hint="Diferencia entre ambas miradas"
                  tone="warning"
                />
              </div>
              <div className="mt-4 rounded-2xl border border-white/10 bg-[#0f1f28] px-4 py-4 text-sm text-[#9fb6c4]">
                {currentManagerAverage !== null
                  ? "Compará primero la autoevaluación con la evaluación del jefe. Después usá KPIs y OKRs como evidencia adicional."
                  : "Todavía no hay evaluación del jefe visible. Empezá por la autoevaluación y por los objetivos complementarios que ya existan."}
              </div>
            </SurfaceCard>

            <SurfaceCard
              title="Objetivos complementarios"
              subtitle="KPIs y OKRs se preservan como contexto operativo, sin ocupar la vista principal."
            >
              <div className="grid gap-3 md:grid-cols-2">
                <SummaryCard label="KPIs asignados" value={selectedEmployeeOperational.kpis.length} hint="Visibles para esta persona" />
                <SummaryCard label="OKRs asignados" value={selectedEmployeeOperational.okrs.length} hint="Visibles para esta persona" />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {selectedEmployeeOperational.kpis.slice(0, 2).map((item) => (
                  <StatusPill key={item._id} label={item.name || "KPI"} />
                ))}
                {selectedEmployeeOperational.okrs.slice(0, 2).map((item) => (
                  <StatusPill key={item._id} label={item.objective || "OKR"} />
                ))}
                {!selectedEmployeeOperational.kpis.length && !selectedEmployeeOperational.okrs.length ? (
                  <p className="text-sm text-[#9fb6c4]">No hay KPIs/OKRs asignados para esta persona.</p>
                ) : null}
              </div>
            </SurfaceCard>
          </div>
        </div>
      ) : null}

      {activeTab === "individual" ? (
        <div className="space-y-5">
          <SurfaceCard
            title="Evaluación individual"
            subtitle="Seleccioná una persona y un período. Desde acá podés leer desempeño, abrir autoevaluación o completar la evaluación del jefe."
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs uppercase tracking-[0.08em] text-[#7f99a8]">Empleado</label>
                <select
                  className="pf-select"
                  value={selectedEmployeeId}
                  onChange={(event) => setSelectedEmployeeId(event.target.value)}
                >
                  <option value="">Seleccioná una persona</option>
                  {visibleEmployees.map((employee) => (
                    <option key={employee._id} value={employee._id}>
                      {buildEmployeeLabel(employee)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-[0.08em] text-[#7f99a8]">Ciclo / período</label>
                <select
                  className="pf-select"
                  value={selectedCycleId}
                  onChange={(event) => setSelectedCycleId(event.target.value)}
                >
                  <option value="">Todos</option>
                  {cycleOptionsForEmployee.map((cycle) => (
                    <option key={cycle._id} value={cycle._id}>
                      {buildCycleLabel(cycle)}
                    </option>
                  ))}
                </select>
              </div>
              <SummaryCard label="Autoevaluación" value={autoDetail ? autoDetail.estado : "Sin carga"} hint={autoDetail ? formatDate(autoDetail.updatedAt) : "No registrada"} />
              <SummaryCard label="Jefatura" value={managerDetail ? managerDetail.estado : "Sin carga"} hint={managerDetail ? formatDate(managerDetail.updatedAt) : "No registrada"} />
            </div>
          </SurfaceCard>

          <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
            <SurfaceCard title="Qué incluye esta evaluación" subtitle="Tomamos el esquema del formulario real para que la lectura sea natural.">
              <div className="grid gap-3 md:grid-cols-3">
                <article className="rounded-2xl border border-white/10 bg-[#0f1f28] px-4 py-4">
                  <p className="text-sm font-semibold text-white">Metas y competencias</p>
                  <p className="mt-2 text-sm text-[#9fb6c4]">Cada descriptor se puntúa de 1 a 5.</p>
                </article>
                <article className="rounded-2xl border border-white/10 bg-[#0f1f28] px-4 py-4">
                  <p className="text-sm font-semibold text-white">Evidencias</p>
                  <p className="mt-2 text-sm text-[#9fb6c4]">Cada descriptor puede llevar comentario o evidencia breve.</p>
                </article>
                <article className="rounded-2xl border border-white/10 bg-[#0f1f28] px-4 py-4">
                  <p className="text-sm font-semibold text-white">Resumen final</p>
                  <p className="mt-2 text-sm text-[#9fb6c4]">El cierre se arma con autoevaluación, jefatura y observaciones finales.</p>
                </article>
              </div>
            </SurfaceCard>

            <SurfaceCard title="Vista rápida" subtitle="Lectura corta para saber dónde entrar primero.">
              {detailError ? (
                <ErrorState compact title="No pudimos cargar el detalle" description={detailError} />
              ) : detailLoading ? (
                <LoadingState compact title="Cargando detalle individual" description="Estamos trayendo puntajes y comentarios visibles." />
              ) : (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-white/10 bg-[#0f1f28] px-4 py-4">
                    <p className="text-sm font-semibold text-white">Autoevaluación</p>
                    <p className="mt-2 text-sm text-[#9fb6c4]">
                      {autoDetail
                        ? `${autoDetail.scores.length} descriptores cargados. Promedio ${formatScore(currentAutoAverage)}.`
                        : "Todavía no hay autoevaluación visible para esta persona."}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-[#0f1f28] px-4 py-4">
                    <p className="text-sm font-semibold text-white">Evaluación del jefe</p>
                    <p className="mt-2 text-sm text-[#9fb6c4]">
                      {canSeeManagerSection
                        ? managerDetail
                          ? `${managerDetail.scores.length} descriptores cargados. Promedio ${formatScore(currentManagerAverage)}.`
                          : "Todavía no hay evaluación del jefe visible para esta persona."
                        : "No mostramos esta sección para tu rol actual."}
                    </p>
                  </div>
                </div>
              )}
            </SurfaceCard>
          </div>
        </div>
      ) : null}

      {activeTab === "auto" ? (
        autoDetail ? (
          <div className="space-y-5">
            <SurfaceCard
              title="Autoevaluación"
              subtitle="Vista de competencias y descriptores completados por la persona evaluada."
              actions={
                canCreateAuto ? (
                  <button
                    type="button"
                    onClick={() => openEditor("AUTOEVALUACION", autoDetail)}
                    className="rounded-2xl border border-white/15 px-4 py-2 text-sm text-white"
                  >
                    Editar
                  </button>
                ) : null
              }
            >
              <div className="space-y-4">
                {groups.length ? (
                  groups.map((group) => (
                    <MetricDescriptorCard
                      key={group.id}
                      groupTitle={group.title}
                      groupDefinition={group.description}
                      descriptors={group.descriptors.map((descriptor) => {
                        const score = autoDetail.scores.find((item) => String(item.metricId) === String(descriptor.metricId));
                        return {
                          ...descriptor,
                          nivel: score?.nivel ?? 3,
                          comentario: score?.comentario ?? "",
                        };
                      })}
                      canEdit={false}
                      highlightedMetricIds={new Set()}
                      onLevelChange={() => {}}
                      onCommentChange={() => {}}
                    />
                  ))
                ) : (
                  <EmptyState compact title="No hay descriptores cargados" description="Cuando existan competencias activas para evaluar, aparecerán acá." />
                )}
              </div>
            </SurfaceCard>
          </div>
        ) : (
          <EmptyState
            title="Todavía no hay autoevaluación visible"
            description="Cuando exista una autoevaluación para esta persona, la vas a ver acá con escala 1–5 y evidencias."
            actionLabel={canCreateAuto ? "Crear autoevaluación" : undefined}
            onAction={canCreateAuto ? () => openEditor("AUTOEVALUACION", null) : undefined}
          />
        )
      ) : null}

      {activeTab === "manager" && canSeeManagerSection ? (
        managerDetail ? (
          <div className="space-y-5">
            <SurfaceCard
              title="Evaluación del jefe"
              subtitle="Misma estructura que la autoevaluación para facilitar comparación justa y legible."
              actions={
                canCreateManager ? (
                  <button
                    type="button"
                    onClick={() => openEditor("JEFATURA", managerDetail)}
                    className="rounded-2xl border border-white/15 px-4 py-2 text-sm text-white"
                  >
                    Editar
                  </button>
                ) : null
              }
            >
              <div className="space-y-4">
                {groups.length ? (
                  groups.map((group) => (
                    <MetricDescriptorCard
                      key={group.id}
                      groupTitle={group.title}
                      groupDefinition={group.description}
                      descriptors={group.descriptors.map((descriptor) => {
                        const score = managerDetail.scores.find((item) => String(item.metricId) === String(descriptor.metricId));
                        return {
                          ...descriptor,
                          nivel: score?.nivel ?? 3,
                          comentario: score?.comentario ?? "",
                        };
                      })}
                      canEdit={false}
                      highlightedMetricIds={new Set()}
                      onLevelChange={() => {}}
                      onCommentChange={() => {}}
                    />
                  ))
                ) : (
                  <EmptyState compact title="No hay descriptores cargados" description="Cuando existan competencias activas para evaluar, aparecerán acá." />
                )}
              </div>
            </SurfaceCard>
          </div>
        ) : (
          <EmptyState
            title="Todavía no hay evaluación del jefe visible"
            description="Cuando exista una evaluación de jefatura, la vas a ver acá con su escala y observaciones."
            actionLabel={canCreateManager ? "Crear evaluación del jefe" : undefined}
            onAction={canCreateManager ? () => openEditor("JEFATURA", null) : undefined}
          />
        )
      ) : null}

      {activeTab === "summary" ? (
        <div className="space-y-5">
          <SurfaceCard title="Resumen evaluativo" subtitle="Síntesis final, fortalezas, aspectos a mejorar, observaciones y evidencias visibles.">
            <div className="grid gap-4 md:grid-cols-3">
              <SummaryCard label="Promedio autoevaluación" value={formatScore(currentAutoAverage)} hint="Promedio actual" />
              <SummaryCard label="Promedio jefe" value={formatScore(currentManagerAverage)} hint="Promedio actual" />
              <SummaryCard
                label="Resultado final"
                value={formatScore(managerDetail?.resultadoFinal ?? autoDetail?.resultadoFinal)}
                hint="Resultado visible hoy"
                tone="success"
              />
            </div>
          </SurfaceCard>

          <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
            <SurfaceCard title="Fortalezas" subtitle="Tomamos los descriptores mejor puntuados para facilitar la lectura del cierre.">
              {strengths.length ? (
                <div className="flex flex-wrap gap-2">
                  {strengths.map((item) => (
                    <StatusPill key={item} label={item} tone="success" />
                  ))}
                </div>
              ) : (
                <EmptyState compact title="Sin fortalezas destacadas todavía" description="Cuando haya puntajes cargados, se resumirán acá." />
              )}
            </SurfaceCard>

            <SurfaceCard title="Aspectos a mejorar" subtitle="Mostramos primero los descriptores que requieren seguimiento.">
              {improvements.length ? (
                <div className="flex flex-wrap gap-2">
                  {improvements.map((item) => (
                    <StatusPill key={item} label={item} tone="warning" />
                  ))}
                </div>
              ) : (
                <EmptyState compact title="Sin aspectos críticos visibles" description="Cuando existan descriptores en seguimiento, se resumirán acá." />
              )}
            </SurfaceCard>
          </div>

          <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
            <SurfaceCard title="Observación final" subtitle="Comentario general del cierre disponible para esta evaluación.">
              <p className="rounded-2xl border border-white/10 bg-[#0f1f28] px-4 py-4 text-sm text-[#9fb6c4]">
                {managerDetail?.comentariosGenerales ||
                  autoDetail?.comentariosGenerales ||
                  "Todavía no hay observaciones finales cargadas."}
              </p>
            </SurfaceCard>

            <SurfaceCard title="Evidencias" subtitle="Mostramos evidencia o comentario descriptor por descriptor cuando ya existe.">
              {evaluationEvidence.length ? (
                <div className="space-y-3">
                  {evaluationEvidence.map((item, index) => (
                    <article key={`${item.metric}-${index}`} className="rounded-2xl border border-white/10 bg-[#0f1f28] px-4 py-4">
                      <p className="text-sm font-semibold text-white">{item.metric}</p>
                      <p className="mt-2 text-sm text-[#9fb6c4]">{item.comment}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState compact title="Todavía no hay evidencias visibles" description="Cuando existan comentarios o evidencia por descriptor, aparecerán acá." />
              )}
            </SurfaceCard>
          </div>
        </div>
      ) : null}

      {activeTab === "visual" ? (
        <div className="space-y-5">
          <SurfaceCard title="Comparación por habilidad" subtitle="Barras simples para leer rápido autoevaluación versus evaluación del jefe.">
            {comparisonRows.length ? (
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparisonRows}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#284152" />
                    <XAxis dataKey="name" stroke="#9fb6c4" tickLine={false} axisLine={false} />
                    <YAxis domain={[0, 5]} stroke="#9fb6c4" tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="auto" name="Autoevaluación" fill="#60a5fa" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="jefe" name="Jefatura" fill="#34d399" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState compact title="Sin datos suficientes para comparar" description="Cuando haya autoevaluación y evaluación del jefe, aparecerá esta comparación." />
            )}
          </SurfaceCard>

          <SurfaceCard title="Distribución de niveles" subtitle="Lectura simple de cuántos descriptores quedaron en cada nivel 1–5.">
            {distributionRows.some((item) => item.auto || item.jefe) ? (
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={distributionRows}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#284152" />
                    <XAxis dataKey="level" stroke="#9fb6c4" tickLine={false} axisLine={false} />
                    <YAxis stroke="#9fb6c4" tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="auto" name="Autoevaluación" fill="#818cf8" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="jefe" name="Jefatura" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState compact title="Sin niveles visibles" description="Cuando existan descriptores puntuados, aparecerá esta distribución." />
            )}
          </SurfaceCard>
        </div>
      ) : null}

      {editor.open ? (
        <div ref={editorRef}>
          <EvaluationEditor
            title={
              editor.mode === "edit"
                ? editor.type === "AUTOEVALUACION"
                  ? "Editar autoevaluación"
                  : "Editar evaluación del jefe"
                : editor.type === "AUTOEVALUACION"
                  ? "Nueva autoevaluación"
                  : "Nueva evaluación del jefe"
            }
            form={editorForm}
            groups={groups}
            saving={saving}
            canDelete={editor.mode === "edit" && Boolean(editorForm.id)}
            onFieldChange={(field, value) => setEditorForm((current) => ({ ...current, [field]: value }))}
            onScoreChange={updateEditorScore}
            onCommentChange={updateEditorComment}
            onSubmit={handleSaveEditor}
            onCancel={closeEditor}
            onDelete={() => handleDeleteEvaluation(editorForm.id)}
            highlight
          />
        </div>
      ) : null}

      <SurfaceCard
        title="Compatibilidad con KPIs / OKRs"
        subtitle="Los objetivos existentes siguen funcionando, pero ahora quedan como apoyo del proceso de evaluación y no como vista principal."
        actions={
          <button
            type="button"
            onClick={() => setView("evaluaciones")}
            className="rounded-2xl border border-white/15 px-4 py-2 text-sm text-white"
          >
            Ir a Evaluaciones
          </button>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
            <p className="text-sm font-semibold text-white">Qué mide Evaluaciones</p>
            <p className="mt-2 text-sm text-[#9fb6c4]">
              Desempeño por competencias, autoevaluación, evaluación superior, evidencias y resumen final.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
            <p className="text-sm font-semibold text-white">Qué conservan KPIs / OKRs</p>
            <p className="mt-2 text-sm text-[#9fb6c4]">
              Objetivos medibles y contexto operativo. Se preservan, pero ya no dominan la experiencia principal.
            </p>
          </div>
        </div>
      </SurfaceCard>
    </div>
  );
}
