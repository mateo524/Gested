import express from "express";
import bcrypt from "bcryptjs";
import multer from "multer";
import ExcelJS from "exceljs";
import User from "../models/User.js";
import Role from "../models/Role.js";
import { auth } from "../middleware/auth.js";
import { permit } from "../middleware/permit.js";
import { logAudit } from "../utils/audit.js";
import { resolveCompanyScope } from "../utils/companyScope.js";
import { generateTempPassword } from "../utils/password.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

function toBoolean(value, fallback = true) {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "si", "sí", "activo"].includes(normalized)) return true;
  if (["false", "0", "no", "inactivo"].includes(normalized)) return false;
  return fallback;
}

async function parseUploadedRows(file) {
  const workbook = new ExcelJS.Workbook();
  const fileName = file.originalname.toLowerCase();

  if (fileName.endsWith(".csv")) {
    await workbook.csv.readBuffer(file.buffer);
  } else {
    await workbook.xlsx.load(file.buffer);
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const headers = worksheet
    .getRow(1)
    .values.slice(1)
    .map((value) => String(value || "").trim().toLowerCase());

  const rows = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values = row.values.slice(1);
    const item = {};

    headers.forEach((header, index) => {
      item[header] = values[index];
    });

    rows.push({ ...item, _rowNumber: rowNumber });
  });

  return rows;
}

router.get("/", auth, permit("manage_users"), async (req, res) => {
  const { companyId } = await resolveCompanyScope(req);
  const search = req.query.q?.trim();
  const onlyActive =
    req.query.activo === "true" ? true : req.query.activo === "false" ? false : null;

  const filters = { companyId, isSuperAdmin: false };

  if (typeof onlyActive === "boolean") {
    filters.activo = onlyActive;
  }

  if (search) {
    filters.$or = [
      { nombre: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }

  const users = await User.find(filters)
    .select("-passwordHash")
    .populate("roleId", "nombre permisos")
    .sort({ nombre: 1 });

  res.json(users);
});

router.post("/", auth, permit("manage_users"), async (req, res) => {
  const { nombre, email, password, roleId, activo = true } = req.body;
  const { companyId } = await resolveCompanyScope(req);

  if (!nombre || !email || !roleId) {
    return res.status(400).json({ mensaje: "Faltan datos obligatorios del usuario" });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    return res.status(409).json({ mensaje: "Ya existe un usuario con ese email" });
  }

  const role = await Role.findOne({ _id: roleId, companyId });
  if (!role || String(role.companyId) !== String(companyId)) {
    return res.status(400).json({ mensaje: "El rol seleccionado no es valido" });
  }

  const generatedPassword = password?.trim() || generateTempPassword();
  const mustChangePassword = !password?.trim();

  const passwordHash = await bcrypt.hash(generatedPassword, 10);
  const user = await User.create({
    companyId,
    nombre: nombre.trim(),
    email: normalizedEmail,
    passwordHash,
    roleId,
    activo,
    mustChangePassword,
  });

  await logAudit({
    companyId,
    userId: req.user.userId,
    accion: "create",
    modulo: "users",
    detalle: `Usuario creado: ${user.email}`,
  });

  const hydratedUser = await User.findById(user._id)
    .select("-passwordHash")
    .populate("roleId", "nombre permisos");

  res.status(201).json({
    mensaje: "Usuario creado",
    user: hydratedUser,
    temporaryPassword: mustChangePassword ? generatedPassword : null,
  });
});

router.post(
  "/import",
  auth,
  permit("manage_users"),
  upload.single("file"),
  async (req, res) => {
    const { companyId } = await resolveCompanyScope(req);
    if (!req.file) {
      return res.status(400).json({ mensaje: "Debes subir un archivo CSV o Excel" });
    }

    const rows = await parseUploadedRows(req.file);
    if (!rows.length) {
      return res.status(400).json({ mensaje: "El archivo no contiene filas para importar" });
    }

    const roles = await Role.find({ companyId }).lean();
    const roleByKey = new Map();
    roles.forEach((role) => {
      roleByKey.set(String(role.nombre || "").trim().toLowerCase(), role);
      roleByKey.set(String(role.code || "").trim().toLowerCase(), role);
    });

    const result = {
      total: rows.length,
      created: 0,
      updated: 0,
      errors: [],
      temporaryPasswords: [],
    };

    for (const row of rows) {
      const nombre = String(row.nombre || "").trim();
      const email = String(row.email || "").trim().toLowerCase();
      const rolInput = String(row.rol || row.role || row.rolecode || "").trim().toLowerCase();
      const role = roleByKey.get(rolInput);

      if (!nombre || !email || !role) {
        result.errors.push({
          row: row._rowNumber,
          message: "Faltan datos obligatorios o rol invalido",
        });
        continue;
      }

      const activo = toBoolean(row.activo, true);
      const password = String(row.password || "").trim();
      const existing = await User.findOne({ companyId, email, isSuperAdmin: false });

      if (existing) {
        existing.nombre = nombre;
        existing.roleId = role._id;
        existing.activo = activo;

        if (password) {
          existing.passwordHash = await bcrypt.hash(password, 10);
          existing.mustChangePassword = false;
        }

        await existing.save();
        result.updated += 1;
        continue;
      }

      const generatedPassword = password || generateTempPassword();
      const mustChangePassword = !password;
      const user = await User.create({
        companyId,
        nombre,
        email,
        roleId: role._id,
        activo,
        passwordHash: await bcrypt.hash(generatedPassword, 10),
        mustChangePassword,
      });

      if (mustChangePassword) {
        result.temporaryPasswords.push({
          _id: user._id,
          nombre: user.nombre,
          email: user.email,
          temporaryPassword: generatedPassword,
        });
      }

      result.created += 1;
    }

    await logAudit({
      companyId,
      userId: req.user.userId,
      accion: "import",
      modulo: "users",
      detalle: `Importacion de usuarios: ${result.created} creados, ${result.updated} actualizados`,
    });

    res.json({
      mensaje: "Importacion finalizada",
      ...result,
    });
  }
);

router.post("/bulk", auth, permit("manage_users"), async (req, res) => {
  const { action, userIds = [] } = req.body;
  const { companyId } = await resolveCompanyScope(req);

  if (!action || !Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ mensaje: "Debes indicar accion y usuarios" });
  }

  const users = await User.find({
    _id: { $in: userIds },
    companyId,
    isSuperAdmin: false,
  });

  if (!users.length) {
    return res.status(404).json({ mensaje: "No se encontraron usuarios para procesar" });
  }

  let temporaryPasswords = [];

  if (action === "activate") {
    await User.updateMany({ _id: { $in: users.map((user) => user._id) } }, { activo: true });
  } else if (action === "deactivate") {
    const ownId = String(req.user.userId);
    if (users.some((user) => String(user._id) === ownId)) {
      return res.status(400).json({ mensaje: "No puedes desactivar tu propio usuario" });
    }

    await User.updateMany({ _id: { $in: users.map((user) => user._id) } }, { activo: false });
  } else if (action === "delete") {
    const ownId = String(req.user.userId);
    if (users.some((user) => String(user._id) === ownId)) {
      return res.status(400).json({ mensaje: "No puedes eliminar tu propio usuario" });
    }

    await User.deleteMany({ _id: { $in: users.map((user) => user._id) } });
  } else if (action === "reset_password") {
    temporaryPasswords = await Promise.all(
      users.map(async (user) => {
        const tempPassword = generateTempPassword();
        user.passwordHash = await bcrypt.hash(tempPassword, 10);
        user.mustChangePassword = true;
        await user.save();

        return {
          _id: user._id,
          nombre: user.nombre,
          email: user.email,
          temporaryPassword: tempPassword,
        };
      })
    );
  } else {
    return res.status(400).json({ mensaje: "Accion masiva no valida" });
  }

  await logAudit({
    companyId,
    userId: req.user.userId,
    accion: "bulk",
    modulo: "users",
    detalle: `Accion masiva ${action} sobre ${users.length} usuario(s)`,
  });

  res.json({
    mensaje: "Accion masiva aplicada",
    processed: users.length,
    temporaryPasswords,
  });
});

