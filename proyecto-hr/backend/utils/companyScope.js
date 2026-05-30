import Company from "../models/Company.js";

export async function companyScope(req, res, next) {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(400).json({ error: "companyId no encontrado en token" });
    }

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ error: "Empresa no encontrada" });
    }

    req.company = company;
    next();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
