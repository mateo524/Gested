import ExcelJS from "exceljs";

export const BULK_IMPORT_TEMPLATE_FILENAME = "Plantilla_ZENTOR_Importacion.xlsx";

export const BULK_IMPORT_CATALOGS = {
  roleKey: ["ORG_OWNER","ORG_ADMIN","HR","MANAGER","EMPLOYEE","VIEWER","AUDITOR"],
  scope: ["ORGANIZATION","REGION_COUNTRY","BUSINESS_UNIT","DEPARTMENT","TEAM","SELF"],
  relationshipType: ["direct","dotted_line","temporary"],
  status: ["active","inactive"],
  yesNo: ["yes","no"],
  tipoContrato: ["full_time","part_time","contractor","intern"],
  evaluacionStatus: ["pending","in_progress","completed","cancelled"],
  medicionTipo: ["COMPETENCIA","KPI","OBJETIVO","PERSONALIZADO"],
  habilidadTipo: ["TRANSVERSAL","TECNICA","LIDERAZGO","PERSONALIZADA"],
  habilidadNivel: ["BASICO","INTERMEDIO","AVANZADO"],
};

const DATA_ROWS = 300; // rows with dropdowns/formulas

function headerStyle(worksheet) {
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4B99" } };
  headerRow.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
}

function applySheetStyle(worksheet, columns) {
  worksheet.columns = columns.map((c) => ({
    header: c.header,
    key:    c.key,
    width:  c.width || 22,
  }));
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  headerStyle(worksheet);
  worksheet.eachRow((row, rowNumber) => {
    row.alignment = { vertical: "top", wrapText: true };
    if (rowNumber > 1 && rowNumber % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF7F9FC" } };
      });
    }
  });
}

/** Apply dropdown (static list) to a whole column, rows fromRow–toRow. */
function listDropdown(sheet, col, fromRow, toRow, values) {
  const formulae = [`"${values.join(",")}"`];
  for (let r = fromRow; r <= toRow; r++) {
    sheet.getCell(r, col).dataValidation = {
      type: "list",
      allowBlank: true,
      showDropDown: false,
      formulae,
    };
  }
}

/** Apply dropdown sourced from another sheet range. */
function rangeDropdown(sheet, col, fromRow, toRow, sheetRef) {
  // Sheet names with accents need single quotes in formula references
  const safe = sheetRef.includes("á") || sheetRef.includes("é") || sheetRef.includes("ó") || sheetRef.includes("ú") || sheetRef.includes("ñ")
    ? `'${sheetRef}'` : sheetRef;
  for (let r = fromRow; r <= toRow; r++) {
    sheet.getCell(r, col).dataValidation = {
      type: "list",
      allowBlank: true,
      showDropDown: false,
      formulae: [`${safe}`],
    };
  }
}

/** Pre-fill INDEX/MATCH formula in a column so it auto-populates from another sheet. */
function autoFill(sheet, col, fromRow, toRow, formulaFn) {
  for (let r = fromRow; r <= toRow; r++) {
    sheet.getCell(r, col).value = { formula: formulaFn(r), result: "" };
    // Gray italic so users know it auto-fills
    sheet.getCell(r, col).font = { color: { argb: "FF8899AA" }, italic: true };
  }
}

// ─── Sheets ──────────────────────────────────────────────────────────────────

