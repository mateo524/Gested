import crypto from "crypto";
import ExcelJS from "exceljs";
import bcrypt from "bcryptjs";
import Competency from "../models/Competency.js";
import Employee from "../models/Employee.js";
import Metric from "../models/Metric.js";
import PositionHierarchy from "../models/PositionHierarchy.js";
import Role from "../models/Role.js";
import SimpleImportPreview from "../models/SimpleImportPreview.js";
import User from "../models/User.js";
import { generateTempPassword } from "../utils/password.js";
import { syncPrimaryRoleAssignmentForUser } from "../utils/accessControl.js";

function mkToken() {
  return crypto.randomBytes(20).toString("hex");
}

const TRANSIENT_MONGO_ERROR = /not primary|notwritableprimary|node is recovering|connection.*(closed|timed out)/i;

// Shared/free MongoDB Atlas tiers run brief primary elections during
// automatic maintenance (can take up to ~10-12s to resolve), which surface
// as transient write errors. Retry with backoff long enough to ride one out
// instead of forcing the user to re-upload.
async function withMongoRetry(fn, { retries = 5, delayMs = 1000 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === retries || !TRANSIENT_MONGO_ERROR.test(err?.message || "")) throw err;
      await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
    }
  }
  throw lastError;
}

// Persisted in Mongo (not in-process memory) so the preview survives a
// process restart between "analizar" and "confirmar" — free-tier Render
// instances can restart on redeploy or after a sleep/wake cycle, which
// would otherwise wipe an in-memory cache and show "Preview expirado".
async function storePreview(type, rows) {
  const token = mkToken();
  await withMongoRetry(() =>
    SimpleImportPreview.create({ token, type, rows, expiresAt: new Date(Date.now() + 15 * 60 * 1000) })
  );
  return token;
}

async function loadPreview(token) {
  const entry = await withMongoRetry(() => SimpleImportPreview.findOne({ token }).lean());
  if (!entry || entry.expiresAt.getTime() < Date.now()) return null;
  return entry;
}

async function deletePreview(token) {
  await SimpleImportPreview.deleteOne({ token }).catch(() => {});
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function norm(v) { return String(v ?? "").trim(); }
function normLower(v) { return norm(v).toLowerCase(); }
function toBool(v, fallback = true) {
  const s = normLower(v);
  if (["yes", "si", "true", "1", "active", "activo"].includes(s)) return true;
  if (["no", "false", "0", "inactive", "inactivo"].includes(s)) return false;
  return fallback;
}
function parseDate(v) {
  if (v instanceof Date && !isNaN(v)) return v;
  const s = norm(v);
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

function headerStyle(ws) {
  const row = ws.getRow(1);
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4B99" } };
  row.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
}

function setupSheet(ws, columns) {
  ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width || 22 }));
  ws.views = [{ state: "frozen", ySplit: 1 }];
  headerStyle(ws);
}

function dropdown(sheet, col, from, to, values) {
  const letter = col.toString().length === 1 && col >= 65
    ? String.fromCharCode(col)
    : (() => {
        let n = col, s = "";
        while (n > 0) { n--; s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26); }
        return s;
      })();
  const cl = typeof col === "number"
    ? (() => { let n = col, s = ""; while (n > 0) { n--; s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26); } return s; })()
    : col;
  sheet.dataValidations.add(`${cl}${from}:${cl}${to}`, {
    type: "list", allowBlank: true, showDropDown: false,
    formulae: [`"${values.join(",")}"`],
  });
}

const ROWS = 300;
const TIPO_ACCESO = ["EMPLEADO", "MANDO_MEDIO", "DIRECCION"];
const HABILIDAD_TIPO = ["TRANSVERSAL", "TECNICA", "LIDERAZGO"];

// ─── Template builders ───────────────────────────────────────────────────────

export async function buildPersonasTemplate() {
  const wb = new ExcelJS.Workbook();
  wb.creator = "ZENTOR";
  const ws = wb.addWorksheet("Personas");
  setupSheet(ws, [
    { header: "legajo",           key: "legajo",           width: 18 },
    { header: "nombre",           key: "nombre",           width: 20 },
    { header: "apellido",         key: "apellido",         width: 20 },
    { header: "email_laboral",    key: "email_laboral",    width: 30 },
    { header: "puesto",           key: "puesto",           width: 24 },
    { header: "departamento",     key: "departamento",     width: 22 },
    { header: "rol",              key: "rol",              width: 18 },
    { header: "jefe_directo",     key: "jefe_directo",     width: 26 },
    { header: "fecha_ingreso",    key: "fecha_ingreso",    width: 16 },
    { header: "fecha_nacimiento", key: "fecha_nacimiento", width: 18 },
  ]);
  dropdown(ws, 7, 2, ROWS, TIPO_ACCESO);

  // Ref sheet with catalog values
  const cat = wb.addWorksheet("Referencia");
  setupSheet(cat, [{ header: "campo", key: "campo", width: 20 }, { header: "valores válidos", key: "valores", width: 60 }]);
  cat.addRow({ campo: "rol", valores: TIPO_ACCESO.join("  |  ") });
  cat.addRow({ campo: "jefe_directo", valores: "Nombre y apellido exactos del jefe directo (debe existir como otra fila en esta misma hoja o ya cargado en el sistema)." });

  return wb.xlsx.writeBuffer();
}

