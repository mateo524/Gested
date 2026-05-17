import crypto from "node:crypto";
import ExcelJS from "exceljs";
import Employee from "../models/Employee.js";
import ImportJob from "../models/ImportJob.js";
import Role from "../models/Role.js";
import School from "../models/School.js";
import User from "../models/User.js";
import {
  BULK_IMPORT_CATALOGS,
} from "./bulkImportTemplate.js";

export const BULK_IMPORT_PREVIEW_TTL_MS = 6 * 60 * 60 * 1000;
export const BULK_IMPORT_PREVIEW_LIMIT_PER_SHEET = 200;
export const BULK_IMPORT_DATASET = "bulk-unified";
export const BULK_IMPORT_PERSISTENCE_WARNINGS = [
  "La hoja Organización es informativa: la organización real la determina el backend autenticado.",
  "Los Departamentos se validan y se usan para mapear area en Empleados, pero hoy no existe un modelo Department persistente.",
  "KPIs y OKRs se validan por plantilla y se persisten en registros operativos simples. Aun no reemplazan un modulo avanzado de objetivos.",
];

export const BULK_IMPORT_ROLE_KEY_MAP = {
  ORG_OWNER: { roleCode: "ADMIN_COLEGIO", allowedScopes: ["ORGANIZATION"] },
  ORG_ADMIN: { roleCode: "ADMIN_COLEGIO", allowedScopes: ["ORGANIZATION"] },
  HR: { roleCode: "RRHH", allowedScopes: ["ORGANIZATION"] },
  MANAGER: { roleCode: "JEFE", allowedScopes: ["TEAM"] },
  EMPLOYEE: { roleCode: "EMPLEADO", allowedScopes: ["SELF"] },
  VIEWER: { roleCode: "LECTOR", allowedScopes: ["ORGANIZATION"] },
  AUDITOR: { roleCode: "LECTOR", allowedScopes: ["ORGANIZATION"] },
};

const REQUIRED_SHEETS = [
  "Instrucciones",
  "Organización",
  "Departamentos",
  "Empleados",
  "Usuarios_y_Roles",
  "Managers",
  "KPIs",
  "OKRs",
  "Catálogos",
];

const SHEET_COLUMN_CONFIG = {
  "Organización": {
    required: ["organization_code", "organization_name", "status"],
  },
  Departamentos: {
    required: ["department_code", "department_name", "status"],
  },
  Empleados: {
    required: [
      "employee_code",
      "first_name",
      "last_name",
      "work_email",
      "job_title",
      "employment_status",
      "active",
    ],
  },
  Usuarios_y_Roles: {
    required: [
      "employee_code",
      "work_email",
      "role_key",
      "scope",
      "status",
      "can_login",
    ],
  },
  Managers: {
    required: ["employee_code", "relationship_type", "primary_manager", "status"],
  },
  KPIs: {
    required: ["kpi_name", "status", "active"],
  },
  OKRs: {
    required: ["objective_title", "key_result_title", "status"],
  },
  "Catálogos": {
    required: ["catalog", "value", "description"],
  },
};

function normalizeHeader(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function parseDateValue(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  if (typeof value === "number") {
    const epoch = new Date(Math.round((value - 25569) * 86400 * 1000));
    return Number.isNaN(epoch.getTime()) ? null : epoch;
  }
  const text = normalizeText(value);
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function createIssue({ severity = "error", sheet, rowNumber, field = "", message }) {
  return {
    severity,
    sheet,
    rowNumber: String(rowNumber ?? ""),
    field,
    message,
  };
}

function emptyCounts() {
  return { totalRows: 0, validRows: 0, warnings: 0, errors: 0 };
}

function sanitizePreviewRows(rows) {
  return rows.slice(0, BULK_IMPORT_PREVIEW_LIMIT_PER_SHEET);
}

function readSheetRows(workbook, sheetName) {
  const worksheet = workbook.getWorksheet(sheetName);
  if (!worksheet) {
    return { headers: [], rows: [] };
  }

  const headerRow = worksheet.getRow(1);
  const headers = headerRow.values.slice(1).map((value) => normalizeHeader(value));
  const rows = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values = row.values.slice(1);
    const isEmpty = values.every((value) => normalizeText(value) === "");
    if (isEmpty) return;
    const item = { _rowNumber: rowNumber };
    headers.forEach((header, index) => {
      item[header || `col_${index + 1}`] = values[index];
    });
    rows.push(item);
  });

  return { headers, rows };
}

