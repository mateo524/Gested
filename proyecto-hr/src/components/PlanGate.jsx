import { useAuth } from "../context/AuthContext";

/**
 * Renders children only if the company is on the required plan.
 * SuperAdmins always pass through.
 * plan prop: "pro" | "base" (default "pro")
 * fallback: what to render when the plan doesn't match (default: upgrade banner)
 */
export function PlanGate({ plan: requiredPlan = "pro", fallback, children }) {
  const { user } = useAuth();

  if (user?.isSuperAdmin) return children;

  const currentPlan = user?.plan ?? "pro";

  const RANK = { base: 0, pro: 1 };
  if ((RANK[currentPlan] ?? 0) < (RANK[requiredPlan] ?? 0)) {
    return fallback ?? <PlanUpgradeBanner />;
  }

  return children;
}

export function PlanUpgradeBanner({ feature }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-[#14b8a6]/20 bg-[#0a1c26] px-6 py-14 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#14b8a6]/10">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-6 w-6 text-[#14b8a6]">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </div>
      <p className="text-sm font-semibold text-white">
        {feature ? `${feature} requiere` : "Esta función requiere"} el Plan Pro
      </p>
      <p className="mt-2 text-xs text-[#6a8ea0]">
        Contactá a soporte en{" "}
        <a href="mailto:hola@zentor.com.ar" className="text-[#14b8a6] hover:underline">
          hola@zentor.com.ar
        </a>{" "}
        para actualizar tu plan.
      </p>
    </div>
  );
}
