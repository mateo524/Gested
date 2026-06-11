import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";
import { useToast } from "../context/ToastContext";

export default function DevelopmentPlanDetail({ plan, onVolver, onDelete, onUpdate }) {
  const { token } = useAuth();
  const { addToast } = useToast();
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [datosEdit, setDatosEdit] = useState(plan);

  const handleGuardar = async () => {
    try {
      setGuardando(true);
      await apiFetch(`/development-plans/${plan._id}`, {
        token,
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(datosEdit),
      });
      setEditando(false);
      onUpdate();
    } catch (err) {
      addToast({ message: err.message, type: "error" });
    } finally {
      setGuardando(false);
    }
  };

  const handleActualizarObjetivo = async (index, objetivoData) => {
    try {
      await apiFetch(`/development-plans/${plan._id}/objectives/${index}`, {
        token,
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(objetivoData),
      });
      onUpdate();
    } catch (err) {
      addToast({ message: err.message, type: "error" });
    }
  };

  const estadoBadge = (estado) => {
    if (estado === "en_curso")
      return "bg-sky-500/10 text-sky-300 border border-sky-500/20";
    if (estado === "completado")
      return "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20";
    if (estado === "pausado")
      return "bg-amber-500/10 text-amber-300 border border-amber-500/20";
    return "bg-white/10 text-white/70 border border-white/10";
  };

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={onVolver}
        className="flex items-center gap-1.5 text-sm text-[#7a9aaa] hover:text-white transition"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Volver
      </button>

      <div className="rounded-2xl border border-white/[0.08] bg-[#0c1e28] p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-white">{datosEdit.titulo}</h2>
            <p className="text-[#7a9aaa] text-sm mt-1">Para: {datosEdit.empleadoEmail}</p>
          </div>

          <div className="flex gap-2">
            {!editando && (
              <>
                <button
                  onClick={() => onDelete()}
                  className="bg-rose-500/10 text-rose-300 border border-rose-500/20 px-4 py-2 rounded-xl text-sm"
                >
                  Eliminar
                </button>
                <button
                  onClick={() => setEditando(true)}
                  className="bg-[#14b8a6] text-[#022019] font-semibold px-5 py-2 rounded-xl text-sm"
                >
                  Editar
                </button>
              </>
            )}
          </div>
        </div>

        {/* General info */}
        <div className="grid grid-cols-3 gap-6 pb-6 border-b border-white/[0.06]">
          <div>
            <p className="text-[#7a9aaa] text-xs mb-1">Estado</p>
            {editando ? (
              <select
                value={datosEdit.estado}
                onChange={(e) =>
                  setDatosEdit({ ...datosEdit, estado: e.target.value })
                }
                className="w-full rounded-xl border border-white/10 bg-[#091319] px-3 py-2 text-sm text-white focus:border-[#14b8a6]/50 focus:outline-none transition"
              >
                <option value="no_iniciado">No iniciado</option>
                <option value="en_curso">En curso</option>
                <option value="completado">Completado</option>
                <option value="pausado">Pausado</option>
              </select>
            ) : (
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${estadoBadge(datosEdit.estado)}`}>
                {datosEdit.estado}
              </span>
            )}
          </div>

          <div>
            <p className="text-[#7a9aaa] text-xs mb-2">Progreso General</p>
            <div className="bg-[#091319] h-2 rounded-full">
              <div
                className="bg-[#14b8a6] h-2 rounded-full transition-all"
                style={{ width: `${datosEdit.progreso}%` }}
              />
            </div>
            <p className="text-[#c7d5dc] text-sm font-semibold mt-1">{datosEdit.progreso}%</p>
          </div>

          <div>
            <p className="text-[#7a9aaa] text-xs mb-1">Responsable</p>
            {editando ? (
              <input
                type="text"
                value={datosEdit.responsable || ""}
                onChange={(e) =>
                  setDatosEdit({ ...datosEdit, responsable: e.target.value })
                }
                className="w-full rounded-xl border border-white/10 bg-[#091319] px-3 py-2 text-sm text-white focus:border-[#14b8a6]/50 focus:outline-none transition"
              />
            ) : (
              <p className="text-[#c7d5dc] text-sm">{datosEdit.responsable || "-"}</p>
            )}
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-[#7a9aaa] text-xs mb-1">Fecha de Inicio</p>
            <p className="text-[#c7d5dc] text-sm">
              {new Date(datosEdit.fechaInicio).toLocaleDateString("es-ES")}
            </p>
          </div>
          <div>
            <p className="text-[#7a9aaa] text-xs mb-1">Fecha de Fin</p>
            <p className="text-[#c7d5dc] text-sm">
              {new Date(datosEdit.fechaFin).toLocaleDateString("es-ES")}
            </p>
          </div>
        </div>

        {/* Description */}
        <div>
          <h3 className="text-white font-semibold mb-2">Descripción</h3>
          {editando ? (
            <textarea
              value={datosEdit.descripcion || ""}
              onChange={(e) =>
                setDatosEdit({ ...datosEdit, descripcion: e.target.value })
              }
              rows="4"
              className="w-full rounded-xl border border-white/10 bg-[#091319] px-3 py-2 text-sm text-white focus:border-[#14b8a6]/50 focus:outline-none transition"
            />
          ) : (
            <p className="text-[#c7d5dc] text-sm">{datosEdit.descripcion || "-"}</p>
          )}
        </div>

        {/* Objectives */}
        <div className="border-t border-white/[0.06] pt-6">
          <h3 className="text-white font-semibold mb-4">Objetivos</h3>
          <div className="space-y-3">
            {datosEdit.objetivos.map((objetivo, index) => (
              <div
                key={index}
                className="rounded-xl border border-white/[0.06] bg-[#091319]/50 p-4"
              >
                <div className="flex justify-between items-start mb-2">
                  <p className="text-[#c7d5dc] text-sm font-medium">
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
                    className="rounded-xl border border-white/10 bg-[#091319] px-2 py-1 text-xs text-white focus:border-[#14b8a6]/50 focus:outline-none transition"
                  >
                    <option value="pendiente">Pendiente</option>
                    <option value="en_progreso">En progreso</option>
                    <option value="completado">Completado</option>
                  </select>
                </div>

                <p className="text-[#7a9aaa] text-xs">
                  Fecha target:{" "}
                  {objetivo.fechaTarget
                    ? new Date(objetivo.fechaTarget).toLocaleDateString("es-ES")
                    : "-"}
                </p>
              </div>
            ))}
            {datosEdit.objetivos.length === 0 && (
              <p className="text-[#7a9aaa] text-sm">No hay objetivos definidos</p>
            )}
          </div>
        </div>

        {/* Competencies */}
        <div className="border-t border-white/[0.06] pt-6">
          <h3 className="text-white font-semibold mb-4">Competencias a Desarrollar</h3>
          <div className="space-y-4">
            {datosEdit.competencias.map((comp, index) => (
              <div key={index} className="rounded-xl border border-white/[0.06] bg-[#091319]/50 p-4">
                <p className="text-white font-medium mb-3">{comp.nombre}</p>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-[#7a9aaa]">Nivel Actual</span>
                      <span className="text-[#c7d5dc] font-semibold">{comp.nivelActual}/5</span>
                    </div>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((level) => (
                        <div
                          key={level}
                          className={`h-1.5 flex-1 rounded-full ${
                            level <= comp.nivelActual ? "bg-[#14b8a6]" : "bg-white/10"
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-[#7a9aaa]">Nivel Target</span>
                      <span className="text-[#c7d5dc] font-semibold">{comp.nivelTarget}/5</span>
                    </div>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((level) => (
                        <div
                          key={level}
                          className={`h-1.5 flex-1 rounded-full ${
                            level <= comp.nivelTarget ? "bg-[#14b8a6]" : "bg-white/10"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {comp.acciones && comp.acciones.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-white/[0.06]">
                    <p className="text-[#7a9aaa] text-xs font-medium mb-2">Acciones</p>
                    <ul className="text-xs space-y-1">
                      {comp.acciones.map((accion, i) => (
                        <li key={i} className="text-[#c7d5dc]">
                          • {accion}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
            {datosEdit.competencias.length === 0 && (
              <p className="text-[#7a9aaa] text-sm">No hay competencias definidas</p>
            )}
          </div>
        </div>

        {/* Edit actions */}
        {editando && (
          <div className="flex gap-3 justify-end border-t border-white/[0.06] pt-6">
            <button
              onClick={() => {
                setDatosEdit(plan);
                setEditando(false);
              }}
              className="border border-white/10 bg-white/[0.04] text-white/70 px-5 py-2 rounded-xl hover:bg-white/[0.08] text-sm"
            >
              Cancelar
            </button>
            <button
              onClick={handleGuardar}
              disabled={guardando}
              className="bg-[#14b8a6] text-[#022019] font-semibold px-5 py-2 rounded-xl text-sm disabled:opacity-50"
            >
              {guardando ? "Guardando..." : "Guardar Cambios"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
