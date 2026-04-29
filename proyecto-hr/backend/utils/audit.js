import AuditLog from "../models/AuditLog.js";

export async function logAudit({ companyId, schoolId = null, userId, accion, modulo, detalle, metadata = {} }) {
  await AuditLog.create({
    companyId,
    schoolId,
    userId,
    accion,
    modulo,
    detalle,
    metadata,
  });
}
