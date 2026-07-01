import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { perfColor } from "../lib/colors";

export default function TopPerformers({ companyId, cycleId }) {
  const { token } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    const params = new URLSearchParams({ companyId, limit: 5 });
    if (cycleId) params.set("cycleId", cycleId);
    apiFetch(`/evaluations/top-performers?${params}`, { token })
      .then(d => setData(Array.isArray(d) ? d : d?.performers || []))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [companyId, cycleId, token]);

  const medals = ["🥇", "🥈", "🥉"];

  if (loading) return (
    <div className="space-y-3">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="skeleton h-12 w-full rounded-xl" />
      ))}
    </div>
  );

  if (!data.length) return (
    <p className="text-xs text-[#6a8ea0] py-4 text-center">No hay datos de desempeño aún.</p>
  );

  return (
    <div className="space-y-2">
      {data.map((p, i) => (
        <div key={p._id || i} className="flex items-center gap-3 rounded-xl bg-white/4 px-3 py-2.5 border border-white/6">
          <span className="text-lg w-6 text-center shrink-0">{medals[i] || `${i + 1}`}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{p.name || p.employeeName}</p>
            <p className="text-xs text-[#6a8ea0] truncate">{p.area || p.department || ""}</p>
          </div>
          <div className="text-right shrink-0">
            <span className="text-sm font-bold" style={{ color: perfColor(p.score) }}>
              {typeof p.score === "number" ? p.score.toFixed(1) : p.score}
            </span>
            <p className="text-[10px] text-[#6a8ea0]">/ 5</p>
          </div>
        </div>
      ))}
    </div>
  );
}
