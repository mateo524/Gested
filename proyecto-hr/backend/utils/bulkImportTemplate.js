import ExcelJS from "exceljs";

export const BULK_IMPORT_TEMPLATE_FILENAME = "Plantilla_ZENTOR_Importacion.xlsx";

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
  habilidadTipo: ["TRANSVERSAL", "TECNICA", "LIDERAZGO", "PERSONALIZADA"],
  habilidadNivel: ["BASICO", "INTERMEDIO", "AVANZADO"],
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
    { header: "Sección", key: "section", width: 30 },
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
        "Completá esta plantilla oficial para preparar la importación masiva de ZENTOR. Usá una fila por registro y respetá los encabezados.",
    },
    {
      section: "Seguridad",
      detail:
        "No cargues credenciales, claves ni datos reales sensibles en archivos de prueba. SUPER_ADMIN y PLATFORM no se crean ni se configuran desde esta plantilla.",
    },
    {
      section: "Alcance real",
      detail:
        "La organización y el alcance real siempre los determina el sistema según el usuario autenticado. Los datos del Excel son orientativos y no reemplazan el scope del sistema.",
    },
    {
      section: "Orden recomendado",
      detail:
        "1) Organización, 2) Departamentos, 3) Empleados, 4) Usuarios_y_Roles, 5) Managers, 6) Habilidades. La hoja Catálogos sirve como referencia de valores válidos.",
    },
    {
      section: "Formato",
      detail:
        "Mantené los encabezados sin cambiar, evitá celdas fusionadas y completá estado, alcance y rol usando exactamente los valores del catálogo.",
    },
    {
      section: "Managers",
      detail:
        "La relación entre manager y colaborador se define por email del colaborador y email del jefe. tipo_relacion admite: direct, dotted_line o temporary.",
    },
    {
      section: "Usuarios",
      detail:
        "La hoja Usuarios_y_Roles no crea credenciales. Solo declara el vínculo entre persona, email laboral, rol funcional y alcance deseado para validación posterior.",
    },
    {
      section: "Habilidades",
      detail:
        "La hoja Habilidades define el catálogo de competencias de la empresa. tipo admite: TRANSVERSAL, TECNICA, LIDERAZGO, PERSONALIZADA. nivel admite: BASICO, INTERMEDIO, AVANZADO.",
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
    { header: "nombre_organizacion", key: "organizationName", width: 32 },
    { header: "razon_social",        key: "legalName",        width: 32 },
    { header: "pais",                key: "country",          width: 18 },
    { header: "region",              key: "regionCountry",    width: 20 },
    { header: "unidad_negocio",      key: "businessUnit",     width: 22 },
    { header: "estado",              key: "status",           width: 14 },
    { header: "notas",               key: "notes",            width: 34 },
  ]);
}

function addDepartmentsSheet(workbook) {
  const sheet = workbook.addWorksheet("Departamentos");
  applySheetStyle(sheet, [
    { header: "codigo_departamento",  key: "departmentCode",       width: 22 },
    { header: "nombre_departamento",  key: "departmentName",       width: 28 },
    { header: "departamento_padre",   key: "parentDepartmentCode", width: 24 },
    { header: "unidad_negocio",       key: "businessUnit",         width: 22 },
    { header: "region",               key: "regionCountry",        width: 20 },
    { header: "estado",               key: "status",               width: 14 },
    { header: "es_area_personas",     key: "isPeopleArea",         width: 18 },
  ]);
}

function addEmployeesSheet(workbook) {
  const sheet = workbook.addWorksheet("Empleados");
  applySheetStyle(sheet, [
    { header: "legajo",          key: "employeeCode",    width: 20 },
    { header: "nombre",          key: "firstName",       width: 20 },
    { header: "apellido",        key: "lastName",        width: 20 },
    { header: "email_laboral",   key: "workEmail",       width: 30 },
    { header: "puesto",          key: "jobTitle",        width: 24 },
    { header: "departamento",    key: "departmentCode",  width: 20 },
    { header: "unidad_negocio",  key: "businessUnit",    width: 22 },
    { header: "region",          key: "regionCountry",   width: 20 },
    { header: "fecha_ingreso",   key: "hireDate",        width: 16 },
    { header: "tipo_contrato",   key: "employmentStatus",width: 18 },
    { header: "activo",          key: "active",          width: 12 },
  ]);
}