export async function buildJerarquiasTemplate() {
  const wb = new ExcelJS.Workbook();
  wb.creator = "ZENTOR";
  const ws = wb.addWorksheet("Jerarquias");
  setupSheet(ws, [
    { header: "puesto",       key: "puesto",       width: 28 },
    { header: "departamento", key: "departamento", width: 28 },
    { header: "tipo_acceso",  key: "tipo_acceso",  width: 20 },
  ]);
  dropdown(ws, 3, 2, ROWS, TIPO_ACCESO);

  const cat = wb.addWorksheet("Referencia");
  setupSheet(cat, [{ header: "tipo_acceso", key: "tipo_acceso", width: 20 }, { header: "descripcion", key: "desc", width: 70 }]);
  cat.addRow({ tipo_acceso: "EMPLEADO",    desc: "Solo puede ver y completar su propia evaluación." });
  cat.addRow({ tipo_acceso: "MANDO_MEDIO", desc: "Accede a todos los empleados de su departamento / a cargo." });
  cat.addRow({ tipo_acceso: "DIRECCION",   desc: "Accede a todos los mandos medios y empleados de la organización." });

  return wb.xlsx.writeBuffer();
}

export async function buildHabilidadesTemplate() {
  const wb = new ExcelJS.Workbook();
  wb.creator = "ZENTOR";
  const ws = wb.addWorksheet("Habilidades");
  setupSheet(ws, [
    { header: "habilidad",             key: "habilidad",             width: 30 },
    { header: "descripcion_habilidad", key: "descripcion_habilidad", width: 44 },
    { header: "tipo",                  key: "tipo",                  width: 18 },
    { header: "descriptor",            key: "descriptor",            width: 40 },
    { header: "descripcion_descriptor",key: "descripcion_descriptor",width: 50 },
  ]);
  dropdown(ws, 3, 2, ROWS, HABILIDAD_TIPO);

  // Example rows
  [
    { habilidad: "Trabajo en equipo", descripcion_habilidad: "Capacidad para colaborar con otros.", tipo: "TRANSVERSAL", descriptor: "Promueve objetivos grupales", descripcion_descriptor: "Formula y comunica metas en equipo." },
    { habilidad: "Trabajo en equipo", descripcion_habilidad: "Capacidad para colaborar con otros.", tipo: "TRANSVERSAL", descriptor: "Involucra a otros en los logros", descripcion_descriptor: "Involucra a las personas en el logro de objetivos." },
    { habilidad: "Trabajo en equipo", descripcion_habilidad: "Capacidad para colaborar con otros.", tipo: "TRANSVERSAL", descriptor: "Contribuye con iniciativas", descripcion_descriptor: "Aporta ideas para el uso eficiente de recursos." },
  ].forEach((r) => ws.addRow(r));

  const cat = wb.addWorksheet("Referencia");
  setupSheet(cat, [{ header: "tipo", key: "tipo", width: 20 }, { header: "descripcion", key: "desc", width: 60 }]);
  HABILIDAD_TIPO.forEach((t) => cat.addRow({ tipo: t, desc: `Habilidades de tipo ${t.toLowerCase()}.` }));

  return wb.xlsx.writeBuffer();
}

// ─── File analyzers ──────────────────────────────────────────────────────────

function readSheet(wb, sheetName) {
  const ws = wb.worksheets.find((s) =>
    s.name.trim().toLowerCase() === sheetName.toLowerCase()
  );
  if (!ws) return null;
  const headers = [];
  ws.getRow(1).eachCell({ includeEmpty: true }, (cell) => {
    headers.push(norm(cell.value));
  });
  const rows = [];
  ws.eachRow((row, rowNum) => {
    if (rowNum === 1) return;
    const obj = { _rowNumber: rowNum };
    row.eachCell({ includeEmpty: true }, (cell, colNum) => {
      const h = headers[colNum - 1];
      if (h) obj[h] = cell.value;
    });
    const hasContent = Object.entries(obj).some(([k, v]) => k !== "_rowNumber" && norm(v));
    if (hasContent) rows.push(obj);
  });
  return rows;
}

