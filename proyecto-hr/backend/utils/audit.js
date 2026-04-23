import AuditLog from "../models/AuditLog.js";

export async function logAudit({ companyId, userId, accion, modulo, detalle }) {
  await AuditLog.create({
    companyId,
    userId,
    accion,
    modulo,
    detalle,
  });
}