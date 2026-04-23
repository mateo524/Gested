import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function SettingsPage() {
  const { token } = useAuth();
  const [settings, setSettings] = useState({
    nombreVisible: "",
    logoUrl: "",
    primaryColor: "#10b981",
    maxUploadSizeMb: 10,
  });
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/settings`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok && data) {
          setSettings((prev) => ({ ...prev, ...data }));
        }
      })
      .catch(() => {});
  }, [token]);

  const save = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(settings),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.mensaje || "Error al guardar");

      setMessage("✅ Parámetros guardados");
    } catch (error) {
      setMessage(`❌ ${error.message}`);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
      <h3 className="text-xl font-semibold mb-4">Parámetros del sistema</h3>

      <div className="grid md:grid-cols-2 gap-4">
        <input
          className="border border-slate-300 rounded-2xl px-4 py-3"
          placeholder="Nombre visible"
          value={settings.nombreVisible}
          onChange={(e) =>
            setSettings({ ...settings, nombreVisible: e.target.value })
          }
        />

        <input
          className="border border-slate-300 rounded-2xl px-4 py-3"
          placeholder="Logo URL"
          value={settings.logoUrl}
          onChange={(e) =>
            setSettings({ ...settings, logoUrl: e.target.value })
          }
        />

        <input
          className="border border-slate-300 rounded-2xl px-4 py-3"
          placeholder="Color principal"
          value={settings.primaryColor}
          onChange={(e) =>
            setSettings({ ...settings, primaryColor: e.target.value })
          }
        />

        <input
          type="number"
          className="border border-slate-300 rounded-2xl px-4 py-3"
          placeholder="Máximo MB"
          value={settings.maxUploadSizeMb}
          onChange={(e) =>
            setSettings({
              ...settings,
              maxUploadSizeMb: Number(e.target.value),
            })
          }
        />
      </div>

      <button
        onClick={save}
        className="mt-6 bg-emerald-500 text-white px-6 py-3 rounded-2xl"
      >
        Guardar parámetros
      </button>

      {message && <p className="mt-4">{message}</p>}
    </div>
  );
}