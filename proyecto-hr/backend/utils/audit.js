import AuditLog from "../models/AuditLog.js";

// El log de auditoria es un efecto secundario de telemetria: si la escritura
// falla (p.ej. "not primary" durante una eleccion de replica set en Atlas),
// nunca debe tirar abajo el flujo principal (login, etc.) que la llama.
export async function logAudit({ companyId, schoolId = null, userId, accion, modulo, detalle, metadata = {} }) {
  try {
    await AuditLog.create({
      companyId,
      schoolId,
      userId,
      accion,
      modulo,
      detalle,
      metadata,
    });
  } catch (err) {
    console.error("[audit] logAudit fallo (no bloqueante):", err);
  }
}
