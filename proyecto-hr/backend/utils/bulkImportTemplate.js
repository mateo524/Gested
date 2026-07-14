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

const DATA_ROWS = 300;

// Named ranges used for cross-sheet data validation (Excel requires named ranges for this)
const NR = {
  EMP_LEGAJOS: "ZT_EmpLegajos",
  EMP_EMAILS:  "ZT_EmpEmails",
  DEP_CODIGOS: "ZT_DepCodigos",
};

/** Convert 1-based column number to Excel letter(s): 1→A, 27→AA */
function colLetter(n) {
  let s = "";
  while (n > 0) {
    n--;
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26);
  }
  return s;
}

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

/**
 * Add a static-list dropdown to an entire column.
 * Uses sheet.dataValidations.add (range-level) which generates valid XLSX.
 */
function listDropdown(sheet, col, fromRow, toRow, values) {
  const cl = colLetter(col);
  sheet.dataValidations.add(`${cl}${fromRow}:${cl}${toRow}`, {
    type: "list",
    allowBlank: true,
    showDropDown: false,
    formulae: [`"${values.join(",")}"`],
  });
}

/**
 * Add a dropdown sourced from a named range (required for cross-sheet refs in XLSX).
 * namedRange must be registered in workbook.definedNames before the file is written.
 */
function rangeDropdown(sheet, col, fromRow, toRow, namedRange) {
  const cl = colLetter(col);
  sheet.dataValidations.add(`${cl}${fromRow}:${cl}${toRow}`, {
    type: "list",
    allowBlank: true,
    showDropDown: false,
    formulae: [namedRange],
  });
}

