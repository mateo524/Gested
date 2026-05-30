import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import Company from "./models/Company.js";
import Role from "./models/Role.js";
import User from "./models/User.js";
import CompanySetting from "./models/CompanySetting.js";
import Record from "./models/Record.js";
import DatabaseFile from "./models/DatabaseFile.js";
import DevelopmentPlan from "./models/DevelopmentPlan.js";
import AuditLog from "./models/AuditLog.js";

const SUPERADMIN_EMAIL = "admin@demo.com";
const SUPERADMIN_PASSWORD = "123456";

const DEPARTAMENTOS = [
  "Dirección",
  "Investigación y Desarrollo",
  "Producción",
  "Ventas y Marketing",
  "Logística",
  "Recursos Humanos",
  "Finanzas",
  "Control de Calidad",
];

const EMPLEADOS = [
  { apellido: "Mendoza", nombre: "Carolina", rol: "CEO", departamento: "Dirección", salario: 180000, jefe: null },
  { apellido: "Vega", nombre: "Roberto", rol: "CFO", departamento: "Dirección", salario: 150000, jefe: "Carolina Mendoza" },
  { apellido: "Pavón", nombre: "Ana Lucía", rol: "Chief Perfumer (COO)", departamento: "Dirección", salario: 160000, jefe: "Carolina Mendoza" },
  { apellido: "Fuentes", nombre: "Diego", rol: "CMO", departamento: "Dirección", salario: 145000, jefe: "Carolina Mendoza" },
  { apellido: "Rivas", nombre: "Mauricio", rol: "Head of R&D", departamento: "Investigación y Desarrollo", salario: 130000, jefe: "Ana Lucía Pavón" },
  { apellido: "Castellanos", nombre: "Laura", rol: "Perfumer Senior", departamento: "Investigación y Desarrollo", salario: 95000, jefe: "Mauricio Rivas" },
  { apellido: "Ortíz", nombre: "Pablo", rol: "Perfumer Junior", departamento: "Investigación y Desarrollo", salario: 55000, jefe: "Mauricio Rivas" },
  { apellido: "Jiménez", nombre: "Sara", rol: "Técnica de Laboratorio", departamento: "Investigación y Desarrollo", salario: 42000, jefe: "Laura Castellanos" },
  { apellido: "Lara", nombre: "Fernando", rol: "Gerente de Producción", departamento: "Producción", salario: 110000, jefe: "Ana Lucía Pavón" },
  { apellido: "Hernández", nombre: "José", rol: "Supervisor de Producción", departamento: "Producción", salario: 65000, jefe: "Fernando Lara" },
  { apellido: "Cruz", nombre: "Miguel Ángel", rol: "Operador de Máquinas", departamento: "Producción", salario: 38000, jefe: "José Hernández" },
  { apellido: "Flores", nombre: "Carmen", rol: "Especialista en Envasado", departamento: "Producción", salario: 36000, jefe: "José Hernández" },
  { apellido: "Torres", nombre: "Luis", rol: "Asistente de Producción", departamento: "Producción", salario: 32000, jefe: "José Hernández" },
  { apellido: "Suárez", nombre: "Valentina", rol: "Directora de Ventas", departamento: "Ventas y Marketing", salario: 120000, jefe: "Diego Fuentes" },
  { apellido: "Méndez", nombre: "Ricardo", rol: "Key Account Manager", departamento: "Ventas y Marketing", salario: 82000, jefe: "Valentina Suárez" },
  { apellido: "Gómez", nombre: "Patricia", rol: "Especialista en Marketing Digital", departamento: "Ventas y Marketing", salario: 58000, jefe: "Valentina Suárez" },
  { apellido: "Ríos", nombre: "Andrés", rol: "Representante de Ventas", departamento: "Ventas y Marketing", salario: 45000, jefe: "Valentina Suárez" },
  { apellido: "Solís", nombre: "Gabriela", rol: "Brand Manager", departamento: "Ventas y Marketing", salario: 72000, jefe: "Diego Fuentes" },
  { apellido: "Paredes", nombre: "Hugo", rol: "Gerente de Logística", departamento: "Logística", salario: 100000, jefe: "Ana Lucía Pavón" },
  { apellido: "Rivas", nombre: "Daniela", rol: "Coordinadora de Cadena de Suministro", departamento: "Logística", salario: 55000, jefe: "Hugo Paredes" },
  { apellido: "Morales", nombre: "Esteban", rol: "Supervisor de Almacén", departamento: "Logística", salario: 48000, jefe: "Hugo Paredes" },
  { apellido: "Rangel", nombre: "Marcela", rol: "Gerente de RRHH", departamento: "Recursos Humanos", salario: 105000, jefe: "Carolina Mendoza" },
  { apellido: "Peña", nombre: "Rodrigo", rol: "Analista de RRHH", departamento: "Recursos Humanos", salario: 52000, jefe: "Marcela Rangel" },
  { apellido: "Soto", nombre: "Fernanda", rol: "Especialista en Reclutamiento", departamento: "Recursos Humanos", salario: 48000, jefe: "Marcela Rangel" },
  { apellido: "Vargas", nombre: "Elena", rol: "Gerente de Finanzas", departamento: "Finanzas", salario: 115000, jefe: "Roberto Vega" },
  { apellido: "Herrera", nombre: "Carlos", rol: "Contador", departamento: "Finanzas", salario: 55000, jefe: "Elena Vargas" },
  { apellido: "Díaz", nombre: "Mariela", rol: "Analista Financiera", departamento: "Finanzas", salario: 62000, jefe: "Elena Vargas" },
  { apellido: "Navarro", nombre: "Jorge", rol: "Gerente de Control de Calidad", departamento: "Control de Calidad", salario: 98000, jefe: "Ana Lucía Pavón" },
  { apellido: "Méndez", nombre: "Andrea", rol: "Analista de Calidad", departamento: "Control de Calidad", salario: 46000, jefe: "Jorge Navarro" },
  { apellido: "Aguilar", nombre: "Tomás", rol: "Asistente Administrativo", departamento: "Dirección", salario: 35000, jefe: "Carolina Mendoza" },
];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function dateAgo(years = 0, months = 0, days = 0) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  d.setMonth(d.getMonth() - months);
  d.setDate(d.getDate() - days);
  return d;
}

