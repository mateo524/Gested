import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useView } from "../context/ViewContext";
import { apiFetch } from "../lib/api";
import { ErrorState, LoadingState } from "../components/AppStates";

const ALL_EVENTS = [
  { value: "evaluation.created", label: "Evaluación creada" },
  { value: "evaluation.closed", label: "Evaluación cerrada" },
  { value: "employee.created", label: "Empleado creado" },
  { value: "cycle.started", label: "Ciclo iniciado" },
  { value: "plan.created", label: "Plan de desarrollo creado" },
];

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
  const { token, activeCompany, refreshBranding, user } = useAuth();
  const { setView } = useView();
  const [settings, setSettings] = useState(defaultSettings);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");

  // Slack integration state
  const [slackWebhookUrl, setSlackWebhookUrl] = useState("");
  const [slackMessage, setSlackMessage] = useState("");
  const [slackMessageType, setSlackMessageType] = useState("info");
  const [savingSlack, setSavingSlack] = useState(false);
  const [testingSlack, setTestingSlack] = useState(false);

  // Webhooks state
  const [webhooks, setWebhooks] = useState([]);
  const [webhooksState, setWebhooksState] = useState("loading"); // loading | ready | error
  const [webhookForm, setWebhookForm] = useState({ url: "", events: [] });
  const [webhookMessage, setWebhookMessage] = useState("");
  const [webhookMessageType, setWebhookMessageType] = useState("info");
  const [savingWebhook, setSavingWebhook] = useState(false);
  const [testingWebhookId, setTestingWebhookId] = useState(null);

  const isAdmin = user?.permisos?.includes("manage_settings") || user?.isSuperAdmin;

  useEffect(() => {
    apiFetch("/settings", { token })
      .then((data) => {
        if (data) {
          setSettings((prev) => ({
            ...prev,
            ...data,
            automations: { ...prev.automations, ...(data.automations || {}) },
          }));
          if (data.slackWebhookUrl) setSlackWebhookUrl(data.slackWebhookUrl);
        }
      })
      .catch((error) => {
        setMessageType("warning");
        setMessage(error.message);
      });
  }, [token]);

  function loadWebhooks() {
    if (!isAdmin) return;
    setWebhooksState("loading");
    apiFetch("/webhooks-config", { token })
      .then((data) => {
        setWebhooks(Array.isArray(data) ? data : []);
        setWebhooksState("ready");
      })
      .catch(() => setWebhooksState("error"));
  }

  useEffect(() => {
    loadWebhooks();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isAdmin]);

  async function handleAddWebhook(event) {
    event.preventDefault();
    if (!webhookForm.url.startsWith("http")) {
      setWebhookMessage("La URL debe comenzar con http o https.");
      setWebhookMessageType("warning");
      return;
    }
    if (!webhookForm.events.length) {
      setWebhookMessage("Seleccioná al menos un evento.");
      setWebhookMessageType("warning");
      return;
    }
    try {
      setSavingWebhook(true);
      setWebhookMessage("");
      await apiFetch("/webhooks-config", {
        method: "POST",
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(webhookForm),
      });
      setWebhookForm({ url: "", events: [] });
      setWebhookMessage("Webhook agregado correctamente.");
      setWebhookMessageType("success");
      loadWebhooks();
    } catch (error) {
      setWebhookMessage(error.message);
      setWebhookMessageType("error");
    } finally {
      setSavingWebhook(false);
    }
  }

  async function handleDeleteWebhook(id) {
    try {
      await apiFetch(`/webhooks-config/${id}`, { method: "DELETE", token });
      setWebhooks((prev) => prev.filter((w) => w._id !== id));
    } catch (error) {
      setWebhookMessage(error.message);
      setWebhookMessageType("error");
    }
  }

  async function handleTestWebhook(id) {
    try {
      setTestingWebhookId(id);
      const result = await apiFetch(`/webhooks-config/${id}/test`, { method: "POST", token });
      setWebhookMessage(`Test enviado. Respuesta del servidor: ${result.status ?? "OK"}.`);
      setWebhookMessageType("success");
    } catch (error) {
      setWebhookMessage(`Error al probar: ${error.message}`);
      setWebhookMessageType("error");
    } finally {
      setTestingWebhookId(null);
    }
  }

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

  async function saveSlack() {
    try {
      setSavingSlack(true);
      setSlackMessage("");
      await apiFetch("/settings", {
        method: "PUT",
        token,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slackWebhookUrl }),
      });
      setSlackMessage("Webhook guardado correctamente.");
      setSlackMessageType("success");
    } catch (error) {
      setSlackMessage(error.message);
      setSlackMessageType("error");
    } finally {
      setSavingSlack(false);
    }
  }

  async function testSlack() {
    try {
      setTestingSlack(true);
      setSlackMessage("");
      await apiFetch("/settings/test-slack", { method: "POST", token });
      setSlackMessage("Mensaje de prueba enviado a tu workspace de Slack.");
      setSlackMessageType("success");
    } catch (error) {
      setSlackMessage(error.message);
      setSlackMessageType("error");
    } finally {
      setTestingSlack(false);
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
        <button
          type="button"
          onClick={() => setView("dashboard")}
          className="inline-flex items-center gap-2 rounded-2xl border border-white/15 px-4 py-2 text-sm text-[#c5d5de] transition hover:bg-white/5"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
            <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Volver
        </button>
      </div>

      <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
        <h3 className="text-xl font-semibold text-white">Identidad y reglas</h3>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-[#8fa9b7]">Nombre visible de la organización</span>
            <input className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" placeholder="Ej: Colegio San Martín" value={settings.nombreVisible} onChange={(e) => setSettings({ ...settings, nombreVisible: e.target.value })} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-[#8fa9b7]">URL del logo</span>
            <input className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" placeholder="https://mi-org.com/logo.png" value={settings.logoUrl} onChange={(e) => setSettings({ ...settings, logoUrl: e.target.value })} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-[#8fa9b7]">Dominio de email por defecto</span>
            <input className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" placeholder="mi-org.com" value={settings.defaultEmailDomain || ""} onChange={(e) => setSettings({ ...settings, defaultEmailDomain: e.target.value })} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-[#8fa9b7]">Color principal (hex)</span>
            <div className="grid gap-3 grid-cols-[1fr_auto]">
              <input className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" placeholder="#14b8a6" value={settings.primaryColor} onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })} />
              <div className="h-12 w-12 rounded-2xl border border-white/10 shadow-inner" style={{ backgroundColor: settings.primaryColor }} />
            </div>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-[#8fa9b7]">Tamaño máximo de archivos (MB)</span>
            <input type="number" min="1" className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white" value={settings.maxUploadSizeMb} onChange={(e) => setSettings({ ...settings, maxUploadSizeMb: Number(e.target.value) || 10 })} />
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
        <div className="mt-6 flex items-center gap-4">
          <button onClick={save} className="rounded-2xl px-6 py-3 font-semibold text-white" style={{ backgroundColor: settings.primaryColor }}>
            Guardar configuración
          </button>
          {message ? (
            <p
              className={`${
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

      {isAdmin ? (
        <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
          <h3 className="text-xl font-semibold text-white">Webhooks salientes</h3>
          <p className="mt-1 text-sm text-[#9fb6c4]">
            Recibí notificaciones automáticas en tus sistemas externos (Zapier, Make, etc.) cuando ocurran eventos en Zentor.
          </p>

          <div className="mt-5">
            {webhooksState === "loading" ? (
              <LoadingState compact title="Cargando webhooks" description="Un momento..." />
            ) : webhooksState === "error" ? (
              <ErrorState compact title="No se pudieron cargar los webhooks" description="Reintentá para ver la configuración." actionLabel="Reintentar" onAction={loadWebhooks} />
            ) : webhooks.length ? (
              <div className="mb-5 space-y-3">
                {webhooks.map((wh) => (
                  <div key={wh._id} className="flex flex-wrap items-start gap-3 rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
                    <div className="flex-1 min-w-0">
                      <p className="break-all text-sm font-semibold text-white">{wh.url}</p>
                      <p className="mt-1 text-xs text-[#9fb6c4]">
                        {(wh.events || []).join(", ") || "Sin eventos"} · {wh.active ? "Activo" : "Inactivo"}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={testingWebhookId === wh._id}
                        onClick={() => handleTestWebhook(wh._id)}
                        className="rounded-xl border border-white/15 px-3 py-1.5 text-xs font-semibold text-[#c5d5de] transition hover:bg-white/5"
                      >
                        {testingWebhookId === wh._id ? "Enviando..." : "Probar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteWebhook(wh._id)}
                        className="rounded-xl border border-rose-300/40 px-3 py-1.5 text-xs font-semibold text-rose-200"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mb-4 text-sm text-[#9fb6c4]">No hay webhooks configurados.</p>
            )}

            <form onSubmit={handleAddWebhook} className="space-y-3 rounded-2xl border border-white/10 bg-[#0f1f28] p-4">
              <p className="text-sm font-semibold text-white">Agregar webhook</p>
              <input
                className="w-full rounded-2xl border border-white/15 bg-[#122530] px-4 py-3 text-white"
                placeholder="https://hooks.zapier.com/..."
                value={webhookForm.url}
                onChange={(e) => setWebhookForm((prev) => ({ ...prev, url: e.target.value }))}
              />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {ALL_EVENTS.map((ev) => (
                  <label key={ev.value} className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#122530] px-3 py-2 text-xs text-[#c5d5de]">
                    <input
                      type="checkbox"
                      checked={webhookForm.events.includes(ev.value)}
                      onChange={(e) =>
                        setWebhookForm((prev) => ({
                          ...prev,
                          events: e.target.checked
                            ? [...prev.events, ev.value]
                            : prev.events.filter((x) => x !== ev.value),
                        }))
                      }
                    />
                    {ev.label}
                  </label>
                ))}
              </div>
              <button
                type="submit"
                disabled={savingWebhook}
                className="rounded-2xl bg-[#14b8a6] px-6 py-2.5 text-sm font-semibold text-[#0f172a] transition hover:bg-[#0d9488]"
              >
                {savingWebhook ? "Guardando..." : "Agregar webhook"}
              </button>
            </form>

            {webhookMessage ? (
              <p className={`mt-3 ${webhookMessageType === "error" ? "pf-alert-error" : webhookMessageType === "success" ? "pf-alert-success" : "pf-alert-warning"}`}>
                {webhookMessage}
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {isAdmin ? (
        <section className="rounded-[2rem] border border-white/10 bg-[#122530] p-6">
          <h3 className="text-xl font-semibold text-white">Integraciones</h3>
          <p className="mt-1 text-sm text-[#9fb6c4]">
            Conectá ZENTOR con herramientas externas para recibir alertas en tiempo real.
          </p>

          <div className="mt-5 space-y-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-[#8fa9b7]">Slack Webhook URL</span>
              <input
                className="w-full rounded-2xl border border-white/15 bg-[#0f1f28] px-4 py-3 text-white"
                placeholder="https://hooks.slack.com/services/..."
                value={slackWebhookUrl}
                onChange={(e) => setSlackWebhookUrl(e.target.value)}
              />
              <p className="mt-1.5 text-xs text-[#6b8899]">
                Pegá la URL de tu webhook de Slack para recibir alertas de evaluaciones vencidas y ciclos.{" "}
                <a
                  href="https://api.slack.com/apps"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-[#14b8a6] hover:text-[#0d9488]"
                >
                  Creá uno en api.slack.com/apps
                </a>
              </p>
            </label>

            <div className="flex gap-3">
              <button
                type="button"
                disabled={savingSlack}
                onClick={saveSlack}
                className="rounded-2xl bg-[#14b8a6] px-6 py-2.5 text-sm font-semibold text-[#0f172a] transition hover:bg-[#0d9488] disabled:opacity-60"
              >
                {savingSlack ? "Guardando..." : "Guardar"}
              </button>
              <button
                type="button"
                disabled={testingSlack || !slackWebhookUrl}
                onClick={testSlack}
                className="rounded-2xl border border-white/15 px-6 py-2.5 text-sm font-semibold text-[#c5d5de] transition hover:bg-white/5 disabled:opacity-40"
              >
                {testingSlack ? "Enviando..." : "Probar"}
              </button>
            </div>

            {slackMessage ? (
              <p className={`mt-2 ${slackMessageType === "error" ? "pf-alert-error" : slackMessageType === "success" ? "pf-alert-success" : "pf-alert-warning"}`}>
                {slackMessage}
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

    </div>
  );
}