function buildBySheetSummary(rawSummary) {
  return Object.fromEntries(
    Object.entries(rawSummary).map(([sheet, counts]) => [
      sheet,
      {
        totalRows: counts.totalRows,
        validRows: counts.validRows,
        warnings: counts.warnings,
        errors: counts.errors,
      },
    ])
  );
}

function issueMatchesSheet(issue, sheetName, severity) {
  return issue.sheet === sheetName && issue.severity === severity;
}

function pushSheetIssues(summaryBySheet, issues, sheetName) {
  summaryBySheet[sheetName].warnings = issues.filter((item) => issueMatchesSheet(item, sheetName, "warning")).length;
  summaryBySheet[sheetName].errors = issues.filter((item) => issueMatchesSheet(item, sheetName, "error")).length;
}

async function loadScopeCollections({ companyId, schoolId }) {
  const [employees, users, roles, school] = await Promise.all([
    Employee.find({ companyId }).select("_id companyId schoolId legajo email nombre apellido area cargo activo").lean(),
    User.find({ companyId, isSuperAdmin: false }).select("_id email employeeId roleId activo").lean(),
    Role.find({ companyId, activo: { $ne: false } }).select("_id code nombre scope permisos").lean(),
    schoolId ? School.findOne({ _id: schoolId, companyId, activa: true }).select("_id nombre").lean() : null,
  ]);

  return { employees, users, roles, school };
}

function validateNoTenantColumns(row, sheetName, issues) {
  ["companyid", "schoolid", "company_id", "school_id"].forEach((field) => {
    if (field in row && normalizeText(row[field])) {
      issues.push(
        createIssue({
          severity: "warning",
          sheet: sheetName,
          rowNumber: row._rowNumber,
          field,
          message: `${field} sera ignorado. El tenant real lo determina el backend autenticado.`,
        })
      );
    }
  });
}

function countValidRows(rows, issues, sheetName) {
  const errorRows = new Set(
    issues
      .filter((item) => item.sheet === sheetName && item.severity === "error")
      .map((item) => item.rowNumber)
  );
  return rows.filter((row) => !errorRows.has(String(row._rowNumber))).length;
}

function validateCatalogSheet(rows, issues, summaryBySheet) {
  const officialValues = {
    roleKey: BULK_IMPORT_CATALOGS.roleKey,
    scope: BULK_IMPORT_CATALOGS.scope,
    relationship_type: BULK_IMPORT_CATALOGS.relationshipType,
    status: BULK_IMPORT_CATALOGS.status,
    "yes/no": BULK_IMPORT_CATALOGS.yesNo,
  };

  const grouped = {};
  rows.forEach((row) => {
    const catalog = normalizeText(row.catalog);
    const value = normalizeText(row.value);
    if (!grouped[catalog]) grouped[catalog] = [];
    grouped[catalog].push(value);
  });

  Object.entries(officialValues).forEach(([catalog, values]) => {
    const current = new Set(grouped[catalog] || []);
    values.forEach((value) => {
      if (!current.has(value)) {
        issues.push(
          createIssue({
            severity: "warning",
            sheet: "Catálogos",
            rowNumber: "",
            field: catalog,
            message: `El catalogo ${catalog} no contiene el valor oficial ${value}. Se usara el catalogo del backend.`,
          })
        );
      }
    });
  });

  summaryBySheet["Catálogos"].totalRows = rows.length;
}

function validateOrganizationRows(rows, issues, summaryBySheet) {
  summaryBySheet["Organización"].totalRows = rows.length;
  rows.forEach((row) => {
    validateNoTenantColumns(row, "Organización", issues);
    const status = normalizeText(row.status);
    if (status && !BULK_IMPORT_CATALOGS.status.includes(status)) {
      issues.push(
        createIssue({
          sheet: "Organización",
          rowNumber: row._rowNumber,
          field: "status",
          message: `status invalido: ${status}`,
        })
      );
    }
  });
}