function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

const TIPOS_CONTRATO = ["indefinido", "fijo", "temporal"];
const ESTADOS_EMPLEADO = ["activo", "activo", "activo", "activo", "activo", "activo", "activo", "activo", "licencia", "inactivo"];

const PLANES_TITULOS = [
  "Liderazgo y Gestión de Equipos",
  "Técnicas Avanzadas de Perfumería",
  "Certificación en Normas ISO 9001",
  "Marketing Olfativo: Estrategias Sensoriales",
  "Optimización de Cadena de Suministro",
  "Gestión Financiera para no Financieros",
  "Desarrollo de Habilidades Directivas",
  "Innovación en Fragancias Sostenibles",
  "Transformación Digital en RRHH",
  "Técnicas de Ventas Consultivas",
  "Control Estadístico de Procesos",
  "Negociación y Gestión de Conflictos",
  "Inglés Técnico para Negocios",
  "Data Analytics para Toma de Decisiones",
  "Gestión de Proyectos Ágiles",
  "Seguridad e Higiene en Laboratorios",
  "Liderazgo Femenino en la Industria",
  "Estrategias de Exportación",
  "Branding Sensorial: Identidad Olfativa",
  "Gestión del Cambio Organizacional",
];

const COMPETENCIAS_POOL = [
  { nombre: "Comunicación Efectiva", nivelActual: 3, nivelTarget: 5 },
  { nombre: "Trabajo en Equipo", nivelActual: 3, nivelTarget: 4 },
  { nombre: "Resolución de Problemas", nivelActual: 2, nivelTarget: 4 },
  { nombre: "Pensamiento Analítico", nivelActual: 3, nivelTarget: 5 },
  { nombre: "Liderazgo", nivelActual: 2, nivelTarget: 4 },
  { nombre: "Creatividad e Innovación", nivelActual: 3, nivelTarget: 5 },
  { nombre: "Orientación a Resultados", nivelActual: 4, nivelTarget: 5 },
  { nombre: "Adaptabilidad al Cambio", nivelActual: 2, nivelTarget: 4 },
  { nombre: "Conocimiento Técnico", nivelActual: 3, nivelTarget: 4 },
  { nombre: "Inteligencia Emocional", nivelActual: 3, nivelTarget: 5 },
];

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB conectado para seed ficticio");

    // =========================================================
    // 1. IDENTIFICAR SUPERADMIN Y SUS REFERENCIAS
    // =========================================================
    const superadmin = await User.findOne({ email: SUPERADMIN_EMAIL }).populate("roleId");
    if (!superadmin) {
      console.log("No se encontró superadmin. Ejecutá primero seedAdmin.js");
      process.exit(1);
    }

    const companyId = superadmin.companyId;
    const roleId = superadmin.roleId._id;
    console.log(`Superadmin encontrado: ${superadmin.email} (companyId: ${companyId})`);

    // =========================================================
    // 2. ELIMINAR TODO EL CONTENIDO ANTERIOR (excepto superadmin)
    // =========================================================
    console.log("\n--- Limpiando datos anteriores ---");

    const delRecords = await Record.deleteMany({ companyId });
    console.log(`  Records eliminados: ${delRecords.deletedCount}`);

    const delDBFiles = await DatabaseFile.deleteMany({ companyId });
    console.log(`  DatabaseFiles eliminados: ${delDBFiles.deletedCount}`);

    const delPlans = await DevelopmentPlan.deleteMany({ companyId });
    console.log(`  DevelopmentPlans eliminados: ${delPlans.deletedCount}`);

    const delAudits = await AuditLog.deleteMany({ companyId });
    console.log(`  AuditLogs eliminados: ${delAudits.deletedCount}`);

    // Eliminar otros usuarios (que no sean superadmin)
    const delUsers = await User.deleteMany({ _id: { $ne: superadmin._id }, companyId });
    console.log(`  Otros usuarios eliminados: ${delUsers.deletedCount}`);

    // Eliminar otros roles (que no sean admin)
    const delRoles = await Role.deleteMany({ _id: { $ne: roleId }, companyId });
    console.log(`  Otros roles eliminados: ${delRoles.deletedCount}`);

    console.log("  Limpieza completada.\n");

    // =========================================================
    // 3. CREAR EMPLEADOS (Records) CON FECHAS HISTÓRICAS
    // =========================================================
    console.log("--- Creando empleados ficticios ---");

    const dbFile = await DatabaseFile.create({
      companyId,
      nombreVisible: "Planilla Perfomia Corp",
      nombreArchivo: "perfomia-corp-empleados.xlsx",
      hoja: "Empleados",
      registros: 0,
      activa: true,
      createdAt: dateAgo(3),
    });

    const employeeIds = [];
    for (const emp of EMPLEADOS) {
      const fechaIngreso = randomDate(dateAgo(3), dateAgo(0, 6));
      const emailBase = `${emp.nombre.toLowerCase().split(" ")[0]}.${emp.apellido.toLowerCase()}@perfomia.com`;
      const email = emailBase.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

      const estado = randomChoice(ESTADOS_EMPLEADO);
      const tipoContrato = randomChoice(TIPOS_CONTRATO);

      const record = await Record.create({
        companyId,
        databaseId: dbFile._id,
        apellido: emp.apellido,
        nombre: emp.nombre,
        nombreCompleto: `${emp.nombre} ${emp.apellido}`,
        rol: emp.rol,
        email,
        telefono: `+52 55 ${randomInt(1000, 9999)}-${randomInt(1000, 9999)}`,
        direccion: `${randomChoice(["Av. Reforma", "Calle Morelos", "Blvd. Perfumes", "Paseo de los Olores", "Av. Fragancia"])} #${randomInt(100, 999)}`,
        ciudad: randomChoice(["Ciudad de México", "Guadalajara", "Monterrey", "Querétaro", "Toluca"]),
        estado,
        fechaIngreso,
        departamento: emp.departamento,
        jefe: emp.jefe,
        salario: emp.salario,
        tipoContrato,
        estado_empleado: estado,
        documento: `PEF${String(randomInt(10000, 99999))}`,
        descripcion: `${emp.rol} en el departamento de ${emp.departamento}. ${randomChoice(["Especialista en su área con amplia trayectoria.", "Profesional comprometido con la excelencia.", "Miembro clave del equipo de perfumería."])}`,
        createdAt: fechaIngreso,
        updatedAt: fechaIngreso,
      });

      employeeIds.push(record._id);
    }

    dbFile.registros = employeeIds.length;
    await dbFile.save();
    console.log(`  ${employeeIds.length} empleados creados`);

    // =========================================================
    // 4. CREAR USUARIOS ADICIONALES (roles RRHH, Supervisor)
    // =========================================================
    console.log("\n--- Creando usuarios adicionales ---");

    const rrhhRole = await Role.create({
      companyId,
      nombre: "RRHH Manager",
      permisos: ["manage_users", "view_audit", "export_reports", "manage_settings"],
    });

    const supervisorRole = await Role.create({
      companyId,
      nombre: "Supervisor",
      permisos: ["export_reports", "export_team_reports", "view_reports", "manage_settings"],
    });

    const usuariosNuevos = [
      { nombre: "Marcela Rangel", email: "mrangel@perfomia.com", role: rrhhRole._id, pw: "Rrhh2026!" },
      { nombre: "Hugo Paredes", email: "hparedes@perfomia.com", role: supervisorRole._id, pw: "Logis2026!" },
      { nombre: "Valentina Suárez", email: "vsuarez@perfomia.com", role: supervisorRole._id, pw: "Ventas2026!" },
      { nombre: "Laura Castellanos", email: "lcastellanos@perfomia.com", role: supervisorRole._id, pw: "Perfum2026!" },
    ];

    for (const u of usuariosNuevos) {
      const passwordHash = await bcrypt.hash(u.pw, 10);
      await User.create({
        companyId,
        roleId: u.role,
        nombre: u.nombre,
        email: u.email,
        passwordHash,
        activo: true,
      });
      console.log(`  Usuario creado: ${u.email}`);
    }

    console.log(`  ${usuariosNuevos.length} usuarios adicionales creados`);

    // =========================================================
    // 5. CREAR PLANES DE DESARROLLO (distribuidos en 3 años)
    // =========================================================
    console.log("\n--- Creando planes de desarrollo ---");

    const estadosPlan = ["no_iniciado", "en_curso", "completado", "completado", "completado", "pausado"];
    const planIds = [];

    for (let i = 0; i < 20; i++) {
      const empIndex = i % employeeIds.length;
      const employeeId = employeeIds[empIndex];
      const employee = EMPLEADOS[empIndex];

      const fechaInicio = randomDate(dateAgo(2, 6), dateAgo(0, 3));
      const duracionMeses = randomInt(2, 8);
      const fechaFin = new Date(fechaInicio);
      fechaFin.setMonth(fechaFin.getMonth() + duracionMeses);

      const estado = randomChoice(estadosPlan);
      const numObjetivos = randomInt(2, 5);
      const objetivos = [];
      let completados = 0;

      for (let j = 0; j < numObjetivos; j++) {
        const objEstado = estado === "completado" ? "completado" : randomChoice(["pendiente", "en_progreso", "completado"]);
        if (objEstado === "completado") completados++;
        const targetDate = new Date(fechaInicio);
        targetDate.setMonth(targetDate.getMonth() + randomInt(1, duracionMeses));

        objetivos.push({
          descripcion: randomChoice([
            "Completar curso teórico",
            "Aprobar evaluación práctica",
            "Realizar presentación final",
            "Entregar proyecto integrador",
            "Alcanzar certificación",
            "Demostrar competencias adquiridas",
            "Implementar mejora en el área",
          ]),
          estado: objEstado,
          fechaTarget: targetDate,
          completedAt: objEstado === "completado" ? randomDate(fechaInicio, fechaFin) : null,
        });
      }

      const progreso = estado === "completado" ? 100 : estado === "no_iniciado" ? 0 : Math.round((completados / numObjetivos) * 100);

      const competenciasPlan = [];
      const numComp = randomInt(1, 3);
      const compSeleccionadas = [...COMPETENCIAS_POOL].sort(() => Math.random() - 0.5).slice(0, numComp);
      for (const comp of compSeleccionadas) {
        competenciasPlan.push({
          nombre: comp.nombre,
          nivelActual: estado === "completado" ? comp.nivelTarget : comp.nivelActual,
          nivelTarget: comp.nivelTarget,
          acciones: randomChoice([
            ["Capacitación interna", "Mentoría con senior"],
            ["Curso externo", "Workshop práctico"],
            ["Reading asignado", "Ejercicios semanales"],
            ["Certificación oficial", "Proyecto aplicado"],
          ]),
        });
      }

      const plan = await DevelopmentPlan.create({
        companyId,
        employeeId,
        empleadoEmail: `${employee.nombre.toLowerCase().split(" ")[0]}.${employee.apellido.toLowerCase()}@perfomia.com`.normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
        titulo: PLANES_TITULOS[i % PLANES_TITULOS.length],
        descripcion: `Plan de desarrollo enfocado en ${PLANES_TITULOS[i % PLANES_TITULOS.length].toLowerCase()} para ${employee.nombre} ${employee.apellido}.`,
        objetivos,
        competencias: competenciasPlan,
        fechaInicio,
        fechaFin,
        estado,
        progreso,
        responsable: employee.jefe || "Carolina Mendoza",
        notas: estado === "completado" ? "Plan finalizado exitosamente. Se recomienda siguiente nivel." : estado === "pausado" ? "Plan pausado por carga laboral. Pendiente retomar." : "Seguimiento mensual programado.",
        createdAt: fechaInicio,
        updatedAt: fechaFin,
      });

      planIds.push(plan._id);
    }

    console.log(`  ${planIds.length} planes de desarrollo creados`);

    // =========================================================
    // 5. CREAR LOGS DE AUDITORÍA (3 años de actividad)
    // =========================================================
    console.log("\n--- Creando logs de auditoría ---");

    const accionesAudit = [
      { accion: "crear_empleado", modulo: "empleados" },
      { accion: "actualizar_empleado", modulo: "empleados" },
      { accion: "crear_plan_desarrollo", modulo: "planes_desarrollo" },
      { accion: "completar_objetivo", modulo: "planes_desarrollo" },
      { accion: "finalizar_plan", modulo: "planes_desarrollo" },
      { accion: "exportar_reporte", modulo: "exportaciones" },
      { accion: "iniciar_sesion", modulo: "auth" },
      { accion: "configurar_parametros", modulo: "configuración" },
      { accion: "cargar_archivo_excel", modulo: "empleados" },
      { accion: "actualizar_perfil", modulo: "empleados" },
    ];

    const auditLogs = [];
    for (let i = 0; i < 300; i++) {
      const fecha = randomDate(dateAgo(3), new Date());
      const accion = randomChoice(accionesAudit);
      const empleadoRandom = randomChoice(EMPLEADOS);

      auditLogs.push({
        companyId,
        userId: superadmin._id,
        accion: accion.accion,
        modulo: accion.modulo,
        detalle: randomChoice([
          `Se ${accion.accion.replace(/_/g, " ")}: ${empleadoRandom.nombre} ${empleadoRandom.apellido}`,
          `${accion.accion.replace(/_/g, " ")} en el módulo ${accion.modulo}`,
          `Usuario admin realizó: ${accion.accion.replace(/_/g, " ")}`,
        ]),
        createdAt: fecha,
        updatedAt: fecha,
      });
    }

    await AuditLog.insertMany(auditLogs);
    console.log(`  ${auditLogs.length} logs de auditoría creados`);

    // =========================================================
    // 6. RESUMEN FINAL
    // =========================================================
    console.log("\n===========================================");
    console.log("  SEED FICTICIO COMPLETADO EXITOSAMENTE");
    console.log("===========================================");
    console.log(`  Empresa: Perfomia Corp`);
    console.log(`  Empleados: ${employeeIds.length}`);
    console.log(`  Planes de Desarrollo: ${planIds.length}`);
    console.log(`  Logs de Auditoría: ${auditLogs.length}`);
    console.log(`  Archivo de Datos: ${dbFile.nombreVisible}`);
    console.log("");
    console.log(`  Superadmin: ${SUPERADMIN_EMAIL} / ${SUPERADMIN_PASSWORD}`);
    console.log("===========================================\n");

    process.exit(0);
  } catch (error) {
    console.error("Error en seed ficticio:", error);
    process.exit(1);
  }
}

run();