function addUsersRolesSheet(workbook) {
  const sheet = workbook.addWorksheet("Usuarios_y_Roles");
  applySheetStyle(sheet, [
    { header: "legajo",               key: "employeeCode",      width: 20 },
    { header: "email_laboral",        key: "workEmail",         width: 30 },
    { header: "rol",                  key: "roleKey",           width: 18 },
    { header: "alcance",              key: "scope",             width: 22 },
    { header: "referencia_alcance",   key: "scopeReferenceCode",width: 24 },
    { header: "estado",               key: "status",            width: 14 },
    { header: "puede_iniciar_sesion", key: "canLogin",          width: 22 },
    { header: "notas",                key: "notes",             width: 34 },
  ]);
}

function addManagersSheet(workbook) {
  const sheet = workbook.addWorksheet("Managers");
  applySheetStyle(sheet, [
    { header: "legajo",          key: "employeeCode",         width: 20 },
    { header: "email_jefe",      key: "managerEmployeeCode",  width: 30 },
    { header: "tipo_relacion",   key: "relationshipType",     width: 20 },
    { header: "jefe_principal",  key: "primaryManager",       width: 18 },
    { header: "fecha_inicio",    key: "startDate",            width: 16 },
    { header: "fecha_fin",       key: "endDate",              width: 16 },
    { header: "estado",          key: "status",               width: 14 },
  ]);
}

function addEvaluationsSheet(workbook) {
  const sheet = workbook.addWorksheet("Evaluaciones");
  applySheetStyle(sheet, [
    { header: "email_empleado",       key: "employeeEmail",   width: 30 },
    { header: "email_jefe",           key: "managerEmail",    width: 30 },
    { header: "nombre_ciclo",         key: "cycleName",       width: 26 },
    { header: "periodo",              key: "period",          width: 18 },
    { header: "estado",               key: "status",          width: 14 },
    { header: "puntaje_general",      key: "overallScore",    width: 18 },
    { header: "comentarios_jefe",     key: "managerComments", width: 38 },
    { header: "comentarios_empleado", key: "employeeComments",width: 38 },
  ]);
}

function addPerformanceMeasurementsSheet(workbook) {
  const sheet = workbook.addWorksheet("Mediciones_Desempeno");
  applySheetStyle(sheet, [
    { header: "email_empleado",  key: "employeeEmail",   width: 30 },
    { header: "tipo_medicion",   key: "measurementType", width: 22 },
    { header: "nombre_medicion", key: "measurementName", width: 34 },
    { header: "descripcion",     key: "description",     width: 38 },
    { header: "descriptores",    key: "descriptors",     width: 40 },
    { header: "puntaje_jefe",    key: "managerScore",    width: 18 },
    { header: "autoevaluacion",  key: "selfScore",       width: 16 },
    { header: "evidencia",       key: "evidence",        width: 34 },
    { header: "comentarios",     key: "comments",        width: 34 },
    { header: "peso",            key: "weight",          width: 12 },
  ]);
}

function addDevelopmentPlansSheet(workbook) {
  const sheet = workbook.addWorksheet("Planes_Desarrollo");
  applySheetStyle(sheet, [
    { header: "email_empleado",    key: "employeeEmail",   width: 30 },
    { header: "titulo",            key: "title",           width: 30 },
    { header: "descripcion",       key: "description",     width: 38 },
    { header: "email_responsable", key: "responsibleEmail",width: 30 },
    { header: "fecha_limite",      key: "dueDate",         width: 16 },
    { header: "estado",            key: "status",          width: 14 },
    { header: "notas_seguimiento", key: "followUpNotes",   width: 38 },
  ]);
}

