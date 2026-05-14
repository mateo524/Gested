import ExcelJS from "exceljs";

export const BULK_IMPORT_TEMPLATE_FILENAME = "Plantilla_Performia_Importacion.xlsx";

export const BULK_IMPORT_CATALOGS = {
  roleKey: [
    "ORG_OWNER",
    "ORG_ADMIN",
    "HR",
    "MANAGER",
    "EMPLOYEE",
    "VIEWER",
    "AUDITOR",
  ],
  scope: [
    "ORGANIZATION",
    "REGION_COUNTRY",
    "BUSINESS_UNIT",
    "DEPARTMENT",
    "TEAM",
    "SELF",
  ],
  relationshipType: ["direct", "dotted_line", "temporary"],
  status: ["active", "inactive"],
  yesNo: ["yes", "no"],
};

function applySheetStyle(worksheet, columns) {
  worksheet.columns = columns.map((column) => ({
    header: column.header,
    key: column.key,
    width: column.width || 22,
  }));
  worksheet.views = [{ state: "frozen", ySplit: 1 }];

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1F4B99" },
  };
  headerRow.alignment = { vertical: "middle", horizontal: "center", wrapText: true };

  worksheet.eachRow((row, rowNumber) => {
    row.alignment = { vertical: "top", wrapText: true };
    if (rowNumber > 1 && rowNumber % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF7F9FC" },
        };
      });
    }
  });
}

function addInstructionSheet(workbook) {
  const sheet = workbook.addWorksheet("Instrucciones");
  sheet.columns = [
    { header: "Seccion", key: "section", width: 30 },
    { header: "Detalle", key: "detail", width: 120 },
  ];
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1F4B99" },
  };
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  const rows = [
    {
      section: "Objetivo",
      detail:
        "Completa esta plantilla oficial para preparar la importacion masiva unificada de Performia. Usa una fila por registro y respeta los encabezados.",
    },
    {
      section: "Seguridad",
      detail:
        "No cargues credenciales, claves ni datos reales sensibles en archivos de prueba. SUPER_ADMIN y PLATFORM no se crean ni se configuran desde esta plantilla.",
    },
    {
      section: "Alcance real",
      detail:
        "La organizacion y el alcance real siempre los determina el backend segun el usuario autenticado. Los datos del Excel son orientativos y no reemplazan el scope del sistema.",
    },
    {
      section: "IDs confiables",
      detail:
        "No uses companyId, schoolId o identificadores internos como fuente confiable de asignacion. La plantilla trabaja con codigos funcionales y referencias de negocio.",
    },
    {
      section: "Orden recomendado",
      detail:
        "1) Organizacion, 2) Departamentos, 3) Empleados, 4) Usuarios_y_Roles, 5) Managers, 6) KPIs, 7) OKRs. La hoja Catalogos sirve como referencia valida.",
    },
    {
      section: "Formato",
      detail:
        "Mantene encabezados sin cambiar, evita celdas fusionadas y completa yes/no, status, scope y roleKey usando exactamente los valores del catalogo.",
    },
    {
      section: "Managers",
      detail:
        "La relacion entre manager y colaborador se define por employee_code y manager_employee_code. relationship_type admite direct, dotted_line o temporary.",
    },
    {
      section: "Usuarios",
      detail:
        "La hoja Usuarios_y_Roles no crea credenciales. Solo declara el vinculo entre persona, email laboral, rol funcional y alcance deseado para validacion posterior.",
    },
  ];

  rows.forEach((row) => sheet.addRow(row));
  sheet.eachRow((row) => {
    row.alignment = { vertical: "top", wrapText: true };
  });
}

function addOrganizationSheet(workbook) {
  const sheet = workbook.addWorksheet("Organización");
  applySheetStyle(sheet, [
    { header: "organization_code", key: "organizationCode", width: 24 },
    { header: "organization_name", key: "organizationName", width: 32 },
    { header: "legal_name", key: "legalName", width: 32 },
    { header: "country", key: "country", width: 18 },
    { header: "region_country", key: "regionCountry", width: 20 },
    { header: "business_unit", key: "businessUnit", width: 22 },
    { header: "status", key: "status", width: 14 },
    { header: "notes", key: "notes", width: 34 },
  ]);
  sheet.addRow({
    organizationCode: "ORG-DEMO-01",
    organizationName: "Colegio Faro Norte",
    legalName: "Instituto Faro Norte SA",
    country: "AR",
    regionCountry: "Buenos Aires",
    businessUnit: "Educacion K-12",
    status: "active",
    notes: "Ejemplo ficticio. El backend define la organizacion real.",
  });
}

