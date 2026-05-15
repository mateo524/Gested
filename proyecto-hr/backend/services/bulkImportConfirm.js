import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import Employee from "../models/Employee.js";
import ImportJob from "../models/ImportJob.js";
import Role from "../models/Role.js";
import User from "../models/User.js";
import { logAudit } from "../utils/audit.js";
import { generateTempPassword } from "../utils/password.js";
import { syncPrimaryRoleAssignmentForUser } from "../utils/accessControl.js";
import {
  BULK_IMPORT_ROLE_KEY_MAP,
  buildBulkImportTenantFilter,
} from "./bulkImportAnalyzer.js";

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function toBooleanWord(value, fallback = true) {
  const normalized = normalizeText(value).toLowerCase();
  if (["yes", "si", "true", "1", "active"].includes(normalized)) return true;
  if (["no", "false", "0", "inactive"].includes(normalized)) return false;
  return fallback;
}

function parseDateValue(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const text = normalizeText(value);
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildIssue(sheet, rowNumber, field, message, severity = "error") {
  return { sheet, rowNumber: String(rowNumber ?? ""), field, message, severity };
}

function jobIssuesToResponse(issues = []) {
  return issues.map((item) => ({
    sheet: item.normalized?.sheet || "",
    rowNumber: item.rowNumber || "",
    field: item.normalized?.field || "",
    message: item.message,
    severity: item.severity || "error",
  }));
}

function sanitizeIssuesForJob(items) {
  return items.slice(0, 300).map((item) => ({
    rowNumber: String(item.rowNumber ?? ""),
    message: item.message,
    severity: item.severity || "error",
    source: "rule",
    normalized: {
      sheet: item.sheet,
      field: item.field,
    },
  }));
}

async function findTargetJob({ req, importJobId, previewToken }) {
  const filter = buildBulkImportTenantFilter(req, {
    stage: "analyzed",
  });

  if (importJobId) {
    filter._id = importJobId;
  } else {
    filter.previewToken = previewToken;
  }

  return ImportJob.findOne(filter).sort({ createdAt: -1 });
}

export async function confirmBulkImportJob({ req, importJobId, previewToken }) {
  const job = await findTargetJob({ req, importJobId, previewToken });
  if (!job) {
    return {
      status: 404,
      payload: { ok: false, mensaje: "Importacion no encontrada para este tenant" },
    };
  }

  if (job.expiresAt && job.expiresAt.getTime() < Date.now()) {
    job.stage = "expired";
    job.auditTrail.push({
      action: "bulk_import_expired",
      actorUserId: req.user.userId,
      details: {},
    });
    await job.save();
    return {
      status: 400,
      payload: {
        ok: false,
        importJobId: job._id,
        mensaje: "El preview expiro. Vuelve a analizar el archivo antes de confirmar.",
      },
    };
  }

  const storedPreview = job.previewSummary?.preview;
  const storedSummary = job.previewSummary?.summary;
  const persistedWarnings = Array.isArray(job.previewSummary?.persistenceWarnings)
    ? job.previewSummary.persistenceWarnings
    : [];
  const jobIssues = jobIssuesToResponse(job.issues || []);
  const blockingErrors = jobIssues.filter((item) => item.severity === "error");
  if (blockingErrors.length) {
    return {
      status: 400,
      payload: {
        ok: false,
        importJobId: job._id,
        mensaje: "La importacion tiene errores bloqueantes y no puede confirmarse.",
        errors: blockingErrors,
      },
    };
  }

  const preview = storedPreview || {};
  const result = {
    departments: { processed: 0, created: 0, updated: 0, skipped: 0 },
    employees: { processed: 0, created: 0, updated: 0, skipped: 0 },
    users: { processed: 0, created: 0, updated: 0, skipped: 0 },
    roleAssignments: { processed: 0, created: 0, updated: 0, skipped: 0 },
    managers: { processed: 0, created: 0, updated: 0, skipped: 0 },
    kpis: { processed: 0, created: 0, updated: 0, skipped: 0 },
    okrs: { processed: 0, created: 0, updated: 0, skipped: 0 },
    temporaryPasswords: [],
    warnings: [...persistedWarnings],
    errors: [],
  };

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const [roles, existingEmployees, existingUsers] = await Promise.all([
        Role.find({ companyId: job.companyId, activo: { $ne: false } }).session(session).lean(),
        Employee.find({ companyId: job.companyId }).session(session),
        User.find({ companyId: job.companyId, isSuperAdmin: false }).session(session),
      ]);

      const roleByCode = new Map(roles.filter((role) => role.code).map((role) => [role.code, role]));
      const employeeByCode = new Map();
      const employeeByEmail = new Map();
      existingEmployees.forEach((item) => {
        if (normalizeText(item.legajo)) employeeByCode.set(normalizeText(item.legajo), item);
        if (normalizeEmail(item.email)) employeeByEmail.set(normalizeEmail(item.email), item);
      });
      const userByEmail = new Map(existingUsers.map((item) => [normalizeEmail(item.email), item]));
      const importedDepartmentMap = new Map(
        (preview.departments || []).map((item) => [normalizeText(item.department_code), normalizeText(item.department_name)])
      );

      result.departments.processed = (preview.departments || []).length;
      result.departments.skipped = result.departments.processed;

      for (const row of preview.employees || []) {
        result.employees.processed += 1;
        const employeeCode = normalizeText(row.employee_code);
        const email = normalizeEmail(row.work_email);
        const employeePayload = {
          companyId: job.companyId,
          schoolId: job.schoolId,
          legajo: employeeCode,
          nombre: normalizeText(row.first_name),
          apellido: normalizeText(row.last_name),
          email,
          cargo: normalizeText(row.job_title),
          area: importedDepartmentMap.get(normalizeText(row.department_code)) || normalizeText(row.department_code),
          activo: toBooleanWord(row.active, true),
          fechaIngreso: parseDateValue(row.hire_date),
        };

        const existing = employeeByCode.get(employeeCode) || employeeByEmail.get(email) || null;
        if (existing) {
          existing.nombre = employeePayload.nombre;
          existing.apellido = employeePayload.apellido;
          existing.email = employeePayload.email;
          existing.cargo = employeePayload.cargo;
          existing.area = employeePayload.area;
          existing.legajo = employeePayload.legajo;
          existing.activo = employeePayload.activo;
          existing.fechaIngreso = employeePayload.fechaIngreso;
          await existing.save({ session });
          employeeByCode.set(employeeCode, existing);
          employeeByEmail.set(email, existing);
          result.employees.updated += 1;
        } else {
          const created = await Employee.create([employeePayload], { session });
          const employee = created[0];
          employeeByCode.set(employeeCode, employee);
          employeeByEmail.set(email, employee);
          result.employees.created += 1;
        }
      }

      const defaultRole =
        roleByCode.get("EMPLEADO") ||
        roleByCode.get("LECTOR") ||
        roles[0];

      for (const row of preview.usersAndRoles || []) {
        result.users.processed += 1;
        const email = normalizeEmail(row.work_email);
        const employeeCode = normalizeText(row.employee_code);
        const employee = employeeByCode.get(employeeCode) || employeeByEmail.get(email);
        const current = userByEmail.get(email);
        const roleKey = normalizeText(row.role_key).toUpperCase();
        const mapped = BULK_IMPORT_ROLE_KEY_MAP[roleKey];
        const role = mapped ? roleByCode.get(mapped.roleCode) : null;

        if (!employee || !role || !defaultRole) {
          result.errors.push(buildIssue("Usuarios_y_Roles", row._rowNumber, "role_key", "No se pudo resolver empleado o rol para confirmar"));
          result.users.skipped += 1;
          continue;
        }

        if (current) {
          current.nombre = `${employee.nombre} ${employee.apellido}`.trim();
          current.employeeId = employee._id;
          current.schoolId = job.schoolId || current.schoolId || null;
          current.activo = toBooleanWord(row.status, true);
          await current.save({ session });
          await syncPrimaryRoleAssignmentForUser({
            user: current,
            companyId: job.companyId,
            employeeId: employee._id,
            roleKey,
            scope: String(row.scope || mapped.allowedScopes?.[0] || "TEAM").trim().toUpperCase(),
            departmentCode: String(row.scope_reference_code || "").trim(),
            teamId: String(row.scope_reference_code || "").trim(),
            active: true,
            session,
          });
          userByEmail.set(email, current);
          result.users.updated += 1;
        } else {
          const generatedPassword = generateTempPassword();
          const created = await User.create([
            {
              companyId: job.companyId,
              schoolId: job.schoolId || null,
              roleId: defaultRole._id,
              employeeId: employee._id,
              nombre: `${employee.nombre} ${employee.apellido}`.trim(),
              email,
              passwordHash: await bcrypt.hash(generatedPassword, 10),
              activo: toBooleanWord(row.status, true),
              isSuperAdmin: false,
              mustChangePassword: true,
            },
          ], { session });
          const user = created[0];
          await syncPrimaryRoleAssignmentForUser({
            user,
            companyId: job.companyId,
            employeeId: employee._id,
            roleKey,
            scope: String(row.scope || mapped.allowedScopes?.[0] || "TEAM").trim().toUpperCase(),
            departmentCode: String(row.scope_reference_code || "").trim(),
            teamId: String(row.scope_reference_code || "").trim(),
            active: true,
            session,
          });
          userByEmail.set(email, user);
          result.temporaryPasswords.push({
            email,
            temporaryPassword: generatedPassword,
          });
          result.users.created += 1;
        }
      }

      for (const row of preview.usersAndRoles || []) {
        result.roleAssignments.processed += 1;
        const email = normalizeEmail(row.work_email);
        const roleKey = normalizeText(row.role_key).toUpperCase();
        const mapped = BULK_IMPORT_ROLE_KEY_MAP[roleKey];
        const role = mapped ? roleByCode.get(mapped.roleCode) : null;
        const user = userByEmail.get(email);
        if (!user || !role) {
          result.roleAssignments.skipped += 1;
          continue;
        }
        user.roleId = role._id;
        await user.save({ session });
        result.roleAssignments.updated += 1;
      }

      for (const row of preview.managers || []) {
        result.managers.processed += 1;
        const employee =
          employeeByCode.get(normalizeText(row.employee_code)) ||
          employeeByEmail.get(normalizeEmail(row.employee_email));
        const manager =
          employeeByCode.get(normalizeText(row.manager_employee_code)) ||
          employeeByEmail.get(normalizeEmail(row.manager_email));

        if (!employee || !manager) {
          result.managers.skipped += 1;
          continue;
        }
        employee.managerId = manager._id;
        await employee.save({ session });
        result.managers.updated += 1;
      }

      result.kpis.processed = (preview.kpis || []).length;
      result.kpis.skipped = result.kpis.processed;
      result.okrs.processed = (preview.okrs || []).length;
      result.okrs.skipped = result.okrs.processed;

      const finalIssues = [...result.errors.map((item) => ({ ...item, severity: "error" }))];
      const finalWarnings = result.warnings.map((message) =>
        buildIssue("sistema", "", "persistence", message, "warning")
      );

      job.stage = finalIssues.length ? "failed" : "confirmed";
      job.confirmedAt = finalIssues.length ? null : new Date();
      job.expiresAt = null;
      job.createdCount =
        result.employees.created +
        result.users.created;
      job.updatedCount =
        result.employees.updated +
        result.users.updated +
        result.roleAssignments.updated +
        result.managers.updated;
      job.errorCount = finalIssues.length;
      job.issues = sanitizeIssuesForJob([...finalIssues, ...finalWarnings]);
      job.resultSummary = {
        result,
        summary: storedSummary,
      };
      job.auditTrail.push({
        action: finalIssues.length ? "bulk_import_confirm_failed" : "bulk_import_confirmed",
        actorUserId: req.user.userId,
        details: {
          createdCount: job.createdCount,
          updatedCount: job.updatedCount,
          errorCount: job.errorCount,
        },
      });
      await job.save({ session });

      await logAudit({
        companyId: job.companyId,
        schoolId: job.schoolId,
        userId: req.user.userId,
        accion: finalIssues.length ? "bulk_import_failed" : "bulk_import_confirmed",
        modulo: "bulk-import",
        detalle: `Importacion masiva unificada ${finalIssues.length ? "fallida" : "confirmada"} (${job.sourceFileName})`,
        metadata: {
          importJobId: job._id,
          createdCount: job.createdCount,
          updatedCount: job.updatedCount,
          errorCount: job.errorCount,
        },
      });
    });

    const freshJob = await ImportJob.findById(job._id).lean();
    return {
      status: freshJob.stage === "confirmed" ? 200 : 400,
      payload: {
        ok: freshJob.stage === "confirmed",
        importJobId: freshJob._id,
        stage: freshJob.stage,
        result: freshJob.resultSummary?.result || result,
        summary: freshJob.previewSummary?.summary || storedSummary || null,
        errors: jobIssuesToResponse((freshJob.issues || []).filter((item) => item.severity === "error")),
        warnings: jobIssuesToResponse((freshJob.issues || []).filter((item) => item.severity === "warning")),
      },
    };
  } finally {
    await session.endSession();
  }
}
