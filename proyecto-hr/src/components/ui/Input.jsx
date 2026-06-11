export function Input({ label, error, className = "", ...props }) {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-xs font-medium text-[#9ab3be]">{label}</label>}
      <input
        className={`w-full rounded-xl border bg-[#091319] px-3.5 py-2.5 text-sm text-white placeholder-[#7a9aaa] transition
          border-white/10
          focus:border-[#14b8a6]/50 focus:outline-none focus:ring-2 focus:ring-[#14b8a6]/20
          disabled:opacity-50
          ${error ? "border-rose-500/50 focus:ring-rose-500/20" : ""}
          ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  );
}

export function Select({ label, error, children, className = "", ...props }) {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-xs font-medium text-[#9ab3be]">{label}</label>}
      <select
        className={`w-full rounded-xl border border-white/10 bg-[#091319] px-3.5 py-2.5 text-sm text-white transition
          focus:border-[#14b8a6]/50 focus:outline-none focus:ring-2 focus:ring-[#14b8a6]/20
          disabled:opacity-50
          ${error ? "border-rose-500/50" : ""}
          ${className}`}
        {...props}
      >{children}</select>
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  );
}
