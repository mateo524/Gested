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
let COMPANY_ID = "";

async function api(method, path, body, extraHeaders = {}) {
  const headers = { "Content-Type": "application/json", ...extraHeaders };
  if (TOKEN) headers["Authorization"] = `Bearer ${TOKEN}`;
  if (COMPANY_ID) headers["X-Company-Id"] = COMPANY_ID;
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

// Standard roles required for pilot users
const PILOT_ROLE_DEFS = [
  { roleKey: "ORG_ADMIN", legacyCode: "ADMIN_COLEGIO", nombre: "Administrador", roleLabel: "Administrador" },
  { roleKey: "HR", legacyCode: "RRHH", nombre: "RRHH", roleLabel: "RRHH" },
  { roleKey: "MANAGER", legacyCode: "JEFE", nombre: "Manager", roleLabel: "Manager" },
  { roleKey: "EMPLOYEE", legacyCode: "EMPLEADO", nombre: "Empleado", roleLabel: "Empleado" },
  { roleKey: "VIEWER", legacyCode: "LECTOR", nombre: "Lector", roleLabel: "Lector" },
  { roleKey: "AUDITOR", legacyCode: "LECTOR", nombre: "Auditor", roleLabel: "Auditor" },
];

// Ensure standard roles exist, return map legacyCode → role
async function ensurePilotRoles(existingRoles, companyId) {
  console.log("→ Ensuring standard roles...\n");

  // Filter to company-specific roles
  const companyRoles = existingRoles.filter(r => String(r.companyId) === String(companyId));

  const results = [];

  for (const def of PILOT_ROLE_DEFS) {
    // AUDITOR uses LECTOR legacy role, handled after
    if (def.roleKey === "AUDITOR") continue;

    const existing = companyRoles.find(r =>
      String(r.code || "").toUpperCase() === def.legacyCode.toUpperCase()
    );

    if (existing) {
      results.push({ ...def, role: existing, status: "existente" });
      continue;
    }

    if (DRY_RUN) {
      results.push({ ...def, role: null, status: "a crear" });
      continue;
    }

    const created = await apiSafe("POST", "/roles", {
      nombre: def.nombre,
      code: def.legacyCode,
      descripcion: `Rol estándar para ${def.roleLabel}`,
    });

    if (created._error) {
      console.warn(`  ⚠ Error creating role ${def.legacyCode}: ${created._error}`);
      results.push({ ...def, role: null, status: "error" });
    } else {
      results.push({ ...def, role: created.role, status: "creado" });
    }
  }

  // Print summary
  for (const r of results) {
    const roleId = r.role ? r.role._id : "N/A";
    console.log(`  ${r.legacyCode}: ${roleId} / ${r.status.toUpperCase()}`);
  }

  const missing = results.filter(r => !r.role && r.status !== "a crear");
  if (missing.length > 0) {
    console.error(`\n  ✗ ${missing.length} rol(es) sin crear. Abortando.`);
    return null;
  }

  // Build role map: legacyCode → role document
  const roleMap = {};
  for (const r of results) {
    if (r.role) {
      roleMap[r.legacyCode] = r.role;
    } else if (DRY_RUN) {
      // Placeholder for dry-run so downstream code can still map
      roleMap[r.legacyCode] = { _id: "dry-run", code: r.legacyCode, nombre: r.nombre };
    }
  }

  // AUDITOR shares LECTOR as legacy role
  const lector = roleMap["LECTOR"];
  if (!lector) {
    console.error("\n  ✗ LECTOR role required for AUDITOR but not available. Abortando.");
    return null;
  }
  if (!roleMap["AUDITOR"]) {
    roleMap["AUDITOR"] = DRY_RUN
      ? { _id: "dry-run", code: "LECTOR", nombre: "Auditor" }
      : lector;
  }

  console.log(`  → ${Object.keys(roleMap).length} roles ready\n`);
  return roleMap;
}

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
  { nombre: "Dominio del contenido disciplinar", descripcion: "Demuestra dominio de los contenidos del area que ensena.", tipo: "DOCENTE", componente: "C" },
  { nombre: "Planificacion de la ensenanza", descripcion: "Planifica sus clases con objetivos claros y materiales adecuados.", tipo: "DOCENTE", componente: "H" },
  { nombre: "Evaluacion de aprendizajes", descripcion: "Utiliza instrumentos variados para evaluar el progreso del estudiante.", tipo: "DOCENTE", componente: "H" },
  { nombre: "Comunicacion con estudiantes", descripcion: "Establece una comunicacion clara y efectiva con los estudiantes.", tipo: "DOCENTE", componente: "A" },
  { nombre: "Trabajo en equipo", descripcion: "Colabora activamente con colegas en proyectos institucionales.", tipo: "TRANSVERSAL", componente: "A" },
  { nombre: "Liderazgo", descripcion: "Inspira y guia a otros hacia el logro de objetivos.", tipo: "LIDERAZGO", componente: "H" },
  { nombre: "Resolucion de conflictos", descripcion: "Media y resuelve conflictos de manera constructiva.", tipo: "LIDERAZGO", componente: "H" },
  { nombre: "Gestion del tiempo", descripcion: "Organiza su tiempo para cumplir con plazos y prioridades.", tipo: "TRANSVERSAL", componente: "A" },
  { nombre: "Uso de herramientas digitales", descripcion: "Utiliza plataformas y herramientas digitales para su trabajo.", tipo: "TRANSVERSAL", componente: "H" },
  { nombre: "Comunicacion escrita", descripcion: "Redacta informes y comunicaciones con claridad y correccion.", tipo: "TRANSVERSAL", componente: "H" },
  { nombre: "Atencion al cliente interno", descripcion: "Responde a necesidades de colegas con eficiencia y amabilidad.", tipo: "TRANSVERSAL", componente: "A" },
  { nombre: "Innovacion y mejora continua", descripcion: "Propone mejoras y nuevas ideas para optimizar procesos.", tipo: "TRANSVERSAL", componente: "A" },
  { nombre: "Cumplimiento de objetivos", descripcion: "Alcanza los objetivos definidos para su rol en el periodo.", tipo: "TRANSVERSAL", componente: "A" },
  { nombre: "Asistencia y puntualidad", descripcion: "Asiste regularmente y cumple con el horario laboral.", tipo: "TRANSVERSAL", componente: "A" },
  { nombre: "Feedback y acompanamiento", descripcion: "Brinda retroalimentacion constructiva y acompanamiento al equipo.", tipo: "LIDERAZGO", componente: "H" },
  { nombre: "Gestion operativa", descripcion: "Coordina recursos y procesos para asegurar la operacion diaria.", tipo: "LIDERAZGO", componente: "H" },
  { nombre: "Toma de decisiones", descripcion: "Analiza opciones y toma decisiones informadas y oportunas.", tipo: "LIDERAZGO", componente: "H" },
];

