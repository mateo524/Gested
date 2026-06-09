import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

const ToastCtx = createContext(null);

const ICONS = {
  success: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 shrink-0">
      <path d="M3 8l3.5 3.5L13 4" />
    </svg>
  ),
  error: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 shrink-0">
      <circle cx="8" cy="8" r="6" /><path d="M5.5 5.5l5 5M10.5 5.5l-5 5" />
    </svg>
  ),
  warning: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 shrink-0">
      <path d="M8 5.5v3M8 10.5h.01" /><path d="M7.1 2.5L1.5 13h13L9 2.5a1.1 1.1 0 00-1.9 0z" />
    </svg>
  ),
  info: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 shrink-0">
      <circle cx="8" cy="8" r="6" /><path d="M8 7v4M8 5h.01" />
    </svg>
  ),
};

const TONE = {
  success: "border-emerald-300/30 bg-gradient-to-br from-emerald-500/15 to-[#0c1920] text-emerald-100",
  error:   "border-rose-300/30 bg-gradient-to-br from-rose-500/15 to-[#0c1920] text-rose-100",
  warning: "border-amber-300/30 bg-gradient-to-br from-amber-500/15 to-[#0c1920] text-amber-100",
  info:    "border-white/[0.12] bg-gradient-to-br from-[#162c39] to-[#0f2028] text-[#e8eef1]",
};

function ToastItem({ id, message, type = "info", onRemove }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setShow(true));
    return () => cancelAnimationFrame(t);
  }, []);

  return (
    <div
      role="alert"
      className={`flex w-[340px] items-start gap-3 rounded-2xl border px-4 py-3 shadow-[0_8px_32px_rgba(2,8,23,0.55)] transition-all duration-250 ${TONE[type] || TONE.info} ${
        show ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
      }`}
    >
      {ICONS[type] || ICONS.info}
      <p className="flex-1 text-sm leading-relaxed">{message}</p>
      <button
        type="button"
        onClick={() => onRemove(id)}
        className="shrink-0 opacity-50 transition-opacity hover:opacity-100"
        aria-label="Cerrar"
      >
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
          <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
      </button>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const counter = useRef(0);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    ({ message, type = "info", duration = 4000 }) => {
      const id = `t${++counter.current}`;
      setToasts((prev) => [...prev.slice(-5), { id, message, type }]);
      setTimeout(() => removeToast(id), duration);
      return id;
    },
    [removeToast]
  );

  return (
    <ToastCtx.Provider value={{ addToast, removeToast }}>
      {children}
      <div className="fixed right-4 top-4 z-[200] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem {...t} onRemove={removeToast} />
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast requires ToastProvider");
  return ctx;
}
