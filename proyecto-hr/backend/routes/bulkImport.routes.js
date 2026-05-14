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

    res.status(analysis.errors.length ? 422 : 200).json({
      ok: analysis.errors.length === 0,
      importJobId: job._id,
      previewToken,
      summary: analysis.summary,
      preview: analysis.preview,
      errors: analysis.errors,
      warnings: analysis.warnings,
    });
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
