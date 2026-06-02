#!/usr/bin/env node

// Performia Pilot Seed Script
// Idempotent: safe to run multiple times. Creates demo data if not exists.
// Does NOT delete existing data.
// Usage:
//   SEED_CONFIRM=1 node scripts/seed-pilot.mjs
//   SEED_CONFIRM=1 node scripts/seed-pilot.mjs --reset-passwords
//   node scripts/seed-pilot.mjs --dry-run

const API_URL = process.env.API_URL || "https://gested-1-backend.onrender.com";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@demo.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "123456";
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "Demo1234!";
const DRY_RUN = process.argv.includes("--dry-run");
const RESET_PASSWORDS = process.argv.includes("--reset-passwords");

let TOKEN = "";

async function api(method, path, body) {
  const headers = { "Content-Type": "application/json" };
  if (TOKEN) headers["Authorization"] = `Bearer ${TOKEN}`;
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data;
  const text = await res.text();
  try {
    data = JSON.parse(text);
  } catch {
    data = { message: text };
  }
  if (!res.ok) {
    const msg = data?.message || data?.mensaje || data?.error || `HTTP ${res.status}`;
    throw new Error(`${method} ${path}: ${msg}`);
  }
  return data;
}

async function apiSafe(method, path, body) {
  try {
    return await api(method, path, body);
  } catch (err) {
    return { _error: err.message };
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function listAll(path) {
  const items = [];
  let page = 1;
  while (true) {
    const data = await api("GET", `${path}?page=${page}&limit=100`);
    const list = Array.isArray(data) ? data : data?.data || data?.items || data?.results || [];
    if (!list.length) break;
    items.push(...list);
    if (list.length < 100) break;
    page++;
  }
  return items;
}

// ──────────────────────────────────────────────
// Data
// ──────────────────────────────────────────────

const PILOT_USERS = [
  { email: "superadmin.demo@performia.test", roleCode: "SUPER_ADMIN", nombre: "Super Admin Demo" },
  { email: "orgadmin.demo@performia.test", roleCode: "ORG_ADMIN", nombre: "Admin Org Demo" },
  { email: "hr.demo@performia.test", roleCode: "HR", nombre: "RRHH Demo" },
  { email: "manager.demo@performia.test", roleCode: "MANAGER", nombre: "Manager Demo" },
  { email: "employee.demo@performia.test", roleCode: "EMPLOYEE", nombre: "Empleado Demo" },
  { email: "viewer.demo@performia.test", roleCode: "VIEWER", nombre: "Lector Demo" },
  { email: "auditor.demo@performia.test", roleCode: "AUDITOR", nombre: "Auditor Demo" },
];

const DEMO_EMPLOYEES = [
  { nombre: "Carlos", apellido: "Rodríguez", email: "carlos.rodriguez@horizonte.edu", cargo: "Director General", area: "Dirección", tipoEmpleado: "DIRECTIVO", fechaIngreso: "2022-01-15" },
  { nombre: "María", apellido: "López", email: "maria.lopez@horizonte.edu", cargo: "Jefa de Departamento Académico", area: "Académica", tipoEmpleado: "DIRECTIVO", fechaIngreso: "2022-03-01" },
  { nombre: "Juan", apellido: "Martínez", email: "juan.martinez@horizonte.edu", cargo: "Coordinador Académico", area: "Académica", tipoEmpleado: "DIRECTIVO", fechaIngreso: "2022-06-15" },
  { nombre: "Ana", apellido: "García", email: "ana.garcia@horizonte.edu", cargo: "Coordinadora de Evaluaciones", area: "Académica", tipoEmpleado: "DIRECTIVO", fechaIngreso: "2023-02-01" },
  { nombre: "Pedro", apellido: "González", email: "pedro.gonzalez@horizonte.edu", cargo: "Docente de Matemática", area: "Académica", tipoEmpleado: "DOCENTE", fechaIngreso: "2023-03-01" },
  { nombre: "Laura", apellido: "Díaz", email: "laura.diaz@horizonte.edu", cargo: "Docente de Lengua", area: "Académica", tipoEmpleado: "DOCENTE", fechaIngreso: "2023-03-15" },
  { nombre: "Roberto", apellido: "Pérez", email: "roberto.perez@horizonte.edu", cargo: "Docente de Ciencias", area: "Académica", tipoEmpleado: "DOCENTE", fechaIngreso: "2023-04-01" },
  { nombre: "Sofía", apellido: "Ramírez", email: "sofia.ramirez@horizonte.edu", cargo: "Docente de Historia", area: "Académica", tipoEmpleado: "DOCENTE", fechaIngreso: "2023-04-15" },
  { nombre: "Diego", apellido: "Torres", email: "diego.torres@horizonte.edu", cargo: "Docente de Inglés", area: "Académica", tipoEmpleado: "DOCENTE", fechaIngreso: "2024-02-01" },
  { nombre: "Valentina", apellido: "Acosta", email: "valentina.acosta@horizonte.edu", cargo: "Docente de Educación Física", area: "Académica", tipoEmpleado: "DOCENTE", fechaIngreso: "2024-02-15" },
  { nombre: "Facundo", apellido: "Moreno", email: "facundo.moreno@horizonte.edu", cargo: "Docente de Arte", area: "Académica", tipoEmpleado: "DOCENTE", fechaIngreso: "2024-03-01" },
  { nombre: "Camila", apellido: "Sosa", email: "camila.sosa@horizonte.edu", cargo: "Docente de Tecnología", area: "Académica", tipoEmpleado: "DOCENTE", fechaIngreso: "2024-03-15" },
  { nombre: "Gabriela", apellido: "Sánchez", email: "gabriela.sanchez@horizonte.edu", cargo: "Jefa de Operaciones", area: "Operaciones", tipoEmpleado: "DIRECTIVO", fechaIngreso: "2022-05-01" },
  { nombre: "Martín", apellido: "Álvarez", email: "martin.alvarez@horizonte.edu", cargo: "Coordinador de Logística", area: "Operaciones", tipoEmpleado: "DIRECTIVO", fechaIngreso: "2023-01-15" },
  { nombre: "Florencia", apellido: "Romero", email: "florencia.romero@horizonte.edu", cargo: "Coordinadora de Mantenimiento", area: "Operaciones", tipoEmpleado: "DIRECTIVO", fechaIngreso: "2023-02-01" },
  { nombre: "Lucas", apellido: "Fernández", email: "lucas.fernandez@horizonte.edu", cargo: "Asistente Operativo", area: "Operaciones", tipoEmpleado: "NO_DOCENTE", fechaIngreso: "2023-06-01" },
  { nombre: "Emilia", apellido: "Luna", email: "emilia.luna@horizonte.edu", cargo: "Asistente Operativa", area: "Operaciones", tipoEmpleado: "NO_DOCENTE", fechaIngreso: "2023-06-15" },
  { nombre: "Nicolás", apellido: "Ríos", email: "nicolas.rios@horizonte.edu", cargo: "Asistente de Logística", area: "Operaciones", tipoEmpleado: "NO_DOCENTE", fechaIngreso: "2023-07-01" },
  { nombre: "Julieta", apellido: "Paz", email: "julieta.paz@horizonte.edu", cargo: "Asistente de Mantenimiento", area: "Operaciones", tipoEmpleado: "NO_DOCENTE", fechaIngreso: "2024-01-15" },
  { nombre: "Agustín", apellido: "Vega", email: "agustin.vega@horizonte.edu", cargo: "Asistente Operativo", area: "Operaciones", tipoEmpleado: "NO_DOCENTE", fechaIngreso: "2024-02-01" },
  { nombre: "Victoria", apellido: "Castillo", email: "victoria.castillo@horizonte.edu", cargo: "Asistente Administrativa", area: "Operaciones", tipoEmpleado: "NO_DOCENTE", fechaIngreso: "2024-02-15" },
  { nombre: "Pablo", apellido: "Herrera", email: "pablo.herrera@horizonte.edu", cargo: "Jefe de RRHH", area: "RRHH", tipoEmpleado: "DIRECTIVO", fechaIngreso: "2022-04-01" },
  { nombre: "Carolina", apellido: "Medina", email: "carolina.medina@horizonte.edu", cargo: "Coordinadora de Selección", area: "RRHH", tipoEmpleado: "RRHH", fechaIngreso: "2023-02-15" },
  { nombre: "Fernando", apellido: "Silva", email: "fernando.silva@horizonte.edu", cargo: "Coordinador de Desarrollo", area: "RRHH", tipoEmpleado: "RRHH", fechaIngreso: "2023-03-01" },
  { nombre: "Lucía", apellido: "Molina", email: "lucia.molina@horizonte.edu", cargo: "Analista de RRHH", area: "RRHH", tipoEmpleado: "RRHH", fechaIngreso: "2023-05-01" },
  { nombre: "Tomás", apellido: "Roldán", email: "tomas.roldan@horizonte.edu", cargo: "Analista de RRHH", area: "RRHH", tipoEmpleado: "RRHH", fechaIngreso: "2023-06-01" },
  { nombre: "Daniela", apellido: "Cáceres", email: "daniela.caceres@horizonte.edu", cargo: "Analista de RRHH", area: "RRHH", tipoEmpleado: "RRHH", fechaIngreso: "2024-01-01" },
  { nombre: "Esteban", apellido: "Pereyra", email: "esteban.pereyra@horizonte.edu", cargo: "Analista de RRHH", area: "RRHH", tipoEmpleado: "RRHH", fechaIngreso: "2024-02-01" },
  { nombre: "Rocío", apellido: "Giménez", email: "rocio.gimenez@horizonte.edu", cargo: "Analista de RRHH", area: "RRHH", tipoEmpleado: "RRHH", fechaIngreso: "2024-03-01" },
  { nombre: "Alejandro", apellido: "Navarro", email: "alejandro.navarro@horizonte.edu", cargo: "Jefe de Tecnología", area: "Tecnología", tipoEmpleado: "DIRECTIVO", fechaIngreso: "2022-06-01" },
  { nombre: "Valeria", apellido: "Suárez", email: "valeria.suarez@horizonte.edu", cargo: "Coordinadora de Infraestructura", area: "Tecnología", tipoEmpleado: "DIRECTIVO", fechaIngreso: "2023-04-01" },
  { nombre: "Gustavo", apellido: "Ortiz", email: "gustavo.ortiz@horizonte.edu", cargo: "Coordinador de Desarrollo", area: "Tecnología", tipoEmpleado: "DIRECTIVO", fechaIngreso: "2023-04-15" },
  { nombre: "Elena", apellido: "Rivas", email: "elena.rivas@horizonte.edu", cargo: "Ingeniera de Sistemas", area: "Tecnología", tipoEmpleado: "NO_DOCENTE", fechaIngreso: "2023-07-15" },
  { nombre: "Matías", apellido: "Cruz", email: "matias.cruz@horizonte.edu", cargo: "Desarrollador Frontend", area: "Tecnología", tipoEmpleado: "NO_DOCENTE", fechaIngreso: "2023-08-01" },
  { nombre: "Camila", apellido: "Flores", email: "camila.flores@horizonte.edu", cargo: "Desarrolladora Backend", area: "Tecnología", tipoEmpleado: "NO_DOCENTE", fechaIngreso: "2023-08-15" },
  { nombre: "Santiago", apellido: "Mendoza", email: "santiago.mendoza@horizonte.edu", cargo: "Soporte TI", area: "Tecnología", tipoEmpleado: "NO_DOCENTE", fechaIngreso: "2024-01-01" },
  { nombre: "Andrea", apellido: "Reyes", email: "andrea.reyes@horizonte.edu", cargo: "Soporte TI", area: "Tecnología", tipoEmpleado: "NO_DOCENTE", fechaIngreso: "2024-01-15" },
  { nombre: "Francisco", apellido: "Peña", email: "francisco.pena@horizonte.edu", cargo: "Analista de Datos", area: "Tecnología", tipoEmpleado: "NO_DOCENTE", fechaIngreso: "2024-02-15" },
  { nombre: "Marina", apellido: "Costas", email: "marina.costas@horizonte.edu", cargo: "Analista de Datos", area: "Tecnología", tipoEmpleado: "NO_DOCENTE", fechaIngreso: "2024-03-01" },
];

const DEMO_COMPETENCIES = [
  { competencia: "Dominio del contenido disciplinar", definicion: "Demuestra dominio de los contenidos del area que ensena.", tipo: "DESEMPENO", escala: "1_5" },
  { competencia: "Planificacion de la ensenanza", definicion: "Planifica sus clases con objetivos claros y materiales adecuados.", tipo: "DESEMPENO", escala: "1_5" },
  { competencia: "Evaluacion de aprendizajes", definicion: "Utiliza instrumentos variados para evaluar el progreso del estudiante.", tipo: "DESEMPENO", escala: "1_5" },
  { competencia: "Comunicacion con estudiantes", definicion: "Establece una comunicacion clara y efectiva con los estudiantes.", tipo: "DESEMPENO", escala: "1_5" },
  { competencia: "Trabajo en equipo", definicion: "Colabora activamente con colegas en proyectos institucionales.", tipo: "COMPETENCIA", escala: "1_5" },
  { competencia: "Liderazgo", definicion: "Inspira y guia a otros hacia el logro de objetivos.", tipo: "COMPETENCIA", escala: "1_5" },
  { competencia: "Resolucion de conflictos", definicion: "Media y resuelve conflictos de manera constructiva.", tipo: "COMPETENCIA", escala: "1_5" },
  { competencia: "Gestion del tiempo", definicion: "Organiza su tiempo para cumplir con plazos y prioridades.", tipo: "COMPETENCIA", escala: "1_5" },
  { competencia: "Uso de herramientas digitales", definicion: "Utiliza plataformas y herramientas digitales para su trabajo.", tipo: "COMPETENCIA", escala: "1_5" },
  { competencia: "Comunicacion escrita", definicion: "Redacta informes y comunicaciones con claridad y correccion.", tipo: "COMPETENCIA", escala: "1_5" },
  { competencia: "Atencion al cliente interno", definicion: "Responde a necesidades de colegas con eficiencia y amabilidad.", tipo: "COMPETENCIA", escala: "1_5" },
  { competencia: "Innovacion y mejora continua", definicion: "Propone mejoras y nuevas ideas para optimizar procesos.", tipo: "COMPETENCIA", escala: "1_5" },
  { competencia: "Cumplimiento de objetivos", definicion: "Alcanza los objetivos definidos para su rol en el periodo.", tipo: "DESEMPENO", escala: "1_5" },
  { competencia: "Asistencia y puntualidad", definicion: "Asiste regularmente y cumple con el horario laboral.", tipo: "DESEMPENO", escala: "1_5" },
  { competencia: "Responsabilidad institucional", definicion: "Asume compromisos institucionales y los cumple.", tipo: "DESEMPENO", escala: "1_5" },
];

const DEMO_CYCLES = [
  { periodo: "Q3", anio: 2025, etapa: "CIERRE", estado: "CERRADO", fechaInicio: "2025-07-01", fechaFin: "2025-09-30" },
  { periodo: "Q4", anio: 2025, etapa: "CIERRE", estado: "CERRADO", fechaInicio: "2025-10-01", fechaFin: "2025-12-31" },
  { periodo: "Q1", anio: 2026, etapa: "REVISION", estado: "CERRADO", fechaInicio: "2026-01-01", fechaFin: "2026-03-31" },
  { periodo: "Q2", anio: 2026, etapa: "SEGUIMIENTO", estado: "ACTIVO", fechaInicio: "2026-04-01", fechaFin: "2026-06-30" },
];

const DEMO_PLANS = [
  { nombre: "Plan de liderazgo pedagógico", descripcion: "Desarrollar habilidades de liderazgo para coordinar el equipo docente.", estado: "EN_CURSO", prioridad: "ALTA" },
  { nombre: "Formación en herramientas digitales", descripcion: "Capacitarse en nuevas plataformas educativas para integrar tecnologia.", estado: "EN_CURSO", prioridad: "MEDIA" },
  { nombre: "Plan de comunicación efectiva", descripcion: "Mejorar la comunicación con padres y colegas.", estado: "PENDIENTE", prioridad: "ALTA" },
  { nombre: "Optimización de procesos operativos", descripcion: "Revisar y optimizar los procesos de logística y mantenimiento.", estado: "EN_CURSO", prioridad: "ALTA" },
  { nombre: "Plan de bienestar laboral", descripcion: "Implementar acciones para mejorar el clima laboral.", estado: "PENDIENTE", prioridad: "MEDIA" },
  { nombre: "Formación en evaluación por competencias", descripcion: "Capacitarse en el diseño de instrumentos de evaluación.", estado: "COMPLETADO", prioridad: "MEDIA" },
  { nombre: "Plan de desarrollo de RRHH", descripcion: "Implementar un sistema de seguimiento de desempeño.", estado: "EN_CURSO", prioridad: "ALTA" },
  { nombre: "Actualización técnica en infraestructura TI", descripcion: "Actualizar servidores y red para mejorar conectividad.", estado: "EN_CURSO", prioridad: "ALTA" },
  { nombre: "Plan de mentoría para nuevos docentes", descripcion: "Acompañar a los docentes ingresantes durante su primer semestre.", estado: "COMPLETADO", prioridad: "MEDIA" },
  { nombre: "Implementación de OKR institucionales", descripcion: "Definir y hacer seguimiento de OKR por departamento.", estado: "EN_CURSO", prioridad: "ALTA" },
];

function getManagerIdx(empIdx) {
  if (empIdx === 0) return null;
  const areaManager = { "Dirección": null, "Académica": 1, "Operaciones": 12, "RRHH": 21, "Tecnología": 29 };
  const coordinators = {
    "Académica": [2, 3], "Operaciones": [13, 14], "RRHH": [22, 23], "Tecnología": [30, 31],
  };
  const emp = DEMO_EMPLOYEES[empIdx];
  if ([1, 12, 21, 29].includes(empIdx)) return 0;
  if ([2, 3].includes(empIdx)) return 1;
  if ([13, 14].includes(empIdx)) return 12;
  if ([22, 23].includes(empIdx)) return 21;
  if ([30, 31].includes(empIdx)) return 29;
  const deptCoords = coordinators[emp.area] || [];
  return deptCoords.length > 0 ? deptCoords[empIdx % deptCoords.length] : (areaManager[emp.area] ?? null);
}

function randomScore(includeLow) {
  const pool = includeLow ? [1, 2, 3, 3, 4, 4, 4, 5, 5, 5] : [3, 3, 4, 4, 4, 5, 5, 5];
  return pool[Math.floor(Math.random() * pool.length)];
}

function randomDate(start, end) {
  const d = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return d.toISOString().split("T")[0];
}

// ──────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────

async function main() {
  const startTime = Date.now();
  console.log("=== Performia Pilot Seed ===\n");
  console.log(`API: ${API_URL}`);
  console.log(`Admin: ${ADMIN_EMAIL}`);
  if (DRY_RUN) console.log("Mode: DRY RUN (no changes)");
  if (RESET_PASSWORDS) console.log("Mode: RESET PASSWORDS (will update existing user passwords)");
  console.log();

  if (!process.env.CI && !process.env.SEED_CONFIRM && !DRY_RUN) {
    console.log("Set SEED_CONFIRM=1 to proceed, use --dry-run to preview, or use CI=1.");
    console.log("Example: SEED_CONFIRM=1 node scripts/seed-pilot.mjs");
    process.exit(1);
  }

  // 1. Login
  console.log("→ Logging in...");
  const auth = await api("POST", "/auth/login", { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  TOKEN = auth.token;
  console.log(`  OK: ${auth.user?.email || ADMIN_EMAIL}\n`);

  // 2. Fetch existing data
  console.log("→ Checking existing data...");
  const existingEmployees = await listAll("/employees");
  const existingUsers = await listAll("/users");
  const existingRoles = await listAll("/roles");
  const existingCompetencies = await listAll("/competencies");
  const existingCycles = await listAll("/evaluation-cycles");
  console.log(`  Employees: ${existingEmployees.length}, Users: ${existingUsers.length}, Roles: ${existingRoles.length}`);
  console.log(`  Competencies: ${existingCompetencies.length}, Cycles: ${existingCycles.length}\n`);

  const roleByCode = new Map();
  for (const role of existingRoles) {
    const code = String(role.code || role.nombre || "").trim().toUpperCase();
    roleByCode.set(code, role);
  }

  const employeeByEmail = new Map();
  for (const emp of existingEmployees) {
    employeeByEmail.set(String(emp.email || "").trim().toLowerCase(), emp);
  }

  // 3. Create demo employees (if missing)
  console.log("→ Creating demo employees...");
  const empIds = [];
  let empCreated = 0;
  if (DRY_RUN) {
    const missing = DEMO_EMPLOYEES.filter(e => !employeeByEmail.has(String(e.email || "").trim().toLowerCase()));
    console.log(`  Would create ${missing.length} employees (${existingEmployees.length} already exist)`);
    for (const e of DEMO_EMPLOYEES) empIds.push("dry-run-id");
  } else {
    for (let i = 0; i < DEMO_EMPLOYEES.length; i++) {
      const e = DEMO_EMPLOYEES[i];
      const existing = employeeByEmail.get(String(e.email || "").trim().toLowerCase());
      if (existing) {
        empIds.push(existing._id);
        continue;
      }
      const created = await apiSafe("POST", "/employees", {
        nombre: e.nombre, apellido: e.apellido, email: e.email,
        cargo: e.cargo, area: e.area, tipoEmpleado: e.tipoEmpleado, fechaIngreso: e.fechaIngreso,
      });
      if (created._error) {
        console.warn(`  ⚠ Employee ${e.nombre} ${e.apellido}: ${created._error}`);
        empIds.push(null);
      } else {
        empIds.push(created._id || created.employee?._id);
        empCreated++;
      }
    }
    console.log(`  Created ${empCreated} employees (${existingEmployees.length} pre-existing)\n`);

    // Set manager relationships
    console.log("→ Setting manager relationships...");
    let mgrSet = 0;
    for (let i = 0; i < empIds.length; i++) {
      const mgrIdx = getManagerIdx(i);
      if (mgrIdx !== null && empIds[i] && empIds[mgrIdx]) {
        const updated = await apiSafe("PUT", `/employees/${empIds[i]}`, {
          ...DEMO_EMPLOYEES[i],
          managerId: empIds[mgrIdx],
        });
        if (!updated._error) mgrSet++;
      }
    }
    console.log(`  Set ${mgrSet} manager relationships\n`);
  }

  // 4. Create pilot users
  console.log("→ Creating pilot users...");
  const userResults = [];
  if (DRY_RUN) {
    for (const pu of PILOT_USERS) {
      const exists = existingUsers.find(u => String(u.email || "").trim().toLowerCase() === pu.email);
      console.log(`  ${exists ? "EXISTS" : "WOULD CREATE"} ${pu.email} (${pu.roleCode})`);
      userResults.push({ ...pu, created: !exists });
    }
  } else {
    for (const pu of PILOT_USERS) {
      const exists = existingUsers.find(u => String(u.email || "").trim().toLowerCase() === pu.email);
      if (exists && !RESET_PASSWORDS) {
        console.log(`  EXISTS ${pu.email} (${pu.roleCode})`);
        userResults.push({ ...pu, created: false, id: exists._id });
        continue;
      }
      if (exists && RESET_PASSWORDS) {
        // Update password - we can't update via API easily, so skip for now
        console.log(`  EXISTS ${pu.email} - use --reset-passwords via backend`);
        userResults.push({ ...pu, created: false, id: exists._id });
        continue;
      }
      const role = roleByCode.get(pu.roleCode);
      if (!role) {
        console.warn(`  ⚠ Role ${pu.roleCode} not found, skipping ${pu.email}`);
        userResults.push({ ...pu, created: false, error: "role not found" });
        continue;
      }
      const created = await apiSafe("POST", "/users", {
        nombre: pu.nombre,
        email: pu.email,
        password: DEMO_PASSWORD,
        roleId: role._id,
        activo: true,
      });
      if (created._error) {
        if (created._error.includes("409") || created._error.includes("ya existe")) {
          console.log(`  EXISTS ${pu.email} (${pu.roleCode})`);
          userResults.push({ ...pu, created: false });
        } else {
          console.warn(`  ⚠ ${pu.email}: ${created._error}`);
          userResults.push({ ...pu, created: false, error: created._error });
        }
      } else {
        console.log(`  CREATED ${pu.email} (${pu.roleCode})`);
        userResults.push({ ...pu, created: true, id: created._id });
      }
    }
  }
  console.log(`  Pilot users: ${userResults.filter(u => u.created).length} created, ${userResults.filter(u => !u.created && !u.error).length} existing\n`);

  // 5. Create competencies (if missing)
  console.log("→ Creating competencies...");
  const metricIds = [];
  let compCreated = 0;
  const existingCompNames = new Set(existingCompetencies.map(c => String(c.competencia || c.nombre || "").trim().toLowerCase()));
  if (DRY_RUN) {
    const missing = DEMO_COMPETENCIES.filter(c => !existingCompNames.has(String(c.competencia).trim().toLowerCase()));
    console.log(`  Would create ${missing.length} competencies`);
  } else {
    for (const c of DEMO_COMPETENCIES) {
      if (existingCompNames.has(String(c.competencia).trim().toLowerCase())) {
        const found = existingCompetencies.find(x => String(x.competencia || x.nombre || "").trim().toLowerCase() === String(c.competencia).trim().toLowerCase());
        if (found) metricIds.push(found._id);
        continue;
      }
      const created = await apiSafe("POST", "/competencies", c);
      if (created._error) {
        console.warn(`  ⚠ Competency "${c.competencia}": ${created._error}`);
      } else {
        metricIds.push(created._id);
        compCreated++;
      }
    }
    console.log(`  Created ${compCreated} competencies\n`);
  }

  // 6. Create cycles (if missing)
  console.log("→ Creating cycles...");
  const cycleIds = [];
  let cycleCreated = 0;
  if (DRY_RUN) {
    console.log(`  Would create ${DEMO_CYCLES.length - existingCycles.length} cycles`);
  } else {
    for (const c of DEMO_CYCLES) {
      const exists = existingCycles.find(x => String(x.periodo || "") === c.periodo && Number(x.anio) === c.anio);
      if (exists) {
        cycleIds.push(exists._id);
        continue;
      }
      const created = await apiSafe("POST", "/evaluation-cycles", c);
      if (created._error) {
        console.warn(`  ⚠ Cycle "${c.periodo} ${c.anio}": ${created._error}`);
      } else {
        cycleIds.push(created._id);
        cycleCreated++;
      }
    }
    console.log(`  Created ${cycleCreated} cycles\n`);
  }

  // 7. Create evaluations
  if (!DRY_RUN && empIds.filter(Boolean).length > 0 && cycleIds.length > 0 && metricIds.length > 0) {
    console.log("→ Creating evaluations...");
    const evalStatuses = ["CERRADA", "CERRADA", "CERRADA", "APROBADA"];
    let evalsCreated = 0;
    for (let ci = 0; ci < cycleIds.length; ci++) {
      for (let ei = 0; ei < empIds.length; ei++) {
        if (!empIds[ei] || !cycleIds[ci]) continue;
        await sleep(30);
        const scores = metricIds.map(mid => ({ metricId: mid, nivel: ci === 0 ? randomScore(true) : randomScore() }));
        const rFinal = scores.reduce((a, s) => a + s.nivel, 0) / scores.length;
        const autoResult = await apiSafe("POST", "/evaluations", {
          employeeId: empIds[ei], cycleId: cycleIds[ci], tipo: "AUTOEVALUACION",
          scores, estado: evalStatuses[ci], resultadoFinal: rFinal,
        });
        if (!autoResult._error) evalsCreated++;
        const mgrIdx = getManagerIdx(ei);
        if (mgrIdx !== null && empIds[mgrIdx]) {
          const mgrScores = metricIds.map(mid => ({ metricId: mid, nivel: ci === 0 ? randomScore(true) : randomScore() }));
          const mgrFinal = mgrScores.reduce((a, s) => a + s.nivel, 0) / mgrScores.length;
          const mgrResult = await apiSafe("POST", "/evaluations", {
            employeeId: empIds[ei], cycleId: cycleIds[ci], tipo: "JEFATURA",
            scores: mgrScores, estado: evalStatuses[ci], resultadoFinal: mgrFinal,
          });
          if (!mgrResult._error) evalsCreated++;
        }
      }
      console.log(`  Cycle ${ci + 1}/${cycleIds.length}: evaluations complete`);
    }
    console.log(`  Total evaluations: ${evalsCreated}\n`);
  }

  // 8. Create development plans
  if (!DRY_RUN && empIds.filter(Boolean).length > 0) {
    console.log("→ Creating development plans...");
    const planEmpIndices = [1, 2, 5, 8, 13, 16, 22, 24, 30, 33];
    let plansCreated = 0;
    for (let i = 0; i < DEMO_PLANS.length; i++) {
      const empIdx = planEmpIndices[i];
      if (!empIds[empIdx]) continue;
      const result = await apiSafe("POST", "/development-plans", {
        nombre: DEMO_PLANS[i].nombre, descripcion: DEMO_PLANS[i].descripcion,
        estado: DEMO_PLANS[i].estado, prioridad: DEMO_PLANS[i].prioridad,
        empleadoId: empIds[empIdx],
        fechaInicio: randomDate(new Date("2025-07-01"), new Date("2026-04-01")),
        fechaFin: DEMO_PLANS[i].estado === "COMPLETADO" ? randomDate(new Date("2026-01-01"), new Date("2026-04-01")) : undefined,
      });
      if (!result._error) plansCreated++;
    }
    console.log(`  Created ${plansCreated} plans\n`);
  }

  // 9. Print credentials
  console.log("=== CREDENCIALES PILOTO ===\n");
  console.log(`Admin (SUPER_ADMIN existente):`);
  console.log(`  Email:    ${ADMIN_EMAIL}`);
  console.log(`  Password: ${ADMIN_PASSWORD}\n`);

  for (const u of PILOT_USERS) {
    const status = u.roleCode === "SUPER_ADMIN" ? "(mismo admin existente)" : userResults.find(r => r.email === u.email)?.created ? "(creado)" : "(ya existía)";
    console.log(`${u.roleCode}:`);
    console.log(`  Email:    ${u.email}`);
    console.log(`  Password: ${DEMO_PASSWORD}`);
    console.log(`  Estado:   ${status}\n`);
  }

  console.log(`Organización demo: ${auth.user?.companyName || "Horizonte Educativo"}`);
  console.log(`API URL: ${API_URL}\n`);

  console.log("Datos demo garantizados:");
  console.log(`  - Organización demo con tenant configurado`);
  console.log(`  - ${DRY_RUN ? "(simulado)" : empIds.filter(Boolean).length} empleados con jerarquía de managers`);
  console.log(`  - ${DRY_RUN ? "(simulado)" : metricIds.length} competencias configuradas`);
  console.log(`  - ${DRY_RUN ? "(simulado)" : cycleIds.length} ciclos de evaluación`);
  console.log(`  - Evaluaciones de tipo AUTOEVALUACION y JEFATURA`);
  console.log(`  - Planes de desarrollo`);
  console.log(`  - KPIs y OKRs (ejecutar seed-demo.mjs para datos completos)\n`);

  console.log("Cómo ejecutar:");
  console.log("  1. SEED_CONFIRM=1 node scripts/seed-pilot.mjs");
  console.log("  2. Login con cualquier credencial de arriba");
  console.log(`  3. Para datos completos (40 empleados): SEED_CONFIRM=1 node scripts/seed-demo.mjs`);
  console.log(`  4. Modo dry-run: node scripts/seed-pilot.mjs --dry-run\n`);

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log(`Duration: ${elapsed}s`);
}

main().catch((err) => {
  console.error("\nSeed failed:", err.message);
  process.exit(1);
});
