import bcrypt from "bcryptjs";
import Company from "../models/Company.js";
import CompanySetting from "../models/CompanySetting.js";
import Role from "../models/Role.js";
import User from "../models/User.js";

export const DEFAULT_PERMISSIONS = [
  "manage_users",
  "manage_roles",
  "view_audit",
  "export_reports",
  "manage_settings",
];

const DEFAULT_ADMIN = {
  email: process.env.SEED_ADMIN_EMAIL || "admin@demo.com",
  password: process.env.SEED_ADMIN_PASSWORD || "123456",
  nombre: process.env.SEED_ADMIN_NAME || "Administrador General",
  companyName: process.env.SEED_COMPANY_NAME || "Empresa Demo",
  companySlug: process.env.SEED_COMPANY_SLUG || "empresa-demo",
};

export async function ensureInitialAccess() {
  let company = await Company.findOne({ nombre: DEFAULT_ADMIN.companyName });

  if (!company) {
    company = await Company.create({
      nombre: DEFAULT_ADMIN.companyName,
      slug: DEFAULT_ADMIN.companySlug,
    });
    console.log("Bootstrap: empresa inicial creada");
  }

  let adminRole = await Role.findOne({
    companyId: company._id,
    nombre: "Admin",
  });

  if (!adminRole) {
    adminRole = await Role.create({
      companyId: company._id,
      nombre: "Admin",
      permisos: DEFAULT_PERMISSIONS,
    });
    console.log("Bootstrap: rol Admin creado");
  } else {
    const mergedPermissions = Array.from(
      new Set([...(adminRole.permisos || []), ...DEFAULT_PERMISSIONS])
    );

    if (mergedPermissions.length !== adminRole.permisos.length) {
      adminRole.permisos = mergedPermissions;
      await adminRole.save();
      console.log("Bootstrap: permisos del Admin actualizados");
    }
  }

  const settings = await CompanySetting.findOne({ companyId: company._id });
  if (!settings) {
    await CompanySetting.create({
      companyId: company._id,
      nombreVisible: DEFAULT_ADMIN.companyName,
      primaryColor: "#10b981",
      maxUploadSizeMb: 10,
    });
    console.log("Bootstrap: settings iniciales creados");
  }

  let adminUser = await User.findOne({ email: DEFAULT_ADMIN.email.toLowerCase() });
  if (!adminUser) {
    adminUser = await User.create({
      companyId: company._id,
      roleId: adminRole._id,
      nombre: DEFAULT_ADMIN.nombre,
      email: DEFAULT_ADMIN.email.toLowerCase(),
      passwordHash: await bcrypt.hash(DEFAULT_ADMIN.password, 10),
      activo: true,
    });
    console.log("Bootstrap: admin inicial creado");
  }

  return {
    company,
    adminRole,
    adminUser,
    credentials: {
      email: DEFAULT_ADMIN.email,
      password: DEFAULT_ADMIN.password,
    },
  };
}