router.put("/:id", auth, permit("manage_users"), async (req, res) => {
  const { nombre, email, password, roleId, activo } = req.body;
  const update = {};
  const { companyId } = await resolveCompanyScope(req);

  const user = await User.findOne({
    _id: req.params.id,
    companyId,
    isSuperAdmin: false,
  });

  if (!user) {
    return res.status(404).json({ mensaje: "Usuario no encontrado" });
  }

  if (nombre) update.nombre = nombre.trim();
  if (typeof activo === "boolean") update.activo = activo;

  if (email) {
    const normalizedEmail = email.trim().toLowerCase();
    const duplicated = await User.findOne({
      email: normalizedEmail,
      _id: { $ne: req.params.id },
    });

    if (duplicated) {
      return res.status(409).json({ mensaje: "Ya existe un usuario con ese email" });
    }

    update.email = normalizedEmail;
  }

  if (roleId) {
    const role = await Role.findOne({ _id: roleId, companyId: user.companyId });
    if (!role) {
      return res.status(400).json({ mensaje: "El rol seleccionado no es valido" });
    }

    update.roleId = roleId;
  }

  if (password) {
    update.passwordHash = await bcrypt.hash(password, 10);
    update.mustChangePassword = false;
  }

  const updatedUser = await User.findByIdAndUpdate(req.params.id, update, {
    new: true,
  })
    .select("-passwordHash")
    .populate("roleId", "nombre permisos");

  await logAudit({
    companyId: user.companyId,
    userId: req.user.userId,
    accion: "update",
    modulo: "users",
    detalle: `Usuario actualizado: ${updatedUser.email}`,
  });

  res.json({ mensaje: "Usuario actualizado", user: updatedUser });
});

router.delete("/:id", auth, permit("manage_users"), async (req, res) => {
  if (String(req.params.id) === String(req.user.userId)) {
    return res.status(400).json({ mensaje: "No puedes eliminar tu propio usuario" });
  }

  const { companyId } = await resolveCompanyScope(req);
  const user = await User.findOneAndDelete({
    _id: req.params.id,
    companyId,
    isSuperAdmin: false,
  });

  if (!user) {
    return res.status(404).json({ mensaje: "Usuario no encontrado" });
  }

  await logAudit({
    companyId: user.companyId,
    userId: req.user.userId,
    accion: "delete",
    modulo: "users",
    detalle: `Usuario eliminado: ${user.email}`,
  });

  res.json({ mensaje: "Usuario eliminado" });
});

export default router;
