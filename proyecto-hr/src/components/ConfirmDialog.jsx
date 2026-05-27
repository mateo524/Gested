import { useRef } from "react";
import useClickOutside from "../hooks/useClickOutside";

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  destructive = false,
  loading = false,
  onCancel,
  onConfirm,
}) {
  const panelRef = useRef(null);

  useClickOutside(
    panelRef,
    () => {
      if (!loading) onCancel?.();
    },
    open
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#020617]/70 px-4 backdrop-blur-sm">
      <div
        ref={panelRef}
        className="w-full max-w-md rounded-[1.75rem] border border-white/10 bg-[#122530] p-6 shadow-[0_30px_80px_rgba(2,8,23,0.45)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
      >
        <div className="flex items-start gap-4">
          <div
            className={`mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
              destructive ? "bg-rose-500/15 text-rose-100" : "bg-[#1e3a8a]/20 text-[#dbe7ff]"
            }`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
              {destructive ? (
                <>
                  <path d="M10 11v6" />
                  <path d="M14 11v6" />
                  <path d="M4 7h16" />
                  <path d="M6 7l1 12h10l1-12" />
                  <path d="M9 7V4h6v3" />
                </>
              ) : (
                <>
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 8v5" />
                  <path d="M12 16h.01" />
                </>
              )}
            </svg>
          </div>
          <div className="min-w-0">
            <h3 id="confirm-dialog-title" className="text-lg font-semibold text-white">
              {title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[#9fb6c4]">{message}</p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-2xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`rounded-2xl px-4 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
              destructive ? "bg-rose-600 hover:bg-rose-500" : "bg-[#1e3a8a] hover:bg-[#2a4db8]"
            }`}
          >
            {loading ? "Procesando..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
