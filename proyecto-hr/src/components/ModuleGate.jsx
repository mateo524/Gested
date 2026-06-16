import { useAuth } from "../context/AuthContext";

/**
 * Renders children only if the given module is active for the current company.
 * SuperAdmins always see everything.
 * If `modules` is null (legacy company without the field), all modules are treated as active.
 */
export function ModuleGate({ module: moduleKey, fallback = null, children }) {
  const { user, modules } = useAuth();

  if (user?.isSuperAdmin) return children;

  // No modules config → all on by default
  if (!modules) return children;

  if (modules[moduleKey] === false) return fallback;

  return children;
}
