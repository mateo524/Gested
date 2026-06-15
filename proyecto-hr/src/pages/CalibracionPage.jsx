import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";

function scoreColor(score) {
  if (score === null || score === undefined) return "bg-white/5 text-[#7a9aaa]";
  if (score <= 2) return "bg-rose-500/20 text-rose-200";
  if (score <= 2.9) return "bg-amber-500/20 text-amber-200";
  if (score <= 3.9) return "bg-amber-400/20 text-amber-100";
  if (score <= 4.9) return "bg-teal-500/20 text-teal-200";
  return "bg-emerald-500/20 text-emerald-200";
}

function ScoreCell({ value }) {
  return (
    <td className="px-3 py-2 text-center">
      <span
        className={`inline-flex min-w-[2.2rem] items-center justify-center rounded-xl px-2 py-1 text-xs font-semibold ${scoreColor(value)}`}
      >
        {value !== null && value !== undefined ? value : "—"}
      </span>
    </td>
  );
}

export default function CalibracionPage() {
  const { token } = useAuth();
  const [cycles, setCycles] = useState([]);
  const [selectedCycleId, setSelectedCycleId] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingCycles, setLoadingCycles] = useState(true);
  const [error, setError] = useState("");
  const [filterArea, setFilterArea] = useState("all");

  useEffect(() => {
    async function fetchCycles() {
      try {
        setLoadingCycles(true);
        const result = await apiFetch("/evaluation-cycles", { token });
        setCycles(Array.isArray(result) ? result : []);
      } catch {
        setCycles([]);
      } finally {
        setLoadingCycles(false);
      }
    }
    fetchCycles();
  }, [token]);

  const loadCalibration = useCallback(
    async (cycleId) => {
      if (!cycleId) return;
      setLoading(true);
      setError("");
      setData(null);
      try {
        const result = await apiFetch(`/evaluation-cycles/${cycleId}/calibration`, { token });
        setData(result);
      } catch (err) {
        setError(err.message || "Error cargando calibración");
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    if (selectedCycleId) loadCalibration(selectedCycleId);
  }, [selectedCycleId, loadCalibration]);

  const areas = useMemo(() => {
    if (!data?.rows) return [];
    return [...new Set(data.rows.map((r) => r.employee.area || "Sin área"))];
  }, [data]);

  const filteredRows = useMemo(() => {
    if (!data?.rows) return [];
    if (filterArea === "all") return data.rows;
    return data.rows.filter((r) => (r.employee.area || "Sin área") === filterArea);
  }, [data, filterArea]);

  // Group rows by area
  const groupedByArea = useMemo(() => {
    const groups = {};
    for (const row of filteredRows) {
      const area = row.employee.area || "Sin área";
      if (!groups[area]) groups[area] = [];
      groups[area].push(row);
    }
    return groups;
  }, [filteredRows]);

  const competencies = data?.competencies || [];

  return (
    <div className="space-y-6">
      <div className="pf-surface p-6">
        <div className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#14b8a6]">
          Calibración
        </div>
        <h1 className="text-2xl font-bold text-white">Matriz de calibración</h1>
        <p className="mt-1 text-sm text-[#7a9aaa]">
          Visualizá los puntajes de todos los empleados lado a lado para detectar inconsistencias antes de
          cerrar el ciclo.
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-[#7a9aaa] uppercase tracking-wider">Ciclo</label>
          <select
            className="rounded-2xl border border-white/10 bg-[#12222d] px-4 py-2.5 text-sm text-white min-w-[220px]"
            value={selectedCycleId}
            onChange={(e) => setSelectedCycleId(e.target.value)}
            disabled={loadingCycles}
          >
            <option value="">
              {loadingCycles ? "Cargando ciclos…" : "Seleccionar ciclo"}
            </option>
            {cycles.map((c) => (
              <option key={c._id} value={c._id}>
                {c.periodo} {c.anio} — {c.estado}
              </option>
            ))}
          </select>
        </div>

        {areas.length > 0 && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[#7a9aaa] uppercase tracking-wider">Filtrar por área</label>
            <select
              className="rounded-2xl border border-white/10 bg-[#12222d] px-4 py-2.5 text-sm text-white min-w-[180px]"
              value={filterArea}
              onChange={(e) => setFilterArea(e.target.value)}
            >
              <option value="all">Todas las áreas</option>
              {areas.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        )}

        {data && (
          <div className="ml-auto flex items-center gap-3 text-xs text-[#7a9aaa]">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full bg-rose-500/50" /> 1–2 Bajo
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full bg-amber-500/50" /> 3 Medio
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full bg-teal-500/50" /> 4 Alto
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full bg-emerald-500/50" /> 5 Destacado
            </span>
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="pf-card p-8 text-center text-sm text-[#7a9aaa]">
          Cargando calibración…
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      {/* Empty state — no cycle selected */}
      {!loading && !data && !error && (
        <div className="pf-card flex flex-col items-center justify-center gap-3 p-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-[#0c1e28] text-2xl">
            📊
          </div>
          <p className="text-base font-semibold text-white">Seleccioná un ciclo para comenzar</p>
          <p className="text-sm text-[#7a9aaa]">
            Elegí un ciclo del selector de arriba para ver la matriz de calibración.
          </p>
        </div>
      )}

      {/* Matrix */}
      {data && !loading && (
        <div className="pf-card overflow-x-auto">
          {data.cycle && (
            <div className="border-b border-white/10 px-5 py-4">
              <p className="text-sm font-semibold text-white">
                {data.cycle.periodo}{" "}
                <span className="ml-2 rounded-full bg-[#14b8a6]/15 px-2.5 py-0.5 text-xs text-[#14b8a6]">
                  {data.cycle.estado}
                </span>
              </p>
              <p className="mt-0.5 text-xs text-[#7a9aaa]">{filteredRows.length} empleado(s) en vista</p>
            </div>
          )}

          {competencies.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-[#7a9aaa]">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-6 w-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </span>
              <p className="text-sm font-semibold text-white">Sin evaluaciones para este ciclo</p>
              <p className="max-w-xs text-xs text-[#7a9aaa]">Cuando se cierren evaluaciones en el ciclo seleccionado, los resultados aparecerán aquí para calibrar.</p>
            </div>
          ) : (
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-white/10 text-[#7a9aaa]">
                  <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider">
                    Empleado
                  </th>
                  <th className="px-3 py-3 text-left font-semibold text-xs uppercase tracking-wider">
                    Área / Cargo
                  </th>
                  {competencies.map((comp) => (
                    <th
                      key={comp}
                      className="px-3 py-3 text-center font-semibold text-xs uppercase tracking-wider max-w-[120px]"
                    >
                      <span className="block truncate max-w-[100px] mx-auto" title={comp}>
                        {comp}
                      </span>
                    </th>
                  ))}
                  <th className="px-3 py-3 text-center font-semibold text-xs uppercase tracking-wider">
                    Promedio
                  </th>
                  <th className="px-3 py-3 text-center font-semibold text-xs uppercase tracking-wider">
                    Tipo
                  </th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(groupedByArea).map(([area, rows]) => (
                  <>
                    {/* Area subheading */}
                    <tr key={`area-${area}`} className="bg-[#0c1e28]/60">
                      <td
                        colSpan={3 + competencies.length + 1}
                        className="px-4 py-2 text-xs font-bold uppercase tracking-[0.15em] text-[#14b8a6]"
                      >
                        {area}
                      </td>
                    </tr>

                    {/* Employee rows */}
                    {rows.map((row) => (
                      <tr
                        key={String(row.employee._id)}
                        className="border-t border-white/5 transition hover:bg-white/[0.03]"
                      >
                        <td className="px-4 py-2.5 font-medium text-white">
                          {row.employee.nombre}
                        </td>
                        <td className="px-3 py-2.5 text-[#8ea5b3]">
                          <div className="text-xs">{row.employee.area}</div>
                          <div className="text-[11px] text-[#6b8797]">{row.employee.cargo}</div>
                        </td>
                        {competencies.map((comp) => (
                          <ScoreCell key={comp} value={row.scores[comp] ?? null} />
                        ))}
                        <ScoreCell value={row.average} />
                        <td className="px-3 py-2 text-center">
                          <span className="rounded-full bg-white/8 px-2 py-0.5 text-[10px] text-[#c7d5dc] uppercase tracking-wide">
                            {row.evaluationType}
                          </span>
                        </td>
                      </tr>
                    ))}

                    {/* Area average row */}
                    <tr key={`avg-${area}`} className="border-t border-white/10 bg-[#0c1e28]/40">
                      <td
                        colSpan={2}
                        className="px-4 py-2 text-xs font-semibold text-[#7a9aaa] italic"
                      >
                        Promedio del área — {area}
                      </td>
                      {competencies.map((comp) => (
                        <td key={comp} className="px-3 py-2 text-center text-xs text-[#7a9aaa]">
                          —
                        </td>
                      ))}
                      <td className="px-3 py-2 text-center">
                        <span
                          className={`inline-flex min-w-[2.2rem] items-center justify-center rounded-xl px-2 py-1 text-xs font-bold ${scoreColor(data.areaAverages?.[area])}`}
                        >
                          {data.areaAverages?.[area] ?? "—"}
                        </span>
                      </td>
                      <td />
                    </tr>
                  </>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