function addInstructionSheet(workbook) {
  const sheet = workbook.addWorksheet("Instrucciones");
  sheet.columns = [
    { header: "Sección", key: "section", width: 30 },
    { header: "Detalle", key: "detail",  width: 120 },
  ];
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  headerStyle(sheet);

  [
    { section: "Objetivo",        detail: "Completá esta plantilla oficial para preparar la importación masiva de ZENTOR. Usá una fila por registro y respetá los encabezados." },
    { section: "Orden recomendado", detail: "1) Organización → 2) Departamentos → 3) Empleados → 4) Usuarios_y_Roles → 5) Managers → 6) Habilidades. Empezá por Empleados para que los desplegables de las otras solapas se carguen automáticamente." },
    { section: "Desplegables",    detail: "Las columnas con valores fijos (estado, rol, tipo, etc.) muestran un menú desplegable. Las columnas de email y legajo en otras solapas muestran los valores que ingresaste en la solapa Empleados." },
    { section: "Autocompletado",  detail: "En la solapa Usuarios_y_Roles, al seleccionar el legajo, el email_laboral se completa solo. Completá primero toda la solapa Empleados." },
    { section: "Seguridad",       detail: "No cargues credenciales ni datos sensibles en archivos de prueba. SUPER_ADMIN y PLATFORM no se configuran desde esta plantilla." },
    { section: "Managers",        detail: "tipo_relacion: direct = jefe directo, dotted_line = jefe funcional, temporary = temporal. jefe_principal: yes/no." },
    { section: "Habilidades",     detail: "Define el catálogo de competencias de la empresa. tipo: TRANSVERSAL, TECNICA, LIDERAZGO, PERSONALIZADA. nivel: BASICO, INTERMEDIO, AVANZADO." },
  ].forEach((row) => sheet.addRow(row));
  sheet.eachRow((row) => { row.alignment = { vertical: "top", wrapText: true }; });
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
  // col 6 = estado
  listDropdown(sheet, 6, 2, DATA_ROWS, BULK_IMPORT_CATALOGS.status);
}

function addDepartmentsSheet(workbook) {
  const sheet = workbook.addWorksheet("Departamentos");
  applySheetStyle(sheet, [
    { header: "codigo_departamento", key: "departmentCode",       width: 22 },
    { header: "nombre_departamento", key: "departmentName",       width: 28 },
    { header: "departamento_padre",  key: "parentDepartmentCode", width: 24 },
    { header: "unidad_negocio",      key: "businessUnit",         width: 22 },
    { header: "region",              key: "regionCountry",        width: 20 },
    { header: "estado",              key: "status",               width: 14 },
    { header: "es_area_personas",    key: "isPeopleArea",         width: 18 },
  ]);
  // col 3 = departamento_padre → dropdown de códigos en la misma solapa
  rangeDropdown(sheet, 3, 2, DATA_ROWS, "Departamentos!$A$2:$A$300");
  // col 6 = estado
  listDropdown(sheet, 6, 2, DATA_ROWS, BULK_IMPORT_CATALOGS.status);
  // col 7 = es_area_personas
  listDropdown(sheet, 7, 2, DATA_ROWS, BULK_IMPORT_CATALOGS.yesNo);
}

function addEmployeesSheet(workbook) {
  const sheet = workbook.addWorksheet("Empleados");
  applySheetStyle(sheet, [
    { header: "legajo",         key: "employeeCode",     width: 20 },
    { header: "nombre",         key: "firstName",        width: 20 },
    { header: "apellido",       key: "lastName",         width: 20 },
    { header: "email_laboral",  key: "workEmail",        width: 30 },
    { header: "puesto",         key: "jobTitle",         width: 24 },
    { header: "departamento",   key: "departmentCode",   width: 20 },
    { header: "unidad_negocio", key: "businessUnit",     width: 22 },
    { header: "region",         key: "regionCountry",    width: 20 },
    { header: "fecha_ingreso",  key: "hireDate",         width: 16 },
    { header: "tipo_contrato",  key: "employmentStatus", width: 18 },
    { header: "activo",         key: "active",           width: 12 },
  ]);
  // col 6 = departamento → dropdown de códigos de Departamentos
  rangeDropdown(sheet, 6, 2, DATA_ROWS, "Departamentos!$A$2:$A$300");
  // col 10 = tipo_contrato
  listDropdown(sheet, 10, 2, DATA_ROWS, BULK_IMPORT_CATALOGS.tipoContrato);
  // col 11 = activo
  listDropdown(sheet, 11, 2, DATA_ROWS, BULK_IMPORT_CATALOGS.yesNo);
}

