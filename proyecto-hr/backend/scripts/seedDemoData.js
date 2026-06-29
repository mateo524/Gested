/**
 * Seed Demo Data — importa las 100 personas + competencias + evaluaciones del demo HTML
 * Uso: node backend/scripts/seedDemoData.js [companyId]
 *
 * Si no pasas companyId, usa la primera empresa que encuentre en la DB.
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

import Company from "../models/Company.js";
import School from "../models/School.js";
import Employee from "../models/Employee.js";
import Competency from "../models/Competency.js";
import Metric from "../models/Metric.js";
import EvaluationCycle from "../models/EvaluationCycle.js";
import Evaluation from "../models/Evaluation.js";
import EvaluationScore from "../models/EvaluationScore.js";
import User from "../models/User.js";

// ─── Generador determinístico (misma seed=77 que el demo HTML) ─────────────────
let seed = 77;
function rand() { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return (seed >>> 0) / 0xffffffff; }
function ri(a, b) { return Math.floor(rand() * (b - a + 1)) + a; }
function avgArr(arr) { return arr.length ? +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2) : 0; }

const FIRST = ["Ana","Carlos","María","Juan","Sofía","Diego","Valentina","Matías","Laura","Andrés","Camila","Roberto","Florencia","Sebastián","Paula","Nicolás","Lucía","Martín","Daniela","Felipe","Gabriela","Alejandro","Natalia","Pablo","Romina","Facundo","Verónica","Tomás","Cecilia","Ramiro","Victoria","Ignacio","Claudia","Emilio","Mariana","Gustavo","Silvana","Hernán","Patricia","Leandro","Julia","Ricardo","Mercedes","Iván","Aldana","Maximiliano","Lorena","Eduardo","Vanessa","Jorge","Beatriz","Fernando","Marcela","Esteban","Andrea","Sergio","Liliana","Adrián","Carolina","Raúl","Nora","Cristian","Hugo","Miriam","Gerardo","Alicia","Oscar","Sandra","Walter","Graciela","Leonardo","Viviana","Ariel","Susana","Miguel","Teresa","Daniel","Karina","Claudio","Mónica","Rubén","Elena","Fabián","Rosa","Gonzalo","Celia","Ezequiel","Norma","Agustín","Rita","Rodrigo","Pilar","Javier","Alba","Mauricio","Silvia"];
const LAST = ["García","López","Martínez","González","Rodríguez","Fernández","Pérez","Sánchez","Ramírez","Torres","Flores","Rivera","Gómez","Díaz","Reyes","Morales","Cruz","Vargas","Mendoza","Herrera","Ramos","Ruiz","Ortiz","Silva","Aguilar","Molina","Castro","Bravo","Medina","Suárez"];
let ni = 0;
function nn() { return `${FIRST[ni % FIRST.length]} ${LAST[ni++ % LAST.length]}`; }

const COMPS = [
  { key: "TE",  label: "Trabajo en Equipo",      subs: ["Formula objetivos en equipo","Involucra a otras personas","Uso eficiente de recursos"] },
  { key: "CE",  label: "Comunicación Efectiva",   subs: ["Trato cordial y respetuoso","Comunicación con claridad","Genera iniciativas en común"] },
  { key: "OL",  label: "Orientación al Logro",    subs: ["Logra estándares inst.","Mejora continua","Organiza según misión"] },
  { key: "AGC", label: "Adaptación al Cambio",    subs: ["Entiende cambios del contexto","Actitud flexible","Ajusta comportamiento"] },
  { key: "IOS", label: "Iniciativa al Servicio",  subs: ["Reacciona a necesidades","Aporta alternativas","Anticipa cambios"] },
];
const LEAD = [
  { key: "FF", label: "Formación de Formadores",  subs: ["Desarrolla capacidades","Retroalimenta para el logro","Gestiona conocimiento"] },
  { key: "TD", label: "Toma de Decisiones",       subs: ["Decide con información","Evalúa alternativas","Comunica decisiones"] },
  { key: "L",  label: "Liderazgo",                subs: ["Inspira y motiva","Delega con claridad","Desarrolla colaboradores"] },
];
const DOC = [
  { key: "LP", label: "Liderazgo Pedagógico",     subs: ["Desarrolla compromiso","Retroalimenta para motivar","Estrategias formativas","Cumple requerimientos","Acompañamiento integral","Estrategias innovadoras"] },
];

const BIASES = { SEC: { CE: -0.5, AGC: -0.3 }, PRI: { OL: -0.4 }, JAR: { TE: 0.3, IOS: -0.5 }, ADM: { AGC: -0.6, IOS: -0.4 } };

function mkP(nombre, nivel, levelTag, puesto, esJefatura, esDocente, reportaA) {
  const base = ri(2, 4);
  const b = BIASES[levelTag] || {};
  const scores = {};
  const comps = [...COMPS, ...(esJefatura ? LEAD : []), ...(esDocente ? DOC : [])];
  comps.forEach(c => {
    const ba = +(base + (b[c.key] || 0) + rand() * 1.6 - 0.8).toFixed(1);
    const bj = +(base + (b[c.key] || 0) + rand() * 1.6 - 0.8).toFixed(1);
    scores["a_" + c.key] = {};
    scores["j_" + c.key] = {};
    c.subs.forEach((_, i) => {
      scores["a_" + c.key]["s" + i] = Math.max(1, Math.min(5, +(ba + rand() * 1.2 - 0.6).toFixed(1)));
      scores["j_" + c.key]["s" + i] = Math.max(1, Math.min(5, +(bj + rand() * 1.2 - 0.6).toFixed(1)));
    });
    scores["a_" + c.key + "_avg"] = avgArr(Object.values(scores["a_" + c.key]));
    scores["j_" + c.key + "_avg"] = avgArr(Object.values(scores["j_" + c.key]));
  });
  const aPool = comps.map(c => scores["a_" + c.key + "_avg"]);
  const jPool = comps.map(c => scores["j_" + c.key + "_avg"]);
  scores.autoGeneral = avgArr(aPool);
  scores.jefeGeneral = avgArr(jPool);
  scores.general = +((scores.autoGeneral + scores.jefeGeneral) / 2).toFixed(1);
  return { nombre, nivel, levelTag, puesto, esJefatura, esDocente, reportaA, scores, comps };
}

// Build org — misma estructura que el demo
const DG = mkP(nn(), "Dirección General", "DIR", "Director General", true, false, "—");
const DS = mkP(nn(), "Secundaria", "SEC", "Director Secundaria", true, false, "Director General");
const CS = [1,2,3,4,5].map(i => mkP(nn(), "Secundaria", "SEC", `Coordinador Sec. ${i}`, true, false, "Dir. Secundaria"));
const DP = mkP(nn(), "Primaria", "PRI", "Director Primaria", true, false, "Director General");
const CP = [1,2,3].map(i => mkP(nn(), "Primaria", "PRI", `Coordinador Pri. ${i}`, true, false, "Dir. Primaria"));
const DJ = mkP(nn(), "Jardín", "JAR", "Director Jardín", true, false, "Director General");
const CJ = [1,2,3].map(i => mkP(nn(), "Jardín", "JAR", `Coordinador Jar. ${i}`, true, false, "Dir. Jardín"));
const STAFF = [
  ...[1,2,3].map(i => mkP(nn(), "RRHH", "ADM", `Resp. RRHH ${i}`, false, false, "Director General")),
  ...[1,2,3].map(i => mkP(nn(), "Administración", "ADM", `Administrativo ${i}`, false, false, "Director General")),
  mkP(nn(), "Tecnología", "ADM", "Enc. Tecnología", false, false, "Director General"),
  mkP(nn(), "Biblioteca", "ADM", "Bibliotecaria", false, false, "Director General"),
  ...[1,2,3,4].map(i => mkP(nn(), "Orientación", "ADM", `Orientador ${i}`, false, false, "Director General")),
  mkP(nn(), "Comunicaciones", "ADM", "Com. Institucional", false, false, "Director General"),
];
function mkDocs(niv, tag, coords, n) {
  return Array.from({ length: n }, (_, i) => mkP(nn(), `Docentes ${niv}`, tag, `Docente ${niv}`, false, true, coords[i % coords.length].nombre));
}
const DS_DOC = mkDocs("Secundaria", "SEC", CS, 34);
const DP_DOC = mkDocs("Primaria", "PRI", CP, 33);
const DJ_DOC = mkDocs("Jardín", "JAR", CJ, 33);
const DATA = [DG, DS, ...CS, DP, ...CP, DJ, ...CJ, ...STAFF, ...DS_DOC, ...DP_DOC, ...DJ_DOC];

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("Conectando a MongoDB...");
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  await mongoose.connect(mongoUri);
  console.log("Conectado.");

  // Resolve company
  const cliCompanyId = process.argv[2];
  const company = cliCompanyId
    ? await Company.findById(cliCompanyId).lean()
    : await Company.findOne().lean();
  if (!company) throw new Error("No se encontró ninguna empresa. Creá una primero.");
  const companyId = company._id;
  console.log(`Usando empresa: ${company.nombre} (${companyId})`);

  // Find or create a school for this company (required by Evaluation model)
  let school = await School.findOne({ companyId }).lean();
  if (!school) {
    school = await School.create({ companyId, nombre: `${company.nombre} — Institución`, activa: true });
    console.log("Escuela demo creada.");
  }
  const schoolId = school._id;

  // Find an admin user for evaluatorUserId
  const adminUser = await User.findOne({ companyId }).lean();
  if (!adminUser) throw new Error("No hay usuarios en esta empresa. Creá un usuario admin primero.");
  const evaluatorUserId = adminUser._id;
  console.log(`Evaluador: ${adminUser.email}`);

  // ─── Competencias y métricas ─────────────────────────────────────────────────
  console.log("Creando competencias y descriptores...");
  const allCompDefs = [...COMPS, ...LEAD, ...DOC];
  const compMap = {};   // key → Competency._id
  const metricMap = {}; // key → [Metric._id, ...]

  for (const def of allCompDefs) {
    const comp = await Competency.findOneAndUpdate(
      { companyId, nombre: def.label },
      { $setOnInsert: { companyId, schoolId, nombre: def.label, descripcion: `Competencia: ${def.label}`, tipo: "COMPORTAMENTAL", nivel: "TODOS", alcance: "ORGANIZACION" } },
      { upsert: true, returnDocument: "after" }
    );
    compMap[def.key] = comp._id;
    // Un solo metric por competencia (el índice único del DB lo requiere)
    const metricNombre = def.subs[0] || def.label;
    const metric = await Metric.findOneAndUpdate(
      { companyId, competencyId: comp._id },
      { $setOnInsert: { companyId, schoolId, competencyId: comp._id, nombre: metricNombre, descripcion: def.subs.join(" · ") } },
      { upsert: true, returnDocument: "after" }
    );
    metricMap[def.key] = [metric._id];
  }
  console.log(`${allCompDefs.length} competencias creadas.`);

  // ─── Ciclo de evaluación ─────────────────────────────────────────────────────
  const cycle = await EvaluationCycle.findOneAndUpdate(
    { companyId, anio: 2024, periodo: "Anual", etapa: "EVALUACION_FINAL" },
    { $setOnInsert: { companyId, schoolId, anio: 2024, periodo: "Anual", etapa: "EVALUACION_FINAL", estado: "ABIERTO", fechaInicio: new Date("2024-03-01"), fechaFin: new Date("2024-11-30") } },
    { upsert: true, returnDocument: "after" }
  );
  console.log(`Ciclo: ${cycle.anio} ${cycle.periodo} (${cycle._id})`);

  // ─── Empleados + Evaluaciones ─────────────────────────────────────────────────
  console.log(`Insertando ${DATA.length} personas...`);
  let empCount = 0;
  let evalCount = 0;
  let scoreCount = 0;

  // Maps para asignar managers en el segundo pass
  const nombreToId = new Map(); // nombre completo → emp._id
  const cargoToId = new Map();  // cargo → emp._id
  const personaEmpIds = [];     // [{persona, empId}]

  // Normaliza el campo reportaA para buscar por cargo
  const CARGO_ALIASES = {
    "Director General": "Director General",
    "Dir. Secundaria": "Director Secundaria",
    "Dir. Primaria": "Director Primaria",
    "Dir. Jardín": "Director Jardín",
  };

  for (const persona of DATA) {
    const parts = persona.nombre.trim().split(" ");
    const nombre = parts[0];
    const apellido = parts.slice(1).join(" ");
    const slug = `${nombre}.${apellido}`.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "").replace(/[^a-z.]/g, "");
    const email = `${slug}.demo@zentor.edu.ar`;
    const legajo = String(empCount + 1001);

    // Upsert employee
    const emp = await Employee.findOneAndUpdate(
      { companyId, email },
      {
        $setOnInsert: {
          companyId, schoolId, nombre, apellido, email, legajo,
          cargo: persona.puesto, area: persona.nivel, departamento: persona.nivel,
          tipoEmpleado: persona.esDocente ? "DOCENTE" : "ADMINISTRATIVO",
          activo: true,
        },
      },
      { upsert: true, returnDocument: "after" }
    );
    empCount++;

    // Guardar en mapas para el segundo pass
    nombreToId.set(persona.nombre.trim(), emp._id);
    cargoToId.set(persona.puesto, emp._id);
    personaEmpIds.push({ persona, empId: emp._id });

    // Upsert AUTOEVALUACION
    const autoEval = await Evaluation.findOneAndUpdate(
      { companyId, schoolId, employeeId: emp._id, cycleId: cycle._id, tipo: "AUTOEVALUACION" },
      { $setOnInsert: { companyId, schoolId, employeeId: emp._id, cycleId: cycle._id, tipo: "AUTOEVALUACION", estado: "CERRADA", evaluatorUserId, resultadoFinal: persona.scores.autoGeneral } },
      { upsert: true, returnDocument: "after" }
    );

    // Upsert JEFATURA
    const jefeEval = await Evaluation.findOneAndUpdate(
      { companyId, schoolId, employeeId: emp._id, cycleId: cycle._id, tipo: "JEFATURA" },
      { $setOnInsert: { companyId, schoolId, employeeId: emp._id, cycleId: cycle._id, tipo: "JEFATURA", estado: "CERRADA", evaluatorUserId, resultadoFinal: persona.scores.jefeGeneral } },
      { upsert: true, returnDocument: "after" }
    );

    // Upsert FINAL
    await Evaluation.findOneAndUpdate(
      { companyId, schoolId, employeeId: emp._id, cycleId: cycle._id, tipo: "FINAL" },
      { $setOnInsert: { companyId, schoolId, employeeId: emp._id, cycleId: cycle._id, tipo: "FINAL", estado: "CERRADA", evaluatorUserId, resultadoFinal: persona.scores.general } },
      { upsert: true }
    );
    evalCount += 3;

    // EvaluationScore via bulkWrite — un score por competencia
    const scoreOps = [];
    for (const compDef of persona.comps) {
      const metricId = metricMap[compDef.key]?.[0];
      if (!metricId) continue;
      const aAvg = persona.scores["a_" + compDef.key + "_avg"];
      const jAvg = persona.scores["j_" + compDef.key + "_avg"];
      scoreOps.push({
        updateOne: {
          filter: { evaluationId: autoEval._id, metricId },
          update: { $setOnInsert: { evaluationId: autoEval._id, metricId, nivel: Math.max(1, Math.min(5, Math.round(aAvg))) || 3 } },
          upsert: true,
        },
      });
      scoreOps.push({
        updateOne: {
          filter: { evaluationId: jefeEval._id, metricId },
          update: { $setOnInsert: { evaluationId: jefeEval._id, metricId, nivel: Math.max(1, Math.min(5, Math.round(jAvg))) || 3 } },
          upsert: true,
        },
      });
    }
    if (scoreOps.length) {
      const res = await EvaluationScore.bulkWrite(scoreOps, { ordered: false });
      scoreCount += res.upsertedCount || 0;
    }

    if (empCount % 10 === 0) process.stdout.write(`  ${empCount}/${DATA.length}...\r`);
  }

  console.log(`\n✓ ${empCount} empleados insertados`);
  console.log(`✓ ${evalCount} evaluaciones insertadas`);
  console.log(`✓ ${scoreCount} scores insertados`);

  // ─── Segundo pass: asignar managerId ─────────────────────────────────────────
  console.log("Asignando managers...");
  let managerCount = 0;
  const managerOps = [];
  for (const { persona, empId } of personaEmpIds) {
    const reportaA = persona.reportaA;
    if (!reportaA || reportaA === "—") continue;
    // Primero buscar por cargo (alias), luego por nombre exacto
    const cargoBuscado = CARGO_ALIASES[reportaA] || reportaA;
    const managerId = cargoToId.get(cargoBuscado) || nombreToId.get(reportaA);
    if (!managerId) continue;
    managerOps.push({
      updateOne: { filter: { _id: empId }, update: { $set: { managerId } } },
    });
    managerCount++;
  }
  if (managerOps.length) await Employee.bulkWrite(managerOps, { ordered: false });
  console.log(`✓ ${managerCount} managers asignados`);

  console.log("\nDatos demo listos. Recargá el dashboard para ver los resultados.");

  await mongoose.disconnect();
}

main().catch(err => {
  console.error("Error:", err.message);
  process.exit(1);
});
