import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

import Company from "./models/Company.js";
import Role from "./models/Role.js";
import User from "./models/User.js";
import CompanySetting from "./models/CompanySetting.js";

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB conectado para seed");

    let company = await Company.findOne({ nombre: "Empresa Demo" });

    if (!company) {
      company = await Company.create({
        nombre: "Empresa Demo",
        slug: "empresa-demo",
      });
      console.log("Empresa creada");
    } else {
      console.log("Empresa ya existe");
    }

    let adminRole = await Role.findOne({
      companyId: company._id,
      nombre: "Admin",
    });

    if (!adminRole) {
      adminRole = await Role.create({
        companyId: company._id,
        nombre: "Admin",
        permisos: [
          "manage_users",
          "manage_roles",
          "view_audit",
          "export_reports",
          "manage_settings",
        ],
      });
      console.log("Rol Admin creado");
    } else {
      console.log("Rol Admin ya existe");
    }

    let settings = await CompanySetting.findOne({ companyId: company._id });

    if (!settings) {
      settings = await CompanySetting.create({
        companyId: company._id,
        nombreVisible: "Empresa Demo",
        primaryColor: "#10b981",
        maxUploadSizeMb: 10,
      });
      console.log("Settings creados");
    } else {
      console.log("Settings ya existen");
    }

    const email = "admin@demo.com";
    const password = "123456";

    const deleted = await User.deleteOne({ email });
    console.log("Usuarios borrados con ese email:", deleted.deletedCount);

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      companyId: company._id,
      roleId: adminRole._id,
      nombre: "Administrador General",
      email,
      passwordHash,
      activo: true,
    });

    console.log("Usuario admin RECREADO:", user.email);

    console.log("=================================");
    console.log("LOGIN INICIAL");
    console.log("Email: admin@demo.com");
    console.log("Password: 123456");
    console.log("=================================");

    process.exit(0);
  } catch (error) {
    console.error("Error en seed:", error);
    process.exit(1);
  }
}

run();