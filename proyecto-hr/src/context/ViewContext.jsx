import { createContext, useContext } from "react";

const ViewContext = createContext({ view: "dashboard", setView: () => {} });

export function ViewProvider({ value, children }) {
  return <ViewContext.Provider value={value}>{children}</ViewContext.Provider>;
}

export function useView() {
  return useContext(ViewContext);
}

