import { useEffect } from "react";

export default function useClickOutside(ref, onOutside, active = true) {
  useEffect(() => {
    if (!active) return undefined;

    function handlePointerDown(event) {
      if (!ref.current || ref.current.contains(event.target)) return;
      onOutside?.(event);
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onOutside?.(event);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [active, onOutside, ref]);
}
