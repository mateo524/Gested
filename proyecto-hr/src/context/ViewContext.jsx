import { createContext, useContext } from "react";

const ViewContext = createContext({
  view: "dashboard",
  setView: () => {},
  searchQuery: "",
  setSearchQuery: () => {},
  theme: "dark",
  setTheme: () => {},
  language: "es",
  setLanguage: () => {},
  t: (_key, fallback = "") => fallback,
});

export function ViewProvider({ value, children }) {
  return <ViewContext.Provider value={value}>{children}</ViewContext.Provider>;
}

export function useView() {
  return useContext(ViewContext);
}
