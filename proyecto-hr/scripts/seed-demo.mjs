#!/usr/bin/env node

// Performia Demo Seed Script
// Resets the tenant and creates a comprehensive demo dataset (~40 employees, 1 year of usage)
// Usage: node scripts/seed-demo.mjs

const API_URL = process.env.API_URL || "https://gested-1-backend.onrender.com";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@demo.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "123456";

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

const EMPLOYEES = [
  // Dirección
  { nombre: "Carlos", apellido: "Rodríguez", email: "carlos.rodriguez@horizonte.edu", cargo: "Director General", area: "Dirección", tipoEmpleado: "DIRECTIVO", fechaIngreso: "2022-01-15" },
  // Académica
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
  // Operaciones
  { nombre: "Gabriela", apellido: "Sánchez", email: "gabriela.sanchez@horizonte.edu", cargo: "Jefa de Operaciones", area: "Operaciones", tipoEmpleado: "DIRECTIVO", fechaIngreso: "2022-05-01" },
  { nombre: "Martín", apellido: "Álvarez", email: "martin.alvarez@horizonte.edu", cargo: "Coordinador de Logística", area: "Operaciones", tipoEmpleado: "DIRECTIVO", fechaIngreso: "2023-01-15" },
  { nombre: "Florencia", apellido: "Romero", email: "florencia.romero@horizonte.edu", cargo: "Coordinadora de Mantenimiento", area: "Operaciones", tipoEmpleado: "DIRECTIVO", fechaIngreso: "2023-02-01" },
  { nombre: "Lucas", apellido: "Fernández", email: "lucas.fernandez@horizonte.edu", cargo: "Asistente Operativo", area: "Operaciones", tipoEmpleado: "NO_DOCENTE", fechaIngreso: "2023-06-01" },
  { nombre: "Emilia", apellido: "Luna", email: "emilia.luna@horizonte.edu", cargo: "Asistente Operativa", area: "Operaciones", tipoEmpleado: "NO_DOCENTE", fechaIngreso: "2023-06-15" },
  { nombre: "Nicolás", apellido: "Ríos", email: "nicolas.rios@horizonte.edu", cargo: "Asistente de Logística", area: "Operaciones", tipoEmpleado: "NO_DOCENTE", fechaIngreso: "2023-07-01" },
  { nombre: "Julieta", apellido: "Paz", email: "julieta.paz@horizonte.edu", cargo: "Asistente de Mantenimiento", area: "Operaciones", tipoEmpleado: "NO_DOCENTE", fechaIngreso: "2024-01-15" },
  { nombre: "Agustín", apellido: "Vega", email: "agustin.vega@horizonte.edu", cargo: "Asistente Operativo", area: "Operaciones", tipoEmpleado: "NO_DOCENTE", fechaIngreso: "2024-02-01" },
  { nombre: "Victoria", apellido: "Castillo", email: "victoria.castillo@horizonte.edu", cargo: "Asistente Administrativa", area: "Operaciones", tipoEmpleado: "NO_DOCENTE", fechaIngreso: "2024-02-15" },
  // RRHH
  { nombre: "Pablo", apellido: "Herrera", email: "pablo.herrera@horizonte.edu", cargo: "Jefe de RRHH", area: "RRHH", tipoEmpleado: "DIRECTIVO", fechaIngreso: "2022-04-01" },
  { nombre: "Carolina", apellido: "Medina", email: "carolina.medina@horizonte.edu", cargo: "Coordinadora de Selección", area: "RRHH", tipoEmpleado: "RRHH", fechaIngreso: "2023-02-15" },
  { nombre: "Fernando", apellido: "Silva", email: "fernando.silva@horizonte.edu", cargo: "Coordinador de Desarrollo", area: "RRHH", tipoEmpleado: "RRHH", fechaIngreso: "2023-03-01" },
  { nombre: "Lucía", apellido: "Molina", email: "lucia.molina@horizonte.edu", cargo: "Analista de RRHH", area: "RRHH", tipoEmpleado: "RRHH", fechaIngreso: "2023-05-01" },
  { nombre: "Tomás", apellido: "Roldán", email: "tomas.roldan@horizonte.edu", cargo: "Analista de RRHH", area: "RRHH", tipoEmpleado: "RRHH", fechaIngreso: "2023-06-01" },
  { nombre: "Daniela", apellido: "Cáceres", email: "daniela.caceres@horizonte.edu", cargo: "Analista de RRHH", area: "RRHH", tipoEmpleado: "RRHH", fechaIngreso: "2024-01-01" },
  { nombre: "Esteban", apellido: "Pereyra", email: "esteban.pereyra@horizonte.edu", cargo: "Analista de RRHH", area: "RRHH", tipoEmpleado: "RRHH", fechaIngreso: "2024-02-01" },
  { nombre: "Rocío", apellido: "Giménez", email: "rocio.gimenez@horizonte.edu", cargo: "Analista de RRHH", area: "RRHH", tipoEmpleado: "RRHH", fechaIngreso: "2024-03-01" },
  // Tecnología
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

const COMPETENCIES = [
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

const CYCLES = [
  { periodo: "Q3", anio: 2025, etapa: "CIERRE", estado: "CERRADO", fechaInicio: "2025-07-01", fechaFin: "2025-09-30" },
  { periodo: "Q4", anio: 2025, etapa: "CIERRE", estado: "CERRADO", fechaInicio: "2025-10-01", fechaFin: "2025-12-31" },
  { periodo: "Q1", anio: 2026, etapa: "REVISION", estado: "CERRADO", fechaInicio: "2026-01-01", fechaFin: "2026-03-31" },
  { periodo: "Q2", anio: 2026, etapa: "SEGUIMIENTO", estado: "ACTIVO", fechaInicio: "2026-04-01", fechaFin: "2026-06-30" },
];

const PLANS = [
  { nombre: "Plan de liderazgo pedagógico", descripcion: "Desarrollar habilidades de liderazgo para coordinar el equipo docente y mejorar los indicadores academicos.", estado: "EN_CURSO", prioridad: "ALTA" },
  { nombre: "Formación en herramientas digitales", descripcion: "Capacitarse en nuevas plataformas educativas para integrar tecnologia en el aula.", estado: "EN_CURSO", prioridad: "MEDIA" },
  { nombre: "Plan de comunicación efectiva", descripcion: "Mejorar la comunicación con padres y colegas a través de talleres y retroalimentación.", estado: "PENDIENTE", prioridad: "ALTA" },
  { nombre: "Optimización de procesos operativos", descripcion: "Revisar y optimizar los procesos de logística y mantenimiento institucional.", estado: "EN_CURSO", prioridad: "ALTA" },
  { nombre: "Plan de bienestar laboral", descripcion: "Implementar acciones para mejorar el clima laboral y reducir el ausentismo.", estado: "PENDIENTE", prioridad: "MEDIA" },
  { nombre: "Formación en evaluación por competencias", descripcion: "Capacitarse en el diseño de instrumentos de evaluación por competencias.", estado: "COMPLETADO", prioridad: "MEDIA" },
  { nombre: "Plan de desarrollo de RRHH", descripcion: "Implementar un sistema de seguimiento de desempeño para todo el personal.", estado: "EN_CURSO", prioridad: "ALTA" },
  { nombre: "Actualización técnica en infraestructura TI", descripcion: "Actualizar los servidores y la red para mejorar la conectividad institucional.", estado: "EN_CURSO", prioridad: "ALTA" },
  { nombre: "Plan de mentoría para nuevos docentes", descripcion: "Acompañar a los docentes ingresantes durante su primer semestre.", estado: "COMPLETADO", prioridad: "MEDIA" },
  { nombre: "Implementación de OKR institucionales", descripcion: "Definir y hacer seguimiento de OKR por departamento para alinear objetivos.", estado: "EN_CURSO", prioridad: "ALTA" },
];

const KPIS = [
  { nombre: "% Satisfacción académica", descripcion: "Porcentaje de satisfacción de estudiantes con la calidad educativa.", unidad: "percent", meta: 88, frecuencia: "quarterly" },
  { nombre: "% Cumplimiento de cronograma", descripcion: "Porcentaje de actividades realizadas dentro del cronograma planificado.", unidad: "percent", meta: 92, frecuencia: "monthly" },
  { nombre: "% Retención de personal", descripcion: "Porcentaje de empleados que permanecen activos durante el período.", unidad: "percent", meta: 90, frecuencia: "quarterly" },
  { nombre: "Tiempo de respuesta TI (hs)", descripcion: "Tiempo promedio de respuesta a incidentes de soporte técnico.", unidad: "hours", meta: 24, frecuencia: "monthly" },
  { nombre: "% Evaluaciones completadas", descripcion: "Porcentaje de evaluaciones completadas vs. planificadas en el ciclo.", unidad: "percent", meta: 95, frecuencia: "quarterly" },
  { nombre: "Ausentismo promedio (%)", descripcion: "Porcentaje de ausencias no programadas sobre días hábiles.", unidad: "percent", meta: 5, frecuencia: "monthly" },
];

const OKRS = [
  { objetivo: "Mejorar la calidad educativa general", kr: "Alcanzar 85% de satisfacción en encuestas estudiantiles", quarter: "2025-Q3", meta: 85 },
  { objetivo: "Mejorar la calidad educativa general", kr: "Reducir brecha de rendimiento entre áreas a menos de 10%", quarter: "2025-Q3", meta: 10 },
  { objetivo: "Optimizar la gestión operativa", kr: "Reducir tiempos de respuesta a incidentes en 30%", quarter: "2025-Q3", meta: 30 },
  { objetivo: "Fortalecer el desarrollo del talento", kr: "Completar 100% de evaluaciones de desempeño del personal", quarter: "2025-Q4", meta: 100 },
  { objetivo: "Fortalecer el desarrollo del talento", kr: "Implementar plan de desarrollo para 80% del personal", quarter: "2025-Q4", meta: 80 },
  { objetivo: "Mejorar la calidad educativa general", kr: "Lograr 90% de participación en evaluaciones docentes", quarter: "2026-Q1", meta: 90 },
  { objetivo: "Optimizar la gestión operativa", kr: "Digitalizar 100% de procesos administrativos críticos", quarter: "2026-Q1", meta: 100 },
  { objetivo: "Mejorar la calidad educativa general", kr: "Aumentar a 90% la tasa de evaluación completa por ciclo", quarter: "2026-Q2", meta: 90 },
  { objetivo: "Fortalecer el desarrollo del talento", kr: "Reducir ausentismo a menos de 5%", quarter: "2026-Q2", meta: 5 },
  { objetivo: "Optimizar la gestión operativa", kr: "Mantener tiempo de respuesta TI bajo 24 horas", quarter: "2026-Q2", meta: 24 },
];

const ANNOUNCEMENTS = [
  { titulo: "Inicio del Ciclo de Evaluaciones Q3 2025", contenido: "Se da inicio al ciclo de evaluaciones del tercer trimestre. Todos los colaboradores deben completar su autoevaluación antes del 30 de septiembre.", tipo: "GENERAL", prioridad: "ALTA" },
  { titulo: "Capacitación en nuevas herramientas digitales", contenido: "Se abre la inscripción para el taller de herramientas digitales educativas. Cupos limitados.", tipo: "GENERAL", prioridad: "MEDIA" },
  { titulo: "Actualización del manual de procedimientos", contenido: "Se ha actualizado el manual de procedimientos operativos. Revisar la sección de protocolos de seguridad.", tipo: "GENERAL", prioridad: "BAJA" },
  { titulo: "Resultados del Ciclo Q4 2025", contenido: "Ya están disponibles los resultados consolidados del cuarto trimestre. Revisar el reporte ejecutivo para más detalles.", tipo: "GENERAL", prioridad: "ALTA" },
  { titulo: "Recordatorio: Evaluaciones Q1 2026", contenido: "Queda una semana para cerrar las evaluaciones del primer trimestre. Por favor completar las pendientes.", tipo: "GENERAL", prioridad: "ALTA" },
];

function getManagerId(empIdx) {
  // El Director (0) no tiene manager
  if (empIdx === 0) return null;

  const areas = {
    "Dirección": [], // no hay otros en Dirección
    "Académica": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], // indices 1-11
    "Operaciones": [12, 13, 14, 15, 16, 17, 18, 19, 20], // indices 12-20
    "RRHH": [21, 22, 23, 24, 25, 26, 27, 28], // indices 21-28
    "Tecnología": [29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39], // indices 29-39
  };
  const emp = EMPLOYEES[empIdx];

  // Department heads report to Director (0)
  if (empIdx === 1 || empIdx === 12 || empIdx === 21 || empIdx === 29) return 0;

  // Coordinators report to department heads
  if ([2, 3].includes(empIdx)) return 1; // Académica coordinators → María López
  if ([13, 14].includes(empIdx)) return 12; // Operaciones coordinators → Gabriela Sánchez
  if ([22, 23].includes(empIdx)) return 21; // RRHH coordinators → Pablo Herrera
  if ([30, 31].includes(empIdx)) return 29; // Tecnología coordinators → Alejandro Navarro

  // Regular employees report to their department coordinators or head
  const deptEmps = areas[emp.area] || [];
  const coordinators = {
    "Académica": [2, 3],
    "Operaciones": [13, 14],
    "RRHH": [22, 23],
    "Tecnología": [30, 31],
  };
  const deptCoords = coordinators[emp.area] || [];
  const deptHead = {
    "Académica": 1, "Operaciones": 12, "RRHH": 21, "Tecnología": 29,
  };
  if (deptCoords.length) {
    return deptCoords[empIdx % deptCoords.length];
  }
  return deptHead[emp.area] ?? null;
}

function randomScore(includeLow = false) {
  const pool = includeLow ? [1, 2, 3, 3, 4, 4, 4, 5, 5, 5] : [3, 3, 4, 4, 4, 5, 5, 5];
  return pool[Math.floor(Math.random() * pool.length)];
}

function randomDate(start, end) {
  const d = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return d.toISOString().split("T")[0];
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  const startTime = Date.now();
  console.log("=== Performia Demo Seed Script ===");
  console.log(`API: ${API_URL}`);
  console.log(`Admin: ${ADMIN_EMAIL}\n`);

  console.log("⚠  WARNING: This will DELETE ALL existing data and recreate it.");
  console.log("   Only superadmin will be preserved.");
  console.log(`   Target: ${API_URL}\n`);

  if (!process.env.CI && !process.env.SEED_CONFIRM) {
    console.log("   Set SEED_CONFIRM=1 to proceed, or use CI=1.");
    console.log("   Example: SEED_CONFIRM=1 node scripts/seed-demo.mjs");
    process.exit(1);
  }

  // 1. Login
  console.log("→ Logging in...");
  const auth = await api("POST", "/auth/login", { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  TOKEN = auth.token;
  console.log(`  OK: ${auth.user?.email || ADMIN_EMAIL}\n`);

  // 2. Clean existing data in reverse dependency order
  console.log("→ Cleaning existing data...");

  const delEvals = await listAll("/evaluations");
  for (const e of delEvals) {
    try { await api("DELETE", `/evaluations/${e._id}`); } catch { }
  }
  console.log(`  Deleted ${delEvals.length} evaluations`);

  const delPlans = await listAll("/development-plans");
  for (const p of delPlans) {
    try { await api("DELETE", `/development-plans/${p._id}`); } catch { }
  }
  console.log(`  Deleted ${delPlans.length} development plans`);

  const delCycles = await listAll("/evaluation-cycles");
  for (const c of delCycles) {
    try { await api("DELETE", `/evaluation-cycles/${c._id}`); } catch { }
  }
  console.log(`  Deleted ${delCycles.length} cycles`);

  const delCompetencies = await listAll("/competencies");
  for (const c of delCompetencies) {
    try { await api("DELETE", `/competencies/${c._id}`); } catch { }
  }
  console.log(`  Deleted ${delCompetencies.length} competencies`);

  // Note: metrics are created via competencies, no separate /metrics POST

  const delUsers = await listAll("/users");
  let deletedUsers = 0;
  for (const u of delUsers) {
    if (u.email === ADMIN_EMAIL) continue;
    try { await api("DELETE", `/users/${u._id}`); deletedUsers++; } catch { }
  }
  console.log(`  Deleted ${deletedUsers} users (kept superadmin)`);

  const delEmployees = await listAll("/employees");
  for (const e of delEmployees) {
    try { await api("DELETE", `/employees/${e._id}`); } catch { }
  }
  console.log(`  Deleted ${delEmployees.length} employees`);

  const delAnnouncements = await listAll("/announcements");
  for (const a of delAnnouncements) {
    try { await api("DELETE", `/announcements/${a._id}`); } catch { }
  }
  console.log(`  Deleted ${delAnnouncements.length} announcements\n`);

  // 3. Create competencies (used as evaluation metrics)
  console.log("→ Creating competencies...");
  const metricIds = [];
  for (const c of COMPETENCIES) {
    try {
      const created = await api("POST", "/competencies", c);
      metricIds.push(created._id);
    } catch (err) {
      console.warn(`  ⚠ Could not create competency "${c.competencia}": ${err.message}`);
    }
  }
  console.log(`  Created ${metricIds.length} competencies\n`);

  // 4. Create cycles
  console.log("→ Creating evaluation cycles...");
  const cycleIds = [];
  for (const c of CYCLES) {
    try {
      const created = await api("POST", "/evaluation-cycles", c);
      cycleIds.push(created._id);
    } catch (err) {
      console.warn(`  ⚠ Could not create cycle "${c.periodo} ${c.anio}": ${err.message}`);
    }
  }
  console.log(`  Created ${cycleIds.length} cycles\n`);

  // 5. Create employees
  console.log("→ Creating 40 employees...");
  const empIds = [];
  for (let i = 0; i < EMPLOYEES.length; i++) {
    const e = EMPLOYEES[i];
    const body = {
      nombre: e.nombre,
      apellido: e.apellido,
      email: e.email,
      cargo: e.cargo,
      area: e.area,
      tipoEmpleado: e.tipoEmpleado,
      fechaIngreso: e.fechaIngreso,
    };
    try {
      const created = await api("POST", "/employees", body);
      empIds.push(created._id || created.employee?._id);
    } catch (err) {
      console.warn(`  ⚠ Could not create employee ${e.nombre} ${e.apellido}: ${err.message}`);
      empIds.push(null);
    }
  }
  console.log(`  Created ${empIds.filter(Boolean).length} employees\n`);

  // Update employee manager relationships
  console.log("→ Setting manager relationships...");
  let managersSet = 0;
  for (let i = 0; i < empIds.length; i++) {
    const managerIdx = getManagerId(i);
    if (managerIdx !== null && empIds[i] && empIds[managerIdx]) {
      try {
        const e = EMPLOYEES[i];
        await api("PUT", `/employees/${empIds[i]}`, {
          nombre: e.nombre,
          apellido: e.apellido,
          email: e.email,
          cargo: e.cargo,
          area: e.area,
          tipoEmpleado: e.tipoEmpleado,
          fechaIngreso: e.fechaIngreso,
          managerId: empIds[managerIdx],
        });
        managersSet++;
      } catch { }
    }
  }
  console.log(`  Set ${managersSet} manager relationships\n`);

  // 6. Create evaluations for each employee in each cycle
  console.log("→ Creating evaluations...");
  const evalStatuses = ["CERRADA", "CERRADA", "CERRADA", "APROBADA"];
  let evalsCreated = 0;
  for (let ci = 0; ci < cycleIds.length; ci++) {
    for (let ei = 0; ei < empIds.length; ei++) {
      if (!empIds[ei] || !cycleIds[ci]) continue;

      await sleep(50);

      const scores = metricIds.map((mid) => ({
        metricId: mid,
        nivel: ci === 0 ? randomScore(true) : randomScore(),
      }));

      // Auto-evaluation
      try {
        await api("POST", "/evaluations", {
          employeeId: empIds[ei],
          cycleId: cycleIds[ci],
          tipo: "AUTOEVALUACION",
          scores,
          estado: evalStatuses[ci],
          resultadoFinal: scores.reduce((a, s) => a + s.nivel, 0) / scores.length,
        });
        evalsCreated++;
      } catch (err) {
        // May fail if employee has no user account - skip
      }

      // Manager evaluation (for employees who have a manager)
      const managerIdx = getManagerId(ei);
      if (managerIdx !== null && empIds[managerIdx]) {
        try {
          const managerScores = metricIds.map((mid) => ({
            metricId: mid,
            nivel: ci === 0 ? randomScore(true) : randomScore(),
          }));
          await api("POST", "/evaluations", {
            employeeId: empIds[ei],
            cycleId: cycleIds[ci],
            tipo: "JEFATURA",
            scores: managerScores,
            estado: evalStatuses[ci],
            resultadoFinal: managerScores.reduce((a, s) => a + s.nivel, 0) / managerScores.length,
          });
          evalsCreated++;
        } catch { }
      }
    }
    console.log(`  Cycle ${ci + 1}/${cycleIds.length}: evaluations created`);
  }
  console.log(`  Total evaluations: ${evalsCreated}\n`);

  // 7. Create development plans
  console.log("→ Creating development plans...");
  let plansCreated = 0;
  const planEmployees = [1, 2, 5, 8, 13, 16, 22, 24, 30, 33];
  for (let i = 0; i < PLANS.length; i++) {
    const p = PLANS[i];
    const empIdx = planEmployees[i];
    if (!empIds[empIdx]) continue;
    try {
      await api("POST", "/development-plans", {
        empleadoId: empIds[empIdx],
        nombre: p.nombre,
        descripcion: p.descripcion,
        estado: p.estado,
        prioridad: p.prioridad,
        fechaInicio: randomDate(new Date("2025-07-01"), new Date("2026-04-01")),
        fechaFin: p.estado === "COMPLETADO" ? randomDate(new Date("2026-01-01"), new Date("2026-04-01")) : undefined,
      });
      plansCreated++;
    } catch (err) {
      console.warn(`  ⚠ Could not create plan "${p.nombre}": ${err.message}`);
    }
  }
  console.log(`  Created ${plansCreated} development plans\n`);

  // 8. Create users
  console.log("→ Creating users...");
  const userRoles = [
    { empIdx: 0, roleName: "ORG_ADMIN" },
    { empIdx: 1, roleName: "MANAGER" },
    { empIdx: 2, roleName: "MANAGER" },
    { empIdx: 12, roleName: "MANAGER" },
    { empIdx: 13, roleName: "MANAGER" },
    { empIdx: 21, roleName: "HR" },
    { empIdx: 22, roleName: "MANAGER" },
    { empIdx: 29, roleName: "MANAGER" },
    { empIdx: 31, roleName: "MANAGER" },
    { empIdx: 5, roleName: "EMPLOYEE" },
    { empIdx: 8, roleName: "EMPLOYEE" },
    { empIdx: 15, roleName: "EMPLOYEE" },
    { empIdx: 18, roleName: "EMPLEADO" },
    { empIdx: 25, roleName: "EMPLEADO" },
    { empIdx: 34, roleName: "EMPLEADO" },
    { empIdx: 36, roleName: "EMPLEADO" },
    { empIdx: 10, roleName: "VIEWER" },
  ];

  let usersCreated = 0;
  const allRoles = await listAll("/roles");
  for (const ru of userRoles) {
    const empIdx = ru.empIdx;
    if (!empIds[empIdx]) continue;
    const emp = EMPLOYEES[empIdx];
    const role = allRoles.find(
      (r) => String(r.code || r.nombre || "").toUpperCase() === ru.roleName
    );
    if (!role) {
      console.warn(`  ⚠ Role "${ru.roleName}" not found, skipping ${emp.email}`);
      continue;
    }
    try {
      await api("POST", "/users", {
        nombre: `${emp.nombre} ${emp.apellido}`,
        email: emp.email,
        password: "Performia#2026!App",
        roleId: role._id,
        activo: true,
      });
      usersCreated++;
    } catch (err) {
      console.warn(`  ⚠ Could not create user ${emp.email}: ${err.message}`);
    }
  }
  console.log(`  Created ${usersCreated} users\n`);

  // 9. Create KPI records (best-effort, endpoint may vary)
  console.log("→ Creating KPI records...");
  let kpiRecordsCreated = 0;
  for (const kpi of KPIS) {
    for (let q = 0; q < 4; q++) {
      const variance = (Math.random() - 0.3) * 15;
      const valorActual = Math.round((kpi.meta + variance) * 10) / 10;
      try {
        await api("POST", "/metrics/kpi-records", {
          nombre: kpi.nombre,
          descripcion: kpi.descripcion,
          unidad: kpi.unidad,
          meta: kpi.meta,
          periodo: ["2025-Q3", "2025-Q4", "2026-Q1", "2026-Q2"][q],
          valorActual,
          frecuencia: kpi.frecuencia,
          activo: true,
        });
        kpiRecordsCreated++;
      } catch { }
    }
  }
  console.log(`  Created ${kpiRecordsCreated} KPI records\n`);

  // 10. Create OKR records
  console.log("→ Creating OKR records...");
  let okrRecordsCreated = 0;
  for (const okr of OKRS) {
    try {
      const progress = Math.round((50 + Math.random() * 45) * 10) / 10;
      await api("POST", "/metrics/okr-records", {
        titulo: okr.objetivo,
        kr: okr.kr,
        quarter: okr.quarter,
        meta: okr.meta,
        progreso: progress,
        estado: progress >= okr.meta ? "CUMPLIDO" : progress >= 70 ? "EN_CURSO" : "EN_PROGRESO",
      });
      okrRecordsCreated++;
    } catch (err) {
      console.warn(`  ⚠ Could not create OKR "${okr.kr}": ${err.message}`);
    }
  }
  console.log(`  Created ${okrRecordsCreated} OKR records\n`);

  // 11. Create announcements
  console.log("→ Creating announcements...");
  let annCreated = 0;
  for (const a of ANNOUNCEMENTS) {
    try {
      await api("POST", "/announcements", {
        titulo: a.titulo,
        contenido: a.contenido,
        tipo: a.tipo,
        prioridad: a.prioridad,
        activo: true,
      });
      annCreated++;
    } catch (err) {
      console.warn(`  ⚠ Could not create announcement "${a.titulo}": ${err.message}`);
    }
  }
  console.log(`  Created ${annCreated} announcements\n`);

  // Summary
  console.log("=== Seed Complete ===");
  console.log(`  Employees: ${empIds.filter(Boolean).length}`);
  console.log(`  Metrics/Competencies: ${metricIds.length}`);
  console.log(`  Cycles: ${cycleIds.length}`);
  console.log(`  Evaluations: ${evalsCreated}`);
  console.log(`  Development Plans: ${plansCreated}`);
  console.log(`  Users: ${usersCreated}`);
  console.log(`  KPI Records: ${kpiRecordsCreated}`);
  console.log(`  OKR Records: ${okrRecordsCreated}`);
  console.log(`  Announcements: ${annCreated}`);
  console.log(`  Demo users password: Performia#2026!App`);
  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log(`  Duration: ${elapsed}s`);
  console.log(`\nNext steps:`);
  console.log(`  1. Deploy the frontend or use the existing deploy`);
  console.log(`  2. Login as admin@demo.com / 123456`);
  console.log(`  3. Or login as any seeded user (e.g. carlos.rodriguez@horizonte.edu) with password Performia#2026!App`);
}

main().catch((err) => {
  console.error("\nSeed failed:", err.message);
  process.exit(1);
});
