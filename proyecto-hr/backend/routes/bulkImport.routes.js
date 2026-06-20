import express from "express";
import multer from "multer";
import { auth } from "../middleware/auth.js";
import { attachTenantScope } from "../middleware/tenantScope.js";
import { requireAnyPermission } from "../middleware/rbac.js";
import { PERMISSIONS } from "../utils/permissions.js";
import {
  BULK_IMPORT_TEMPLATE_FILENAME,
  buildBulkImportTemplateBuffer,
} from "../services/bulkImportTemplate.js";
import {
  analyzeBulkImportWorkbook,
  buildBulkImportTenantFilter,
  createBulkImportAnalysisJob,
} from "../services/bulkImportAnalyzer.js";
import { confirmBulkImportJob } from "../services/bulkImportConfirm.js";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
});

export function resolveBulkTenant(req) {
  if (req.scope?.isSuperAdmin) {
    return {
      companyId: req.get("X-Company-Id") || req.scope.companyId,
      schoolId: req.body.schoolId || req.query.schoolId || req.scope.schoolId || null,
    };
  }

  return {
    companyId: req.scope.companyId,
    schoolId: req.scope.schoolId || null,
  };
}

export const bulkImportManageAccess = requireAnyPermission(
  PERMISSIONS.MANAGE_USERS,
  PERMISSIONS.MANAGE_SCHOOL_USERS,
  PERMISSIONS.MANAGE_EMPLOYEES,
  PERMISSIONS.MANAGE_ROLES
);

export const bulkImportReadAccess = requireAnyPermission(
  PERMISSIONS.MANAGE_USERS,
  PERMISSIONS.MANAGE_SCHOOL_USERS,
  PERMISSIONS.MANAGE_EMPLOYEES,
  PERMISSIONS.MANAGE_ROLES,
  PERMISSIONS.VIEW_AUDIT
);

export function buildBulkImportAnalyzeErrorPayload(error) {
  const isDevelopment = process.env.NODE_ENV === "development";
  const status = Number(error?.status || 500);
  const code = error?.code || "BULK_IMPORT_ANALYZE_FAILED";
  const message =
    status >= 500
      ? "No pudimos analizar el archivo."
      : error?.publicMessage || error?.message || "No pudimos analizar el archivo.";

  const payload = {
    ok: false,
    code,
    message,
    errors: Array.isArray(error?.errors) ? error.errors : [],
    warnings: Array.isArray(error?.warnings) ? error.warnings : [],
  };

  if (isDevelopment && error?.detail) {
    payload.detail = error.detail;
  } else if (isDevelopment && status >= 500 && error?.message) {
    payload.detail = error.message;
  }

  return { status, payload };
}

export function buildBulkImportAnalyzeResponsePayload({ analysis, job, previewToken }) {
  const hasBlockingErrors = Array.isArray(analysis?.errors) && analysis.errors.length > 0;
  const hasWarnings = Array.isArray(analysis?.warnings) && analysis.warnings.length > 0;
  const message = hasBlockingErrors
    ? "El archivo contiene errores de validacion. Revisa los detalles antes de continuar."
    : hasWarnings
      ? "El archivo se analizo con advertencias. Revisa la vista previa antes de confirmar."
      : "El archivo se valido correctamente.";

  const bySheet = analysis?.summary?.bySheet || {};
  const normalizedBySheet = {
    organization: bySheet["Organización"] || bySheet.organization || {},
    departments: bySheet.Departamentos || bySheet.departments || {},
    employees: bySheet.Empleados || bySheet.employees || {},
    usersAndRoles: bySheet["Usuarios_y_Roles"] || bySheet.usersAndRoles || {},
    managers: bySheet.Managers || bySheet.managers || {},
    kpis: bySheet.KPIs || bySheet.kpis || {},
    okrs: bySheet.OKRs || bySheet.okrs || {},
    evaluations: bySheet.Evaluaciones || bySheet.evaluations || {},
    performanceMeasurements:
      bySheet.Mediciones_Desempeno || bySheet.performanceMeasurements || {},
    developmentPlans: bySheet.Planes_Desarrollo || bySheet.developmentPlans || {},
    catalogs: bySheet["Catálogos"] || bySheet.catalogs || {},
  };

  return {
    status: hasBlockingErrors ? 422 : 200,
    payload: {
      ok: !hasBlockingErrors,
      code: hasBlockingErrors ? "BULK_IMPORT_VALIDATION_ERRORS" : "BULK_IMPORT_ANALYZED",
      message,
      importJobId: job._id,
      previewToken,
      summary: {
        ...analysis.summary,
        bySheet: normalizedBySheet,
      },
      preview: analysis.preview,
      errors: analysis.errors,
      warnings: analysis.warnings,
    },
  };
}

router.get(
  "/template",
  auth,
  attachTenantScope,
  bulkImportManageAccess,
  async (req, res) => {
    const buffer = await buildBulkImportTemplateBuffer();

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${BULK_IMPORT_TEMPLATE_FILENAME}"`);
    res.setHeader("Cache-Control", "no-store");
    res.send(Buffer.from(buffer));
  }
);

