import express from "express";
import School from "../models/School.js";
import { auth } from "../middleware/auth.js";
import { attachTenantScope, buildScopedFilter } from "../middleware/tenantScope.js";
import { requireAnyPermission, requirePermission } from "../middleware/rbac.js";
import { PERMISSIONS } from "../utils/permissions.js";
import { logAudit } from "../utils/audit.js";

const router = express.Router();

function resolveCompanyId(req) {
  return req.scope.isSuperAdmin ? req.body.companyId || req.query.companyId : req.scope.companyId;
}

router.get(
  "/",
  auth,
  attachTenantScope,
  requireAnyPermission(PERMISSIONS.MANAGE_SCHOOLS, PERMISSIONS.MANAGE_COMPANIES),
  async (req, res) => {
    const filter = buildScopedFilter(req, {});

    if (req.scope.isSuperAdmin && req.query.companyId) {
      filter.companyId = req.query.companyId;
    }

    if (req.query.q?.trim()) {
      const regex = { $regex: req.query.q.trim(), $options: "i" };
      filter.$or = [{ nombre: regex }, { codigo: regex }, { ciudad: regex }, { provincia: regex }];
    }

    const schools = await School.find(filter).sort({ nombre: 1 }).lean();
    res.json(schools);
  }
);

router.post(
  "/",
  auth,
  attachTenantScope,
  requirePermission(PERMISSIONS.MANAGE_SCHOOLS),
  async (req, res) => {
    const companyId = resolveCompanyId(req);

    if (!companyId || !req.body.nombre?.trim()) {
      return res.status(400).json({ mensaje: "Debes indicar empresa y nombre del colegio" });
    }

    const school = await School.create({
      companyId,
      nombre: req.body.nombre.trim(),
      codigo: req.body.codigo?.trim() || "",
      ciudad: req.body.ciudad?.trim() || "",
      provincia: req.body.provincia?.trim() || "",
      pais: req.body.pais?.trim() || "Argentina",
      activa: req.body.activa !== false,
    });

    await logAudit({
      companyId,
      schoolId: school._id,
      userId: req.user.userId,
      accion: "create",
      modulo: "schools",
      detalle: `Se creo el colegio ${school.nombre}`,
    });

    res.status(201).json({ mensaje: "Colegio creado", school });
  }
);

router.put(
  "/:id",
  auth,
  attachTenantScope,
  requirePermission(PERMISSIONS.MANAGE_SCHOOLS),
  async (req, res) => {
    const filter = buildScopedFilter(req, { _id: req.params.id });
    const school = await School.findOne(filter);

    if (!school) {
      return res.status(404).json({ mensaje: "Colegio no encontrado" });
    }

    ["nombre", "codigo", "ciudad", "provincia", "pais", "activa"].forEach((field) => {
      if (field in req.body) {
        school[field] = req.body[field];
      }
    });

    await school.save();

    await logAudit({
      companyId: school.companyId,
      schoolId: school._id,
      userId: req.user.userId,
      accion: "update",
      modulo: "schools",
      detalle: `Se actualizo el colegio ${school.nombre}`,
    });

    res.json({ mensaje: "Colegio actualizado", school });
  }
);

export default router;
