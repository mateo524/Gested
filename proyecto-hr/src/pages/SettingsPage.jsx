import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";

const defaultSettings = {
  nombreVisible: "",
  logoUrl: "",
  primaryColor: "#10b981",
  maxUploadSizeMb: 10,
};

export default function SettingsPage() {
  const { token, activeCompany } = useAuth();
  const [settings, setSettings] = useState(defaultSettings);
  const [message, setMessage] = useState("");

  useEffect(() => {
    apiFetch("/settings", { token })
      .then((data) => {
        if (data) setSettings((prev) => ({ ...prev, ...data }));
      })
      .catch(() => {});
  }, [token]);

  const save = async () => {
    try {
      const data = await apiFetch("/settings", {
        method: "PUT",
        token,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(settings),
      });

      setSettings((prev) => ({ ...prev, ...(data.settings || {}) }));
      setMessage("Parametros actualizados");
    } catch (error) {
      setMessage(error.message);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm uppercase tracking-[0.22em] text-emerald-500">Control de marca y operacion</p>
        <h3 className="mt-3 text-3xl font-bold text-slate-950">Parametros de {activeCompany?.nombre || "la empresa"}</h3>
        <p className="mt-3 max-w-3xl text-slate-500">
          Este apartado sirve para definir como se presenta la empresa dentro de Gested, que
          capacidad de carga maneja y que referencias visuales usa el equipo para operar de forma
          consistente.
        </p>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-xl font-semibold">Identidad visible</h3>
          <p className="mt-1 text-slate-500">
            Ajusta el nombre que se muestra, el logo y el color principal de referencia.
          </p>

          <div className="mt-6 grid gap-4">
            <input
              className="rounded-2xl border border-slate-300 px-4 py-3"
              placeholder="Nombre visible"
              value={settings.nombreVisible}
              onChange={(e) =>
                setSettings({ ...settings, nombreVisible: e.target.value })
              }
            />

            <input
              className="rounded-2xl border border-slate-300 px-4 py-3"
              placeholder="URL del logo"
              value={settings.logoUrl}
              onChange={(e) =>
                setSettings({ ...settings, logoUrl: e.target.value })
              }
            />

            <div className="grid gap-4 md:grid-cols-[1fr_auto]">
              <input
                className="rounded-2xl border border-slate-300 px-4 py-3"
                placeholder="Color principal"
                value={settings.primaryColor}
                onChange={(e) =>
                  setSettings({ ...settings, primaryColor: e.target.value })
                }
              />
              <div
                className="h-full min-h-14 rounded-2xl border border-slate-200"
                style={{ backgroundColor: settings.primaryColor }}
              />
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-xl font-semibold">Operacion de datos</h3>
          <p className="mt-1 text-slate-500">
            Define limites utiles para que la carga de archivos siga siendo clara y segura.
          </p>

          <div className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm text-slate-500">Tamano maximo por archivo (MB)</span>
              <input
                type="number"
                min="1"
                className="w-full rounded-2xl border border-slate-300 px-4 py-3"
                value={settings.maxUploadSizeMb}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    maxUploadSizeMb: Number(e.target.value),
                  })
                }
              />
            </label>

            <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Que controla este modulo</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                <li>Nombre y referencia visual de la empresa dentro del panel.</li>
                <li>Capacidad maxima sugerida para importaciones.</li>
                <li>Base para seguir sumando branding, notificaciones y politicas.</li>
              </ul>
            </div>
          </div>

          <button
            onClick={save}
            className="mt-6 rounded-2xl bg-emerald-500 px-6 py-3 font-semibold text-white"
          >
            Guardar parametros
          </button>

          {message ? <p className="mt-4 text-slate-600">{message}</p> : null}
        </div>
      </section>
    </div>
  );
}