function addUsersRolesSheet(workbook) {
  const sheet = workbook.addWorksheet("Usuarios_y_Roles");
  applySheetStyle(sheet, [
    { header: "legajo",               key: "employeeCode",       width: 20 },
    { header: "email_laboral",        key: "workEmail",          width: 30 },
    { header: "rol",                  key: "roleKey",            width: 18 },
    { header: "alcance",              key: "scope",              width: 22 },
    { header: "referencia_alcance",   key: "scopeReferenceCode", width: 24 },
    { header: "estado",               key: "status",             width: 14 },
    { header: "puede_iniciar_sesion", key: "canLogin",           width: 22 },
    { header: "notas",                key: "notes",              width: 34 },
  ]);
  // col 1 = legajo → dropdown desde Empleados
  rangeDropdown(sheet, 1, 2, DATA_ROWS, "Empleados!$A$2:$A$300");
  // col 2 = email_laboral → AUTOCOMPLETADO desde legajo
  autoFill(sheet, 2, 2, DATA_ROWS,
    (r) => `IFERROR(INDEX(Empleados!$D:$D,MATCH(A${r},Empleados!$A:$A,0)),"")`
  );
  // col 3 = rol
  listDropdown(sheet, 3, 2, DATA_ROWS, BULK_IMPORT_CATALOGS.roleKey);
  // col 4 = alcance
  listDropdown(sheet, 4, 2, DATA_ROWS, BULK_IMPORT_CATALOGS.scope);
  // col 6 = estado
  listDropdown(sheet, 6, 2, DATA_ROWS, BULK_IMPORT_CATALOGS.status);
  // col 7 = puede_iniciar_sesion
  listDropdown(sheet, 7, 2, DATA_ROWS, BULK_IMPORT_CATALOGS.yesNo);
}

function addManagersSheet(workbook) {
  const sheet = workbook.addWorksheet("Managers");
  applySheetStyle(sheet, [
    { header: "legajo",         key: "employeeCode",        width: 20 },
    { header: "email_jefe",     key: "managerEmployeeCode", width: 30 },
    { header: "tipo_relacion",  key: "relationshipType",    width: 20 },
    { header: "jefe_principal", key: "primaryManager",      width: 18 },
    { header: "fecha_inicio",   key: "startDate",           width: 16 },
    { header: "fecha_fin",      key: "endDate",             width: 16 },
    { header: "estado",         key: "status",              width: 14 },
  ]);
  // col 1 = legajo del colaborador → dropdown Empleados
  rangeDropdown(sheet, 1, 2, DATA_ROWS, "Empleados!$A$2:$A$300");
  // col 2 = email del jefe → dropdown de emails de Empleados
  rangeDropdown(sheet, 2, 2, DATA_ROWS, "Empleados!$D$2:$D$300");
  // col 3 = tipo_relacion
  listDropdown(sheet, 3, 2, DATA_ROWS, BULK_IMPORT_CATALOGS.relationshipType);
  // col 4 = jefe_principal
  listDropdown(sheet, 4, 2, DATA_ROWS, BULK_IMPORT_CATALOGS.yesNo);
  // col 7 = estado
  listDropdown(sheet, 7, 2, DATA_ROWS, BULK_IMPORT_CATALOGS.status);
}

function addEvaluationsSheet(workbook) {
  const sheet = workbook.addWorksheet("Evaluaciones");
  applySheetStyle(sheet, [
    { header: "email_empleado",       key: "employeeEmail",    width: 30 },
    { header: "email_jefe",           key: "managerEmail",     width: 30 },
    { header: "nombre_ciclo",         key: "cycleName",        width: 26 },
    { header: "periodo",              key: "period",           width: 18 },
    { header: "estado",               key: "status",           width: 14 },
    { header: "puntaje_general",      key: "overallScore",     width: 18 },
    { header: "comentarios_jefe",     key: "managerComments",  width: 38 },
    { header: "comentarios_empleado", key: "employeeComments", width: 38 },
  ]);
  rangeDropdown(sheet, 1, 2, DATA_ROWS, "Empleados!$D$2:$D$300");
  rangeDropdown(sheet, 2, 2, DATA_ROWS, "Empleados!$D$2:$D$300");
  listDropdown(sheet, 5, 2, DATA_ROWS, BULK_IMPORT_CATALOGS.evaluacionStatus);
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
  rangeDropdown(sheet, 1, 2, DATA_ROWS, "Empleados!$D$2:$D$300");
  listDropdown(sheet, 2, 2, DATA_ROWS, BULK_IMPORT_CATALOGS.medicionTipo);
}