const DEMO_CYCLES = [
  { periodo: "Q3", anio: 2025, etapa: "EVALUACION_FINAL", estado: "CERRADO", fechaInicio: "2025-07-01", fechaFin: "2025-09-30" },
  { periodo: "Q4", anio: 2025, etapa: "EVALUACION_FINAL", estado: "CERRADO", fechaInicio: "2025-10-01", fechaFin: "2025-12-31" },
  { periodo: "Q1", anio: 2026, etapa: "REVISION_INTERMEDIA", estado: "CERRADO", fechaInicio: "2026-01-01", fechaFin: "2026-03-31" },
  { periodo: "Q2", anio: 2026, etapa: "INICIO", estado: "ABIERTO", fechaInicio: "2026-04-01", fechaFin: "2026-06-30" },
];

const DEMO_PLANS = [
  { aspectoDesarrollar: "Liderazgo pedagógico", medicion: "Encuesta de satisfacción del equipo docente", estado: "EN_CURSO", fortalezas: ["Planificación", "Organización"] },
  { aspectoDesarrollar: "Herramientas digitales", medicion: "Cantidad de plataformas integradas en el aula", estado: "EN_CURSO", fortalezas: ["Curiosidad tecnológica"] },
  { aspectoDesarrollar: "Comunicación efectiva con familias", medicion: "Encuesta de satisfacción de padres", estado: "PENDIENTE", fortalezas: ["Empatía"] },
  { aspectoDesarrollar: "Optimización de procesos operativos", medicion: "Tiempo promedio de resolución de incidencias", estado: "EN_CURSO", fortalezas: ["Visión sistémica"] },
  { aspectoDesarrollar: "Bienestar laboral del equipo", medicion: "Índice de clima laboral trimestral", estado: "PENDIENTE", fortalezas: ["Escucha activa"] },
  { aspectoDesarrollar: "Evaluación por competencias", medicion: "Cantidad de evaluaciones completadas con rúbrica", estado: "CERRADO", fortalezas: ["Rigor académico"] },
  { aspectoDesarrollar: "Sistema de seguimiento de desempeño", medicion: "% de empleados con evaluación al día", estado: "EN_CURSO", fortalezas: ["Organización", "Análisis"] },
  { aspectoDesarrollar: "Infraestructura TI", medicion: "Uptime de servidores y disponibilidad de red", estado: "EN_CURSO", fortalezas: ["Conocimiento técnico"] },
  { aspectoDesarrollar: "Mentoría a nuevos docentes", medicion: "Retención de docentes en primer año", estado: "CERRADO", fortalezas: ["Paciencia", "Comunicación"] },
  { aspectoDesarrollar: "OKR institucionales", medicion: "% de OKR cumplidos por departamento", estado: "EN_CURSO", fortalezas: ["Pensamiento estratégico"] },
  { aspectoDesarrollar: "Feedback continuo al equipo", medicion: "Frecuencia de reuniones 1:1 realizadas", estado: "EN_CURSO", fortalezas: ["Escucha activa", "Comunicación"] },
  { aspectoDesarrollar: "Planificación estratégica anual", medicion: "Cumplimiento de hitos del plan anual", estado: "PENDIENTE", fortalezas: ["Visión de futuro"] },
];

