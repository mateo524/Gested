import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useView } from "../context/ViewContext";
import { apiFetch } from "../lib/api";

const tabs = [
  { key: "resumen", label: "Resumen" },
  { key: "personas", label: "Personas" },
  { key: "kpis", label: "KPIs" },
  { key: "okrs", label: "OKRs" },
  { key: "evaluaciones", label: "Evaluaciones" },
  { key: "desarrollo", label: "Desarrollo" },
  { key: "acciones", label: "Acciones" },
];

const severityTone = {
  high: "border-rose-300/30 bg-rose-500/10 text-rose-100",
  medium: "border-amber-300/30 bg-amber-500/10 text-amber-100",
  low: "border-sky-300/30 bg-sky-500/10 text-sky-100",
};

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("es-AR", {
    dateStyle: "medium",
  });
}

function StatCard({ label, value, hint }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-[#0F1A21] p-4">
      <p className="text-xs uppercase tracking-[0.08em] text-[#7A9AAA]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      {hint ? <p className="mt-1 text-sm text-[#8FA9B7]">{hint}</p> : null}
    </article>
  );
}

function EmptyPanel({ text }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#122530] px-5 py-6 text-sm text-[#9fb6c4]">
      {text}
    </div>
  );
}

function InsightList({ items, renderItem }) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <article key={item._id} className="rounded-2xl border border-white/10 bg-[#0F1A21] p-4">
          {renderItem(item)}
        </article>
      ))}
    </div>
  );
}

