import { useEffect, useMemo, useState } from "react";

export default function CollapsibleList({
  items = [],
  initialCount = 3,
  renderItem,
  emptyState = null,
  className = "",
  buttonLabelMore,
  buttonLabelLess = "Ver menos",
}) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setExpanded(false);
  }, [items.length]);

  const safeInitialCount = Math.max(1, Number(initialCount) || 1);
  const hiddenCount = Math.max(0, items.length - safeInitialCount);
  const visibleItems = useMemo(
    () => (expanded ? items : items.slice(0, safeInitialCount)),
    [expanded, items, safeInitialCount]
  );

  if (!items.length) {
    return emptyState;
  }

  return (
    <div className={className}>
      {visibleItems.map((item, index) => renderItem(item, index))}
      {hiddenCount > 0 ? (
        <div className="mt-3 flex justify-start">
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            className="inline-flex items-center gap-1.5 rounded-2xl border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-xs font-medium text-[#b8cdd8] transition hover:bg-white/[0.08] hover:text-white"
          >
            {expanded ? buttonLabelLess : buttonLabelMore || `Ver más (${hiddenCount})`}
            <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" className={`h-3 w-3 shrink-0 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}>
              <path d="M2 4l4 4 4-4" />
            </svg>
          </button>
        </div>
      ) : null}
    </div>
  );
}
