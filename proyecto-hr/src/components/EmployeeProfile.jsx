import { useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function EmployeeProfile({ empleado, onVolver }) {
  const { token } = useAuth();
  const [editando, setEditando] = useState(false);
  const [datosEdit, setDatosEdit] = useState(empleado);
  const [guardando, setGuardando] = useState(false);
  const [descargando, setDescargando] = useState(null);

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
          headers: {
            Authorization: `Bearer ${token}`,
          },
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
            <h2 className="text-3xl font-bold text-slate-900">
              {datosEdit.nombreCompleto}
            </h2>
            <p className="text-slate-600 mt-1">{datosEdit.rol}</p>
          </div>

          <div className="flex gap-2">
            {!editando && (
              <>
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
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8">
          {/* Columna izquierda - Información personal */}
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-4">
                Información Personal
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Nombre Completo
                  </label>
                  {editando ? (
                    <input
                      type="text"
                      name="nombreCompleto"
                      value={datosEdit.nombreCompleto}
                      onChange={handleCambio}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    />
                  ) : (
                    <p className="text-slate-900">{datosEdit.nombreCompleto}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Email
                  </label>
                  {editando ? (
                    <input
                      type="email"
                      name="email"
                      value={datosEdit.email}
                      onChange={handleCambio}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    />
                  ) : (
                    <p className="text-slate-900">{datosEdit.email}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Teléfono
                  </label>
                  {editando ? (
                    <input
                      type="tel"
                      name="telefono"
                      value={datosEdit.telefono || ""}
                      onChange={handleCambio}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    />
                  ) : (
                    <p className="text-slate-900">{datosEdit.telefono || "-"}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Documento
                  </label>
                  {editando ? (
                    <input
                      type="text"
                      name="documento"
                      value={datosEdit.documento || ""}
                      onChange={handleCambio}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    />
                  ) : (
                    <p className="text-slate-900">{datosEdit.documento || "-"}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Información de ubicación */}
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-4">
                Ubicación
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Dirección
                  </label>
                  {editando ? (
                    <input
                      type="text"
                      name="direccion"
                      value={datosEdit.direccion || ""}
                      onChange={handleCambio}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    />
                  ) : (
                    <p className="text-slate-900">{datosEdit.direccion || "-"}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Ciudad
                  </label>
                  {editando ? (
                    <input
                      type="text"
                      name="ciudad"
                      value={datosEdit.ciudad || ""}
                      onChange={handleCambio}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    />
                  ) : (
                    <p className="text-slate-900">{datosEdit.ciudad || "-"}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Estado
                  </label>
                  {editando ? (
                    <input
                      type="text"
                      name="estado"
                      value={datosEdit.estado || ""}
                      onChange={handleCambio}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    />
                  ) : (
                    <p className="text-slate-900">{datosEdit.estado || "-"}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Columna derecha - Información laboral */}
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-4">
                Información Laboral
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Rol
                  </label>
                  {editando ? (
                    <input
                      type="text"
                      name="rol"
                      value={datosEdit.rol}
                      onChange={handleCambio}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    />
                  ) : (
                    <p className="text-slate-900">{datosEdit.rol}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Departamento
                  </label>
                  {editando ? (
                    <input
                      type="text"
                      name="departamento"
                      value={datosEdit.departamento || ""}
                      onChange={handleCambio}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    />
                  ) : (
                    <p className="text-slate-900">{datosEdit.departamento || "-"}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Jefe Directo
                  </label>
                  {editando ? (
                    <input
                      type="text"
                      name="jefe"
                      value={datosEdit.jefe || ""}
                      onChange={handleCambio}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    />
                  ) : (
                    <p className="text-slate-900">{datosEdit.jefe || "-"}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Tipo de Contrato
                  </label>
                  {editando ? (
                    <select
                      name="tipoContrato"
                      value={datosEdit.tipoContrato || ""}
                      onChange={handleCambio}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">Seleccionar</option>
                      <option value="indefinido">Indefinido</option>
                      <option value="fijo">Fijo</option>
                      <option value="temporal">Temporal</option>
                    </select>
                  ) : (
                    <p className="text-slate-900">{datosEdit.tipoContrato || "-"}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Salario
                  </label>
                  {editando ? (
                    <input
                      type="number"
                      name="salario"
                      value={datosEdit.salario || ""}
                      onChange={handleCambio}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    />
                  ) : (
                    <p className="text-slate-900">
                      {datosEdit.salario
                        ? `$${datosEdit.salario.toLocaleString()}`
                        : "-"}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Fecha de Ingreso
                  </label>
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
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    />
                  ) : (
                    <p className="text-slate-900">
                      {datosEdit.fechaIngreso
                        ? new Date(datosEdit.fechaIngreso).toLocaleDateString(
                            "es-ES"
                          )
                        : "-"}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Estado del Empleado
                  </label>
                  {editando ? (
                    <select
                      name="estado_empleado"
                      value={datosEdit.estado_empleado || "activo"}
                      onChange={handleCambio}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="activo">Activo</option>
                      <option value="inactivo">Inactivo</option>
                      <option value="licencia">Licencia</option>
                    </select>
                  ) : (
                    <p className="text-slate-900">
                      {datosEdit.estado_empleado || "activo"}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Descripción */}
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-4">
                Adicional
              </h3>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Descripción
                </label>
                {editando ? (
                  <textarea
                    name="descripcion"
                    value={datosEdit.descripcion || ""}
                    onChange={handleCambio}
                    rows="4"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                ) : (
                  <p className="text-slate-900">
                    {datosEdit.descripcion || "-"}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {editando && (
          <div className="flex gap-3 mt-8 justify-end border-t border-slate-200 pt-6">
            <button
              onClick={() => {
                setDatosEdit(empleado);
                setEditando(false);
              }}
              className="px-4 py-2 border border-slate-300 rounded-xl hover:bg-slate-50"
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
      </div>
    </div>
  );
}
