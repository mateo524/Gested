import { useState, useRef, useEffect } from "react";

export default function Tooltip({ text, children, position = "top" }) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const tipRef = useRef(null);

  useEffect(() => {
    if (!visible || !triggerRef.current || !tipRef.current) return;
    const t = triggerRef.current.getBoundingClientRect();
    const tip = tipRef.current.getBoundingClientRect();
    const gap = 8;
    let top, left;
    if (position === "top") {
      top = t.top - tip.height - gap;
      left = t.left + t.width / 2 - tip.width / 2;
    } else if (position === "bottom") {
      top = t.bottom + gap;
      left = t.left + t.width / 2 - tip.width / 2;
    } else if (position === "left") {
      top = t.top + t.height / 2 - tip.height / 2;
      left = t.left - tip.width - gap;
    } else {
      top = t.top + t.height / 2 - tip.height / 2;
      left = t.right + gap;
    }
    setCoords({ top: top + window.scrollY, left: Math.max(8, left + window.scrollX) });
  }, [visible, position]);

  if (!text) return children;

  return (
    <>
      <span ref={triggerRef} onMouseEnter={() => setVisible(true)} onMouseLeave={() => setVisible(false)} className="inline-flex">
        {children}
      </span>
      {visible && (
        <div
          ref={tipRef}
          style={{ position: "fixed", top: coords.top, left: coords.left, zIndex: 9999, pointerEvents: "none" }}
          className="rounded-lg bg-[#1e3344] border border-white/10 px-3 py-1.5 text-xs text-white shadow-xl max-w-[220px] leading-snug"
        >
          {text}
        </div>
      )}
    </>
  );
}
