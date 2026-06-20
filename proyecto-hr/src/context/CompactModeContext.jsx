import { createContext, useContext, useState } from "react";

const CompactModeContext = createContext({ compact: false, toggleCompact: () => {} });

export function CompactModeProvider({ children }) {
  const [compact, setCompact] = useState(() => {
    try { return localStorage.getItem("zentor_compact") === "1"; } catch { return false; }
  });

  function toggleCompact() {
    setCompact(v => {
      const next = !v;
      try { localStorage.setItem("zentor_compact", next ? "1" : "0"); } catch {}
      return next;
    });
  }

  return (
    <CompactModeContext.Provider value={{ compact, toggleCompact }}>
      {children}
    </CompactModeContext.Provider>
  );
}

export function useCompactMode() { return useContext(CompactModeContext); }