export async function analyzePersonasFile(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const rows = readSheet(wb, "personas") || readSheet(wb, "Personas");
  if (!rows) return { ok: false, errors: ["No se encontró la hoja 'Personas' en el archivo."], rows: [], token: null };

  const errors = [];
  const parsed = [];
  rows.forEach((row, i) => {
    const lineErrors = [];
    if (!norm(row.nombre)) lineErrors.push(`Fila ${row._rowNumber}: 'nombre' es obligatorio.`);
    if (!norm(row.apellido)) lineErrors.push(`Fila ${row._rowNumber}: 'apellido' es obligatorio.`);
    if (!norm(row.email_laboral)) lineErrors.push(`Fila ${row._rowNumber}: 'email_laboral' es obligatorio.`);
    if (!norm(row.puesto)) lineErrors.push(`Fila ${row._rowNumber}: 'puesto' es obligatorio.`);
    const rol = norm(row.rol).toUpperCase();
    if (rol && !TIPO_ACCESO.includes(rol)) lineErrors.push(`Fila ${row._rowNumber}: 'rol' debe ser EMPLEADO, MANDO_MEDIO o DIRECCION.`);
    errors.push(...lineErrors);
    parsed.push({
      _rowNumber:       row._rowNumber,
      legajo:           norm(row.legajo),
      nombre:           norm(row.nombre),
      apellido:         norm(row.apellido),
      email_laboral:    normLower(row.email_laboral),
      puesto:           norm(row.puesto),
      departamento:     norm(row.departamento),
      rol:              rol || null,
      jefe_directo:     norm(row.jefe_directo),
      fecha_ingreso:    parseDate(row.fecha_ingreso),
      fecha_nacimiento: parseDate(row.fecha_nacimiento),
      activo:           true,
    });
  });

  parsed.forEach((item) => {
    if (!item.jefe_directo) return;
    const ownKey = `${item.nombre} ${item.apellido}`.trim().toLowerCase();
    if (item.jefe_directo.toLowerCase() === ownKey) {
      errors.push(`Fila ${item._rowNumber}: 'jefe_directo' no puede ser la misma persona.`);
    }
  });

  if (errors.length) return { ok: false, errors, rows: parsed, token: null };
  const token = await storePreview("personas", parsed);
  return { ok: true, errors: [], rows: parsed, token };
}

export async function analyzeJerarquiasFile(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const rows = readSheet(wb, "jerarquias") || readSheet(wb, "Jerarquias");
  if (!rows) return { ok: false, errors: ["No se encontró la hoja 'Jerarquias' en el archivo."], rows: [], token: null };

  const errors = [];
  const parsed = [];
  rows.forEach((row) => {
    if (!norm(row.puesto)) { errors.push(`Fila ${row._rowNumber}: 'puesto' es obligatorio.`); return; }
    const tipo = norm(row.tipo_acceso).toUpperCase();
    if (!TIPO_ACCESO.includes(tipo)) { errors.push(`Fila ${row._rowNumber}: 'tipo_acceso' debe ser EMPLEADO, MANDO_MEDIO o DIRECCION.`); return; }
    parsed.push({ _rowNumber: row._rowNumber, puesto: norm(row.puesto), departamento: norm(row.departamento), tipo_acceso: tipo });
  });

  if (errors.length) return { ok: false, errors, rows: parsed, token: null };
  const token = await storePreview("jerarquias", parsed);
  return { ok: true, errors: [], rows: parsed, token };
}

export async function analyzeHabilidadesFile(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const rows = readSheet(wb, "habilidades") || readSheet(wb, "Habilidades");
  if (!rows) return { ok: false, errors: ["No se encontró la hoja 'Habilidades' en el archivo."], rows: [], token: null };

  const errors = [];
  const parsed = [];
  rows.forEach((row) => {
    if (!norm(row.habilidad)) { errors.push(`Fila ${row._rowNumber}: 'habilidad' es obligatorio.`); return; }
    const tipo = norm(row.tipo).toUpperCase();
    if (tipo && !HABILIDAD_TIPO.includes(tipo)) errors.push(`Fila ${row._rowNumber}: 'tipo' debe ser TRANSVERSAL, TECNICA o LIDERAZGO.`);
    parsed.push({
      _rowNumber:             row._rowNumber,
      habilidad:              norm(row.habilidad),
      descripcion_habilidad:  norm(row.descripcion_habilidad),
      tipo:                   tipo || "TRANSVERSAL",
      descriptor:             norm(row.descriptor),
      descripcion_descriptor: norm(row.descripcion_descriptor),
    });
  });

  if (errors.length) return { ok: false, errors, rows: parsed, token: null };
  const token = await storePreview("habilidades", parsed);
  return { ok: true, errors: [], rows: parsed, token };
}