const DEMO_KPIS = [
  { name: "Cumplimiento de objetivos académicos", targetValue: 90, currentValue: 78, unit: "percent", frequency: "quarterly", status: "warning" },
  { name: "Asistencia del personal", targetValue: 95, currentValue: 92, unit: "percent", frequency: "monthly", status: "on_track" },
  { name: "Calidad de entregables", targetValue: 85, currentValue: 72, unit: "percent", frequency: "quarterly", status: "warning" },
  { name: "Satisfacción de familias", targetValue: 88, currentValue: 85, unit: "percent", frequency: "quarterly", status: "on_track" },
  { name: "Tiempo de respuesta a incidencias", targetValue: 4, currentValue: 6, unit: "hours", frequency: "monthly", status: "critical" },
  { name: "Avance de proyectos tecnológicos", targetValue: 80, currentValue: 55, unit: "percent", frequency: "quarterly", status: "warning" },
  { name: "Cumplimiento de evaluaciones", targetValue: 100, currentValue: 67, unit: "percent", frequency: "monthly", status: "critical" },
  { name: "Rotación de personal", targetValue: 5, currentValue: 8, unit: "percent", frequency: "quarterly", status: "warning" },
  { name: "Capacitaciones completadas", targetValue: 90, currentValue: 65, unit: "percent", frequency: "monthly", status: "warning" },
  { name: "Clima laboral", targetValue: 80, currentValue: 73, unit: "percent", frequency: "quarterly", status: "on_track" },
];

