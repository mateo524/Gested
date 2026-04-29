import bcrypt from "bcryptjs";
import Company from "../models/Company.js";
import CompanySetting from "../models/CompanySetting.js";
import Role from "../models/Role.js";
import School from "../models/School.js";
import User from "../models/User.js";
import { ensureEducationalRoles, ensurePermissionsSeed } from "./seedRolesPermissions.js";
import { PERMISSIONS } from "./permissions.js";

export const COMPANY_ADMIN_PERMISSIONS = [
  "manage_users",
  "manage_roles",
  "view_audit",
  "export_reports",
  "manage_settings",
  PERMISSIONS.MANAGE_SCHOOLS,
  PERMISSIONS.MANAGE_SCHOOL_USERS,
  PERMISSIONS.MANAGE_EMPLOYEES,
  PERMISSIONS.MANAGE_COMPETENCIES,
  PERMISSIONS.MANAGE_METRICS,
  PERMISSIONS.MANAGE_EVALUATION_CYCLES,
  PERMISSIONS.MANAGE_EVALUATIONS,
  PERMISSIONS.MANAGE_DEVELOPMENT_PLANS,
  PERMISSIONS.VIEW_REPORTS,
  PERMISSIONS.DOWNLOAD_REPORTS,
];

export const SUPER_ADMIN_PERMISSIONS = [
  ...COMPANY_ADMIN_PERMISSIONS,
  "manage_companies",
  PERMISSIONS.VIEW_GLOBAL_REPORTS,
  PERMISSIONS.DOWNLOAD_GLOBAL_DATA,
  PERMISSIONS.MANAGE_GLOBAL_USERS,
];

const DEFAULT_ADMIN = {
  email: process.env.SEED_ADMIN_EMAIL || "admin@demo.com",
  password: process.env.SEED_ADMIN_PASSWORD || "123456",
  nombre: process.env.SEED_ADMIN_NAME || "Administrador General",
  companyName: process.env.SEED_COMPANY_NAME || "Empresa Demo",
  companySlug: process.env.SEED_COMPANY_SLUG || "empresa-demo",
  schoolName: process.env.SEED_SCHOOL_NAME || "Colegio Demo",
};

async function ensureRole({ companyId, nombre, permisos }) {
  let role = await Role.findOne({ companyId, nombre });

  if (!role) {
    role = await Role.create({
      companyId,
      nombre,
      permisos,
      scope: nombre === "Super Admin" ? "global" : "company",
      code: nombre === "Super Admin" ? "SUPER_ADMIN" : null,
    });
    return role;
  }

  const mergedPermissions = Array.from(new Set([...(role.permisos || []), ...permisos]));
  if (mergedPermissions.length !== role.permisos.length) {
    role.permisos = mergedPermissions;
    await role.save();
  }

  if (!role.scope) {
    role.scope = nombre === "Super Admin" ? "global" : "company";
    await role.save();
  }

  return role;
}

export async function ensureCompanyStructure({ companyName, companySlug }) {
  let company = await Company.findOne({ nombre: companyName });

  if (!company) {
    company = await Company.create({
      nombre: companyName,
      slug: companySlug,
      tipoCliente: "general",
    });
  }

  let school = await School.findOne({ companyId: company._id, nombre: DEFAULT_ADMIN.schoolName });
  if (!school) {
    school = await School.create({
      companyId: company._id,
      nombre: DEFAULT_ADMIN.schoolName,
      codigo: "DEMO",
      ciudad: "Buenos Aires",
      provincia: "Buenos Aires",
    });
  }

  const adminRole = await ensureRole({
    companyId: company._id,
    nombre: "Admin",
    permisos: COMPANY_ADMIN_PERMISSIONS,
  });

  const settings = await CompanySetting.findOne({ companyId: company._id });
  if (!settings) {
    await CompanySetting.create({
      companyId: company._id,
      nombreVisible: companyName,
      primaryColor: "#10b981",
      maxUploadSizeMb: 10,
    });
  }

  return { company, school, adminRole };
}

export async function ensureInitialAccess() {
  await ensurePermissionsSeed();
  const { company, school, adminRole } = await ensureCompanyStructure({
    companyName: DEFAULT_ADMIN.companyName,
    companySlug: DEFAULT_ADMIN.companySlug,
  });
  await ensureEducationalRoles({ companyId: company._id, schoolId: school._id });

  const superAdminRole = await ensureRole({
    companyId: company._id,
    nombre: "Super Admin",
    permisos: SUPER_ADMIN_PERMISSIONS,
  });

  let superAdmin = await User.findOne({ email: DEFAULT_ADMIN.email.toLowerCase() });
  if (!superAdmin) {
    superAdmin = await User.create({
      companyId: company._id,
      schoolId: school._id,
      roleId: superAdminRole._id,
      nombre: DEFAULT_ADMIN.nombre,
      email: DEFAULT_ADMIN.email.toLowerCase(),
      passwordHash: await bcrypt.hash(DEFAULT_ADMIN.password, 10),
      activo: true,
      isSuperAdmin: true,
    });
    console.log("Bootstrap: super admin inicial creado");
  } else {
    let changed = false;

    if (!superAdmin.isSuperAdmin) {
      superAdmin.isSuperAdmin = true;
      changed = true;
    }

    if (String(superAdmin.roleId) !== String(superAdminRole._id)) {
      superAdmin.roleId = superAdminRole._id;
      changed = true;
    }

    if (!superAdmin.schoolId) {
      superAdmin.schoolId = school._id;
      changed = true;
    }

    if (changed) {
      await superAdmin.save();
    }
  }

  return {
    company,
    adminRole,
    superAdminRole,
    adminUser: superAdmin,
    credentials: {
      email: DEFAULT_ADMIN.email,
      password: DEFAULT_ADMIN.password,
    },
  };
}
