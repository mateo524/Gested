import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { apiFetch } from "../lib/api";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  ChevronDown,
  User,
  ClipboardList,
  TrendingUp,
  BarChart2,
} from "lucide-react";

// ---------------------------------------------------------------------------
// ProfileTab — accordion/tab hybrid
// ---------------------------------------------------------------------------
function ProfileTab({ label, icon, isOpen, onToggle, children }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0c1e28] overflow-hidden">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-white/5 transition-colors"
      >
        <span className="flex items-center gap-2.5 text-sm font-semibold text-white">
          {icon}
          {label}
        </span>
        <ChevronDown
          className={`size-4 text-[#7f99a8] transition-transform duration-300 ${
            isOpen ? "rotate-180 text-[#14b8a6]" : ""
          }`}
        />
      </button>
      {isOpen && (
        <div className="border-t border-white/[0.06] px-5 pb-5 pt-4 animate-in fade-in slide-in-from-top-2 duration-200">
          {children}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// EmployeeProfile
// ---------------------------------------------------------------------------
export default function EmployeeProfile({ empleado, onVolver }) {
  const { token } = useAuth();
  const { addToast } = useToast();
  const [editando, setEditando] = useState(false);
  const [datosEdit, setDatosEdit] = useState(empleado);
  const [guardando, setGuardando] = useState(false);
  const [descargando, setDescargando] = useState(null);

  // Active tab — only one open at a time
  const [openTab, setOpenTab] = useState("info");

  const toggleTab = (key) => setOpenTab((prev) => (prev === key ? null : key));

  // Evaluation history — lazy-loaded when tab first opens
  const [historial, setHistorial] = useState(null);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);

  useEffect(() => {
    if (openTab !== "evaluaciones" || historial !== null) return;
    const ctrl = new AbortController();
    setCargandoHistorial(true);
    apiFetch(`/employees/${empleado._id}/evaluation-history`, {
      token,
      signal: ctrl.signal,
    })
      .then((data) => setHistorial(data.history || []))
      .catch((err) => {
        if (!ctrl.signal.aborted) {
          addToast({ message: err.message, type: "error" });
          setHistorial([]);
        }
      })
      .finally(() => setCargandoHistorial(false));
    return () => ctrl.abort();
  }, [openTab]);

  const handleGuardar = async () => {
    try {
      setGuardando(true);
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/records/${empleado._id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(datosEdit),
        }
      );
      if (!response.ok) throw new Error("Error al guardar");
      setEditando(false);
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setGuardando(false);
    }
  };

  const descargarPDF = async () => {
    try {
      setDescargando("pdf");
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/export/pdf/employee/${empleado._id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!response.ok) throw new Error("Error al descargar");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${empleado.nombreCompleto}-reporte.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setDescargando(null);
    }
  };

  const handleCambio = (e) => {
    const { name, value } = e.target;
    setDatosEdit({ ...datosEdit, [name]: value });
  };

  // ---------------------------------------------------------------------------
  // Shared input style helpers
  // ---------------------------------------------------------------------------
  const inputCls =
    "w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500";

  const Field = ({ label, children }) => (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label}
      </label>
      {children}
    </div>
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={onVolver}
        className="text-emerald-600 hover:text-emerald-800 font-semibold text-sm"
      >
        ← Volver
      </button>

      {/* ── Header card (name + action buttons — always visible) ── */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm px-8 py-6 flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">
            {datosEdit.nombreCompleto}
          </h2>
          <p className="text-slate-600 mt-1">{datosEdit.rol}</p>
        </div>
        {!editando && (
          <div className="flex gap-2">
            <button
              onClick={descargarPDF}
              disabled={descargando === "pdf"}
              className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white px-4 py-2 rounded-xl transition"
            >
              {descargando === "pdf" ? "Descargando..." : "📄 PDF"}
            </button>
            <button
              onClick={() => setEditando(true)}
              className="bg-emerald-500 text-white px-4 py-2 rounded-xl hover:bg-emerald-600"
            >
              Editar
            </button>
          </div>
        )}
      </div>

      {/* ── Expandable tabs ── */}
      <div className="space-y-3">

        {/* ── Tab 1: Información ── */}
        <ProfileTab
          label="Información"
          icon={<User className="size-4 text-[#14b8a6]" />}
          isOpen={openTab === "info"}
          onToggle={() => toggleTab("info")}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Personal */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wide mb-2">
                Personal
              </h3>

              <Field label="Nombre Completo">
                {editando ? (
                  <input
                    type="text"
                    name="nombreCompleto"
                    value={datosEdit.nombreCompleto}
                    onChange={handleCambio}
                    className={inputCls}
                  />
                ) : (
                  <p className="text-white/90">{datosEdit.nombreCompleto}</p>
                )}
              </Field>

              <Field label="Email">
                {editando ? (
                  <input
                    type="email"
                    name="email"
                    value={datosEdit.email}
                    onChange={handleCambio}
                    className={inputCls}
                  />
                ) : (
                  <p className="text-white/90">{datosEdit.email}</p>
                )}
              </Field>

              <Field label="Teléfono">
                {editando ? (
                  <input
                    type="tel"
                    name="telefono"
                    value={datosEdit.telefono || ""}
                    onChange={handleCambio}
                    className={inputCls}
                  />
                ) : (
                  <p className="text-white/90">{datosEdit.telefono || "-"}</p>
                )}
              </Field>

              <Field label="Documento">
                {editando ? (
                  <input
                    type="text"
                    name="documento"
                    value={datosEdit.documento || ""}
                    onChange={handleCambio}
                    className={inputCls}
                  />
                ) : (
                  <p className="text-white/90">{datosEdit.documento || "-"}</p>
                )}
              </Field>

              <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wide mt-4 mb-2">
                Ubicación
              </h3>

              <Field label="Dirección">
                {editando ? (
                  <input
                    type="text"
                    name="direccion"
                    value={datosEdit.direccion || ""}
                    onChange={handleCambio}
                    className={inputCls}
                  />
                ) : (
                  <p className="text-white/90">{datosEdit.direccion || "-"}</p>
                )}
              </Field>

              <Field label="Ciudad">
                {editando ? (
                  <input
                    type="text"
                    name="ciudad"
                    value={datosEdit.ciudad || ""}
                    onChange={handleCambio}
                    className={inputCls}
                  />
                ) : (
                  <p className="text-white/90">{datosEdit.ciudad || "-"}</p>
                )}
              </Field>

              <Field label="Estado">
                {editando ? (
                  <input
                    type="text"
                    name="estado"
                    value={datosEdit.estado || ""}
                    onChange={handleCambio}
                    className={inputCls}
                  />
                ) : (
                  <p className="text-white/90">{datosEdit.estado || "-"}</p>
                )}
              </Field>
            </div>

            {/* Laboral */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wide mb-2">
                Laboral
              </h3>

              <Field label="Rol">
                {editando ? (
                  <input
                    type="text"
                    name="rol"
                    value={datosEdit.rol}
                    onChange={handleCambio}
                    className={inputCls}
                  />
                ) : (
                  <p className="text-white/90">{datosEdit.rol}</p>
                )}
              </Field>

              <Field label="Departamento">
                {editando ? (
                  <input
                    type="text"
                    name="departamento"
                    value={datosEdit.departamento || ""}
                    onChange={handleCambio}
                    className={inputCls}
                  />
                ) : (
                  <p className="text-white/90">
                    {datosEdit.departamento || "-"}
                  </p>
                )}
              </Field>

              <Field label="Jefe Directo">
                {editando ? (
                  <input
                    type="text"
                    name="jefe"
                    value={datosEdit.jefe || ""}
                    onChange={handleCambio}
                    className={inputCls}
                  />
                ) : (
                  <p className="text-white/90">{datosEdit.jefe || "-"}</p>
                )}
              </Field>

              <Field label="Tipo de Contrato">
                {editando ? (
                  <select
                    name="tipoContrato"
                    value={datosEdit.tipoContrato || ""}
                    onChange={handleCambio}
                    className={inputCls}
                  >
                    <option value="">Seleccionar</option>
                    <option value="indefinido">Indefinido</option>
                    <option value="fijo">Fijo</option>
                    <option value="temporal">Temporal</option>
                  </select>
                ) : (
                  <p className="text-white/90">
                    {datosEdit.tipoContrato || "-"}
                  </p>
                )}
              </Field>

              <Field label="Salario">
                {editando ? (
                  <input
                    type="number"
                    name="salario"
                    value={datosEdit.salario || ""}
                    onChange={handleCambio}
                    className={inputCls}
                  />
                ) : (
                  <p className="text-white/90">
                    {datosEdit.salario
                      ? `$${datosEdit.salario.toLocaleString()}`
                      : "-"}
                  </p>
                )}
              </Field>

              <Field label="Fecha de Ingreso">
                {editando ? (
                  <input
                    type="date"
                    name="fechaIngreso"
                    value={
                      datosEdit.fechaIngreso
                        ? datosEdit.fechaIngreso.split("T")[0]
                        : ""
                    }
                    onChange={handleCambio}
                    className={inputCls}
                  />
                ) : (
                  <p className="text-white/90">
                    {datosEdit.fechaIngreso
                      ? new Date(datosEdit.fechaIngreso).toLocaleDateString(
                          "es-ES"
                        )
                      : "-"}
                  </p>
                )}
              </Field>

              <Field label="Estado del Empleado">
                {editando ? (
                  <select
                    name="estado_empleado"
                    value={datosEdit.estado_empleado || "activo"}
                    onChange={handleCambio}
                    className={inputCls}
                  >
                    <option value="activo">Activo</option>
                    <option value="inactivo">Inactivo</option>
                    <option value="licencia">Licencia</option>
                  </select>
                ) : (
                  <p className="text-white/90">
                    {datosEdit.estado_empleado || "activo"}
                  </p>
                )}
              </Field>

              <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wide mt-4 mb-2">
                Adicional
              </h3>

              <Field label="Descripción">
                {editando ? (
                  <textarea
                    name="descripcion"
                    value={datosEdit.descripcion || ""}
                    onChange={handleCambio}
                    rows="4"
                    className={inputCls}
                  />
                ) : (
                  <p className="text-white/90">
                    {datosEdit.descripcion || "-"}
                  </p>
                )}
              </Field>
            </div>
          </div>

          {/* Edit action bar */}
          {editando && (
            <div className="flex gap-3 mt-6 justify-end border-t border-white/10 pt-5">
              <button
                onClick={() => {
                  setDatosEdit(empleado);
                  setEditando(false);
                }}
                className="px-4 py-2 border border-white/20 rounded-xl text-white/70 hover:bg-white/5"
              >
                Cancelar
              </button>
              <button
                onClick={handleGuardar}
                disabled={guardando}
                className="bg-emerald-500 text-white px-4 py-2 rounded-xl hover:bg-emerald-600 disabled:opacity-50"
              >
                {guardando ? "Guardando..." : "Guardar Cambios"}
              </button>
            </div>
          )}
        </ProfileTab>

        {/* ── Tab 2: Evaluaciones ── */}
        <ProfileTab
          label="Evaluaciones"
          icon={<ClipboardList className="size-4 text-[#14b8a6]" />}
          isOpen={openTab === "evaluaciones"}
          onToggle={() => toggleTab("evaluaciones")}
        >
          {cargandoHistorial ? (
            <p className="text-white/50 text-sm py-4">Cargando historial...</p>
          ) : !historial || historial.length === 0 ? (
            <p className="text-white/50 text-sm py-4">
              Sin evaluaciones cerradas aún.
            </p>
          ) : (
            <div className="space-y-6">
              {/* Mini line chart */}
              <div className="h-48 mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={historial.map((h) => ({
                      name: h.cycleName,
                      promedio: h.promedio,
                    }))}
                    margin={{ top: 4, right: 12, left: -10, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(255,255,255,0.08)"
                    />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 5]}
                      tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#091319",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "8px",
                        color: "#fff",
                      }}
                      formatter={(val) => [val, "Promedio"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="promedio"
                      stroke="#14b8a6"
                      strokeWidth={2}
                      dot={{ fill: "#14b8a6", r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Table */}
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-white/50 text-left">
                    <th className="pb-2 font-medium pr-4">Ciclo</th>
                    <th className="pb-2 font-medium pr-4">Fecha</th>
                    <th className="pb-2 font-medium pr-4">Promedio</th>
                    <th className="pb-2 font-medium">Tipo</th>
                  </tr>
                </thead>
                <tbody>
                  {historial.map((row, i) => (
                    <tr
                      key={i}
                      className="border-b border-white/5 hover:bg-white/5 transition"
                    >
                      <td className="py-2 pr-4 text-white font-medium">
                        {row.cycleName}
                      </td>
                      <td className="py-2 pr-4 text-white/70">
                        {row.fecha
                          ? new Date(row.fecha).toLocaleDateString("es-ES")
                          : "-"}
                      </td>
                      <td className="py-2 pr-4">
                        <span className="text-[#14b8a6] font-semibold">
                          {row.promedio.toFixed(2)}
                        </span>
                        <span className="text-white/30 text-xs"> / 5</span>
                      </td>
                      <td className="py-2">
                        {row.tipo ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-white/10 text-white/70 uppercase">
                            {row.tipo}
                          </span>
                        ) : (
                          <span className="text-white/30">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ProfileTab>

        {/* ── Tab 3: Planes de desarrollo ── */}
        <ProfileTab
          label="Planes de desarrollo"
          icon={<TrendingUp className="size-4 text-[#14b8a6]" />}
          isOpen={openTab === "planes"}
          onToggle={() => toggleTab("planes")}
        >
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <TrendingUp className="size-10 text-[#14b8a6]/40" />
            <p className="text-white/50 text-sm max-w-xs">
              Todavía no hay planes de desarrollo registrados para este
              empleado.
            </p>
            <button className="mt-1 px-4 py-2 rounded-xl bg-[#14b8a6]/15 text-[#14b8a6] text-sm font-semibold hover:bg-[#14b8a6]/25 transition-colors">
              + Crear plan de desarrollo
            </button>
          </div>
        </ProfileTab>

        {/* ── Tab 4: KPIs & OKRs ── */}
        <ProfileTab
          label="KPIs & OKRs"
          icon={<BarChart2 className="size-4 text-[#14b8a6]" />}
          isOpen={openTab === "kpis"}
          onToggle={() => toggleTab("kpis")}
        >
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <BarChart2 className="size-10 text-[#14b8a6]/40" />
            <p className="text-white/50 text-sm">Sin datos registrados</p>
          </div>
        </ProfileTab>
      </div>
    </div>
  );
}
