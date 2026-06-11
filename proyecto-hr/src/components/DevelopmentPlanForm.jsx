import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";
import { useToast } from "../context/ToastContext";

export default function DevelopmentPlanForm({ plan, onVolver, onSave }) {
  const { token } = useAuth();
  const { addToast } = useToast();
  const [empleados, setEmpleados] = useState([]);
  const [cargandoEmpleados, setCargandoEmpleados] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [formData, setFormData] = useState(
    plan || {
      titulo: "",
      descripcion: "",
      empleadoEmail: "",
      employeeId: "",
      fechaInicio: new Date().toISOString().split("T")[0],
      fechaFin: "",
      estado: "no_iniciado",
      responsable: "",
      objetivos: [],
      competencias: [],
    }
  );

  useEffect(() => {
    cargarEmpleados();
  }, []);

  const cargarEmpleados = async () => {
    try {
      setCargandoEmpleados(true);
      const data = await apiFetch("/records", { token });
      setEmpleados(
        Array.isArray(data?.records)
          ? data.records
          : Array.isArray(data)
          ? data
          : []
      );
    } catch (err) {
      console.error(err);
    } finally {
      setCargandoEmpleados(false);
    }
  };

  const handleSelectEmpleado = (e) => {
    const selectedId = e.target.value;
    const empleado = empleados.find((emp) => emp._id === selectedId);

    if (empleado) {
      setFormData({
        ...formData,
        employeeId: empleado._id,
        empleadoEmail: empleado.email,
      });
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const agregarObjetivo = () => {
    setFormData({
      ...formData,
      objetivos: [
        ...formData.objetivos,
        {
          descripcion: "",
          estado: "pendiente",
          fechaTarget: "",
        },
      ],
    });
  };

  const actualizarObjetivo = (index, field, value) => {
    const nuevoObjetivos = [...formData.objetivos];
    nuevoObjetivos[index] = { ...nuevoObjetivos[index], [field]: value };
    setFormData({ ...formData, objetivos: nuevoObjetivos });
  };

  const eliminarObjetivo = (index) => {
    setFormData({
      ...formData,
      objetivos: formData.objetivos.filter((_, i) => i !== index),
    });
  };

  const agregarCompetencia = () => {
    setFormData({
      ...formData,
      competencias: [
        ...formData.competencias,
        {
          nombre: "",
          nivelActual: 1,
          nivelTarget: 3,
          acciones: [],
        },
      ],
    });
  };

  const actualizarCompetencia = (index, field, value) => {
    const nuevoCompetencias = [...formData.competencias];
    nuevoCompetencias[index] = { ...nuevoCompetencias[index], [field]: value };
    setFormData({ ...formData, competencias: nuevoCompetencias });
  };

  const eliminarCompetencia = (index) => {
    setFormData({
      ...formData,
      competencias: formData.competencias.filter((_, i) => i !== index),
    });
  };

  const handleGuardar = async () => {
    try {
      setGuardando(true);
      await apiFetch(
        plan ? `/development-plans/${plan._id}` : "/development-plans",
        {
          token,
          method: plan ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        }
      );
      addToast({ message: plan ? "Plan actualizado" : "Plan creado", type: "success" });
      onSave();
    } catch (err) {
      addToast({ message: err.message, type: "error" });
    } finally {
      setGuardando(false);
    }
  };

  const inputClass =
    "w-full rounded-xl border border-white/10 bg-[#091319] px-3.5 py-2.5 text-sm text-white placeholder-white/30 focus:border-[#14b8a6]/50 focus:outline-none focus:ring-1 focus:ring-[#14b8a6]/30 transition";
  const selectClass =
    "w-full appearance-none rounded-xl border border-white/10 bg-[#091319] px-3.5 py-2.5 text-sm text-white placeholder-white/30 focus:border-[#14b8a6]/50 focus:outline-none focus:ring-1 focus:ring-[#14b8a6]/30 transition";
  const labelClass = "block text-xs text-[#7a9aaa] mb-1.5";

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={onVolver}
        className="flex items-center gap-1.5 text-sm text-[#7a9aaa] hover:text-white transition"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="w-4 h-4"
        >
          <path
            fillRule="evenodd"
            d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z"
            clipRule="evenodd"
          />
        </svg>
        Volver
      </button>

      {/* Main card */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#0c1e28] p-6 space-y-6">
        <h2 className="text-white text-xl font-bold">
          {plan ? "Editar Plan" : "Nuevo Plan de Desarrollo"}
        </h2>

        {/* Grid: basic fields */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Título del Plan *</label>
            <input
              type="text"
              name="titulo"
              value={formData.titulo}
              onChange={handleInputChange}
              placeholder="Ej: Plan de liderazgo 2025"
              className={inputClass}
              required
            />
          </div>

          <div>
            <label className={labelClass}>Empleado *</label>
            <select
              value={formData.employeeId}
              onChange={handleSelectEmpleado}
              className={selectClass}
              disabled={cargandoEmpleados}
            >
              {cargandoEmpleados ? (
                <option value="">Cargando empleados...</option>
              ) : (
                <>
                  <option value="">Seleccionar empleado</option>
                  {empleados.map((emp) => (
                    <option key={emp._id} value={emp._id}>
                      {emp.nombreCompleto} ({emp.email})
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>

          <div>
            <label className={labelClass}>Fecha de Inicio *</label>
            <input
              type="date"
              name="fechaInicio"
              value={formData.fechaInicio}
              onChange={handleInputChange}
              className={inputClass}
              required
            />
          </div>

          <div>
            <label className={labelClass}>Fecha de Fin *</label>
            <input
              type="date"
              name="fechaFin"
              value={formData.fechaFin}
              onChange={handleInputChange}
              className={inputClass}
              required
            />
          </div>

          <div>
            <label className={labelClass}>Estado</label>
            <select
              name="estado"
              value={formData.estado}
              onChange={handleInputChange}
              className={selectClass}
            >
              <option value="no_iniciado">No iniciado</option>
              <option value="en_curso">En curso</option>
              <option value="completado">Completado</option>
              <option value="pausado">Pausado</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>Responsable</label>
            <input
              type="text"
              name="responsable"
              value={formData.responsable}
              onChange={handleInputChange}
              placeholder="Nombre del responsable"
              className={inputClass}
            />
          </div>
        </div>

        {/* Descripción */}
        <div>
          <label className={labelClass}>Descripción</label>
          <textarea
            name="descripcion"
            value={formData.descripcion}
            onChange={handleInputChange}
            rows="3"
            placeholder="Descripción del plan..."
            className={inputClass}
          />
        </div>

        {/* Objetivos */}
        <div className="border-t border-white/[0.06] pt-6 mt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Objetivos</h3>
            <button
              onClick={agregarObjetivo}
              className="text-xs text-[#14b8a6] border border-[#14b8a6]/30 bg-[#14b8a6]/10 rounded-lg px-3 py-1.5 hover:bg-[#14b8a6]/20 transition"
            >
              + Agregar
            </button>
          </div>

          <div className="space-y-3">
            {formData.objetivos.map((objetivo, index) => (
              <div
                key={index}
                className="rounded-xl border border-white/[0.06] bg-[#091319]/50 p-4 space-y-3"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Descripción del objetivo"
                    value={objetivo.descripcion}
                    onChange={(e) =>
                      actualizarObjetivo(index, "descripcion", e.target.value)
                    }
                    className={inputClass + " flex-1"}
                  />
                  <button
                    onClick={() => eliminarObjetivo(index)}
                    className="text-[#7a9aaa] hover:text-rose-400 transition text-lg leading-none"
                  >
                    ✕
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={objetivo.estado}
                    onChange={(e) =>
                      actualizarObjetivo(index, "estado", e.target.value)
                    }
                    className={selectClass}
                  >
                    <option value="pendiente">Pendiente</option>
                    <option value="en_progreso">En progreso</option>
                    <option value="completado">Completado</option>
                  </select>

                  <input
                    type="date"
                    value={objetivo.fechaTarget}
                    onChange={(e) =>
                      actualizarObjetivo(index, "fechaTarget", e.target.value)
                    }
                    className={inputClass}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Competencias */}
        <div className="border-t border-white/[0.06] pt-6 mt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">
              Competencias a Desarrollar
            </h3>
            <button
              onClick={agregarCompetencia}
              className="text-xs text-[#14b8a6] border border-[#14b8a6]/30 bg-[#14b8a6]/10 rounded-lg px-3 py-1.5 hover:bg-[#14b8a6]/20 transition"
            >
              + Agregar
            </button>
          </div>

          <div className="space-y-3">
            {formData.competencias.map((comp, index) => (
              <div
                key={index}
                className="rounded-xl border border-white/[0.06] bg-[#091319]/50 p-4 space-y-3"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Nombre de la competencia"
                    value={comp.nombre}
                    onChange={(e) =>
                      actualizarCompetencia(index, "nombre", e.target.value)
                    }
                    className={inputClass + " flex-1"}
                  />
                  <button
                    onClick={() => eliminarCompetencia(index)}
                    className="text-[#7a9aaa] hover:text-rose-400 transition text-lg leading-none"
                  >
                    ✕
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[#7a9aaa] block mb-1">
                      Nivel Actual: {comp.nivelActual}
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      value={comp.nivelActual}
                      onChange={(e) =>
                        actualizarCompetencia(
                          index,
                          "nivelActual",
                          parseInt(e.target.value)
                        )
                      }
                      className="w-full accent-[#14b8a6]"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-[#7a9aaa] block mb-1">
                      Nivel Target: {comp.nivelTarget}
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      value={comp.nivelTarget}
                      onChange={(e) =>
                        actualizarCompetencia(
                          index,
                          "nivelTarget",
                          parseInt(e.target.value)
                        )
                      }
                      className="w-full accent-[#14b8a6]"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-white/[0.06] pt-6 flex gap-3 justify-end">
          <button
            onClick={onVolver}
            className="border border-white/10 bg-white/[0.04] text-white/70 px-5 py-2 rounded-xl hover:bg-white/[0.08] transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleGuardar}
            disabled={guardando || !formData.titulo || !formData.empleadoEmail}
            className="bg-[#14b8a6] text-[#022019] font-semibold px-6 py-2 rounded-xl disabled:opacity-40 transition hover:brightness-110"
          >
            {guardando ? "Guardando..." : "Guardar Plan"}
          </button>
        </div>
      </div>
    </div>
  );
}
