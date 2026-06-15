export function CardSkeleton() {
  return (
    <div className="bg-[#0c1e28] border border-white/[0.08] rounded-3xl p-6 shadow-sm animate-pulse">
      <div className="h-4 bg-white/10 rounded w-24 mb-3" />
      <div className="h-8 bg-white/10 rounded w-16" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }) {
  return (
    <div className="animate-pulse space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <div className="h-4 bg-white/10 rounded flex-1" />
          <div className="h-4 bg-white/10 rounded w-48" />
          <div className="h-4 bg-white/10 rounded w-32" />
          <div className="h-4 bg-white/10 rounded w-20" />
        </div>
      ))}
    </div>
  );
}

export function ListSkeleton({ items = 4 }) {
  return (
    <div className="animate-pulse space-y-3">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="h-16 bg-white/10 rounded-2xl" />
      ))}
    </div>
  );
}