function validateDepartmentRows(rows, issues, summaryBySheet) {
  summaryBySheet.Departamentos.totalRows = rows.length;
  const seenCodes = new Set();
  rows.forEach((row) => {
    validateNoTenantColumns(row, "Departamentos", issues);
    const code = normalizeText(row.department_code);
    const name = normalizeText(row.department_name);
    const status = normalizeText(row.status);
    if (!code) {
      issues.push(createIssue({ sheet: "Departamentos", rowNumber: row._rowNumber, field: "department_code", message: "department_code es obligatorio" }));
    }
    if (!name) {
      issues.push(createIssue({ sheet: "Departamentos", rowNumber: row._rowNumber, field: "department_name", message: "department_name es obligatorio" }));
    }
    if (code) {
      if (seenCodes.has(code)) {
        issues.push(createIssue({ sheet: "Departamentos", rowNumber: row._rowNumber, field: "department_code", message: `department_code duplicado en archivo: ${code}` }));
      }
      seenCodes.add(code);
    }
    if (status && !BULK_IMPORT_CATALOGS.status.includes(status)) {
      issues.push(createIssue({ sheet: "Departamentos", rowNumber: row._rowNumber, field: "status", message: `status invalido: ${status}` }));
    }
  });
}

function validateEmployeeRows(rows, issues, summaryBySheet, context) {
  summaryBySheet.Empleados.totalRows = rows.length;
  const importedDepartmentCodes = new Set(context.departments.map((item) => normalizeText(item.department_code)).filter(Boolean));
  const seenCodes = new Set();
  const seenEmails = new Set();
  const existingByCode = new Map(
    context.existingEmployees
      .filter((item) => normalizeText(item.legajo))
      .map((item) => [normalizeText(item.legajo), item])
  );

  rows.forEach((row) => {
    validateNoTenantColumns(row, "Empleados", issues);
    const employeeCode = normalizeText(row.employee_code);
    const email = normalizeEmail(row.work_email);
    const departmentCode = normalizeText(row.department_code);
    const employmentStatus = normalizeText(row.employment_status || row.status);
    const active = normalizeText(row.active);
    const hireDate = parseDateValue(row.hire_date);

    if (!employeeCode) {
      issues.push(createIssue({ sheet: "Empleados", rowNumber: row._rowNumber, field: "employee_code", message: "employee_code es obligatorio" }));
    } else {
      if (seenCodes.has(employeeCode)) {
        issues.push(createIssue({ sheet: "Empleados", rowNumber: row._rowNumber, field: "employee_code", message: `employee_code duplicado en archivo: ${employeeCode}` }));
      }
      const existing = existingByCode.get(employeeCode);
      if (existing && normalizeEmail(existing.email) && normalizeEmail(existing.email) !== email) {
        issues.push(createIssue({ sheet: "Empleados", rowNumber: row._rowNumber, field: "employee_code", message: `employee_code ya existe con otro email en la organizacion: ${employeeCode}` }));
      }
      seenCodes.add(employeeCode);
    }

    if (!normalizeText(row.first_name)) {
      issues.push(createIssue({ sheet: "Empleados", rowNumber: row._rowNumber, field: "first_name", message: "first_name es obligatorio" }));
    }
    if (!normalizeText(row.last_name)) {
      issues.push(createIssue({ sheet: "Empleados", rowNumber: row._rowNumber, field: "last_name", message: "last_name es obligatorio" }));
    }
    if (!email) {
      issues.push(createIssue({ sheet: "Empleados", rowNumber: row._rowNumber, field: "work_email", message: "work_email es obligatorio" }));
    } else {
      if (!email.includes("@")) {
        issues.push(createIssue({ sheet: "Empleados", rowNumber: row._rowNumber, field: "work_email", message: "work_email no tiene formato valido" }));
      }
      if (seenEmails.has(email)) {
        issues.push(createIssue({ sheet: "Empleados", rowNumber: row._rowNumber, field: "work_email", message: `work_email duplicado en archivo: ${email}` }));
      }
      seenEmails.add(email);
    }
    if (!normalizeText(row.job_title)) {
      issues.push(createIssue({ sheet: "Empleados", rowNumber: row._rowNumber, field: "job_title", message: "job_title es obligatorio" }));
    }
    if (departmentCode && !importedDepartmentCodes.has(departmentCode)) {
      issues.push(createIssue({ sheet: "Empleados", rowNumber: row._rowNumber, field: "department_code", message: `department_code no existe en la hoja Departamentos: ${departmentCode}` }));
    }
    if (employmentStatus && !BULK_IMPORT_CATALOGS.status.includes(employmentStatus)) {
      issues.push(createIssue({ sheet: "Empleados", rowNumber: row._rowNumber, field: "employment_status", message: `employment_status invalido: ${employmentStatus}` }));
    }
    if (active && !BULK_IMPORT_CATALOGS.yesNo.includes(active)) {
      issues.push(createIssue({ sheet: "Empleados", rowNumber: row._rowNumber, field: "active", message: `active invalido: ${active}` }));
    }
    if (normalizeText(row.hire_date) && !hireDate) {
      issues.push(createIssue({ sheet: "Empleados", rowNumber: row._rowNumber, field: "hire_date", message: "hire_date no tiene una fecha valida" }));
    }
  });
}