function addHabilidadesSheet(workbook) {
  const sheet = workbook.addWorksheet("Habilidades");
  applySheetStyle(sheet, [
    { header: "nombre_habilidad", key: "nombre",      width: 34 },
    { header: "descripcion",      key: "descripcion", width: 44 },
    { header: "tipo",             key: "tipo",        width: 20 },
    { header: "nivel",            key: "nivel",       width: 18 },
    { header: "activa",           key: "activa",      width: 12 },
  ]);

  // Sample rows
  const samples = [
    { nombre: "Trabajo en equipo",      descripcion: "Capacidad para colaborar efectivamente con otros.",              tipo: "TRANSVERSAL",  nivel: "BASICO",     activa: "yes" },
    { nombre: "Liderazgo de equipos",   descripcion: "Habilidad para guiar, motivar y desarrollar a su equipo.",      tipo: "LIDERAZGO",    nivel: "AVANZADO",   activa: "yes" },
    { nombre: "Análisis de datos",      descripcion: "Capacidad para interpretar datos y extraer conclusiones.",       tipo: "TECNICA",      nivel: "INTERMEDIO", activa: "yes" },
  ];
  samples.forEach((row) => sheet.addRow(row));
}

function addCatalogsSheet(workbook) {
  const sheet = workbook.addWorksheet("Catálogos");
  applySheetStyle(sheet, [
    { header: "catalogo",     key: "catalog",     width: 26 },
    { header: "valor",        key: "value",       width: 24 },
    { header: "descripcion",  key: "description", width: 52 },
  ]);

  const rows = [
    ...BULK_IMPORT_CATALOGS.roleKey.map((value) => ({
      catalog: "rol",
      value,
      description: "Rol funcional válido para usuarios.",
    })),
    ...BULK_IMPORT_CATALOGS.scope.map((value) => ({
      catalog: "alcance",
      value,
      description: "Nivel de alcance solicitado para el usuario.",
    })),
    ...BULK_IMPORT_CATALOGS.relationshipType.map((value) => ({
      catalog: "tipo_relacion",
      value,
      description: "Tipo de relación manager-colaborador.",
    })),
    ...BULK_IMPORT_CATALOGS.status.map((value) => ({
      catalog: "estado",
      value,
      description: "Estado general del registro.",
    })),
    ...BULK_IMPORT_CATALOGS.yesNo.map((value) => ({
      catalog: "si/no",
      value,
      description: "Valor esperado en columnas activo/puede_iniciar_sesion.",
    })),
    ...BULK_IMPORT_CATALOGS.habilidadTipo.map((value) => ({
      catalog: "tipo_habilidad",
      value,
      description: "Tipo de habilidad o competencia.",
    })),
    ...BULK_IMPORT_CATALOGS.habilidadNivel.map((value) => ({
      catalog: "nivel_habilidad",
      value,
      description: "Nivel de profundidad de la habilidad.",
    })),
  ];

  rows.forEach((row) => sheet.addRow(row));
}

export async function buildBulkImportTemplateBuffer() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ZENTOR";
  workbook.lastModifiedBy = "ZENTOR";
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.subject = "Plantilla oficial de importación masiva";
  workbook.title = BULK_IMPORT_TEMPLATE_FILENAME;
  workbook.company = "ZENTOR";

  addInstructionSheet(workbook);
  addOrganizationSheet(workbook);
  addDepartmentsSheet(workbook);
  addEmployeesSheet(workbook);
  addUsersRolesSheet(workbook);
  addManagersSheet(workbook);
  addEvaluationsSheet(workbook);
  addPerformanceMeasurementsSheet(workbook);
  addDevelopmentPlansSheet(workbook);
  addHabilidadesSheet(workbook);
  addCatalogsSheet(workbook);

  return workbook.xlsx.writeBuffer();
}