function addDepartmentsSheet(workbook) {
  const sheet = workbook.addWorksheet("Departamentos");
  applySheetStyle(sheet, [
    { header: "department_code", key: "departmentCode", width: 22 },
    { header: "department_name", key: "departmentName", width: 28 },
    { header: "parent_department_code", key: "parentDepartmentCode", width: 24 },
    { header: "business_unit", key: "businessUnit", width: 22 },
    { header: "region_country", key: "regionCountry", width: 20 },
    { header: "status", key: "status", width: 14 },
    { header: "is_people_area", key: "isPeopleArea", width: 16 },
  ]);
  sheet.addRow({
    departmentCode: "DEP-RRHH",
    departmentName: "Recursos Humanos",
    parentDepartmentCode: "",
    businessUnit: "Educacion K-12",
    regionCountry: "Buenos Aires",
    status: "active",
    isPeopleArea: "yes",
  });
  sheet.addRow({
    departmentCode: "DEP-SEC",
    departmentName: "Secundaria",
    parentDepartmentCode: "DEP-ACADEMICA",
    businessUnit: "Educacion K-12",
    regionCountry: "Buenos Aires",
    status: "active",
    isPeopleArea: "no",
  });
}

function addEmployeesSheet(workbook) {
  const sheet = workbook.addWorksheet("Empleados");
  applySheetStyle(sheet, [
    { header: "employee_code", key: "employeeCode", width: 20 },
    { header: "first_name", key: "firstName", width: 20 },
    { header: "last_name", key: "lastName", width: 20 },
    { header: "work_email", key: "workEmail", width: 30 },
    { header: "job_title", key: "jobTitle", width: 24 },
    { header: "department_code", key: "departmentCode", width: 20 },
    { header: "business_unit", key: "businessUnit", width: 22 },
    { header: "region_country", key: "regionCountry", width: 20 },
    { header: "hire_date", key: "hireDate", width: 16 },
    { header: "employment_status", key: "employmentStatus", width: 18 },
    { header: "active", key: "active", width: 12 },
  ]);
  sheet.addRow({
    employeeCode: "EMP-1001",
    firstName: "Lucia",
    lastName: "Mendez",
    workEmail: "lucia.mendez@demo.performia.local",
    jobTitle: "HR Business Partner",
    departmentCode: "DEP-RRHH",
    businessUnit: "Educacion K-12",
    regionCountry: "Buenos Aires",
    hireDate: "2024-02-01",
    employmentStatus: "active",
    active: "yes",
  });
  sheet.addRow({
    employeeCode: "EMP-2001",
    firstName: "Tomas",
    lastName: "Rossi",
    workEmail: "tomas.rossi@demo.performia.local",
    jobTitle: "Coordinador Academico",
    departmentCode: "DEP-SEC",
    businessUnit: "Educacion K-12",
    regionCountry: "Buenos Aires",
    hireDate: "2023-07-15",
    employmentStatus: "active",
    active: "yes",
  });
}

function addUsersRolesSheet(workbook) {
  const sheet = workbook.addWorksheet("Usuarios_y_Roles");
  applySheetStyle(sheet, [
    { header: "employee_code", key: "employeeCode", width: 20 },
    { header: "work_email", key: "workEmail", width: 30 },
    { header: "role_key", key: "roleKey", width: 18 },
    { header: "scope", key: "scope", width: 22 },
    { header: "scope_reference_code", key: "scopeReferenceCode", width: 24 },
    { header: "status", key: "status", width: 14 },
    { header: "can_login", key: "canLogin", width: 14 },
    { header: "notes", key: "notes", width: 34 },
  ]);
  sheet.addRow({
    employeeCode: "EMP-1001",
    workEmail: "lucia.mendez@demo.performia.local",
    roleKey: "HR",
    scope: "DEPARTMENT",
    scopeReferenceCode: "DEP-RRHH",
    status: "active",
    canLogin: "yes",
    notes: "Ejemplo de acceso operativo interno.",
  });
  sheet.addRow({
    employeeCode: "EMP-2001",
    workEmail: "tomas.rossi@demo.performia.local",
    roleKey: "MANAGER",
    scope: "TEAM",
    scopeReferenceCode: "TEAM-SEC-COORD",
    status: "active",
    canLogin: "yes",
    notes: "No usar SUPER_ADMIN ni PLATFORM.",
  });
}

