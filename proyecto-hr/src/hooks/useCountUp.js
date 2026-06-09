import { useEffect, useRef, useState } from "react";

/**
 * Animates a number from 0 to `target` using easeOut cubic.
 * Returns the current display value (number or original if non-numeric).
 */
export default function useCountUp(target, duration = 800) {
  const numTarget = typeof target === "number" ? target : Number(target);
  const isFinite = Number.isFinite(numTarget);
  const [display, setDisplay] = useState(isFinite ? 0 : target);
  const frameRef = useRef(null);
  const startRef = useRef(null);
  const prevTarget = useRef(null);

  useEffect(() => {
    if (!isFinite) { setDisplay(target); return; }
    // Don't re-animate if value didn't change
    if (prevTarget.current === numTarget) return;
    prevTarget.current = numTarget;

    startRef.current = null;
    const from = 0;

    function step(ts) {
      if (!startRef.current) startRef.current = ts;
      const t = Math.min((ts - startRef.current) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const curr = from + (numTarget - from) * eased;
      setDisplay(Number.isInteger(numTarget) ? Math.round(curr) : parseFloat(curr.toFixed(2)));
      if (t < 1) frameRef.current = requestAnimationFrame(step);
    }

    frameRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameRef.current);
  }, [numTarget, duration, isFinite, target]);

  return display;
}
