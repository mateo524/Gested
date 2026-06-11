export function Table({ children, className = "" }) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-white/[0.08] ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">{children}</table>
      </div>
    </div>
  );
}
export function Thead({ children }) {
  return <thead className="bg-[#0a1720]"><tr>{children}</tr></thead>;
}
export function Th({ children, className = "" }) {
  return <th className={`px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[.08em] text-[#7a9aaa] ${className}`}>{children}</th>;
}
export function Tbody({ children }) {
  return <tbody className="divide-y divide-white/[0.05]">{children}</tbody>;
}
export function Tr({ children, onClick, className = "" }) {
  return (
    <tr
      onClick={onClick}
      className={`transition-colors ${onClick ? "cursor-pointer hover:bg-[#14b8a6]/5" : "hover:bg-white/[0.02]"} ${className}`}
    >{children}</tr>
  );
}
export function Td({ children, className = "" }) {
  return <td className={`px-4 py-3 text-[#c7d5dc] ${className}`}>{children}</td>;
}