// ─── Confirm handlers ────────────────────────────────────────────────────────

const ROLE_MAP = {
  EMPLEADO:    { roleKey: "EMPLOYEE",  scope: "SELF" },
  MANDO_MEDIO: { roleKey: "MANAGER",   scope: "DEPARTMENT" },
  DIRECCION:   { roleKey: "HR",        scope: "ORGANIZATION" },
};

export async function confirmPersonas({ token, companyId, schoolId, req }) {
  const entry = await loadPreview(token);
  if (!entry || entry.type !== "personas") return { ok: false, message: "Preview expirado. Volvé a subir el archivo." };

  const rows = entry.rows;
  const result = { created: 0, updated: 0, skipped: 0, temporaryPasswords: [], errors: [] };

  const [roles, existingEmployees, existingUsers, hierarchies] = await Promise.all([
    Role.find({ companyId, activo: { $ne: false } }).lean(),
    Employee.find({ companyId }).lean(),
    User.find({ companyId, isSuperAdmin: false }).lean(),
    PositionHierarchy.find({ companyId }).lean(),
  ]);

  const roleByCode = new Map(roles.filter((r) => r.code).map((r) => [r.code, r]));
  const empByLegajo = new Map(existingEmployees.filter((e) => e.legajo).map((e) => [norm(e.legajo), e]));
  const empByEmail  = new Map(existingEmployees.filter((e) => e.email).map((e) => [normLower(e.email), e]));
  const userByEmail = new Map(existingUsers.map((u) => [normLower(u.email), u]));
  const hierMap     = new Map(hierarchies.map((h) => [`${norm(h.puesto)}|${norm(h.departamento)}`, h.tipoAcceso]));

  const defaultRole = roleByCode.get("EMPLEADO") || roleByCode.get("LECTOR") || roles[0];

  for (const row of rows) {
    if (!row.nombre || !row.email_laboral) { result.skipped++; continue; }

    // Resolve role
    const tipoAcceso =
      row.rol ||
      hierMap.get(`${row.puesto}|${row.departamento}`) ||
      hierMap.get(`${row.puesto}|`) ||
      "EMPLEADO";

    const mapped = ROLE_MAP[tipoAcceso] || ROLE_MAP.EMPLEADO;
    const role = roleByCode.get(mapped.roleKey === "EMPLOYEE" ? "EMPLEADO" : mapped.roleKey === "MANAGER" ? "JEFE" : "RRHH")
      || roleByCode.get(mapped.roleKey)
      || defaultRole;

    if (!role || !defaultRole) { result.skipped++; continue; }

    // Upsert employee
    const empPayload = {
      companyId,
      schoolId: schoolId || null,
      legajo: row.legajo,
      nombre: row.nombre,
      apellido: row.apellido,
      email: row.email_laboral,
      cargo: row.puesto,
      area: row.departamento,
      activo: row.activo,
      fechaIngreso: row.fecha_ingreso,
      fechaNacimiento: row.fecha_nacimiento,
    };

    let emp = (row.legajo && empByLegajo.get(row.legajo)) || empByEmail.get(row.email_laboral) || null;
    if (emp) {
      await withMongoRetry(() => Employee.updateOne({ _id: emp._id }, { $set: empPayload }));
      result.updated++;
    } else {
      const created = await withMongoRetry(() => Employee.create(empPayload));
      emp = created;
      empByLegajo.set(row.legajo, emp);
      empByEmail.set(row.email_laboral, emp);
      result.created++;
    }

    // Upsert user + role assignment
    const existingUser = userByEmail.get(row.email_laboral);
    if (existingUser) {
      await withMongoRetry(() => User.updateOne({ _id: existingUser._id }, { $set: { employeeId: emp._id, roleId: role._id } }));
      await withMongoRetry(() => syncPrimaryRoleAssignmentForUser({
        user: existingUser,
        companyId,
        employeeId: emp._id,
        roleKey: mapped.roleKey,
        scope: mapped.scope,
        departmentCode: row.departamento,
        active: true,
      }));
    } else {
      const tempPwd = generateTempPassword();
      const passwordHash = await bcrypt.hash(tempPwd, 10);
      const newUser = await withMongoRetry(() => User.create({
        companyId,
        schoolId: schoolId || null,
        roleId: role._id,
        employeeId: emp._id,
        nombre: `${row.nombre} ${row.apellido}`.trim(),
        email: row.email_laboral,
        passwordHash,
        activo: row.activo,
        isSuperAdmin: false,
        mustChangePassword: true,
      }));
      await withMongoRetry(() => syncPrimaryRoleAssignmentForUser({
        user: newUser,
        companyId,
        employeeId: emp._id,
        roleKey: mapped.roleKey,
        scope: mapped.scope,
        departmentCode: row.departamento,
        active: true,
      }));
      userByEmail.set(row.email_laboral, newUser);
      result.temporaryPasswords.push({ email: row.email_laboral, temporaryPassword: tempPwd });
    }
  }

  const empByFullName = new Map();
  empByEmail.forEach((employee) => {
    const key = `${employee.nombre} ${employee.apellido}`.trim().toLowerCase();
    if (key) empByFullName.set(key, employee);
  });

  for (const row of rows) {
    if (!row.jefe_directo) continue;
    const employee = (row.legajo && empByLegajo.get(row.legajo)) || empByEmail.get(row.email_laboral);
    const manager = empByFullName.get(row.jefe_directo.toLowerCase());
    if (!employee || !manager || String(manager._id) === String(employee._id)) continue;
    await withMongoRetry(() => Employee.updateOne({ _id: employee._id }, { $set: { managerId: manager._id } }));
  }

  await deletePreview(token);
  return { ok: true, result };
}