function validateUsersRolesRows(rows, issues, summaryBySheet, context) {
  summaryBySheet.Usuarios_y_Roles.totalRows = rows.length;
  const importedEmployeesByCode = new Set(context.employees.map((item) => normalizeText(item.employee_code)).filter(Boolean));
  const importedEmployeesByEmail = new Set(context.employees.map((item) => normalizeEmail(item.work_email)).filter(Boolean));

  rows.forEach((row) => {
    validateNoTenantColumns(row, "Usuarios_y_Roles", issues);
    const employeeCode = normalizeText(row.employee_code);
    const email = normalizeEmail(row.work_email);
    const roleKey = normalizeText(row.role_key).toUpperCase();
    const scope = normalizeText(row.scope).toUpperCase();
    const status = normalizeText(row.status);
    const canLogin = normalizeText(row.can_login);

    if (!employeeCode) {
      issues.push(createIssue({ sheet: "Usuarios_y_Roles", rowNumber: row._rowNumber, field: "employee_code", message: "employee_code es obligatorio" }));
    } else if (!importedEmployeesByCode.has(employeeCode)) {
      const exists = context.existingEmployees.some((item) => normalizeText(item.legajo) === employeeCode);
      if (!exists) {
        issues.push(createIssue({ sheet: "Usuarios_y_Roles", rowNumber: row._rowNumber, field: "employee_code", message: `employee_code no existe entre empleados importados ni existentes: ${employeeCode}` }));
      }
    }

    if (!email) {
      issues.push(createIssue({ sheet: "Usuarios_y_Roles", rowNumber: row._rowNumber, field: "work_email", message: "work_email es obligatorio" }));
    } else if (!email.includes("@")) {
      issues.push(createIssue({ sheet: "Usuarios_y_Roles", rowNumber: row._rowNumber, field: "work_email", message: "work_email no tiene formato valido" }));
    }

    if (!importedEmployeesByEmail.has(email)) {
      const exists = context.existingEmployees.some((item) => normalizeEmail(item.email) === email);
      if (!exists) {
        issues.push(createIssue({ sheet: "Usuarios_y_Roles", rowNumber: row._rowNumber, field: "work_email", message: `No existe empleado asociado con email ${email}` }));
      }
    }

    if (!BULK_IMPORT_ROLE_KEY_MAP[roleKey]) {
      issues.push(createIssue({ sheet: "Usuarios_y_Roles", rowNumber: row._rowNumber, field: "role_key", message: `roleKey no permitido: ${roleKey || "(vacio)"}` }));
    }
    if (["SUPER_ADMIN", "PLATFORM"].includes(roleKey)) {
      issues.push(createIssue({ sheet: "Usuarios_y_Roles", rowNumber: row._rowNumber, field: "role_key", message: `roleKey bloqueado: ${roleKey}` }));
    }
    if (!BULK_IMPORT_CATALOGS.scope.includes(scope)) {
      issues.push(createIssue({ sheet: "Usuarios_y_Roles", rowNumber: row._rowNumber, field: "scope", message: `scope no permitido: ${scope || "(vacio)"}` }));
    } else if (BULK_IMPORT_ROLE_KEY_MAP[roleKey] && !BULK_IMPORT_ROLE_KEY_MAP[roleKey].allowedScopes.includes(scope)) {
      issues.push(createIssue({ sheet: "Usuarios_y_Roles", rowNumber: row._rowNumber, field: "scope", message: `El roleKey ${roleKey} no puede asignarse con scope ${scope} en el backend actual` }));
    }
    if (status && !BULK_IMPORT_CATALOGS.status.includes(status)) {
      issues.push(createIssue({ sheet: "Usuarios_y_Roles", rowNumber: row._rowNumber, field: "status", message: `status invalido: ${status}` }));
    }
    if (canLogin && !BULK_IMPORT_CATALOGS.yesNo.includes(canLogin)) {
      issues.push(createIssue({ sheet: "Usuarios_y_Roles", rowNumber: row._rowNumber, field: "can_login", message: `can_login invalido: ${canLogin}` }));
    }
  });
}

