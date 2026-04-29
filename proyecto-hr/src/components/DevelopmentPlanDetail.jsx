import { useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function DevelopmentPlanDetail({ plan, onVolver, onDelete, onUpdate }) {
  const { token } = useAuth();
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [datosEdit, setDatosEdit] = useState(plan);

  const handleGuardar = async () => {
    try {
      setGuardando(true);
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/development-plans/${plan._id}`,
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
      onUpdate();
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setGuardando(false);
    }
  };

  const handleActualizarObjetivo = async (index, objetivoData) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/development-plans/${plan._id}/objectives/${index}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(objetivoData),
        }
      );

      if (!response.ok) throw new Error("Error al actualizar");
      onUpdate();
    } catch (err) {
      alert("Error: " + err.message);
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
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-3xl font-bold text-slate-900">{datosEdit.titulo}</h2>
            <p className="text-slate-600 mt-1">Para: {datosEdit.empleadoEmail}</p>
          </div>

          <div className="flex gap-2">
            {!editando && (
              <>
                <button
                  onClick={() => onDelete()}
                  className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl"
                >
                  Eliminar
                </button>
                <button
                  onClick={() => setEditando(true)}
                  className="bg-emerald-500 text-white px-4 py-2 rounded-xl hover:bg-emerald-600"
                >
                  Editar
                </button>
              </>
            )}
          </div>
        </div>

        {/* Información general */}
        <div className="grid grid-cols-3 gap-6 mb-8 pb-6 border-b border-slate-200">
          <div>
            <p className="text-xs text-slate-500 mb-1">Estado</p>
            {editando ? (
              <select
                value={datosEdit.estado}
                onChange={(e) =>
                  setDatosEdit({ ...datosEdit, estado: e.target.value })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              >
                <option value="no_iniciado">No iniciado</option>
                <option value="en_curso">En curso</option>
                <option value="completado">Completado</option>
                <option value="pausado">Pausado</option>
              </select>
            ) : (
              <span
                className={`inline-block px-3 py-1 rounded text-sm font-semibold ${
                  datosEdit.estado === "en_curso"
                    ? "bg-blue-100 text-blue-800"
                    : datosEdit.estado === "completado"
                    ? "bg-emerald-100 text-emerald-800"
                    : datosEdit.estado === "pausado"
                    ? "bg-yellow-100 text-yellow-800"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                {datosEdit.estado}
              </span>
            )}
          </div>

          <div>
            <p className="text-xs text-slate-500 mb-2">Progreso General</p>
            <div className="w-full bg-slate-200 rounded-full h-3">
              <div
                className="bg-emerald-500 h-3 rounded-full transition-all"
                style={{ width: `${datosEdit.progreso}%` }}
              />
            </div>
            <p className="text-sm font-semibold mt-1">{datosEdit.progreso}%</p>
          </div>

          <div>
            <p className="text-xs text-slate-500 mb-1">Responsable</p>
            {editando ? (
              <input
                type="text"
                value={datosEdit.responsable || ""}
                onChange={(e) =>
                  setDatosEdit({ ...datosEdit, responsable: e.target.value })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            ) : (
              <p className="text-sm">{datosEdit.responsable || "-"}</p>
            )}
          </div>
        </div>

        {/* Fechas */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          <div>
            <p className="text-xs text-slate-500 mb-1">Fecha de Inicio</p>
            <p className="text-sm">
              {new Date(datosEdit.fechaInicio).toLocaleDateString("es-ES")}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Fecha de Fin</p>
            <p className="text-sm">
              {new Date(datosEdit.fechaFin).toLocaleDateString("es-ES")}
            </p>
          </div>
        </div>

        {/* Descripción */}
        <div className="mb-8">
          <h3 className="font-semibold text-slate-900 mb-2">Descripción</h3>
          {editando ? (
            <textarea
              value={datosEdit.descripcion || ""}
              onChange={(e) =>
                setDatosEdit({ ...datosEdit, descripcion: e.target.value })
              }
              rows="4"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          ) : (
            <p className="text-slate-600">{datosEdit.descripcion || "-"}</p>
          )}
        </div>

        {/* Objetivos */}
        <div className="border-t border-slate-200 pt-6 mb-8">
          <h3 className="font-semibold text-slate-900 mb-4">Objetivos</h3>
          <div className="space-y-3">
            {datosEdit.objetivos.map((objetivo, index) => (
              <div
                key={index}
                className="border border-slate-200 rounded-lg p-4 hover:shadow-md"
              >
                <div className="flex justify-between items-start mb-2">
                  <p className="font-medium text-slate-900">
                    {objetivo.descripcion}
                  </p>
                  <select
                    value={objetivo.estado}
                    onChange={(e) =>
                      handleActualizarObjetivo(index, {
                        ...objetivo,
                        estado: e.target.value,
                      })
                    }
                    className="px-2 py-1 border border-slate-300 rounded text-sm"
                  >
                    <option value="pendiente">Pendiente</option>
                    <option value="en_progreso">En progreso</option>
                    <option value="completado">Completado</option>
                  </select>
                </div>

                <p className="text-xs text-slate-500">
                  Fecha target:{" "}
                  {objetivo.fechaTarget
                    ? new Date(objetivo.fechaTarget).toLocaleDateString("es-ES")
                    : "-"}
                </p>
              </div>
            ))}
            {datosEdit.objetivos.length === 0 && (
              <p className="text-slate-500 text-sm">No hay objetivos definidos</p>
            )}
          </div>
        </div>

        {/* Competencias */}
        <div className="border-t border-slate-200 pt-6">
          <h3 className="font-semibold text-slate-900 mb-4">
            Competencias a Desarrollar
          </h3>
          <div className="space-y-4">
            {datosEdit.competencias.map((comp, index) => (
              <div key={index} className="border border-slate-200 rounded-lg p-4">
                <p className="font-medium text-slate-900 mb-3">{comp.nombre}</p>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600">Nivel Actual</span>
                      <span className="font-semibold">{comp.nivelActual}/5</span>
                    </div>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((level) => (
                        <div
                          key={level}
                          className={`h-2 flex-1 rounded ${
                            level <= comp.nivelActual
                              ? "bg-blue-500"
                              : "bg-slate-200"
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600">Nivel Target</span>
                      <span className="font-semibold">{comp.nivelTarget}/5</span>
                    </div>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((level) => (
                        <div
                          key={level}
                          className={`h-2 flex-1 rounded ${
                            level <= comp.nivelTarget
                              ? "bg-emerald-500"
                              : "bg-slate-200"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {comp.acciones && comp.acciones.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-200">
                    <p className="text-xs font-medium text-slate-600 mb-2">
                      Acciones
                    </p>
                    <ul className="text-xs space-y-1">
                      {comp.acciones.map((accion, i) => (
                        <li key={i} className="text-slate-600">
                          • {accion}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
            {datosEdit.competencias.length === 0 && (
              <p className="text-slate-500 text-sm">
                No hay competencias definidas
              </p>
            )}
          </div>
        </div>

        {editando && (
          <div className="flex gap-3 mt-8 justify-end border-t border-slate-200 pt-6">
            <button
              onClick={() => {
                setDatosEdit(plan);
                setEditando(false);
              }}
              className="px-6 py-2 border border-slate-300 rounded-xl hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleGuardar}
              disabled={guardando}
              className="bg-emerald-500 text-white px-6 py-2 rounded-xl hover:bg-emerald-600 disabled:opacity-50"
            >
              {guardando ? "Guardando..." : "Guardar Cambios"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
