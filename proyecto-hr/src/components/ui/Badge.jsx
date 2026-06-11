const variants = {
  teal: "bg-[#14b8a6]/10 text-[#14b8a6] border-[#14b8a6]/20",
  green: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  amber: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  rose: "bg-rose-500/10 text-rose-300 border-rose-500/20",
  violet: "bg-violet-500/10 text-violet-300 border-violet-500/20",
  muted: "bg-white/5 text-[#9ab3be] border-white/10",
};
export function Badge({ variant = "muted", children, dot = false }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${variants[variant]}`}>
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${variant === "teal" ? "bg-[#14b8a6]" : "bg-current"}`} />}
      {children}
    </span>
  );
}
