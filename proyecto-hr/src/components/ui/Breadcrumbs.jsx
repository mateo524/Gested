export default function Breadcrumbs({ items = [] }) {
  if (!items.length) return null;
  return (
    <nav className="flex items-center gap-1.5 text-xs text-[#6a8ea0] mb-4">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="opacity-30">
              <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
          {item.onClick ? (
            <button onClick={item.onClick} className="hover:text-white transition-colors">
              {item.label}
            </button>
          ) : (
            <span className={i === items.length - 1 ? "text-white/80 font-medium" : ""}>{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