export async function confirmJerarquias({ token, companyId }) {
  const entry = await loadPreview(token);
  if (!entry || entry.type !== "jerarquias") return { ok: false, message: "Preview expirado. Volvé a subir el archivo." };

  const rows = entry.rows;
  let created = 0, updated = 0;

  for (const row of rows) {
    const filter = { companyId, puesto: row.puesto, departamento: row.departamento };
    const existing = await PositionHierarchy.findOne(filter);
    if (existing) {
      existing.tipoAcceso = row.tipo_acceso;
      await existing.save();
      updated++;
    } else {
      await PositionHierarchy.create({ ...filter, tipoAcceso: row.tipo_acceso });
      created++;
    }
  }

  await deletePreview(token);
  return { ok: true, result: { created, updated } };
}

export async function confirmHabilidades({ token, companyId, schoolId }) {
  const entry = await loadPreview(token);
  if (!entry || entry.type !== "habilidades") return { ok: false, message: "Preview expirado. Volvé a subir el archivo." };

  const rows = entry.rows;

  // Group by habilidad name
  const grouped = new Map();
  for (const row of rows) {
    const key = row.habilidad.toLowerCase();
    if (!grouped.has(key)) grouped.set(key, { ...row, descriptors: [] });
    if (row.descriptor) grouped.get(key).descriptors.push({ nombre: row.descriptor, descripcion: row.descripcion_descriptor });
  }

  let compCreated = 0, compUpdated = 0, descCreated = 0, descUpdated = 0;

  for (const [, group] of grouped) {
    let comp = await Competency.findOne({ companyId, nombre: { $regex: `^${group.habilidad}$`, $options: "i" } });
    if (comp) {
      comp.descripcion = group.descripcion_habilidad || comp.descripcion;
      comp.tipo = group.tipo || comp.tipo;
      await comp.save();
      compUpdated++;
    } else {
      comp = await Competency.create({
        companyId,
        schoolId: schoolId || null,
        nombre: group.habilidad,
        descripcion: group.descripcion_habilidad,
        tipo: group.tipo || "TRANSVERSAL",
        componente: "C",
        activa: true,
        audienceType: "all",
      });
      compCreated++;
    }

    for (const desc of group.descriptors) {
      if (!desc.nombre) continue;
      const existing = await Metric.findOne({ companyId, competencyId: comp._id, nombre: { $regex: `^${desc.nombre}$`, $options: "i" } });
      if (existing) {
        existing.descripcion = desc.descripcion || existing.descripcion;
        await existing.save();
        descUpdated++;
      } else {
        await Metric.create({
          companyId,
          schoolId: schoolId || null,
          competencyId: comp._id,
          nombre: desc.nombre,
          descripcion: desc.descripcion,
          ponderacion: 1,
          activa: true,
        });
        descCreated++;
      }
    }
  }

  await deletePreview(token);
  return { ok: true, result: { competencias: { created: compCreated, updated: compUpdated }, descriptores: { created: descCreated, updated: descUpdated } } };
}
