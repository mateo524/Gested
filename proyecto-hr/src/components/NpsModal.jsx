import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import { useAuth } from "../context/AuthContext";

const NPS_KEY = "zentor_nps_last";
const NPS_INTERVAL_DAYS = 90;

export default function NpsModal() {
  const { token, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [score, setScore] = useState(null);
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!user) return;
    try {
      const last = localStorage.getItem(NPS_KEY);
      if (last) {
        const diff = (Date.now() - Number(last)) / (1000 * 60 * 60 * 24);
        if (diff < NPS_INTERVAL_DAYS) return;
      }
      // Show after 3 minutes on first visit or after 90 days
      const t = setTimeout(() => setOpen(true), 3 * 60 * 1000);
      return () => clearTimeout(t);
    } catch {}
  }, [user]);

  async function submit() {
    if (score === null) return;
    setSending(true);
    try {
      await apiFetch("/analytics/nps", {
        method: "POST",
        token,
        body: JSON.stringify({ score, comment }),
      });
    } catch {}
    localStorage.setItem(NPS_KEY, String(Date.now()));
    setSending(false);
    setSent(true);
    setTimeout(() => setOpen(false), 2000);
  }

  function dismiss() {
    localStorage.setItem(NPS_KEY, String(Date.now()));
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 w-full max-w-sm">
      <div className="rounded-2xl border border-white/10 bg-[#0c1e28] shadow-2xl p-5">
        {sent ? (
          <div className="flex flex-col items-center py-4 gap-2">
            <span className="text-2xl">🙏</span>
            <p className="text-sm font-semibold text-white">¡Gracias por tu respuesta!</p>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between mb-3">
              <p className="text-sm font-semibold text-white leading-snug">¿Con qué probabilidad recomendarías Zentor?</p>
              <button onClick={dismiss} className="ml-3 text-white/30 hover:text-white transition-colors shrink-0">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              </button>
            </div>
            <div className="flex gap-1 mb-3">
              {[...Array(11)].map((_, i) => (
                <button
                  key={i}
                  onClick={() => setScore(i)}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition-all ${
                    score === i
                      ? i >= 9 ? "bg-[#14b8a6] text-[#0f172a]" : i >= 7 ? "bg-[#f59e0b] text-[#0f172a]" : "bg-[#ef4444] text-white"
                      : "bg-white/6 text-white/50 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {i}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-[10px] text-white/30 mb-3 px-0.5">
              <span>Muy improbable</span><span>Muy probable</span>
            </div>
            {score !== null && (
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="¿Qué mejorarías? (opcional)"
                rows={2}
                className="w-full rounded-xl bg-white/6 border border-white/10 px-3 py-2 text-xs text-white placeholder-white/30 resize-none mb-3 focus:outline-none focus:border-[#14b8a6]/50"
              />
            )}
            <button
              onClick={submit}
              disabled={score === null || sending}
              className="w-full rounded-xl bg-[#14b8a6] py-2.5 text-sm font-bold text-[#0f172a] disabled:opacity-40 transition-opacity"
            >
              {sending ? "Enviando..." : "Enviar"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
