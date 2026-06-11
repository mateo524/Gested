export default function StatCard({ label, value, sub, accent, icon, trend }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0c1e28] px-5 py-4">
      <div className="flex items-start justify-between">
        <p className="text-xs text-[#7f99a8]">{label}</p>
        {icon && <span className="text-[#7f99a8]">{icon}</span>}
      </div>
      <p className={`mt-1 text-2xl font-bold ${accent ? "text-[#14b8a6]" : "text-white"}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-[#7f99a8]">{sub}</p>}
      {trend !== undefined && (
        <p className={`mt-1 text-xs font-medium ${trend >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
          {trend >= 0 ? "↑" : "↓"} {Math.abs(trend)}%
        </p>
      )}
    </div>
  );
}
