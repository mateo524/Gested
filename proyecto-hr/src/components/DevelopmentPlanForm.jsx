import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";

export default function DevelopmentPlanForm({ plan, onVolver, onSave }) {
  const { token } = useAuth();
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
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/records`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) throw new Error("Error al cargar empleados");
      const data = await response.json();
      setEmpleados(data);
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

      const url = plan
        ? `${import.meta.env.VITE_API_URL}/development-plans/${plan._id}`
        : `${import.meta.env.VITE_API_URL}/development-plans`;

      const response = await fetch(url, {
        method: plan ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error("Error al guardar");
      onSave();
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-6">
      <button
        onClick={onVolver}
        className="text-emerald-600 hover:text-emerald-800 font-semibold text-sm"
      >
        ← Volver
      </button>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">
          {plan ? "Editar Plan" : "Nuevo Plan de Desarrollo"}
        </h2>

        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Título del Plan *
            </label>
            <input
              type="text"
              name="titulo"
              value={formData.titulo}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Empleado *
            </label>
            <select
              value={formData.employeeId}
              onChange={handleSelectEmpleado}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              disabled={cargandoEmpleados}
            >
              <option value="">Seleccionar empleado</option>
              {empleados.map((emp) => (
                <option key={emp._id} value={emp._id}>
                  {emp.nombreCompleto} ({emp.email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Fecha de Inicio *
            </label>
            <input
              type="date"
              name="fechaInicio"
              value={formData.fechaInicio}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Fecha de Fin *
            </label>
            <input
              type="date"
              name="fechaFin"
              value={formData.fechaFin}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Estado
            </label>
            <select
              name="estado"
              value={formData.estado}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            >
              <option value="no_iniciado">No iniciado</option>
              <option value="en_curso">En curso</option>
              <option value="completado">Completado</option>
              <option value="pausado">Pausado</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Responsable
            </label>
            <input
              type="text"
              name="responsable"
              value={formData.responsable}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Descripción
          </label>
          <textarea
            name="descripcion"
            value={formData.descripcion}
            onChange={handleInputChange}
            rows="3"
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Objetivos */}
        <div className="mt-8 border-t border-slate-200 pt-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-slate-900">Objetivos</h3>
            <button
              onClick={agregarObjetivo}
              className="text-sm px-3 py-1 border border-emerald-500 text-emerald-600 rounded hover:bg-emerald-50"
            >
              + Agregar
            </button>
          </div>

          <div className="space-y-3">
            {formData.objetivos.map((objetivo, index) => (
              <div key={index} className="border border-slate-200 rounded-lg p-4">
                <div className="flex justify-between mb-3">
                  <input
                    type="text"
                    placeholder="Descripción del objetivo"
                    value={objetivo.descripcion}
                    onChange={(e) =>
                      actualizarObjetivo(index, "descripcion", e.target.value)
                    }
                    className="flex-1 px-3 py-2 border border-slate-300 rounded mr-2"
                  />
                  <button
                    onClick={() => eliminarObjetivo(index)}
                    className="text-red-600 hover:text-red-800"
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
                    className="px-3 py-2 border border-slate-300 rounded text-sm"
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
                    className="px-3 py-2 border border-slate-300 rounded text-sm"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Competencias */}
        <div className="mt-8 border-t border-slate-200 pt-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-slate-900">
              Competencias a Desarrollar
            </h3>
            <button
              onClick={agregarCompetencia}
              className="text-sm px-3 py-1 border border-emerald-500 text-emerald-600 rounded hover:bg-emerald-50"
            >
              + Agregar
            </button>
          </div>

          <div className="space-y-3">
            {formData.competencias.map((comp, index) => (
              <div key={index} className="border border-slate-200 rounded-lg p-4">
                <div className="flex justify-between mb-3">
                  <input
                    type="text"
                    placeholder="Nombre de la competencia"
                    value={comp.nombre}
                    onChange={(e) =>
                      actualizarCompetencia(index, "nombre", e.target.value)
                    }
                    className="flex-1 px-3 py-2 border border-slate-300 rounded mr-2"
                  />
                  <button
                    onClick={() => eliminarCompetencia(index)}
                    className="text-red-600 hover:text-red-800"
                  >
                    ✕
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-600 block mb-1">
                      Nivel Actual: {comp.nivelActual}
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      value={comp.nivelActual}
                      onChange={(e) =>
                        actualizarCompetencia(index, "nivelActual", parseInt(e.target.value))
                      }
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-600 block mb-1">
                      Nivel Target: {comp.nivelTarget}
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      value={comp.nivelTarget}
                      onChange={(e) =>
                        actualizarCompetencia(index, "nivelTarget", parseInt(e.target.value))
                      }
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 mt-8 justify-end border-t border-slate-200 pt-6">
          <button
            onClick={onVolver}
            className="px-6 py-2 border border-slate-300 rounded-xl hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleGuardar}
            disabled={guardando || !formData.titulo || !formData.empleadoEmail}
            className="bg-emerald-500 text-white px-6 py-2 rounded-xl hover:bg-emerald-600 disabled:opacity-50"
          >
            {guardando ? "Guardando..." : "Guardar Plan"}
          </button>
        </div>
      </div>
    </div>
  );
}
