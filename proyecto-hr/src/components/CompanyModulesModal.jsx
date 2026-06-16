import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

const MODULE_LABELS = {
  evaluaciones:     "Evaluaciones y Ciclos",
  calibracion:      "Calibración",
  competencias:     "Competencias",
  planesDesarrollo: "Planes de Desarrollo",
  reporteEjecutivo: "Reporte Ejecutivo",
  orgchart:         "Organigrama",
  exportacion:      "Exportación / Descargas",
  kpis:             "KPIs y Métricas",
  cargaMasiva:      "Carga Masiva",
};

const DEFAULT_MODULES = {
  evaluaciones: true,
  calibracion: false,
  competencias: true,
  planesDesarrollo: true,
  reporteEjecutivo: true,
  orgchart: true,
  exportacion: true,
  kpis: false,
  cargaMasiva: true,
};

export function CompanyModulesModal({ company, token, onClose, onSaved, addToast }) {
  const [modules, setModules] = useState(() => ({
    ...DEFAULT_MODULES,
    ...(company?.modules || {}),
  }));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setModules({ ...DEFAULT_MODULES, ...(company?.modules || {}) });
  }, [company]);

  async function handleSave() {
    setSaving(true);
    try {
      const result = await apiFetch(`/companies/${company._id}/modules`, {
        token,
        method: "PATCH",
        body: modules,
      });
      addToast({ message: "Módulos actualizados correctamente", type: "success" });
      onSaved?.(result.modules);
      onClose();
    } catch {
      addToast({ message: "Error al guardar módulos", type: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#0c1e28] p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-white">Módulos activos</h2>
            <p className="text-xs text-[#7a9aaa] mt-0.5">{company.nombre}</p>
          </div>
          <button type="button" onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#7a9aaa] hover:text-white hover:bg-white/[0.05] transition">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="space-y-2">
          {Object.entries(MODULE_LABELS).map(([key, label]) => (
            <label key={key} className="flex cursor-pointer items-center justify-between rounded-xl border border-white/[0.06] bg-[#0f2030]/60 px-4 py-3 hover:border-[#14b8a6]/20 transition">
              <span className="text-sm text-[#c7d5dc]">{label}</span>
              <button
                type="button"
                role="switch"
                aria-checked={modules[key]}
                onClick={() => setModules(prev => ({ ...prev, [key]: !prev[key] }))}
                className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors ${
                  modules[key] ? "bg-[#14b8a6]" : "bg-white/10"
                }`}
              >
                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  modules[key] ? "translate-x-4" : "translate-x-0"
                }`} />
              </button>
            </label>
          ))}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose}
            className="rounded-xl border border-white/10 px-4 py-2 text-sm text-[#9fb6c4] hover:bg-white/[0.04] transition">
            Cancelar
          </button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="rounded-xl bg-[#14b8a6] px-4 py-2 text-sm font-medium text-[#022019] hover:bg-[#0d9488] disabled:opacity-50 transition">
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
