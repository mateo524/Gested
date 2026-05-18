function StateIcon({ tone = "neutral" }) {
  const className =
    tone === "success"
      ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-100"
      : tone === "warning"
        ? "border-amber-300/20 bg-amber-500/10 text-amber-100"
        : tone === "error"
          ? "border-rose-300/20 bg-rose-500/10 text-rose-100"
          : "border-white/10 bg-[#122530] text-[#d7e5ec]";

  return (
    <span className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${className}`}>
      {tone === "success" ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
          <path d="M5 13l4 4L19 7" />
        </svg>
      ) : tone === "warning" ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
          <path d="M10.3 3.7L1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.7a2 2 0 0 0-3.4 0z" />
        </svg>
      ) : tone === "error" ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
          <path d="M6 6l12 12M18 6L6 18" />
          <circle cx="12" cy="12" r="9" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
          <path d="M4 12h16" />
          <path d="M12 4v16" />
        </svg>
      )}
    </span>
  );
}

function StatePanel({
  tone = "neutral",
  title,
  description,
  actionLabel,
  onAction,
  compact = false,
}) {
  return (
    <div
      className={`rounded-3xl border border-white/10 bg-[#0f1f28] ${
        compact ? "px-4 py-4" : "px-5 py-6"
      }`}
    >
      <div className={`flex ${compact ? "items-center gap-3" : "items-start gap-4"}`}>
        <StateIcon tone={tone} />
        <div className="min-w-0 flex-1">
          <h4 className="text-base font-semibold text-white">{title}</h4>
          <p className="mt-1 text-sm leading-relaxed text-[#9fb6c4]">{description}</p>
          {actionLabel && onAction ? (
            <button
              type="button"
              onClick={onAction}
              className="mt-4 rounded-2xl border border-white/15 bg-[#122530] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#17313f]"
            >
              {actionLabel}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function LoadingState({
  title = "Cargando informacion",
  description = "Estamos preparando esta vista para vos.",
  compact = false,
}) {
  return <StatePanel tone="neutral" title={title} description={description} compact={compact} />;
}

export function EmptyState({
  title = "No encontramos datos todavia",
  description = "Cuando haya informacion disponible, la vas a ver aca.",
  actionLabel,
  onAction,
  compact = false,
}) {
  return (
    <StatePanel
      tone="warning"
      title={title}
      description={description}
      actionLabel={actionLabel}
      onAction={onAction}
      compact={compact}
    />
  );
}

export function ErrorState({
  title = "No pudimos cargar esta vista",
  description = "Reintenta en unos segundos. Si el problema sigue, revisa tus permisos o la conexion.",
  actionLabel,
  onAction,
  compact = false,
}) {
  return (
    <StatePanel
      tone="error"
      title={title}
      description={description}
      actionLabel={actionLabel}
      onAction={onAction}
      compact={compact}
    />
  );
}

export function PermissionState({
  title = "No tienes acceso a esta seccion",
  description = "Tu rol actual no tiene permisos para ver esta informacion.",
  actionLabel,
  onAction,
  compact = false,
}) {
  return (
    <StatePanel
      tone="warning"
      title={title}
      description={description}
      actionLabel={actionLabel}
      onAction={onAction}
      compact={compact}
    />
  );
}