function validateManagersRows(rows, issues, summaryBySheet, context) {
  summaryBySheet.Managers.totalRows = rows.length;
  const employeeCodes = new Set(context.employees.map((item) => normalizeText(item.employee_code)).filter(Boolean));
  const employeeEmails = new Set(context.employees.map((item) => normalizeEmail(item.work_email)).filter(Boolean));

  rows.forEach((row) => {
    validateNoTenantColumns(row, "Managers", issues);
    const employeeCode = normalizeText(row.employee_code);
    const managerEmployeeCode = normalizeText(row.manager_employee_code);
    const managerEmail = normalizeEmail(row.manager_email);
    const relationshipType = normalizeText(row.relationship_type);
    const primaryManager = normalizeText(row.primary_manager);
    const status = normalizeText(row.status);
    const startDate = parseDateValue(row.start_date);
    const endDate = parseDateValue(row.end_date);

    if (!employeeCode) {
      issues.push(createIssue({ sheet: "Managers", rowNumber: row._rowNumber, field: "employee_code", message: "employee_code es obligatorio" }));
    } else if (!employeeCodes.has(employeeCode) && !context.existingEmployees.some((item) => normalizeText(item.legajo) === employeeCode)) {
      issues.push(createIssue({ sheet: "Managers", rowNumber: row._rowNumber, field: "employee_code", message: `employee_code no existe: ${employeeCode}` }));
    }
    if (!managerEmployeeCode && !managerEmail) {
      issues.push(createIssue({ sheet: "Managers", rowNumber: row._rowNumber, field: "manager_employee_code", message: "Debes informar manager_employee_code o manager_email" }));
    }
    if (managerEmployeeCode && !employeeCodes.has(managerEmployeeCode) && !context.existingEmployees.some((item) => normalizeText(item.legajo) === managerEmployeeCode)) {
      issues.push(createIssue({ sheet: "Managers", rowNumber: row._rowNumber, field: "manager_employee_code", message: `manager_employee_code no existe: ${managerEmployeeCode}` }));
    }
    if (managerEmail && !employeeEmails.has(managerEmail) && !context.existingEmployees.some((item) => normalizeEmail(item.email) === managerEmail)) {
      issues.push(createIssue({ sheet: "Managers", rowNumber: row._rowNumber, field: "manager_email", message: `manager_email no existe entre empleados importados o existentes: ${managerEmail}` }));
    }
    if (relationshipType && !BULK_IMPORT_CATALOGS.relationshipType.includes(relationshipType)) {
      issues.push(createIssue({ sheet: "Managers", rowNumber: row._rowNumber, field: "relationship_type", message: `relationship_type invalido: ${relationshipType}` }));
    }
    if (primaryManager && !BULK_IMPORT_CATALOGS.yesNo.includes(primaryManager)) {
      issues.push(createIssue({ sheet: "Managers", rowNumber: row._rowNumber, field: "primary_manager", message: `primary_manager invalido: ${primaryManager}` }));
    }
    if (status && !BULK_IMPORT_CATALOGS.status.includes(status)) {
      issues.push(createIssue({ sheet: "Managers", rowNumber: row._rowNumber, field: "status", message: `status invalido: ${status}` }));
    }
    if (normalizeText(row.start_date) && !startDate) {
      issues.push(createIssue({ sheet: "Managers", rowNumber: row._rowNumber, field: "start_date", message: "start_date no tiene una fecha valida" }));
    }
    if (normalizeText(row.end_date) && !endDate) {
      issues.push(createIssue({ sheet: "Managers", rowNumber: row._rowNumber, field: "end_date", message: "end_date no tiene una fecha valida" }));
    }
    if (startDate && endDate && startDate > endDate) {
      issues.push(createIssue({ sheet: "Managers", rowNumber: row._rowNumber, field: "end_date", message: "end_date no puede ser anterior a start_date" }));
    }
  });
}

