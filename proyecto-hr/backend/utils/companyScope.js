import Company from "../models/Company.js";

export async function resolveCompanyScope(req) {
  const requestedCompanyId = req.headers["x-company-id"];

  if (!req.user) {
    throw new Error("No autorizado");
  }

  if (req.user.isSuperAdmin) {
    const companyId = requestedCompanyId || req.user.companyId;
    const company = await Company.findById(companyId).lean();

    if (!company) {
      const error = new Error("Empresa no encontrada");
      error.status = 404;
      throw error;
    }

    return { companyId: String(company._id), company };
  }

  if (requestedCompanyId && requestedCompanyId !== String(req.user.companyId)) {
    const error = new Error("No tenés acceso a esa empresa");
    error.status = 403;
    throw error;
  }

  const company = await Company.findById(req.user.companyId).lean();
  if (!company) {
    const error = new Error("Empresa no encontrada");
    error.status = 404;
    throw error;
  }

  if (company.activa === false) {
    const error = new Error("La empresa tiene el acceso suspendido");
    error.status = 403;
    throw error;
  }

  return { companyId: String(req.user.companyId), company };
}
