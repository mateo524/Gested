import { useEffect, useState } from "react";

const CURRENT_VERSION = "1.1.0";
const STORAGE_KEY = "zentor_seen_version";

const CHANGES = [
  {
    icon: "🌐",
    title: "Nuevo dominio",
    desc: "Zentor ya tiene su dominio propio: app.zentor.com.ar. Actualizá cualquier acceso directo que tengas guardado.",
  },
  {
    icon: "🔐",
    title: "Cierre de sesión mejorado",
    desc: "Al cerrar sesión, tu cuenta queda completamente desconectada en todos los dispositivos.",
  },
  {
    icon: "🔔",
    title: "Novedades en cada versión",
    desc: "A partir de ahora vas a ver este aviso cada vez que haya cambios relevantes en la plataforma.",
  },
];

export default function WhatsNewModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem(STORAGE_KEY);
    if (seen !== CURRENT_VERSION) setOpen(true);
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, CURRENT_VERSION);
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(6,15,20,0.85)", backdropFilter: "blur(6px)" }}>
      <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#0c1e28] shadow-2xl">
        {/* header */}
        <div className="flex items-center justify-between border-b border-white/8 px-6 py-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#14b8a6]">Versión {CURRENT_VERSION}</p>
            <h2 className="mt-0.5 text-lg font-bold text-white">¿Qué hay de nuevo?</h2>
          </div>
          <button
            onClick={dismiss}
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/40 transition hover:bg-white/8 hover:text-white"
            aria-label="Cerrar"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* changes list */}
        <ul className="divide-y divide-white/6 px-6">
          {CHANGES.map((c) => (
            <li key={c.title} className="flex gap-4 py-4">
              <span className="mt-0.5 text-xl">{c.icon}</span>
              <div>
                <p className="text-sm font-semibold text-white">{c.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-[#6a8ea0]">{c.desc}</p>
              </div>
            </li>
          ))}
        </ul>

        {/* footer */}
        <div className="px-6 pb-5 pt-3">
          <button
            onClick={dismiss}
            className="w-full rounded-2xl bg-[#14b8a6] py-3 text-sm font-bold text-[#0f172a] transition hover:bg-[#0d9488]"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
