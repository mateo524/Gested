import { useAuth } from "../context/AuthContext";
import { apiUrl } from "../lib/api";

export default function ExportPage() {
  const { token, activeCompanyId } = useAuth();

  const download = async (type) => {
    const response = await fetch(`${apiUrl}/export/${type}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        ...(activeCompanyId ? { "X-Company-Id": activeCompanyId } : {}),
      },
    });

    if (!response.ok) {
      alert("Error al exportar");
      return;
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = type === "csv" ? "reporte.csv" : "reporte.xlsx";
    a.click();

    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
      <h3 className="text-xl font-semibold mb-4">Exportaciones</h3>

      <div className="flex gap-4">
        <button
          onClick={() => download("csv")}
          className="bg-emerald-500 text-white px-5 py-3 rounded-2xl"
        >
          Exportar CSV
        </button>

        <button
          onClick={() => download("excel")}
          className="bg-slate-900 text-white px-5 py-3 rounded-2xl"
        >
          Exportar Excel
        </button>
      </div>
    </div>
  );
}