function validateKpisRows(rows, issues, summaryBySheet, context) {
  summaryBySheet.KPIs.totalRows = rows.length;
  rows.forEach((row) => {
    validateNoTenantColumns(row, "KPIs", issues);
    const name = normalizeText(row.kpi_name);
    const employeeEmail = normalizeEmail(row.employee_email || row.work_email);
    const ownerCode = normalizeText(row.owner_employee_code);
    const targetValue = normalizeText(row.target_value);
    const status = normalizeText(row.status);
    const active = normalizeText(row.active);

    if (!name) {
      issues.push(createIssue({ sheet: "KPIs", rowNumber: row._rowNumber, field: "kpi_name", message: "kpi_name es obligatorio" }));
    }
    if (!employeeEmail && !ownerCode) {
      issues.push(createIssue({ sheet: "KPIs", rowNumber: row._rowNumber, field: "employee_email", message: "Debes informar employee_email o owner_employee_code" }));
    }
    if (employeeEmail && !context.employees.some((item) => normalizeEmail(item.work_email) === employeeEmail) && !context.existingEmployees.some((item) => normalizeEmail(item.email) === employeeEmail)) {
      issues.push(createIssue({ sheet: "KPIs", rowNumber: row._rowNumber, field: "employee_email", message: `employee_email no existe: ${employeeEmail}` }));
    }
    if (ownerCode && !context.employees.some((item) => normalizeText(item.employee_code) === ownerCode) && !context.existingEmployees.some((item) => normalizeText(item.legajo) === ownerCode)) {
      issues.push(createIssue({ sheet: "KPIs", rowNumber: row._rowNumber, field: "owner_employee_code", message: `owner_employee_code no existe: ${ownerCode}` }));
    }
    if (!targetValue || Number.isNaN(Number(targetValue))) {
      issues.push(createIssue({ sheet: "KPIs", rowNumber: row._rowNumber, field: "target_value", message: "target_value debe ser numerico y obligatorio" }));
    }
    if (status && !BULK_IMPORT_CATALOGS.status.includes(status)) {
      issues.push(createIssue({ sheet: "KPIs", rowNumber: row._rowNumber, field: "status", message: `status invalido: ${status}` }));
    }
    if (active && !BULK_IMPORT_CATALOGS.yesNo.includes(active)) {
      issues.push(createIssue({ sheet: "KPIs", rowNumber: row._rowNumber, field: "active", message: `active invalido: ${active}` }));
    }
  });
}

function validateOkrsRows(rows, issues, summaryBySheet, context) {
  summaryBySheet.OKRs.totalRows = rows.length;
  rows.forEach((row) => {
    validateNoTenantColumns(row, "OKRs", issues);
    const objective = normalizeText(row.objective_title);
    const keyResult = normalizeText(row.key_result_title);
    const employeeEmail = normalizeEmail(row.employee_email || row.work_email);
    const ownerCode = normalizeText(row.owner_employee_code);
    const status = normalizeText(row.status);

    if (!objective) {
      issues.push(createIssue({ sheet: "OKRs", rowNumber: row._rowNumber, field: "objective_title", message: "objective_title es obligatorio" }));
    }
    if (!keyResult) {
      issues.push(createIssue({ sheet: "OKRs", rowNumber: row._rowNumber, field: "key_result_title", message: "key_result_title es obligatorio" }));
    }
    if (employeeEmail && !context.employees.some((item) => normalizeEmail(item.work_email) === employeeEmail) && !context.existingEmployees.some((item) => normalizeEmail(item.email) === employeeEmail)) {
      issues.push(createIssue({ sheet: "OKRs", rowNumber: row._rowNumber, field: "employee_email", message: `employee_email no existe: ${employeeEmail}` }));
    }
    if (ownerCode && !context.employees.some((item) => normalizeText(item.employee_code) === ownerCode) && !context.existingEmployees.some((item) => normalizeText(item.legajo) === ownerCode)) {
      issues.push(createIssue({ sheet: "OKRs", rowNumber: row._rowNumber, field: "owner_employee_code", message: `owner_employee_code no existe: ${ownerCode}` }));
    }
    if (status && !BULK_IMPORT_CATALOGS.status.includes(status)) {
      issues.push(createIssue({ sheet: "OKRs", rowNumber: row._rowNumber, field: "status", message: `status invalido: ${status}` }));
    }
  });
}

