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
  const [securityStatus, setSecurityStatus] = useState(null);
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
    apiFetch("/auth/security-status", { token })
      .then(setSecurityStatus)
      .catch(() => {});
  }, [token]);

  async function save() {
    try {
      const data = await apiFetch("/settings", {
        method: "PUT",
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      setSettings((prev) => ({ ...prev, ...(data.settings || {}) }));
      await refreshBranding();
      setMessage("Configuracion actualizada.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-8">
        <p className="text-sm uppercase tracking-[0.22em] text-[#22c55e]">Control de organizacion</p>
        <h3 className="mt-3 text-3xl font-bold text-white">
          Configuracion de {activeCompany?.nombre || "la organizacion"}
        </h3>
        <p className="mt-3 text-[#9fb6c4]">
          Ajusta marca visual, reglas de carga y automatizaciones operativas.
        </p>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
          <h3 className="text-xl font-semibold text-white">Identidad y reglas</h3>
          <div className="mt-6 grid gap-4">
            <input className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" placeholder="Nombre visible" value={settings.nombreVisible} onChange={(e) => setSettings({ ...settings, nombreVisible: e.target.value })} />
            <input className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" placeholder="URL del logo" value={settings.logoUrl} onChange={(e) => setSettings({ ...settings, logoUrl: e.target.value })} />
            <div className="grid gap-4 md:grid-cols-[1fr_auto]">
              <input className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" placeholder="Color principal" value={settings.primaryColor} onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })} />
              <div className="h-full min-h-14 w-14 rounded-2xl border border-white/10" style={{ backgroundColor: settings.primaryColor }} />
            </div>
            <input type="number" min="1" className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" value={settings.maxUploadSizeMb} onChange={(e) => setSettings({ ...settings, maxUploadSizeMb: Number(e.target.value) || 10 })} />
            <input className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" placeholder="Dominio email por defecto" value={settings.defaultEmailDomain || ""} onChange={(e) => setSettings({ ...settings, defaultEmailDomain: e.target.value })} />
            <select className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" value={settings.defaultEmployeeRoleCode || "EMPLEADO"} onChange={(e) => setSettings({ ...settings, defaultEmployeeRoleCode: e.target.value })}>
              <option value="EMPLEADO">EMPLEADO</option>
              <option value="JEFE">JEFE</option>
              <option value="RRHH">RRHH</option>
              <option value="ADMIN_COLEGIO">ADMIN_COLEGIO</option>
            </select>
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
          <h3 className="text-xl font-semibold text-white">Automatizaciones</h3>
          <div className="mt-4 grid gap-3 text-sm text-[#c5d5de]">
            {[
              ["nightlyDataCheck", "Control nocturno de calidad de datos"],
              ["autoCreateUsersFromImport", "Crear usuarios automaticamente desde importaciones"],
              ["autoAssignDefaultRole", "Asignar rol por defecto si falta en una fila"],
              ["notifyOnImportErrors", "Notificar errores de importacion"],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0f1f28] px-3 py-2">
                <span>{label}</span>
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

          <button onClick={save} className="mt-6 rounded-2xl px-6 py-3 font-semibold text-white" style={{ backgroundColor: settings.primaryColor }}>
            Guardar configuracion
          </button>
          {message ? <p className="mt-3 text-sm text-[#c5d5de]">{message}</p> : null}
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
        <h3 className="text-xl font-semibold text-white">Seguridad de accesos</h3>
        {securityStatus ? (
          <div className="mt-4 space-y-2 text-sm text-[#c5d5de]">
            <p>
              Politica activa: {securityStatus.policy.maxAttempts} intentos en {securityStatus.policy.windowMinutes} min,
              bloqueo por {securityStatus.policy.lockMinutes} min.
            </p>
            <p>Logins fallidos recientes: {securityStatus.recentFailedLogins?.length || 0}</p>
            <p>Logins exitosos recientes: {securityStatus.recentSuccessLogins?.length || 0}</p>
          </div>
        ) : (
          <p className="mt-4 text-sm text-[#9fb6c4]">Cargando estado de seguridad...</p>
        )}
      </section>
    </div>
  );
}