/** Pre-fill INDEX/MATCH formula so the cell auto-populates from another sheet. */
function autoFill(sheet, col, fromRow, toRow, formulaFn) {
  const cl = colLetter(col);
  for (let r = fromRow; r <= toRow; r++) {
    const cell = sheet.getCell(`${cl}${r}`);
    cell.value = { formula: formulaFn(r), result: "" };
    cell.font = { color: { argb: "FF8899AA" }, italic: true };
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
    { section: "Objetivo",         detail: "Completá esta plantilla oficial para preparar la importación masiva de ZENTOR. Usá una fila por registro y respetá los encabezados." },
    { section: "Orden recomendado",detail: "1) Organización → 2) Departamentos → 3) Empleados → 4) Usuarios_y_Roles → 5) Managers → 6) Habilidades. Empezá por Empleados para que los desplegables de las otras solapas funcionen." },
    { section: "Desplegables",     detail: "Las columnas con valores fijos (estado, rol, tipo, etc.) muestran un menú desplegable. Las columnas de email y legajo en otras solapas muestran los valores que ingresaste en Empleados." },
    { section: "Autocompletado",   detail: "En Usuarios_y_Roles, al seleccionar el legajo en la columna A, el email_laboral (columna B) se completa solo. Completá primero toda la solapa Empleados." },
    { section: "Seguridad",        detail: "No cargues credenciales ni datos sensibles en archivos de prueba. SUPER_ADMIN y PLATFORM no se configuran desde esta plantilla." },
    { section: "Managers",         detail: "tipo_relacion: direct = jefe directo, dotted_line = jefe funcional, temporary = temporal. jefe_principal: yes/no." },
    { section: "Jefe directo (Empleados)", detail: "En la columna jefe_directo de Empleados escribí el nombre y apellido exactos del jefe (tal cual figuran en sus propias columnas nombre/apellido). El sistema busca ese email automáticamente al confirmar la importación." },
    { section: "Habilidades",      detail: "Define el catálogo de competencias de la empresa. tipo: TRANSVERSAL, TECNICA, LIDERAZGO, PERSONALIZADA. nivel: BASICO, INTERMEDIO, AVANZADO." },
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
  rangeDropdown(sheet, 3, 2, DATA_ROWS, NR.DEP_CODIGOS);
  listDropdown(sheet, 6, 2, DATA_ROWS, BULK_IMPORT_CATALOGS.status);
  listDropdown(sheet, 7, 2, DATA_ROWS, BULK_IMPORT_CATALOGS.yesNo);
}

function addEmployeesSheet(workbook) {
  const sheet = workbook.addWorksheet("Empleados");
  applySheetStyle(sheet, [
    { header: "legajo",            key: "employeeCode",   width: 20 },
    { header: "nombre",            key: "firstName",      width: 20 },
    { header: "apellido",          key: "lastName",       width: 20 },
    { header: "email_laboral",     key: "workEmail",      width: 30 },
    { header: "departamento",      key: "departmentCode", width: 20 },
    { header: "puesto",            key: "jobTitle",       width: 24 },
    { header: "jefe_directo",      key: "managerName",    width: 26 },
    { header: "fecha_ingreso",     key: "hireDate",       width: 16 },
    { header: "fecha_nacimiento",  key: "birthDate",      width: 18 },
  ]);
  rangeDropdown(sheet, 5, 2, DATA_ROWS, NR.DEP_CODIGOS);
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
  rangeDropdown(sheet, 1, 2, DATA_ROWS, NR.EMP_LEGAJOS);
  autoFill(sheet, 2, 2, DATA_ROWS,
    (r) => `IFERROR(INDEX(Empleados!$D:$D,MATCH(A${r},Empleados!$A:$A,0),1),"")`
  );
  listDropdown(sheet, 3, 2, DATA_ROWS, BULK_IMPORT_CATALOGS.roleKey);
  listDropdown(sheet, 4, 2, DATA_ROWS, BULK_IMPORT_CATALOGS.scope);
  listDropdown(sheet, 6, 2, DATA_ROWS, BULK_IMPORT_CATALOGS.status);
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
  rangeDropdown(sheet, 1, 2, DATA_ROWS, NR.EMP_LEGAJOS);
  rangeDropdown(sheet, 2, 2, DATA_ROWS, NR.EMP_EMAILS);
  listDropdown(sheet, 3, 2, DATA_ROWS, BULK_IMPORT_CATALOGS.relationshipType);
  listDropdown(sheet, 4, 2, DATA_ROWS, BULK_IMPORT_CATALOGS.yesNo);
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
  rangeDropdown(sheet, 1, 2, DATA_ROWS, NR.EMP_EMAILS);
  rangeDropdown(sheet, 2, 2, DATA_ROWS, NR.EMP_EMAILS);
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
  rangeDropdown(sheet, 1, 2, DATA_ROWS, NR.EMP_EMAILS);
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
  rangeDropdown(sheet, 1, 2, DATA_ROWS, NR.EMP_EMAILS);
  rangeDropdown(sheet, 4, 2, DATA_ROWS, NR.EMP_EMAILS);
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

  [
    { nombre: "Trabajo en equipo",    descripcion: "Capacidad para colaborar efectivamente con otros.",        tipo: "TRANSVERSAL", nivel: "BASICO",     activa: "yes" },
    { nombre: "Liderazgo de equipos", descripcion: "Habilidad para guiar, motivar y desarrollar al equipo.",  tipo: "LIDERAZGO",   nivel: "AVANZADO",   activa: "yes" },
    { nombre: "Análisis de datos",    descripcion: "Capacidad para interpretar datos y extraer conclusiones.", tipo: "TECNICA",     nivel: "INTERMEDIO", activa: "yes" },
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
    ...BULK_IMPORT_CATALOGS.roleKey.map((v)          => ({ catalog: "rol",               value: v, description: "Rol funcional válido para usuarios." })),
    ...BULK_IMPORT_CATALOGS.scope.map((v)             => ({ catalog: "alcance",           value: v, description: "Nivel de alcance del usuario." })),
    ...BULK_IMPORT_CATALOGS.relationshipType.map((v)  => ({ catalog: "tipo_relacion",     value: v, description: "Tipo de relación manager-colaborador." })),
    ...BULK_IMPORT_CATALOGS.status.map((v)            => ({ catalog: "estado",            value: v, description: "Estado general del registro." })),
    ...BULK_IMPORT_CATALOGS.tipoContrato.map((v)      => ({ catalog: "tipo_contrato",     value: v, description: "Modalidad de contratación del empleado." })),
    ...BULK_IMPORT_CATALOGS.evaluacionStatus.map((v)  => ({ catalog: "estado_evaluacion", value: v, description: "Estado de evaluación o plan." })),
    ...BULK_IMPORT_CATALOGS.medicionTipo.map((v)      => ({ catalog: "tipo_medicion",     value: v, description: "Tipo de medición de desempeño." })),
    ...BULK_IMPORT_CATALOGS.yesNo.map((v)             => ({ catalog: "si/no",             value: v, description: "Valor esperado en columnas activo/puede_iniciar_sesion." })),
    ...BULK_IMPORT_CATALOGS.habilidadTipo.map((v)     => ({ catalog: "tipo_habilidad",    value: v, description: "Tipo de habilidad o competencia." })),
    ...BULK_IMPORT_CATALOGS.habilidadNivel.map((v)    => ({ catalog: "nivel_habilidad",   value: v, description: "Nivel de profundidad de la habilidad." })),
  ];
  rows.forEach((row) => sheet.addRow(row));
}

// ─── Build ────────────────────────────────────────────────────────────────────

export async function buildBulkImportTemplateBuffer() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator        = "ZENTOR";
  workbook.lastModifiedBy = "ZENTOR";
  workbook.created        = new Date();
  workbook.modified       = new Date();
  workbook.subject        = "Plantilla oficial de importación masiva";
  workbook.title          = BULK_IMPORT_TEMPLATE_FILENAME;
  workbook.company        = "ZENTOR";

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

  // Named ranges are required for cross-sheet data validation in XLSX format.
  // Excel resolves these names when the user opens the file.
  workbook.definedNames.add("Empleados!$A$2:$A$300",    NR.EMP_LEGAJOS);
  workbook.definedNames.add("Empleados!$D$2:$D$300",    NR.EMP_EMAILS);
  workbook.definedNames.add("Departamentos!$A$2:$A$300", NR.DEP_CODIGOS);

  return workbook.xlsx.writeBuffer();
}
