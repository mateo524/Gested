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
        <div className="mt-4 flex justify-start">
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            className="rounded-2xl border border-white/12 bg-white/5 px-3 py-2 text-xs font-medium text-[#d5e2e9] transition hover:bg-white/10"
          >
            {expanded ? buttonLabelLess : buttonLabelMore || `Ver más (${hiddenCount})`}
          </button>
        </div>
      ) : null}
    </div>
  );
}
