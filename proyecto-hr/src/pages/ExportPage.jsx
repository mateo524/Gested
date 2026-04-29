import { useAuth } from "../context/AuthContext";
import { useState } from "react";

export default function ExportPage() {
  const { token, hasPermission } = useAuth();
  const [descargando, setDescargando] = useState(null);

  const descargar = async (tipo) => {
    try {
      setDescargando(tipo);
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/export/${tipo}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        alert("Error al exportar");
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download =
        tipo === "csv"
          ? "reporte.csv"
          : tipo === "personal"
          ? "mi-reporte.xlsx"
          : tipo === "team"
          ? "equipo-reporte.xlsx"
          : "reporte.xlsx";
      a.click();

      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Error al descargar");
    } finally {
      setDescargando(null);
    }
  };

  const tieneExportTodos = hasPermission("export_reports") || hasPermission("export_all_reports");
  const tieneExportEquipo = hasPermission("export_team_reports") || hasPermission("export_all_reports");

  return (
    <div className="space-y-6">
      {/* Exportaciones personales */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-xl font-semibold mb-2">Mi Reporte Personal</h3>
        <p className="text-slate-600 text-sm mb-4">
          Descarga tu información personal y datos de desempeño
        </p>

        <div className="flex gap-3">
          <button
            onClick={() => descargar("personal")}
            disabled={descargando === "personal"}
            className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white px-5 py-3 rounded-2xl transition"
          >
            {descargando === "personal" ? "Descargando..." : "Descargar Excel"}
          </button>
        </div>
      </div>

      {/* Exportaciones de equipo */}
      {tieneExportEquipo && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-xl font-semibold mb-2">Reporte del Equipo</h3>
          <p className="text-slate-600 text-sm mb-4">
            Descarga información de los empleados a tu cargo
          </p>

          <div className="flex gap-3">
            <button
              onClick={() => descargar("team")}
              disabled={descargando === "team"}
              className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white px-5 py-3 rounded-2xl transition"
            >
              {descargando === "team" ? "Descargando..." : "Descargar Excel"}
            </button>
          </div>
        </div>
      )}

      {/* Exportaciones generales */}
      {tieneExportTodos && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-xl font-semibold mb-2">Reportes Completos</h3>
          <p className="text-slate-600 text-sm mb-4">
            Descarga datos de todos los empleados en diferentes formatos
          </p>

          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() => descargar("csv")}
              disabled={descargando === "csv"}
              className="bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white px-5 py-3 rounded-2xl transition"
            >
              {descargando === "csv" ? "Descargando..." : "Descargar CSV"}
            </button>

            <button
              onClick={() => descargar("excel")}
              disabled={descargando === "excel"}
              className="bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white px-5 py-3 rounded-2xl transition"
            >
              {descargando === "excel" ? "Descargando..." : "Descargar Excel"}
            </button>
          </div>
        </div>
      )}

      {/* Tabla de permisos */}
      <div className="bg-slate-50 rounded-3xl border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">
          Permisos de Descarga
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-300">
                <th className="text-left px-4 py-2 font-semibold text-slate-700">
                  Tipo de Descarga
                </th>
                <th className="text-left px-4 py-2 font-semibold text-slate-700">
                  Estado
                </th>
                <th className="text-left px-4 py-2 font-semibold text-slate-700">
                  Descripción
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-200 hover:bg-white">
                <td className="px-4 py-3">Reporte Personal</td>
                <td className="px-4 py-3">
                  <span className="inline-block px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-semibold">
                    ✓ Disponible
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  Tus datos personales y desempeño
                </td>
              </tr>

              <tr className="border-b border-slate-200 hover:bg-white">
                <td className="px-4 py-3">Reporte de Equipo</td>
                <td className="px-4 py-3">
                  {tieneExportEquipo ? (
                    <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">
                      ✓ Disponible
                    </span>
                  ) : (
                    <span className="inline-block px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-semibold">
                      ✗ Sin acceso
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  Datos de empleados a tu cargo
                </td>
              </tr>

              <tr className="hover:bg-white">
                <td className="px-4 py-3">Reportes Completos</td>
                <td className="px-4 py-3">
                  {tieneExportTodos ? (
                    <span className="inline-block px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-semibold">
                      ✓ Disponible
                    </span>
                  ) : (
                    <span className="inline-block px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-semibold">
                      ✗ Sin acceso
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  Todos los empleados en CSV y Excel
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}