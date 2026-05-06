import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import Company from "../models/Company.js";
import School from "../models/School.js";
import Role from "../models/Role.js";
import User from "../models/User.js";
import { ROLE_DEFINITIONS } from "../utils/permissions.js";

const PASSWORD = process.env.SEED_MATRIX_PASSWORD || "Performia#2026!App";

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function ensureCompanyWithSchool(companyName, schoolName) {
  const slug = slugify(companyName);
  let company = await Company.findOne({ slug });
  if (!company) {
    company = await Company.create({
      nombre: companyName,
      slug,
      tipoCliente: "colegio",
      activa: true,
    });
  }

  let school = await School.findOne({ companyId: company._id, nombre: schoolName });
  if (!school) {
    school = await School.create({
      companyId: company._id,
      nombre: schoolName,
      codigo: slug.toUpperCase().slice(0, 6),
      ciudad: "Buenos Aires",
      provincia: "Buenos Aires",
      pais: "Argentina",
      activa: true,
    });
  }

  return { company, school };
}

async function ensureRole(companyId, schoolId, roleDef) {
  let role = await Role.findOne({
    companyId,
    schoolId: roleDef.scope === "global" ? null : schoolId,
    code: roleDef.code,
  });

  if (!role) {
    role = await Role.create({
      companyId,
      schoolId: roleDef.scope === "global" ? null : schoolId,
      code: roleDef.code,
      nombre: roleDef.nombre,
      descripcion: `Rol de validacion ${roleDef.code}`,
      permisos: roleDef.permisos,
      scope: roleDef.scope,
      activo: true,
      isSystem: true,
    });
  }

  return role;
}

async function ensureUser({
  companyId,
  schoolId,
  role,
  email,
  nombre,
  isSuperAdmin = false,
}) {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const existing = await User.findOne({ email: email.toLowerCase() });

  if (existing) {
    existing.companyId = companyId;
    existing.schoolId = role.scope === "global" ? schoolId : schoolId;
    existing.roleId = role._id;
    existing.nombre = nombre;
    existing.activo = true;
    existing.isSuperAdmin = isSuperAdmin;
    existing.passwordHash = passwordHash;
    existing.mustChangePassword = false;
    await existing.save();
    return existing;
  }

  return User.create({
    companyId,
    schoolId,
    roleId: role._id,
    nombre,
    email: email.toLowerCase(),
    passwordHash,
    activo: true,
    isSuperAdmin,
    mustChangePassword: false,
  });
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI);

  const orgA = await ensureCompanyWithSchool("Colegio Norte", "Colegio Norte - Sede Central");
  const orgB = await ensureCompanyWithSchool("Colegio Sur", "Colegio Sur - Campus");

  const superRole = await ensureRole(orgA.company._id, orgA.school._id, ROLE_DEFINITIONS.find((r) => r.code === "SUPER_ADMIN"));
  const adminRoleA = await ensureRole(orgA.company._id, orgA.school._id, ROLE_DEFINITIONS.find((r) => r.code === "ADMIN_COLEGIO"));
  const rrhhRoleA = await ensureRole(orgA.company._id, orgA.school._id, ROLE_DEFINITIONS.find((r) => r.code === "RRHH"));
  const jefeRoleA = await ensureRole(orgA.company._id, orgA.school._id, ROLE_DEFINITIONS.find((r) => r.code === "JEFE"));
  const empleadoRoleA = await ensureRole(orgA.company._id, orgA.school._id, ROLE_DEFINITIONS.find((r) => r.code === "EMPLEADO"));
  const lectorRoleB = await ensureRole(orgB.company._id, orgB.school._id, ROLE_DEFINITIONS.find((r) => r.code === "LECTOR"));

  const seeded = [];
  seeded.push(
    await ensureUser({
      companyId: orgA.company._id,
      schoolId: orgA.school._id,
      role: superRole,
      email: "superadmin@performia.local",
      nombre: "Superadmin Performia",
      isSuperAdmin: true,
    })
  );
  seeded.push(
    await ensureUser({
      companyId: orgA.company._id,
      schoolId: orgA.school._id,
      role: adminRoleA,
      email: "director.norte@performia.local",
      nombre: "Director Colegio Norte",
    })
  );
  seeded.push(
    await ensureUser({
      companyId: orgA.company._id,
      schoolId: orgA.school._id,
      role: rrhhRoleA,
      email: "rrhh.norte@performia.local",
      nombre: "RRHH Colegio Norte",
    })
  );
  seeded.push(
    await ensureUser({
      companyId: orgA.company._id,
      schoolId: orgA.school._id,
      role: jefeRoleA,
      email: "jefe.norte@performia.local",
      nombre: "Jefe Colegio Norte",
    })
  );
  seeded.push(
    await ensureUser({
      companyId: orgA.company._id,
      schoolId: orgA.school._id,
      role: empleadoRoleA,
      email: "empleado.norte@performia.local",
      nombre: "Empleado Colegio Norte",
    })
  );
  seeded.push(
    await ensureUser({
      companyId: orgB.company._id,
      schoolId: orgB.school._id,
      role: lectorRoleB,
      email: "lector.sur@performia.local",
      nombre: "Lector Colegio Sur",
    })
  );

  console.log("Seed de validacion creado/actualizado.");
  console.log(`Password para todos: ${PASSWORD}`);
  seeded.forEach((user) => console.log(`- ${user.email}`));
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error("Error en seedValidationMatrix:", error);
  await mongoose.disconnect();
  process.exit(1);
});
