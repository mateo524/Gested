function StateIcon({ tone = "neutral" }) {
  const cls =
    tone === "success"
      ? "border-emerald-400/25 bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 text-emerald-300"
      : tone === "warning"
        ? "border-amber-300/25 bg-gradient-to-br from-amber-500/20 to-amber-600/10 text-amber-300"
        : tone === "error"
          ? "border-rose-300/25 bg-gradient-to-br from-rose-500/20 to-rose-600/10 text-rose-300"
          : "border-white/10 bg-gradient-to-br from-white/8 to-white/4 text-[#8fb0c2]";
  return (
    <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border ${cls}`}>
      {tone === "success" ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-6 w-6">
          <path d="M5 13l4 4L19 7" />
        </svg>
      ) : tone === "warning" ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-6 w-6">
          <path d="M12 8v5M12 16h.01" />
          <path d="M10.3 3.7L1.9 18a2 2 0 001.7 3h16.8a2 2 0 001.7-3L13.7 3.7a2 2 0 00-3.4 0z" />
        </svg>
      ) : tone === "error" ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-6 w-6">
          <circle cx="12" cy="12" r="9" />
          <path d="M9 9l6 6M15 9l-6 6" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-6 w-6">
          <circle cx="11" cy="11" r="7" />
          <path d="M16.5 16.5l4 4" />
        </svg>
      )}
    </span>
  );
}

function StatePanel({ tone = "neutral", title, description, actionLabel, onAction, compact = false }) {
  const isAction = actionLabel && onAction;
  return (
    <div className={`rounded-3xl border border-white/10 bg-[#0c1e28] ${compact ? "px-4 py-4" : "px-6 py-6"}`}>
      <div className={`flex ${compact ? "items-center gap-3" : "items-start gap-5"}`}>
        <StateIcon tone={tone} />
        <div className="min-w-0 flex-1">
          <h4 className={`font-semibold text-white ${compact ? "text-sm" : "text-base"}`}>{title}</h4>
          <p className="mt-1 text-sm leading-relaxed text-[#8fa9b7]">{description}</p>
          {isAction ? (
            <button
              type="button"
              onClick={onAction}
              className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-[#14b8a6] px-4 py-2.5 text-sm font-semibold text-[#0f172a] transition hover:bg-[#0d9488]"
            >
              {actionLabel}
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                <path d="M3 8h10M9 4l4 4-4 4" />
              </svg>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function LoadingState({
  title = "Cargando información",
  description = "Estamos preparando esta vista para vos.",
  compact = false,
}) {
  return <StatePanel tone="neutral" title={title} description={description} compact={compact} />;
}

export function EmptyState({
  title = "No encontramos datos todavía",
  description = "Cuando haya información disponible, la vas a ver acá.",
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
  description = "Reintentá en unos segundos. Si el problema sigue, revisá tus permisos o la conexión.",
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
  title = "No tenés acceso a esta sección",
  description = "Tu rol actual no tiene permisos para ver esta información.",
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
