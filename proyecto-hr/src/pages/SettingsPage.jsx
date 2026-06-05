import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";
import { ErrorState, LoadingState } from "../components/AppStates";

const defaultSettings = {
  nombreVisible: "",
  logoUrl: "",
  primaryColor: "#10b981",
  maxUploadSizeMb: 10,
  defaultEmailDomain: "zentor.app",
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
  const [messageType, setMessageType] = useState("info");
  const [securityStatusState, setSecurityStatusState] = useState("loading");

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
      .catch((error) => {
        setMessageType("warning");
        setMessage(error.message);
      });
  }, [token]);

  useEffect(() => {
    setSecurityStatusState("loading");
    apiFetch("/auth/security-status", { token })
      .then((data) => {
        setSecurityStatus(data);
        setSecurityStatusState("ready");
      })
      .catch((error) => {
        setSecurityStatusState("error");
        setMessageType("error");
        setMessage(error.message);
      });
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
      setMessageType("success");
      setMessage("Configuración actualizada.");
    } catch (error) {
      setMessageType("error");
      setMessage(error.message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[#14b8a6]">Control de organización</p>
          <h2 className="mt-1 text-xl font-semibold text-white">
            Configuración de {activeCompany?.nombre || "la organización"}
          </h2>
        </div>
      </div>

      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
          <h3 className="text-xl font-semibold text-white">Identidad y reglas</h3>
          <div className="mt-6 grid gap-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-[#8fa9b7]">Nombre visible de la organización</span>
              <input className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" placeholder="Ej: Colegio San Martín" value={settings.nombreVisible} onChange={(e) => setSettings({ ...settings, nombreVisible: e.target.value })} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-[#8fa9b7]">URL del logo</span>
              <input className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" placeholder="https://mi-org.com/logo.png" value={settings.logoUrl} onChange={(e) => setSettings({ ...settings, logoUrl: e.target.value })} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-[#8fa9b7]">Color principal (hex)</span>
              <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <input className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" placeholder="#14b8a6" value={settings.primaryColor} onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })} />
                <div className="h-12 w-12 rounded-2xl border border-white/10 shadow-inner" style={{ backgroundColor: settings.primaryColor }} />
              </div>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-[#8fa9b7]">Tamaño máximo de archivos (MB)</span>
              <input type="number" min="1" className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" value={settings.maxUploadSizeMb} onChange={(e) => setSettings({ ...settings, maxUploadSizeMb: Number(e.target.value) || 10 })} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-[#8fa9b7]">Dominio de email por defecto</span>
              <input className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" placeholder="mi-org.com" value={settings.defaultEmailDomain || ""} onChange={(e) => setSettings({ ...settings, defaultEmailDomain: e.target.value })} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-[#8fa9b7]">Rol por defecto para nuevos empleados</span>
              <select className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" value={settings.defaultEmployeeRoleCode || "EMPLEADO"} onChange={(e) => setSettings({ ...settings, defaultEmployeeRoleCode: e.target.value })}>
                <option value="EMPLEADO">Empleado</option>
                <option value="JEFE">Jefe / Manager</option>
                <option value="RRHH">RRHH</option>
                <option value="ADMIN_COLEGIO">Administrador de colegio</option>
              </select>
            </label>
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
          <h3 className="text-xl font-semibold text-white">Automatizaciones</h3>
          <div className="mt-4 grid gap-3 text-sm text-[#c5d5de]">
            {[
              ["nightlyDataCheck", "Verificar calidad de datos automáticamente cada noche"],
              ["autoCreateUsersFromImport", "Crear usuarios automáticamente desde importaciones"],
              ["autoAssignDefaultRole", "Asignar rol por defecto si falta en una fila"],
              ["notifyOnImportErrors", "Notificar errores de importación"],
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
            Guardar configuración
          </button>
          {message ? (
            <p
              className={`mt-3 ${
                messageType === "error"
                  ? "pf-alert-error"
                  : messageType === "success"
                    ? "pf-alert-success"
                    : messageType === "warning"
                      ? "pf-alert-warning"
                      : "pf-alert-info"
              }`}
            >
              {message}
            </p>
          ) : null}
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
        <h3 className="text-xl font-semibold text-white">Seguridad de accesos</h3>
        {securityStatusState === "loading" ? (
          <div className="mt-4">
            <LoadingState
              compact
              title="Cargando estado de seguridad"
              description="Estamos revisando políticas e intentos recientes."
            />
          </div>
        ) : null}
        {securityStatusState === "error" ? (
          <div className="mt-4">
            <ErrorState
              compact
              title="No pudimos cargar el estado de seguridad"
              description="Reintenta para revisar políticas, logins recientes y bloqueos."
              actionLabel="Reintentar"
              onAction={() => {
                setMessage("");
                setSecurityStatusState("loading");
                apiFetch("/auth/security-status", { token })
                  .then((data) => {
                    setSecurityStatus(data);
                    setSecurityStatusState("ready");
                  })
                  .catch((error) => {
                    setSecurityStatusState("error");
                    setMessageType("error");
                    setMessage(error.message);
                  });
              }}
            />
          </div>
        ) : null}
        {securityStatusState === "ready" && securityStatus ? (
          <div className="mt-4 space-y-2 text-sm text-[#c5d5de]">
            <p>
              Política activa: {securityStatus.policy.maxAttempts} intentos en {securityStatus.policy.windowMinutes} min,
              bloqueo por {securityStatus.policy.lockMinutes} min.
            </p>
            <p>Logins fallidos recientes: {securityStatus.recentFailedLogins?.length || 0}</p>
            <p>Logins exitosos recientes: {securityStatus.recentSuccessLogins?.length || 0}</p>
          </div>
        ) : null}
      </section>
    </div>
  );
}

