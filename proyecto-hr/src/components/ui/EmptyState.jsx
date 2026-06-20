export default function EmptyState({ icon = "📭", title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/4 text-3xl border border-white/8">
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-white/90">{title}</h3>
      {description && <p className="mt-1.5 text-xs text-[#6a8ea0] max-w-xs leading-relaxed">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