export default function ExecutiveReportPage() {
  const { token, user } = useAuth();
  const { setView } = useView();
  const [activeTab, setActiveTab] = useState("resumen");
  const [cycleId, setCycleId] = useState("");
  const [department, setDepartment] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [overview, setOverview] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState("");

  const canViewExecutive =
    user?.isSuperAdmin ||
    user?.permisos?.includes("view_reports") ||
    user?.permisos?.includes("download_reports") ||
    user?.permisos?.includes("download_team_reports") ||
    user?.permisos?.includes("view_audit");

  const isEmployee = user?.roleCode === "EMPLEADO" || user?.roleKey === "EMPLOYEE";

  const loadOverview = useCallback(async () => {
    if (!token || !canViewExecutive || isEmployee) return;
    try {
      setLoadingOverview(true);
      setError("");
      const params = new URLSearchParams();
      if (cycleId) params.set("cycleId", cycleId);
      if (department) params.set("department", department);
      if (employeeId) params.set("employeeId", employeeId);
      const query = params.toString() ? `?${params.toString()}` : "";
      const data = await apiFetch(`/reports/executive/overview${query}`, {
        token,
        timeoutMs: 30000,
      });
      setOverview(data);

      const nextCycleId = data?.filters?.selectedCycleId || "";
      const nextDepartment = data?.filters?.selectedDepartment || "";
      const nextEmployeeId = data?.filters?.selectedEmployeeId || "";

      if (!cycleId && nextCycleId) setCycleId(nextCycleId);
      if (!department && nextDepartment) setDepartment(nextDepartment);
      if (nextEmployeeId && nextEmployeeId !== employeeId) setEmployeeId(nextEmployeeId);
      if (!nextEmployeeId) setDetail(null);
    } catch (nextError) {
      setOverview(null);
      setDetail(null);
      setError(nextError.message);
    } finally {
      setLoadingOverview(false);
    }
  }, [canViewExecutive, cycleId, department, employeeId, isEmployee, token]);

  const loadEmployeeDetail = useCallback(async (currentEmployeeId) => {
    if (!token || !currentEmployeeId || !canViewExecutive || isEmployee) return;
    try {
      setLoadingDetail(true);
      const params = new URLSearchParams();
      if (cycleId) params.set("cycleId", cycleId);
      const query = params.toString() ? `?${params.toString()}` : "";
      const data = await apiFetch(`/reports/executive/employees/${currentEmployeeId}${query}`, {
        token,
        timeoutMs: 30000,
      });
      setDetail(data);
    } catch (nextError) {
      setDetail(null);
      setError(nextError.message);
    } finally {
      setLoadingDetail(false);
    }
  }, [canViewExecutive, cycleId, isEmployee, token]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (overview?.filters?.selectedEmployeeId) {
      loadEmployeeDetail(overview.filters.selectedEmployeeId);
    }
  }, [loadEmployeeDetail, overview?.filters?.selectedEmployeeId]);

  const employees = overview?.catalogs?.employees || [];
  const cycles = overview?.catalogs?.cycles || [];
  const departments = overview?.catalogs?.departments || [];
  const selectedEmployeeIndex = employees.findIndex((item) => item._id === (overview?.filters?.selectedEmployeeId || employeeId));
  const selectedEmployee = detail?.employee || overview?.selectedEmployee || null;

  const actionList = useMemo(() => {
    const items = [...(overview?.actions || []), ...(detail?.actions || [])];
    return items;
  }, [detail?.actions, overview?.actions]);

  function moveEmployee(offset) {
    if (!employees.length || selectedEmployeeIndex < 0) return;
    const nextIndex = selectedEmployeeIndex + offset;
    if (nextIndex < 0 || nextIndex >= employees.length) return;
    setEmployeeId(employees[nextIndex]._id);
  }

  if (!canViewExecutive || isEmployee) {
    return (
      <div className="space-y-6">
        <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#7A9AAA]">Reportes &gt; Reporte ejecutivo</p>
          <h2 className="mt-2 text-2xl font-bold text-white">Reporte Ejecutivo</h2>
          <div className="mt-5 rounded-2xl border border-rose-300/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-100">
            No tienes permisos para ver este reporte organizacional.
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#7A9AAA]">Reportes &gt; Reporte ejecutivo</p>
        <h2 className="mt-2 text-3xl font-bold text-white">Reporte Ejecutivo Interactivo</h2>
        <p className="mt-3 max-w-4xl text-sm text-[#A9BFCA]">
          Revisa ciclo, area, personas, evaluaciones y planes sin salir de la misma pantalla. Las acciones recomendadas
          se basan en atrasos operativos y datos visibles para tu alcance.
        </p>

        <div className="mt-6 grid gap-4 xl:grid-cols-[1.2fr_1fr_1fr_1fr]">
          <label className="block">
            <span className="mb-2 block text-sm text-[#c5d5de]">Ciclo</span>
            <select
              className="w-full rounded-2xl border border-white/15 bg-[#0F1A21] px-4 py-3 text-white"
              value={cycleId}
              onChange={(event) => setCycleId(event.target.value)}
            >
              <option value="">Todos los ciclos visibles</option>
              {cycles.map((cycle) => (
                <option key={cycle._id} value={cycle._id}>
                  {cycle.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm text-[#c5d5de]">Area / departamento</span>
            <select
              className="w-full rounded-2xl border border-white/15 bg-[#0F1A21] px-4 py-3 text-white"
              value={department}
              onChange={(event) => {
                setDepartment(event.target.value);
                setEmployeeId("");
              }}
            >
              <option value="">Todas las areas visibles</option>
              {departments.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.label} ({item.count})
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm text-[#c5d5de]">Empleado</span>
            <select
              className="w-full rounded-2xl border border-white/15 bg-[#0F1A21] px-4 py-3 text-white"
              value={employeeId}
              onChange={(event) => setEmployeeId(event.target.value)}
            >
              <option value="">Seleccion automatico</option>
              {employees.map((employee) => (
                <option key={employee._id} value={employee._id}>
                  {employee.fullName} {employee.area ? `- ${employee.area}` : ""}
                </option>
              ))}
            </select>
          </label>

          <div className="rounded-2xl border border-white/10 bg-[#0F1A21] p-4">
            <p className="text-xs uppercase tracking-[0.08em] text-[#7A9AAA]">Navegacion interna</p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => moveEmployee(-1)}
                disabled={selectedEmployeeIndex <= 0}
                className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                type="button"
                onClick={() => moveEmployee(1)}
                disabled={selectedEmployeeIndex < 0 || selectedEmployeeIndex >= employees.length - 1}
                className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white disabled:opacity-40"
              >
                Siguiente
              </button>
            </div>
          </div>
        </div>
      </section>

      {error ? <div className="pf-alert-error">{error}</div> : null}

      {loadingOverview ? (
        <EmptyPanel text="Cargando reporte ejecutivo..." />
      ) : !overview ? (
        <EmptyPanel text="No pudimos cargar el reporte ejecutivo para este alcance." />
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <StatCard label="Personas visibles" value={overview.summary?.employeesTotal || 0} hint={`${overview.summary?.departmentsTotal || 0} areas`} />
            <StatCard label="Evaluaciones" value={overview.summary?.evaluationsTotal || 0} hint={`${overview.summary?.evaluationsPending || 0} pendientes`} />
            <StatCard label="Planes abiertos" value={overview.summary?.openPlans || 0} hint={`${overview.summary?.overduePlans || 0} vencidos`} />
            <StatCard label="Sin manager" value={overview.summary?.employeesWithoutManager || 0} hint="Personas sin responsable" />
            <StatCard label="Promedio" value={overview.summary?.averageScore || 0} hint="Resultado visible en el alcance" />
          </section>

          <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
            <div className="flex flex-wrap gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`rounded-xl px-4 py-2.5 text-sm transition ${
                    activeTab === tab.key
                      ? "bg-[#1e3a8a] text-white"
                      : "border border-white/10 bg-[#142028] text-[#AFC3CE]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="mt-6">
              {activeTab === "resumen" ? (
                <div className="space-y-5">
                  <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                    <article className="rounded-2xl border border-white/10 bg-[#0F1A21] p-5">
                      <p className="text-sm font-semibold text-white">Vista actual</p>
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <div className="rounded-xl border border-white/10 bg-[#122530] p-4">
                          <p className="text-xs text-[#7A9AAA]">Ciclo</p>
                          <p className="mt-2 text-base font-semibold text-white">{overview.selectedCycle?.label || "Todos los ciclos visibles"}</p>
                          <p className="mt-1 text-sm text-[#8FA9B7]">
                            {overview.selectedCycle?.estado || "Sin filtro"} · cierre {formatDate(overview.selectedCycle?.fechaFin)}
                          </p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-[#122530] p-4">
                          <p className="text-xs text-[#7A9AAA]">Empleado seleccionado</p>
                          <p className="mt-2 text-base font-semibold text-white">{selectedEmployee?.fullName || "Sin persona seleccionada"}</p>
                          <p className="mt-1 text-sm text-[#8FA9B7]">{selectedEmployee?.cargo || "-"} {selectedEmployee?.area ? `· ${selectedEmployee.area}` : ""}</p>
                        </div>
                      </div>
                    </article>

                    <article className="rounded-2xl border border-white/10 bg-[#0F1A21] p-5">
                      <p className="text-sm font-semibold text-white">Señales rapidas</p>
                      <div className="mt-4 space-y-3 text-sm text-[#c8d8df]">
                        <p>- {overview.summary?.cyclesOpen || 0} ciclos abiertos visibles.</p>
                        <p>- {overview.summary?.evaluationsPending || 0} evaluaciones pendientes dentro del alcance.</p>
                        <p>- {overview.summary?.overduePlans || 0} planes con seguimiento vencido.</p>
                        <p>- {overview.summary?.employeesWithoutManager || 0} personas sin manager asignado.</p>
                      </div>
                    </article>
                  </div>

                  {selectedEmployee ? (
                    <article className="rounded-2xl border border-white/10 bg-[#0F1A21] p-5">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-white">Detalle de la persona seleccionada</p>
                          <p className="mt-1 text-sm text-[#8FA9B7]">
                            {selectedEmployee.fullName} · {selectedEmployee.cargo || "Sin cargo"} {selectedEmployee.area ? `· ${selectedEmployee.area}` : ""}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setView("evaluaciones")} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white">
                            Ir a Evaluaciones
                          </button>
                          <button type="button" onClick={() => setView("planes")} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white">
                            Ir a Desarrollo
                          </button>
                        </div>
                      </div>
                      {loadingDetail ? (
                        <p className="mt-4 text-sm text-[#8FA9B7]">Cargando detalle del empleado...</p>
                      ) : detail ? (
                        <div className="mt-4 grid gap-3 md:grid-cols-4">
                          <StatCard label="Evaluaciones" value={detail.summary?.evaluationCount || 0} />
                          <StatCard label="Pendientes" value={detail.summary?.pendingEvaluations || 0} />
                          <StatCard label="Planes abiertos" value={detail.summary?.openPlans || 0} />
                          <StatCard label="Promedio" value={detail.summary?.averageScore || 0} />
                        </div>
                      ) : (
                        <p className="mt-4 text-sm text-[#8FA9B7]">No hay detalle adicional para esta persona.</p>
                      )}
                    </article>
                  ) : null}
                </div>
              ) : null}

              {activeTab === "personas" ? (
                employees.length ? (
                  <div className="space-y-3">
                    {employees.map((employee) => (
                      <button
                        key={employee._id}
                        type="button"
                        onClick={() => setEmployeeId(employee._id)}
                        className={`w-full rounded-2xl border p-4 text-left transition ${
                          employee._id === (overview.filters?.selectedEmployeeId || employeeId)
                            ? "border-[#3B82F6] bg-[#10233A]"
                            : "border-white/10 bg-[#0F1A21]"
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-white">{employee.fullName}</p>
                            <p className="mt-1 text-sm text-[#8FA9B7]">
                              {employee.cargo || "Sin cargo"} {employee.area ? `· ${employee.area}` : ""}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs">
                            <span className="rounded-full border border-white/10 bg-[#122530] px-3 py-1 text-[#d8e4ea]">
                              Eval: {employee.evaluationCount}
                            </span>
                            <span className="rounded-full border border-white/10 bg-[#122530] px-3 py-1 text-[#d8e4ea]">
                              Planes: {employee.planCount}
                            </span>
                            {!employee.hasManager ? (
                              <span className="rounded-full border border-amber-300/30 bg-amber-500/10 px-3 py-1 text-amber-100">
                                Sin manager
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <EmptyPanel text="No hay personas visibles para los filtros seleccionados." />
                )
              ) : null}

              {activeTab === "kpis" ? (
                loadingDetail ? (
                  <EmptyPanel text="Cargando KPIs..." />
                ) : detail?.kpis?.available && detail?.kpis?.items?.length ? (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-white/10 bg-[#0F1A21] p-4 text-sm text-[#AFC3CE]">
                      {selectedEmployee?.fullName || "La persona seleccionada"} tiene {detail.kpis.items.length} KPI(s)
                      operativo(s) visibles en este alcance.
                    </div>
                    <InsightList
                      items={detail.kpis.items}
                      renderItem={(item) => (
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-white">{item.name}</p>
                            <p className="mt-1 text-sm text-[#8FA9B7]">
                              {item.code || "Sin codigo"} {item.departmentCode ? `· ${item.departmentCode}` : ""}
                            </p>
                            <p className="mt-3 text-sm text-[#c8d8df]">
                              Objetivo {item.targetValue ?? "-"} {item.unit || ""}
                              {item.frequency ? ` · ${item.frequency}` : ""}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs">
                            {item.status ? (
                              <span className="rounded-full border border-white/10 bg-[#122530] px-3 py-1 text-[#d8e4ea]">
                                {item.status}
                              </span>
                            ) : null}
                            <span className="rounded-full border border-white/10 bg-[#122530] px-3 py-1 text-[#d8e4ea]">
                              Actualizado {formatDate(item.updatedAt)}
                            </span>
                          </div>
                        </div>
                      )}
                    />
                  </div>
                ) : (
                  <EmptyPanel text={detail?.kpis?.message || overview.kpis?.message || "Todavia no hay KPIs persistidos para este periodo."} />
                )
              ) : null}

              {activeTab === "okrs" ? (
                loadingDetail ? (
                  <EmptyPanel text="Cargando OKRs..." />
                ) : detail?.okrs?.available && detail?.okrs?.items?.length ? (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-white/10 bg-[#0F1A21] p-4 text-sm text-[#AFC3CE]">
                      {selectedEmployee?.fullName || "La persona seleccionada"} tiene {detail.okrs.items.length} OKR(s)
                      visibles en este alcance.
                    </div>
                    <InsightList
                      items={detail.okrs.items}
                      renderItem={(item) => (
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-white">{item.objectiveTitle}</p>
                            <p className="mt-1 text-sm text-[#8FA9B7]">
                              {item.keyResultTitle}
                              {item.quarter ? ` · ${item.quarter}` : ""}
                              {item.departmentCode ? ` · ${item.departmentCode}` : ""}
                            </p>
                            <p className="mt-3 text-sm text-[#c8d8df]">Meta {item.targetValue ?? "-"}</p>
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs">
                            {item.status ? (
                              <span className="rounded-full border border-white/10 bg-[#122530] px-3 py-1 text-[#d8e4ea]">
                                {item.status}
                              </span>
                            ) : null}
                            <span className="rounded-full border border-white/10 bg-[#122530] px-3 py-1 text-[#d8e4ea]">
                              Actualizado {formatDate(item.updatedAt)}
                            </span>
                          </div>
                        </div>
                      )}
                    />
                  </div>
                ) : (
                  <EmptyPanel text={detail?.okrs?.message || overview.okrs?.message || "Todavia no hay OKRs persistidos para este periodo."} />
                )
              ) : null}

              {activeTab === "evaluaciones" ? (
                loadingDetail ? (
                  <EmptyPanel text="Cargando evaluaciones..." />
                ) : detail?.evaluations?.length ? (
                  <div className="space-y-3">
                    {detail.evaluations.map((evaluation) => (
                      <article key={evaluation._id} className="rounded-2xl border border-white/10 bg-[#0F1A21] p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-white">{evaluation.tipo}</p>
                            <p className="mt-1 text-sm text-[#8FA9B7]">
                              {evaluation.cycle?.label || "Sin ciclo"} · {formatDate(evaluation.createdAt)}
                            </p>
                          </div>
                          <div className="flex gap-2 text-xs">
                            <span className="rounded-full border border-white/10 bg-[#122530] px-3 py-1 text-[#d8e4ea]">
                              {evaluation.estado}
                            </span>
                            <span className="rounded-full border border-white/10 bg-[#122530] px-3 py-1 text-[#d8e4ea]">
                              Resultado {evaluation.resultadoFinal || 0}
                            </span>
                          </div>
                        </div>
                        {evaluation.comentariosGenerales ? (
                          <p className="mt-3 text-sm text-[#c8d8df]">{evaluation.comentariosGenerales}</p>
                        ) : null}
                      </article>
                    ))}

                    {detail.metricSignals?.length ? (
                      <article className="rounded-2xl border border-white/10 bg-[#0F1A21] p-5">
                        <p className="text-sm font-semibold text-white">Indicadores evaluados</p>
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          {detail.metricSignals.map((signal) => (
                            <div key={signal.metricId} className="rounded-xl border border-white/10 bg-[#122530] p-4">
                              <p className="font-medium text-white">{signal.metricName}</p>
                              <p className="mt-1 text-sm text-[#8FA9B7]">{signal.competencyName}</p>
                              <p className="mt-3 text-sm text-[#d8e4ea]">
                                Promedio {signal.averageScore} · {signal.scoreCount} registros
                              </p>
                            </div>
                          ))}
                        </div>
                      </article>
                    ) : null}
                  </div>
                ) : (
                  <EmptyPanel text="No hay evaluaciones para la persona seleccionada en este alcance." />
                )
              ) : null}

              {activeTab === "desarrollo" ? (
                loadingDetail ? (
                  <EmptyPanel text="Cargando planes de desarrollo..." />
                ) : detail?.developmentPlans?.length ? (
                  <div className="space-y-3">
                    {detail.developmentPlans.map((plan) => (
                      <article key={plan._id} className="rounded-2xl border border-white/10 bg-[#0F1A21] p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-white">{plan.aspectoDesarrollar}</p>
                            <p className="mt-1 text-sm text-[#8FA9B7]">
                              Seguimiento {formatDate(plan.fechaSeguimiento)} · creado {formatDate(plan.createdAt)}
                            </p>
                          </div>
                          <span className="rounded-full border border-white/10 bg-[#122530] px-3 py-1 text-xs text-[#d8e4ea]">
                            {plan.estado}
                          </span>
                        </div>
                        {plan.fortalezas?.length ? (
                          <p className="mt-3 text-sm text-[#c8d8df]">Fortalezas: {plan.fortalezas.join(", ")}</p>
                        ) : null}
                        {plan.medicion ? <p className="mt-2 text-sm text-[#c8d8df]">Medicion: {plan.medicion}</p> : null}
                      </article>
                    ))}
                  </div>
                ) : (
                  <EmptyPanel text="No hay planes de desarrollo para la persona seleccionada." />
                )
              ) : null}

              {activeTab === "acciones" ? (
                actionList.length ? (
                  <div className="space-y-3">
                    {actionList.map((action, index) => (
                      <article
                        key={`${action.key || action.title}-${index}`}
                        className={`rounded-2xl border p-4 ${severityTone[action.severity] || severityTone.low}`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold">{action.title}</p>
                            <p className="mt-1 text-sm opacity-90">{action.description}</p>
                          </div>
                          {"count" in action ? (
                            <span className="rounded-full border border-current/20 px-3 py-1 text-xs">
                              {action.count}
                            </span>
                          ) : null}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <EmptyPanel text="No hay acciones recomendadas para los filtros seleccionados." />
                )
              ) : null}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