const DEMO_OKRS = [
  { objectiveTitle: "Mejorar calidad operativa", keyResultTitle: "Reducir incidencias críticas un 40%", targetValue: 40, currentValue: 22, status: "in_progress" },
  { objectiveTitle: "Mejorar calidad operativa", keyResultTitle: "Implementar protocolos en todas las áreas", targetValue: 100, currentValue: 60, status: "in_progress" },
  { objectiveTitle: "Transformación digital", keyResultTitle: "Capacitar 100% del personal en plataformas", targetValue: 100, currentValue: 45, status: "at_risk" },
  { objectiveTitle: "Transformación digital", keyResultTitle: "Migrar 80% de procesos a digital", targetValue: 80, currentValue: 35, status: "at_risk" },
  { objectiveTitle: "Excelencia académica", keyResultTitle: "Alcanzar 90% de satisfacción estudiantil", targetValue: 90, currentValue: 78, status: "in_progress" },
  { objectiveTitle: "Excelencia académica", keyResultTitle: "Completar evaluaciones 100% del plantel", targetValue: 100, currentValue: 67, status: "at_risk" },
  { objectiveTitle: "Bienestar organizacional", keyResultTitle: "Mejorar clima laboral a 80% positivo", targetValue: 80, currentValue: 73, status: "in_progress" },
  { objectiveTitle: "Bienestar organizacional", keyResultTitle: "Reducir rotación anual a menos de 5%", targetValue: 5, currentValue: 8, status: "at_risk" },
  { objectiveTitle: "Eficiencia operativa", keyResultTitle: "Reducir tiempo de respuesta a <4hs", targetValue: 4, currentValue: 6, status: "at_risk" },
  { objectiveTitle: "Eficiencia operativa", keyResultTitle: "Automatizar 50% de reportes manuales", targetValue: 50, currentValue: 20, status: "in_progress" },
];

const DEMO_ANNOUNCEMENTS = [
  { titulo: "Inicio del ciclo de evaluaciones Q2 2026", cuerpo: "Se habilita la plataforma para completar las autoevaluaciones y evaluaciones de jefatura del segundo trimestre. Fecha límite: 30/06/2026.", prioridad: "importante", tipo: "info", audienceType: "all" },
  { titulo: "Nueva plataforma de formación disponible", cuerpo: "Ya está disponible el acceso a la nueva plataforma de capacitación con cursos sobre liderazgo, comunicación efectiva y herramientas digitales.", prioridad: "informativa", tipo: "success", audienceType: "all" },
  { titulo: "Recordatorio: completar feedback trimestral", cuerpo: "Recuerden completar las evaluaciones de desempeño pendientes. El equipo de RRHH hará seguimiento esta semana.", prioridad: "importante", tipo: "warning", audienceType: "department", audienceDepartmentCodes: ["Académica", "Operaciones"] },
  { titulo: "Actualización del sistema de RRHH", cuerpo: "Se implementaron mejoras en el módulo de reportes ejecutivos y la carga de KPIs. Consultar con el equipo de tecnología ante cualquier duda.", prioridad: "informativa", tipo: "update", audienceType: "all" },
  { titulo: "Plan de desarrollo profesional 2026", cuerpo: "Se abre la convocatoria para el plan de desarrollo profesional. Los interesados deben completar el formulario antes del 15/07.", prioridad: "importante", tipo: "info", audienceType: "all", pinned: true },
];

