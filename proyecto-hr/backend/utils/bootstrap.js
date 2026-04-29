import bcrypt from "bcryptjs";
import Company from "../models/Company.js";
import CompanySetting from "../models/CompanySetting.js";
import Role from "../models/Role.js";
import User from "../models/User.js";

export const COMPANY_ADMIN_PERMISSIONS = [
  "manage_users",
  "manage_roles",
  "view_audit",
  "export_reports",
  "manage_settings",
];

export const SUPER_ADMIN_PERMISSIONS = [
  ...COMPANY_ADMIN_PERMISSIONS,
  "manage_companies",
];

const DEFAULT_ADMIN = {
  email: process.env.SEED_ADMIN_EMAIL || "admin@demo.com",
  password: process.env.SEED_ADMIN_PASSWORD || "123456",
  nombre: process.env.SEED_ADMIN_NAME || "Administrador General",
  companyName: process.env.SEED_COMPANY_NAME || "Empresa Demo",
  companySlug: process.env.SEED_COMPANY_SLUG || "empresa-demo",
};

async function ensureRole({ companyId, nombre, permisos }) {
  let role = await Role.findOne({ companyId, nombre });

  if (!role) {
    role = await Role.create({
      companyId,
      nombre,
      permisos,
    });
    return role;
  }

  const mergedPermissions = Array.from(new Set([...(role.permisos || []), ...permisos]));
  if (mergedPermissions.length !== role.permisos.length) {
    role.permisos = mergedPermissions;
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

  return { company, adminRole };
}

export async function ensureInitialAccess() {
  const { company, adminRole } = await ensureCompanyStructure({
    companyName: DEFAULT_ADMIN.companyName,
    companySlug: DEFAULT_ADMIN.companySlug,
  });

  const superAdminRole = await ensureRole({
    companyId: company._id,
    nombre: "Super Admin",
    permisos: SUPER_ADMIN_PERMISSIONS,
  });

  let superAdmin = await User.findOne({ email: DEFAULT_ADMIN.email.toLowerCase() });
  if (!superAdmin) {
    superAdmin = await User.create({
      companyId: company._id,
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