function addManagersSheet(workbook) {
  const sheet = workbook.addWorksheet("Managers");
  applySheetStyle(sheet, [
    { header: "employee_code", key: "employeeCode", width: 20 },
    { header: "manager_employee_code", key: "managerEmployeeCode", width: 24 },
    { header: "relationship_type", key: "relationshipType", width: 18 },
    { header: "primary_manager", key: "primaryManager", width: 18 },
    { header: "start_date", key: "startDate", width: 16 },
    { header: "end_date", key: "endDate", width: 16 },
    { header: "status", key: "status", width: 14 },
  ]);
  sheet.addRow({
    employeeCode: "EMP-3001",
    managerEmployeeCode: "EMP-2001",
    relationshipType: "direct",
    primaryManager: "yes",
    startDate: "2024-03-01",
    endDate: "",
    status: "active",
  });
}

function addKpisSheet(workbook) {
  const sheet = workbook.addWorksheet("KPIs");
  applySheetStyle(sheet, [
    { header: "kpi_code", key: "kpiCode", width: 18 },
    { header: "kpi_name", key: "kpiName", width: 28 },
    { header: "owner_employee_code", key: "ownerEmployeeCode", width: 22 },
    { header: "department_code", key: "departmentCode", width: 18 },
    { header: "target_value", key: "targetValue", width: 14 },
    { header: "unit", key: "unit", width: 14 },
    { header: "frequency", key: "frequency", width: 16 },
    { header: "status", key: "status", width: 14 },
    { header: "active", key: "active", width: 12 },
  ]);
  sheet.addRow({
    kpiCode: "KPI-RET-01",
    kpiName: "Retencion docente",
    ownerEmployeeCode: "EMP-1001",
    departmentCode: "DEP-RRHH",
    targetValue: 92,
    unit: "percent",
    frequency: "quarterly",
    status: "active",
    active: "yes",
  });
}

function addOkrsSheet(workbook) {
  const sheet = workbook.addWorksheet("OKRs");
  applySheetStyle(sheet, [
    { header: "okr_code", key: "okrCode", width: 18 },
    { header: "objective_title", key: "objectiveTitle", width: 36 },
    { header: "key_result_title", key: "keyResultTitle", width: 40 },
    { header: "owner_employee_code", key: "ownerEmployeeCode", width: 22 },
    { header: "department_code", key: "departmentCode", width: 18 },
    { header: "quarter", key: "quarter", width: 12 },
    { header: "target_value", key: "targetValue", width: 14 },
    { header: "status", key: "status", width: 14 },
  ]);
  sheet.addRow({
    okrCode: "OKR-2026-Q2-01",
    objectiveTitle: "Fortalecer liderazgo de mandos medios",
    keyResultTitle: "Completar 90% de planes de desarrollo de managers",
    ownerEmployeeCode: "EMP-1001",
    departmentCode: "DEP-RRHH",
    quarter: "2026-Q2",
    targetValue: 90,
    status: "active",
  });
}

function addCatalogsSheet(workbook) {
  const sheet = workbook.addWorksheet("Catálogos");
  applySheetStyle(sheet, [
    { header: "catalog", key: "catalog", width: 22 },
    { header: "value", key: "value", width: 24 },
    { header: "description", key: "description", width: 52 },
  ]);

  const rows = [
    ...BULK_IMPORT_CATALOGS.roleKey.map((value) => ({
      catalog: "roleKey",
      value,
      description: "Rol funcional valido para clientes.",
    })),
    ...BULK_IMPORT_CATALOGS.scope.map((value) => ({
      catalog: "scope",
      value,
      description: "Nivel de alcance solicitado para el usuario.",
    })),
    ...BULK_IMPORT_CATALOGS.relationshipType.map((value) => ({
      catalog: "relationship_type",
      value,
      description: "Tipo de relacion manager-colaborador.",
    })),
    ...BULK_IMPORT_CATALOGS.status.map((value) => ({
      catalog: "status",
      value,
      description: "Estado general del registro.",
    })),
    ...BULK_IMPORT_CATALOGS.yesNo.map((value) => ({
      catalog: "yes/no",
      value,
      description: "Valor booleano esperado en la plantilla.",
    })),
  ];

  rows.forEach((row) => sheet.addRow(row));
}

export async function buildBulkImportTemplateBuffer() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Performia";
  workbook.lastModifiedBy = "Performia";
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.subject = "Plantilla oficial de importacion masiva";
  workbook.title = BULK_IMPORT_TEMPLATE_FILENAME;
  workbook.company = "Performia";

  addInstructionSheet(workbook);
  addOrganizationSheet(workbook);
  addDepartmentsSheet(workbook);
  addEmployeesSheet(workbook);
  addUsersRolesSheet(workbook);
  addManagersSheet(workbook);
  addKpisSheet(workbook);
  addOkrsSheet(workbook);
  addCatalogsSheet(workbook);

  return workbook.xlsx.writeBuffer();
}
