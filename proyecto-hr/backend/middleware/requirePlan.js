import Company from "../models/Company.js";

const PLAN_RANK = { base: 0, pro: 1 };

export function requirePlan(requiredPlan) {
  return async (req, res, next) => {
    if (req.user?.isSuperAdmin) return next();

    const companyId = req.scope?.companyId;
    if (!companyId) {
      return res.status(403).json({ ok: false, code: "NO_COMPANY", message: "Sin organización activa." });
    }

    const company = await Company.findById(companyId).select("plan planExpiresAt").lean();
    if (!company) {
      return res.status(403).json({ ok: false, code: "COMPANY_NOT_FOUND", message: "Organización no encontrada." });
    }

    if (company.planExpiresAt && new Date(company.planExpiresAt) < new Date()) {
      return res.status(402).json({
        ok: false,
        code: "PLAN_EXPIRED",
        message: "El plan de tu organización ha vencido. Contactá a soporte para renovarlo.",
      });
    }

    const currentRank = PLAN_RANK[company.plan] ?? 0;
    const requiredRank = PLAN_RANK[requiredPlan] ?? 0;
    if (currentRank < requiredRank) {
      return res.status(402).json({
        ok: false,
        code: "PLAN_UPGRADE_REQUIRED",
        message: `Esta función requiere el Plan Pro.`,
        currentPlan: company.plan,
        requiredPlan,
      });
    }

    req.companyPlan = company.plan;
    next();
  };
}

export async function checkEmployeeLimit(req, res, next) {
  if (req.user?.isSuperAdmin) return next();

  const companyId = req.scope?.companyId;
  if (!companyId) return next();

  const company = await Company.findById(companyId).select("plan planExpiresAt").lean();
  if (!company) return next();

  if (company.plan === "pro") return next();

  const Employee = (await import("../models/Employee.js")).default;
  const count = await Employee.countDocuments({ companyId, activo: true });
  if (count >= 50) {
    return res.status(402).json({
      ok: false,
      code: "EMPLOYEE_LIMIT_REACHED",
      message: "Alcanzaste el límite de 50 empleados del Plan Base. Actualizá al Plan Pro para agregar más.",
    });
  }

  next();
}