function addDevelopmentPlansSheet(workbook) {
  const sheet = workbook.addWorksheet("Planes_Desarrollo");
  applySheetStyle(sheet, [
    { header: "email_empleado",    key: "employeeEmail",    width: 30 },
    { header: "titulo",            key: "title",            width: 30 },
    { header: "descripcion",       key: "description",      width: 38 },
    { header: "email_responsable", key: "responsibleEmail", width: 30 },
    { header: "fecha_limite",      key: "dueDate",          width: 16 },
    { header: "estado",            key: "status",           width: 14 },
    { header: "notas_seguimiento", key: "followUpNotes",    width: 38 },
  ]);
  rangeDropdown(sheet, 1, 2, DATA_ROWS, "Empleados!$D$2:$D$300");
  rangeDropdown(sheet, 4, 2, DATA_ROWS, "Empleados!$D$2:$D$300");
  listDropdown(sheet, 6, 2, DATA_ROWS, BULK_IMPORT_CATALOGS.evaluacionStatus);
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
  listDropdown(sheet, 3, 2, DATA_ROWS, BULK_IMPORT_CATALOGS.habilidadTipo);
  listDropdown(sheet, 4, 2, DATA_ROWS, BULK_IMPORT_CATALOGS.habilidadNivel);
  listDropdown(sheet, 5, 2, DATA_ROWS, BULK_IMPORT_CATALOGS.yesNo);

  // Sample rows to guide the user
  [
    { nombre: "Trabajo en equipo",    descripcion: "Capacidad para colaborar efectivamente con otros.",         tipo: "TRANSVERSAL", nivel: "BASICO",     activa: "yes" },
    { nombre: "Liderazgo de equipos", descripcion: "Habilidad para guiar, motivar y desarrollar al equipo.",   tipo: "LIDERAZGO",   nivel: "AVANZADO",   activa: "yes" },
    { nombre: "Análisis de datos",    descripcion: "Capacidad para interpretar datos y extraer conclusiones.",  tipo: "TECNICA",     nivel: "INTERMEDIO", activa: "yes" },
  ].forEach((row) => sheet.addRow(row));
}

function addCatalogsSheet(workbook) {
  const sheet = workbook.addWorksheet("Catálogos");
  applySheetStyle(sheet, [
    { header: "catalogo",    key: "catalog",     width: 26 },
    { header: "valor",       key: "value",       width: 24 },
    { header: "descripcion", key: "description", width: 52 },
  ]);

  const rows = [
    ...BULK_IMPORT_CATALOGS.roleKey.map((v) => ({ catalog: "rol", value: v, description: "Rol funcional válido para usuarios." })),
    ...BULK_IMPORT_CATALOGS.scope.map((v) => ({ catalog: "alcance", value: v, description: "Nivel de alcance del usuario." })),
    ...BULK_IMPORT_CATALOGS.relationshipType.map((v) => ({ catalog: "tipo_relacion", value: v, description: "Tipo de relación manager-colaborador." })),
    ...BULK_IMPORT_CATALOGS.status.map((v) => ({ catalog: "estado", value: v, description: "Estado general del registro." })),
    ...BULK_IMPORT_CATALOGS.tipoContrato.map((v) => ({ catalog: "tipo_contrato", value: v, description: "Modalidad de contratación del empleado." })),
    ...BULK_IMPORT_CATALOGS.evaluacionStatus.map((v) => ({ catalog: "estado_evaluacion", value: v, description: "Estado de evaluación o plan." })),
    ...BULK_IMPORT_CATALOGS.medicionTipo.map((v) => ({ catalog: "tipo_medicion", value: v, description: "Tipo de medición de desempeño." })),
    ...BULK_IMPORT_CATALOGS.yesNo.map((v) => ({ catalog: "si/no", value: v, description: "Valor esperado en columnas activo/puede_iniciar_sesion." })),
    ...BULK_IMPORT_CATALOGS.habilidadTipo.map((v) => ({ catalog: "tipo_habilidad", value: v, description: "Tipo de habilidad o competencia." })),
    ...BULK_IMPORT_CATALOGS.habilidadNivel.map((v) => ({ catalog: "nivel_habilidad", value: v, description: "Nivel de profundidad de la habilidad." })),
  ];
  rows.forEach((row) => sheet.addRow(row));
}

// ─── Build ────────────────────────────────────────────────────────────────────

export async function buildBulkImportTemplateBuffer() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator       = "ZENTOR";
  workbook.lastModifiedBy = "ZENTOR";
  workbook.created       = new Date();
  workbook.modified      = new Date();
  workbook.subject       = "Plantilla oficial de importación masiva";
  workbook.title         = BULK_IMPORT_TEMPLATE_FILENAME;
  workbook.company       = "ZENTOR";

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
