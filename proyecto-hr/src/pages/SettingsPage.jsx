import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";

const defaultSettings = {
  nombreVisible: "",
  logoUrl: "",
  primaryColor: "#10b981",
  maxUploadSizeMb: 10,
  defaultEmailDomain: "performia.app",
  defaultEmployeeRoleCode: "EMPLEADO",
  automations: {
    nightlyDataCheck: true,
    autoCreateUsersFromImport: false,
    autoAssignDefaultRole: true,
    notifyOnImportErrors: true,
  },
};

export default function SettingsPage() {
  const { token, activeCompany, refreshBranding } = useAuth();
  const [settings, setSettings] = useState(defaultSettings);
  const [quality, setQuality] = useState(null);
  const [latestQualityRun, setLatestQualityRun] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    apiFetch("/settings", { token })
      .then((data) => {
        if (data) {
          setSettings((prev) => ({
            ...prev,
            ...data,
            automations: { ...prev.automations, ...(data.automations || {}) },
          }));
        }
      })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    apiFetch("/education-exports/overview", { token })
      .then((data) => setQuality(data?.summary || null))
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    apiFetch("/automation/quality-latest", { token })
      .then((data) => setLatestQualityRun(data?.latest || null))
      .catch(() => {});
  }, [token]);

  const save = async () => {
    try {
      const data = await apiFetch("/settings", {
        method: "PUT",
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      setSettings((prev) => ({ ...prev, ...(data.settings || {}) }));
      await refreshBranding();
      setMessage("Parametros actualizados");
    } catch (error) {
      setMessage(error.message);
    }
  };

  return (
    <div className="space-y-6">
      <section className="pf-card p-8">
        <p className="text-sm uppercase tracking-[0.22em] text-emerald-400">Control de marca y operaciones</p>
        <h3 className="mt-3 text-3xl font-bold text-slate-950">
          Parametros de {activeCompany?.nombre || "la organizacion"}
        </h3>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="pf-card p-6">
          <h3 className="text-xl font-semibold text-slate-950">Identidad y reglas</h3>
          <div className="mt-6 grid gap-4">
            <input
              className="pf-input"
              placeholder="Nombre visible"
              value={settings.nombreVisible}
              onChange={(e) => setSettings({ ...settings, nombreVisible: e.target.value })}
            />
            <input
              className="pf-input"
              placeholder="URL del logo"
              value={settings.logoUrl}
              onChange={(e) => setSettings({ ...settings, logoUrl: e.target.value })}
            />
            <div className="grid gap-4 md:grid-cols-[1fr_auto]">
              <input
                className="pf-input"
                placeholder="Color principal"
                value={settings.primaryColor}
                onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
              />
              <div className="h-full min-h-14 w-14 rounded-2xl border border-white/10" style={{ backgroundColor: settings.primaryColor }} />
            </div>
            <input
              type="number"
              min="1"
              className="pf-input"
              value={settings.maxUploadSizeMb}
              onChange={(e) => setSettings({ ...settings, maxUploadSizeMb: Number(e.target.value) || 10 })}
            />
            <input
              className="pf-input"
              placeholder="Dominio email por defecto"
              value={settings.defaultEmailDomain || ""}
              onChange={(e) => setSettings({ ...settings, defaultEmailDomain: e.target.value })}
            />
            <select
              className="pf-input"
              value={settings.defaultEmployeeRoleCode || "EMPLEADO"}
              onChange={(e) => setSettings({ ...settings, defaultEmployeeRoleCode: e.target.value })}
            >
              <option value="EMPLEADO">EMPLEADO</option>
              <option value="JEFE">JEFE</option>
              <option value="RRHH">RRHH</option>
              <option value="ADMIN_COLEGIO">ADMIN_COLEGIO</option>
            </select>
          </div>
        </div>

        <div className="pf-card p-6">
          <h3 className="text-xl font-semibold text-slate-950">Automatizaciones</h3>
          <div className="mt-4 grid gap-3 text-sm text-slate-700">
            {[
              ["nightlyDataCheck", "Control nocturno de calidad de datos"],
              ["autoCreateUsersFromImport", "Crear usuarios automaticamente desde importaciones"],
              ["autoAssignDefaultRole", "Asignar rol por defecto si falta en la fila"],
              ["notifyOnImportErrors", "Notificar errores de importacion"],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#1A2C38] px-3 py-2">
                <span className="text-[#D4E1E8]">{label}</span>
                <input
                  type="checkbox"
                  checked={Boolean(settings.automations?.[key])}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      automations: { ...settings.automations, [key]: e.target.checked },
                    })
                  }
                />
              </label>
            ))}
          </div>

          {quality ? (
            <div className="mt-6 rounded-2xl border border-white/10 bg-[#1A2C38] p-4 text-sm text-[#D4E1E8]">
              <p className="text-xs uppercase tracking-[0.18em] text-[#9FB6C1]">Calidad de datos actual</p>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <p>Empleados: {quality.employees}</p>
                <p>Evaluaciones: {quality.evaluations}</p>
                <p>Metricas: {quality.metrics}</p>
                <p>Planes: {quality.developmentPlans}</p>
              </div>
            </div>
          ) : null}

          {latestQualityRun ? (
            <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-[#D4E1E8]">
              <p className="text-xs uppercase tracking-[0.18em] text-emerald-200">Ultimo control nocturno</p>
              <p className="mt-1">{new Date(latestQualityRun.createdAt).toLocaleString("es-AR")}</p>
              <p className="mt-1">{latestQualityRun.detalle}</p>
              <p className="mt-2">Score: {latestQualityRun.metrics?.score ?? "-"} / 100</p>
            </div>
          ) : null}

          <button
            onClick={save}
            className="mt-6 rounded-2xl px-6 py-3 font-semibold text-white"
            style={{ backgroundColor: settings.primaryColor }}
          >
            Guardar parametros
          </button>
          {message ? <p className="mt-3 text-sm text-[#A9BFCA]">{message}</p> : null}
        </div>
      </section>
    </div>
  );
}