export async function analyzeBulkImportWorkbook({ buffer, companyId, schoolId }) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const missingSheets = REQUIRED_SHEETS.filter((name) => !workbook.getWorksheet(name));
  const issues = [];
  const summaryBySheet = Object.fromEntries(REQUIRED_SHEETS.map((sheet) => [sheet, emptyCounts()]));

  if (missingSheets.length) {
    missingSheets.forEach((sheetName) => {
      issues.push(
        createIssue({
          sheet: sheetName,
          rowNumber: "",
          field: "sheet",
          message: `Falta la solapa requerida: ${sheetName}`,
        })
      );
    });
  }

  const collections = await loadScopeCollections({ companyId, schoolId });
  if (schoolId && !collections.school) {
    issues.push(createIssue({ sheet: "Organización", rowNumber: "", field: "schoolId", message: "El colegio del scope autenticado no existe o esta inactivo" }));
  }

  const rawSheets = {};
  const preview = {
    organization: [],
    departments: [],
    employees: [],
    usersAndRoles: [],
    managers: [],
    kpis: [],
    okrs: [],
  };

  REQUIRED_SHEETS.forEach((sheetName) => {
    const { headers, rows } = readSheetRows(workbook, sheetName);
    rawSheets[sheetName] = { headers, rows };

    const config = SHEET_COLUMN_CONFIG[sheetName];
    if (config) {
      config.required.forEach((header) => {
        if (!headers.includes(header)) {
          issues.push(
            createIssue({
              sheet: sheetName,
              rowNumber: "",
              field: header,
              message: `Falta la columna requerida ${header}`,
            })
          );
        }
      });
    }
  });

  const departments = rawSheets.Departamentos?.rows || [];
  const employees = rawSheets.Empleados?.rows || [];
  const usersAndRoles = rawSheets["Usuarios_y_Roles"]?.rows || [];
  const managers = rawSheets.Managers?.rows || [];
  const kpis = rawSheets.KPIs?.rows || [];
  const okrs = rawSheets.OKRs?.rows || [];

  validateCatalogSheet(rawSheets["Catálogos"]?.rows || [], issues, summaryBySheet);
  validateOrganizationRows(rawSheets["Organización"]?.rows || [], issues, summaryBySheet);
  validateDepartmentRows(departments, issues, summaryBySheet);
  validateEmployeeRows(employees, issues, summaryBySheet, {
    departments,
    existingEmployees: collections.employees,
  });
  validateUsersRolesRows(usersAndRoles, issues, summaryBySheet, {
    employees,
    existingEmployees: collections.employees,
  });
  validateManagersRows(managers, issues, summaryBySheet, {
    employees,
    existingEmployees: collections.employees,
  });
  validateKpisRows(kpis, issues, summaryBySheet, {
    employees,
    existingEmployees: collections.employees,
  });
  validateOkrsRows(okrs, issues, summaryBySheet, {
    employees,
    existingEmployees: collections.employees,
  });

  Object.keys(summaryBySheet).forEach((sheetName) => {
    pushSheetIssues(summaryBySheet, issues, sheetName);
  });

  summaryBySheet["Organización"].validRows = countValidRows(rawSheets["Organización"]?.rows || [], issues, "Organización");
  summaryBySheet.Departamentos.validRows = countValidRows(departments, issues, "Departamentos");
  summaryBySheet.Empleados.validRows = countValidRows(employees, issues, "Empleados");
  summaryBySheet.Usuarios_y_Roles.validRows = countValidRows(usersAndRoles, issues, "Usuarios_y_Roles");
  summaryBySheet.Managers.validRows = countValidRows(managers, issues, "Managers");
  summaryBySheet.KPIs.validRows = countValidRows(kpis, issues, "KPIs");
  summaryBySheet.OKRs.validRows = countValidRows(okrs, issues, "OKRs");
  summaryBySheet["Catálogos"].validRows = countValidRows(rawSheets["Catálogos"]?.rows || [], issues, "Catálogos");

  preview.organization = sanitizePreviewRows(rawSheets["Organización"]?.rows || []);
  preview.departments = sanitizePreviewRows(departments);
  preview.employees = sanitizePreviewRows(employees);
  preview.usersAndRoles = sanitizePreviewRows(usersAndRoles);
  preview.managers = sanitizePreviewRows(managers);
  preview.kpis = sanitizePreviewRows(kpis);
  preview.okrs = sanitizePreviewRows(okrs);

  const warnings = issues.filter((item) => item.severity === "warning");
  const errors = issues.filter((item) => item.severity === "error");
  const totalRows = Object.values(summaryBySheet).reduce((acc, item) => acc + item.totalRows, 0);
  const validRows = Object.values(summaryBySheet).reduce((acc, item) => acc + item.validRows, 0);

  return {
    ok: errors.length === 0,
    summary: {
      totalRows,
      validRows,
      warnings: warnings.length,
      errors: errors.length,
      bySheet: buildBySheetSummary(summaryBySheet),
    },
    preview,
    errors,
    warnings,
    raw: {
      preview,
      collections: {
        existingRoles: collections.roles,
        existingUsers: collections.users,
        existingEmployees: collections.employees,
      },
      persistenceWarnings: BULK_IMPORT_PERSISTENCE_WARNINGS,
    },
  };
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

