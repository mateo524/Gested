/**
 * wipeTenantData.js
 * Borra TODOS los datos excepto el usuario superadmin (isSuperAdmin: true).
 * Preserva sus credenciales (email + passwordHash) y recrea la estructura mínima.
 *
 * Uso:  node --env-file=.env scripts/wipeTenantData.js
 */
import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

// ─── Models (inline to avoid circular import issues) ─────────────────────────
import User from "../models/User.js";
import Company from "../models/Company.js";
import Role from "../models/Role.js";

const SUPER_ADMIN_PERMISSIONS = [
  "manage_users", "manage_roles", "manage_evaluations", "evaluate_team",
  "self_evaluate", "view_reports", "manage_employees", "manage_cycles",
  "manage_competencies", "manage_metrics", "view_audit", "manage_companies",
  "manage_settings", "import_data", "export_data",
];

// Collections to wipe entirely (all documents)
const WIPE_COLLECTIONS = [
  "employees",
  "evaluations",
  "evaluationscores",
  "evaluationcycles",
  "developmentplans",
  "competencies",
  "metrics",
  "metriclevels",
  "kpirecords",
  "okrrecords",
  "pulsechecks",
  "pulseresponses",
  "notifications",
  "announcements",
  "auditlogs",
  "importjobs",
  "downloadlogs",
  "webhookconfigs",
  "useroleassignments",
  "userroleassignments",
  "rolesassignments",
  "schools",
  "records",
];

async function run() {
  const uri = process.env.MONGO_URI_DIRECT || process.env.MONGO_URI;
  if (!uri) {
    console.error("Falta MONGO_URI o MONGO_URI_DIRECT en .env");
    process.exit(1);
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  const db = mongoose.connection.db;
  console.log(`Conectado a: ${db.databaseName}`);

  // 1. Buscar el superadmin actual
  const superAdmin = await User.findOne({ isSuperAdmin: true }).lean();
  if (!superAdmin) {
    console.error("No se encontró ningún usuario con isSuperAdmin: true. Abortando.");
    process.exit(1);
  }
  console.log(`SuperAdmin encontrado: ${superAdmin.email} (${superAdmin.nombre})`);

  // 2. Listar todas las colecciones
  const allCollections = await db.listCollections().toArray();
  const collectionNames = allCollections.map((c) => c.name).filter((n) => !n.startsWith("system."));

  // 3. Borrar colecciones de datos operativos
  let wiped = 0;
  for (const name of collectionNames) {
    if (WIPE_COLLECTIONS.includes(name.toLowerCase())) {
      const result = await db.collection(name).deleteMany({});
      console.log(`  ✓ ${name}: ${result.deletedCount} docs eliminados`);
      wiped++;
    }
  }

  // 4. Borrar todos los usuarios EXCEPTO el superadmin
  const usersResult = await User.deleteMany({ _id: { $ne: superAdmin._id } });
  console.log(`  ✓ users: ${usersResult.deletedCount} usuarios eliminados (superadmin preservado)`);

  // 5. Borrar compañías y roles, luego recrear estructura mínima
  await db.collection("companies").deleteMany({});
  await db.collection("roles").deleteMany({});
  await db.collection("permissions").deleteMany({});
  await db.collection("companysettings").deleteMany({});
  console.log(`  ✓ companies, roles, permissions: eliminados`);

  // 6. Recrear empresa
  const company = await Company.create({
    nombre: "Perfomia Corp",
    slug: "perfomia-corp",
    tipoCliente: "general",
    activa: true,
  });
  console.log(`  ✓ Empresa recreada: ${company.nombre} (${company._id})`);

  // 7. Recrear rol SuperAdmin
  const superAdminRole = await Role.create({
    companyId: company._id,
    nombre: "Super Admin",
    code: "SUPER_ADMIN",
    scope: "global",
    permisos: SUPER_ADMIN_PERMISSIONS,
    activo: true,
  });
  console.log(`  ✓ Rol SuperAdmin recreado`);

  // 8. Actualizar el superadmin con la nueva compañía y rol
  await User.updateOne(
    { _id: superAdmin._id },
    {
      $set: {
        companyId: company._id,
        roleId: superAdminRole._id,
        schoolId: null,
        isSuperAdmin: true,
        activo: true,
      },
    }
  );

  console.log("\n=================================================");
  console.log("LIMPIEZA COMPLETADA");
  console.log(`Email superadmin: ${superAdmin.email}`);
  console.log("Contraseña:       (la misma de antes — no se cambió)");
  console.log("Empresa:          Perfomia Corp");
  console.log(`Collections limpiadas: ${wiped}`);
  console.log("=================================================");

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("Error fatal:", err);
  process.exit(1);
});
