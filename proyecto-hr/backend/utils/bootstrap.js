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

export async function ensureCompanyStructure({ companyName, companySlug }) {
  let company = await Company.findOne({ nombre: companyName });

  if (!company) {
    company = await Company.create({
      nombre: companyName,
      slug: companySlug,
    });
  }

  let adminRole = await Role.findOne({
    companyId: company._id,
    nombre: "Admin",
  });

  if (!adminRole) {
    adminRole = await Role.create({
      companyId: company._id,
      nombre: "Admin",
      permisos: COMPANY_ADMIN_PERMISSIONS,
    });
  } else {
    const mergedPermissions = Array.from(
      new Set([...(adminRole.permisos || []), ...COMPANY_ADMIN_PERMISSIONS])
    );

    if (mergedPermissions.length !== adminRole.permisos.length) {
      adminRole.permisos = mergedPermissions;
      await adminRole.save();
    }
  }

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

  let superAdmin = await User.findOne({ email: DEFAULT_ADMIN.email.toLowerCase() });
  if (!superAdmin) {
    superAdmin = await User.create({
      companyId: company._id,
      roleId: adminRole._id,
      nombre: DEFAULT_ADMIN.nombre,
      email: DEFAULT_ADMIN.email.toLowerCase(),
      passwordHash: await bcrypt.hash(DEFAULT_ADMIN.password, 10),
      activo: true,
      isSuperAdmin: true,
    });
    console.log("Bootstrap: super admin inicial creado");
  } else if (!superAdmin.isSuperAdmin) {
    superAdmin.isSuperAdmin = true;
    await superAdmin.save();
  }

  return {
    company,
    adminRole,
    adminUser: superAdmin,
    credentials: {
      email: DEFAULT_ADMIN.email,
      password: DEFAULT_ADMIN.password,
    },
  };
}