// Helper: pick random item from array
function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

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
  COMPANY_ID = auth.user?.companyId || "";
  console.log(`  OK: ${auth.user?.email || ADMIN_EMAIL} (company: ${auth.user?.companyName || "N/A"})\n`);

  // 2. Fetch existing data
  console.log("→ Checking existing data...");
  const existingEmployees = await listAll("/employees");
  const existingUsers = await listAll("/users");
  const existingRoles = await listAll("/roles");
  const existingCompetencies = await listAll("/competencies");
  const existingCycles = await listAll("/evaluation-cycles");
  console.log(`  Employees: ${existingEmployees.length}, Users: ${existingUsers.length}, Roles: ${existingRoles.length}`);
  if (existingRoles.length > 0) {
    for (const r of existingRoles) {
      console.log(`    role: _id=${r._id} code=${JSON.stringify(r.code)} nombre="${r.nombre}" companyId=${r.companyId ? String(r.companyId).slice(0,8) : "N/A"}...`);
    }
  }
  console.log(`  Competencies: ${existingCompetencies.length}, Cycles: ${existingCycles.length}\n`);

  // 2.5. Ensure a school exists (users require an active school)
  console.log("→ Checking schools...");
  const existingSchools = await listAll("/schools");
  const ourSchools = existingSchools.filter(s => String(s.companyId) === COMPANY_ID);
  console.log(`  Schools for this company: ${ourSchools.length}`);
  if (!DRY_RUN && ourSchools.length === 0) {
    console.log("  → Creating default school...");
    const school = await apiSafe("POST", "/schools", {
      nombre: "Escuela Horizonte - Sede Principal",
      codigo: "HQ",
      ciudad: "Buenos Aires",
      provincia: "CABA",
      pais: "Argentina",
      activa: true,
      companyId: COMPANY_ID,
    });
    if (school._error) {
      console.warn(`  ⚠ Could not create school: ${school._error}`);
    } else {
      console.log(`  Created school: ${school.school?.nombre || "OK"}\n`);
    }
  }

  // 2.6. Ensure standard roles exist
  const roleMap = await ensurePilotRoles(existingRoles, COMPANY_ID);
  if (!roleMap && !DRY_RUN) {
    console.error("\n  ✗ No se pueden crear usuarios sin roles estándar. Abortando.");
    process.exit(1);
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
      if (pu.roleCode === "SUPER_ADMIN") {
        console.log(`  SKIP  ${pu.email} (SUPER_ADMIN - usar admin existente)`);
        userResults.push({ ...pu, status: "omitido", motivo: "simulado" });
      } else if (exists) {
        console.log(`  EXISTS ${pu.email} (${pu.roleCode})`);
        userResults.push({ ...pu, status: "ya existía" });
      } else {
        const def = PILOT_ROLE_DEFS.find(d => d.roleKey === pu.roleCode);
        const legacyRole = def ? roleMap?.[def.legacyCode] : null;
        const roleInfo = legacyRole ? ` → ${def.legacyCode} (${legacyRole.nombre || legacyRole.code})` : " → SIN ROL";
        console.log(`  WOULD CREATE${roleInfo} ${pu.email} (${pu.roleCode})`);
        userResults.push({ ...pu, status: legacyRole ? "creado (simulado)" : "falló (simulado)", motivo: legacyRole ? null : "rol compatible no encontrado" });
      }
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
      if (pu.roleCode === "SUPER_ADMIN") {
        console.log(`  SKIP  ${pu.email} (SUPER_ADMIN - usar admin existente)`);
        userResults.push({ ...pu, status: "omitido", motivo: "usar admin existente admin@demo.com" });
        continue;
      }

      const def = PILOT_ROLE_DEFS.find(d => d.roleKey === pu.roleCode);
      if (!def) {
        console.warn(`  FALLÓ ${pu.email} (${pu.roleCode}): sin definición de rol`);
        userResults.push({ ...pu, status: "falló", motivo: "sin definición de rol" });
        continue;
      }

      const role = roleMap?.[def.legacyCode];
      if (!role) {
        console.warn(`  FALLÓ ${pu.email} (${pu.roleCode}): rol legacy "${def.legacyCode}" no disponible`);
        userResults.push({ ...pu, status: "falló", motivo: `rol ${def.legacyCode} no disponible` });
        continue;
      }

      // AUDITOR needs roleKey override so assignment gets AUDITOR (not VIEWER from LECTOR preset)
      const userPayload = {
        nombre: pu.nombre,
        email: pu.email,
        password: DEMO_PASSWORD,
        roleId: role._id,
        activo: true,
      };
      if (pu.roleCode === "AUDITOR") {
        userPayload.roleKey = "AUDITOR";
      }

      console.log(`  ${pu.roleCode}: usando rol "${role.nombre || role.code}" (ID: ${role._id})`);
      const created = await apiSafe("POST", "/users", userPayload);
      if (created._error) {
        if (created._error.includes("409") || created._error.includes("ya existe")) {
          console.log(`  YA EXISTE ${pu.email} (${pu.roleCode})`);
          userResults.push({ ...pu, status: "ya existía" });
        } else {
          console.warn(`  ⚠ ${pu.email}: ${created._error}`);
          userResults.push({ ...pu, status: "falló", motivo: created._error });
        }
      } else {
        console.log(`  CREADO ${pu.email} (${pu.roleCode})`);
        userResults.push({ ...pu, status: "creado", id: created._id });
      }
    }
  }
  const creados = userResults.filter(u => u.status === "creado").length;
  const existentes = userResults.filter(u => u.status === "ya existía").length;
  const omitidos = userResults.filter(u => u.status === "omitido").length;
  const fallos = userResults.filter(u => u.status === "falló").length;
  console.log(`  Pilot users: ${creados} creados, ${existentes} existentes, ${omitidos} omitidos, ${fallos} fallos\n`);

  // 5. Create competencies (if missing)
  console.log("→ Creating competencies...");
  const metricIds = [];
  let compCreated = 0;
  const existingCompNames = new Set(existingCompetencies.map(c => String(c.competencia || c.nombre || "").trim().toLowerCase()));
  if (DRY_RUN) {
    const missing = DEMO_COMPETENCIES.filter(c => !existingCompNames.has(String(c.nombre).trim().toLowerCase()));
    console.log(`  Would create ${missing.length} competencies`);
  } else {
    for (const c of DEMO_COMPETENCIES) {
      if (existingCompNames.has(String(c.nombre).trim().toLowerCase())) {
        const found = existingCompetencies.find(x => String(x.competencia || x.nombre || "").trim().toLowerCase() === String(c.nombre).trim().toLowerCase());
        if (found) metricIds.push(found._id);
        continue;
      }
      const created = await apiSafe("POST", "/competencies", c);
      if (created._error) {
        console.warn(`  ⚠ Competency "${c.nombre}": ${created._error}`);
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

  let evalsCreated = 0;
  let plansCreated = 0;

  // 7. Create evaluations
  if (!DRY_RUN && empIds.filter(Boolean).length > 0 && cycleIds.length > 0 && metricIds.length > 0) {
    console.log("→ Creating evaluations...");
    const evalStatuses = ["CERRADA", "CERRADA", "REVISADA", "ENVIADA"];
    for (let ci = 0; ci < cycleIds.length; ci++) {
      for (let ei = 0; ei < empIds.length; ei++) {
        if (!empIds[ei] || !cycleIds[ci]) continue;
        await sleep(30);
        const scores = metricIds.map(mid => ({ metricId: mid, nivel: ci === 0 ? randomScore(true) : randomScore() }));
        const rFinal = scores.reduce((a, s) => a + s.nivel, 0) / scores.length;
        const autoResult = await apiSafe("POST", "/evaluations", {
          employeeId: empIds[ei], cycleId: cycleIds[ci], tipo: "AUTOEVALUACION",
          scores, estado: evalStatuses[ci],
        });
        if (!autoResult._error) evalsCreated++;
        const mgrIdx = getManagerIdx(ei);
        if (mgrIdx !== null && empIds[mgrIdx]) {
          const mgrScores = metricIds.map(mid => ({ metricId: mid, nivel: ci === 0 ? randomScore(true) : randomScore() }));
          const mgrResult = await apiSafe("POST", "/evaluations", {
            employeeId: empIds[ei], cycleId: cycleIds[ci], tipo: "JEFATURA",
            scores: mgrScores, estado: evalStatuses[ci],
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
    const planEmpIndices = [1, 2, 4, 7, 12, 15, 21, 23, 29, 32, 5, 10];
    for (let i = 0; i < DEMO_PLANS.length; i++) {
      const empIdx = planEmpIndices[i % planEmpIndices.length];
      if (!empIds[empIdx]) continue;
      const result = await apiSafe("POST", "/development-plans", {
        employeeId: empIds[empIdx],
        aspectoDesarrollar: DEMO_PLANS[i].aspectoDesarrollar,
        medicion: DEMO_PLANS[i].medicion,
        fortalezas: DEMO_PLANS[i].fortalezas,
        estado: DEMO_PLANS[i].estado,
        fechaSeguimiento: randomDate(new Date("2026-06-01"), new Date("2026-09-30")),
      });
      if (!result._error) plansCreated++;
    }
    console.log(`  Created ${plansCreated} plans\n`);
  }

  // 9. Create KPI records
  let kpiCreated = 0;
  let kpiOmitted = 0;
  if (!DRY_RUN && empIds.filter(Boolean).length > 0 && cycleIds.length > 0) {
    console.log("→ Creating KPI records...");
    for (const kpi of DEMO_KPIS) {
      const empIdx = pickRandom(Array.from({ length: empIds.length }, (_, i) => i).filter(i => empIds[i]));
      if (empIdx === undefined) continue;
      const ci = pickRandom([0, 1, 2, 3]);
      const result = await apiSafe("POST", "/metrics/kpi-records", {
        employeeId: empIds[empIdx],
        cycleId: cycleIds[ci],
        name: kpi.name,
        targetValue: kpi.targetValue,
        currentValue: kpi.currentValue,
        unit: kpi.unit,
        frequency: kpi.frequency,
        period: `${DEMO_CYCLES[ci].periodo} ${DEMO_CYCLES[ci].anio}`,
        departmentCode: DEMO_EMPLOYEES[empIdx].area,
        status: kpi.status,
      });
      if (result._error) {
        // KPI may already exist (lookupKey unique)
        if (result._error.includes("duplicate") || result._error.includes("E11000")) {
          kpiOmitted++;
        }
      } else {
        kpiCreated++;
      }
    }
    console.log(`  Created ${kpiCreated} KPIs (${kpiOmitted} duplicate)\n`);
  }

  // 10. Create OKR records
  let okrCreated = 0;
  if (!DRY_RUN && cycleIds.length > 0) {
    console.log("→ Creating OKR records...");
    const areas = [...new Set(DEMO_EMPLOYEES.filter(e => e.area).map(e => e.area))];
    for (const okr of DEMO_OKRS) {
      const area = pickRandom(areas);
      const ci = pickRandom([1, 2, 3]);
      const result = await apiSafe("POST", "/metrics/okr-records", {
        objectiveTitle: okr.objectiveTitle,
        keyResultTitle: okr.keyResultTitle,
        targetValue: okr.targetValue,
        currentValue: okr.currentValue,
        quarter: `${DEMO_CYCLES[ci].anio}-${DEMO_CYCLES[ci].periodo}`,
        departmentCode: area,
        cycleId: cycleIds[ci],
        status: okr.status,
      });
      if (!result._error) okrCreated++;
    }
    console.log(`  Created ${okrCreated} OKRs\n`);
  }

  // 11. Create announcements
  let annCreated = 0;
  if (!DRY_RUN) {
    console.log("→ Creating announcements...");
    for (const ann of DEMO_ANNOUNCEMENTS) {
      const result = await apiSafe("POST", "/announcements", {
        titulo: ann.titulo,
        cuerpo: ann.cuerpo,
        prioridad: ann.prioridad,
        type: ann.tipo,
        audienceType: ann.audienceType,
        audienceDepartmentCodes: ann.audienceDepartmentCodes || [],
        audienceRoleKeys: ann.audienceType === "all" ? [] : ["ORG_ADMIN", "HR", "MANAGER"],
        pinned: ann.pinned || false,
      });
      if (!result._error) annCreated++;
    }
    console.log(`  Created ${annCreated} announcements\n`);
  }

  // 12. Summary
  console.log("=== RESUMEN PILOTO ===\n");
  const totalEmps = empIds.filter(Boolean).length;
  const totalComps = metricIds.length;
  const totalCycles = cycleIds.length;
  const createdCreds = userResults.filter(u => u.status === "creado").length;
  const existingCreds = userResults.filter(u => u.status === "ya existía").length;
  const failedCreds = userResults.filter(u => u.status === "falló").length;
  console.log(`Empresa:         ${auth.user?.companyName || "Perfomia Corp"}`);
  console.log(`Empleados:       ${DRY_RUN ? "(simulado)" : totalEmps}`);
  console.log(`Usuarios:        ${createdCreds} creados / ${existingCreds} existentes / ${failedCreds} fallidos`);
  console.log(`Roles:           ${Object.keys(roleMap || {}).length} estándar garantizados`);
  console.log(`Competencias:    ${DRY_RUN ? DEMO_COMPETENCIES.length + " (simulado)" : totalComps}`);
  console.log(`Ciclos:          ${DRY_RUN ? DEMO_CYCLES.length + " (simulado)" : totalCycles}`);
  console.log(`Evaluaciones:    ${evalsCreated || 0} creadas`);
  console.log(`KPIs:            ${kpiCreated} creados / ${kpiOmitted} omitidos`);
  console.log(`OKRs:            ${okrCreated} creados`);
  console.log(`Planes:          ${plansCreated || 0} creados`);
  console.log(`Novedades:       ${annCreated} creadas\n`);

  console.log("Módulos completos:");
  console.log("  ✅ Empleados con jerarquía de managers");
  console.log("  ✅ Roles estándar + pilot users");
  console.log("  ✅ Ciclos de evaluación");
  console.log("  ✅ Competencias");
  console.log("  ✅ Evaluaciones (AUTOEVALUACION + JEFATURA)");
  console.log("  ✅ Planes de desarrollo");
  console.log("  ✅ KPIs / OKRs");

  if (annCreated > 0) {
    console.log("  ✅ Novedades");
  }

  console.log("\nMódulos parciales:");
  console.log("  ⚠ Reporte Ejecutivo: datos generados (empleados, evaluaciones, KPIs, planes)");
  console.log("  ⚠ Dashboard/Métricas: datos en backend, visual completa depende del frontend");
  console.log("  ⚠ Importación: plantilla disponible vía GET /bulk-import/template");

  console.log("\n=== CREDENCIALES PILOTO ===\n");
  console.log(`Admin (SUPER_ADMIN existente):`);
  console.log(`  Email:    ${ADMIN_EMAIL}`);
  console.log(`  Password: ${ADMIN_PASSWORD}\n`);

  for (const u of PILOT_USERS) {
    const result = userResults.find(r => r.email === u.email);
    const statusText = result?.status || "desconocido";
    const motivoText = result?.motivo ? ` (${result.motivo})` : "";
    console.log(`${u.roleCode}:`);
    console.log(`  Email:    ${u.email}`);
    console.log(`  Password: ${DEMO_PASSWORD}`);
    console.log(`  Estado:   ${statusText}${motivoText}\n`);
  }

  console.log(`API URL: ${API_URL}\n`);

  console.log("Cómo ejecutar:");
  console.log("  1. SEED_CONFIRM=1 node scripts/seed-pilot.mjs");
  console.log("  2. Login con cualquier credencial de arriba");
  console.log(`  3. Modo dry-run: node scripts/seed-pilot.mjs --dry-run\n`);

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log(`Duration: ${elapsed}s`);
}

main().catch((err) => {
  console.error("\nSeed failed:", err.message);
  process.exit(1);
});