export function buildBulkImportTenantFilter(req, extra = {}) {
  const filter = {
    ...extra,
    jobType: "bulk_unified",
  };

  if (req.scope?.isSuperAdmin) {
    const companyId = req.get("X-Company-Id") || req.query.companyId || req.scope.companyId;
    if (companyId) filter.companyId = companyId;
    const schoolId = req.query.schoolId || null;
    if (schoolId) filter.schoolId = schoolId;
    return filter;
  }

  filter.companyId = req.scope.companyId;
  if (req.scope.schoolId) {
    filter.schoolId = req.scope.schoolId;
  }
  return filter;
}

export async function createBulkImportAnalysisJob({
  req,
  file,
  companyId,
  schoolId,
  analysis,
}) {
  const previewToken = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + BULK_IMPORT_PREVIEW_TTL_MS);
  const stage = "analyzed";
  const issues = sanitizeIssuesForJob([...analysis.errors, ...analysis.warnings]);

  const job = await ImportJob.create({
    jobType: "bulk_unified",
    companyId,
    schoolId,
    createdByUserId: req.user.userId,
    sourceFileName: file.originalname,
    sourceMimeType: file.mimetype,
    sourceStorageProvider: "local",
    previewToken,
    stage,
    datasetRequested: BULK_IMPORT_DATASET,
    datasetDetected: BULK_IMPORT_DATASET,
    parserType: "rules",
    inferenceUsed: false,
    totalRows: analysis.summary.totalRows,
    validRows: analysis.summary.validRows,
    invalidRows: analysis.summary.errors,
    errorCount: analysis.summary.errors,
    previewSummary: {
      summary: analysis.summary,
      preview: analysis.raw.preview,
      persistenceWarnings: analysis.raw.persistenceWarnings,
    },
    issues,
    auditTrail: [
      {
        action: "bulk_import_analyzed",
        actorUserId: req.user.userId,
        details: {
          sourceFileName: file.originalname,
          warnings: analysis.summary.warnings,
          errors: analysis.summary.errors,
        },
      },
    ],
    expiresAt,
  });

  return { job, previewToken, expiresAt };
}
