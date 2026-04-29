import express from "express";
import Employee from "../models/Employee.js";
import { auth } from "../middleware/auth.js";
import { attachTenantScope, buildScopedFilter } from "../middleware/tenantScope.js";
import { requirePermission } from "../middleware/rbac.js";
import { PERMISSIONS } from "../utils/permissions.js";
import { logAudit } from "../utils/audit.js";

const router = express.Router();

function resolveTenantIds(req) {
  return {
    companyId: req.scope.isSuperAdmin ? req.body.companyId || req.query.companyId : req.scope.companyId,
    schoolId: req.scope.isSuperAdmin ? req.body.schoolId || req.query.schoolId : req.scope.schoolId,
  };
}

router.get("/", auth, attachTenantScope, requirePermission(PERMISSIONS.MANAGE_EMPLOYEES), async (req, res) => {
  const filter = buildScopedFilter(req, {});

  if (req.query.schoolId && req.scope.isSuperAdmin) {
    filter.schoolId = req.query.schoolId;
  }

  if (req.query.area) {
    filter.area = req.query.area;
  }

  if (req.query.cargo) {
    filter.cargo = req.query.cargo;
  }

  if (req.query.managerId) {
    filter.managerId = req.query.managerId;
  }

  if (req.query.q?.trim()) {
    const regex = { $regex: req.query.q.trim(), $options: "i" };
    filter.$or = [{ nombre: regex }, { apellido: regex }, { email: regex }, { cargo: regex }];
  }

  const employees = await Employee.find(filter).sort({ apellido: 1, nombre: 1 }).lean();
  res.json(employees);
});

router.post("/", auth, attachTenantScope, requirePermission(PERMISSIONS.MANAGE_EMPLOYEES), async (req, res) => {
  const { companyId, schoolId } = resolveTenantIds(req);

  if (!companyId || !schoolId || !req.body.nombre || !req.body.apellido || !req.body.cargo) {
    return res.status(400).json({ mensaje: "Debes indicar colegio, nombre, apellido y cargo" });
  }

  const employee = await Employee.create({
    companyId,
    schoolId,
    managerId: req.body.managerId || null,
    legajo: req.body.legajo?.trim() || "",
    nombre: req.body.nombre.trim(),
    apellido: req.body.apellido.trim(),
    email: req.body.email?.trim().toLowerCase() || "",
    cargo: req.body.cargo.trim(),
    area: req.body.area?.trim() || "",
    tipoEmpleado: req.body.tipoEmpleado || "DOCENTE",
    fechaIngreso: req.body.fechaIngreso || null,
    activo: req.body.activo !== false,
  });

  await logAudit({
    companyId,
    schoolId,
    userId: req.user.userId,
    accion: "create",
    modulo: "employees",
    detalle: `Se creo el empleado ${employee.apellido}, ${employee.nombre}`,
  });

  res.status(201).json({ mensaje: "Empleado creado", employee });
});

router.put("/:id", auth, attachTenantScope, requirePermission(PERMISSIONS.MANAGE_EMPLOYEES), async (req, res) => {
  const filter = buildScopedFilter(req, { _id: req.params.id });
  const employee = await Employee.findOne(filter);

  if (!employee) {
    return res.status(404).json({ mensaje: "Empleado no encontrado" });
  }

  const editableFields = [
    "managerId",
    "legajo",
    "nombre",
    "apellido",
    "email",
    "cargo",
    "area",
    "tipoEmpleado",
    "fechaIngreso",
    "activo",
  ];

  editableFields.forEach((field) => {
    if (field in req.body) {
      employee[field] = req.body[field];
    }
  });

  await employee.save();

  await logAudit({
    companyId: employee.companyId,
    schoolId: employee.schoolId,
    userId: req.user.userId,
    accion: "update",
    modulo: "employees",
    detalle: `Se actualizo el empleado ${employee.apellido}, ${employee.nombre}`,
  });

  res.json({ mensaje: "Empleado actualizado", employee });
});

export default router;