router.post(
  "/analyze",
  auth,
  attachTenantScope,
  bulkImportManageAccess,
  upload.single("file"),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ ok: false, mensaje: "Debes subir un archivo .xlsx" });
    }

    if (!req.file.originalname.toLowerCase().endsWith(".xlsx")) {
      return res.status(400).json({ ok: false, mensaje: "Solo se aceptan archivos .xlsx para esta importacion unificada" });
    }

    const { companyId, schoolId } = resolveBulkTenant(req);
    if (!companyId) {
      return res.status(400).json({ ok: false, mensaje: "No se pudo resolver la organizacion desde el scope autenticado" });
    }

    try {
      const analysis = await analyzeBulkImportWorkbook({
        buffer: req.file.buffer,
        companyId,
        schoolId,
      });
      const { job, previewToken } = await createBulkImportAnalysisJob({
        req,
        file: req.file,
        companyId,
        schoolId,
        analysis,
      });
      const { status, payload } = buildBulkImportAnalyzeResponsePayload({
        analysis,
        job,
        previewToken,
      });
      res.status(status).json(payload);
    } catch (error) {
      const { status, payload } = buildBulkImportAnalyzeErrorPayload(error);
      res.status(status).json(payload);
    }
  }
);

router.post(
  "/confirm",
  auth,
  attachTenantScope,
  bulkImportManageAccess,
  async (req, res) => {
    const importJobId = String(req.body.importJobId || "").trim();
    const previewToken = String(req.body.previewToken || "").trim();

    if (!importJobId && !previewToken) {
      return res.status(400).json({ ok: false, mensaje: "Debes informar importJobId o previewToken" });
    }

    const outcome = await confirmBulkImportJob({
      req,
      importJobId: importJobId || null,
      previewToken: previewToken || null,
    });
    res.status(outcome.status).json(outcome.payload);
  }
);

router.get(
  "/jobs",
  auth,
  attachTenantScope,
  bulkImportReadAccess,
  async (req, res) => {
    const filter = buildBulkImportTenantFilter(req);
    if (req.query.stage) filter.stage = req.query.stage;

    const items = await (await import("../models/ImportJob.js")).default.find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .select(
        "jobType sourceFileName stage totalRows validRows invalidRows createdCount updatedCount errorCount previewSummary resultSummary createdAt confirmedAt expiresAt"
      )
      .lean();

    res.json({ ok: true, items });
  }
);

// ── Revertir última importación ──────────────────────────────────────────────
router.post(
  "/jobs/:id/revert",
  auth,
  attachTenantScope,
  bulkImportManageAccess,
  async (req, res) => {
    try {
      const ImportJob = (await import("../models/ImportJob.js")).default;
      const Employee = (await import("../models/Employee.js")).default;
      const User = (await import("../models/User.js")).default;

      const filter = buildBulkImportTenantFilter(req, { _id: req.params.id });
      const job = await ImportJob.findOne(filter).lean();
      if (!job) return res.status(404).json({ ok: false, mensaje: "Importación no encontrada." });
      if (job.stage !== "confirmed") {
        return res.status(400).json({ ok: false, mensaje: "Solo se pueden revertir importaciones confirmadas." });
      }

      const importedAt = job.confirmedAt || job.updatedAt;
      const tenantFilter = job.companyId ? { companyId: job.companyId } : { schoolId: job.schoolId };
      const since = new Date(new Date(importedAt).getTime() - 5000); // 5s buffer

      let deleted = 0;
      if (job.datasetDetected === "empleados" || job.datasetRequested === "empleados") {
        const result = await Employee.deleteMany({ ...tenantFilter, createdAt: { $gte: since } });
        deleted = result.deletedCount;
      } else if (job.datasetDetected === "usuarios" || job.datasetRequested === "usuarios") {
        const result = await User.deleteMany({ ...tenantFilter, createdAt: { $gte: since } });
        deleted = result.deletedCount;
      }

      await ImportJob.updateOne({ _id: job._id }, {
        $set: { stage: "expired" },
        $push: { auditTrail: { action: "reverted", actorUserId: req.user._id, details: { deleted }, at: new Date() } },
      });

      res.json({ ok: true, deleted, mensaje: `Importación revertida. ${deleted} registros eliminados.` });
    } catch (err) {
      res.status(500).json({ ok: false, mensaje: err.message });
    }
  }
);

router.get(
  "/jobs/:id",
  auth,
  attachTenantScope,
  bulkImportReadAccess,
  async (req, res) => {
    const filter = buildBulkImportTenantFilter(req, { _id: req.params.id });
    const ImportJob = (await import("../models/ImportJob.js")).default;
    const job = await ImportJob.findOne(filter).lean();
    if (!job) {
      return res.status(404).json({ ok: false, mensaje: "Importacion no encontrada" });
    }

    res.json({ ok: true, job });
  }
);

export default router;
