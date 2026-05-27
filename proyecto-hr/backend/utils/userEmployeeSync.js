import bcrypt from "bcryptjs";
import Employee from "../models/Employee.js";
import Role from "../models/Role.js";
import School from "../models/School.js";
import User from "../models/User.js";
import UserRoleAssignment from "../models/UserRoleAssignment.js";
import { generateTempPassword } from "./password.js";
import { syncPrimaryRoleAssignmentForUser } from "./accessControl.js";

export function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function inferEmployeeRoleLabel({ cargo = "", tipoEmpleado = "", nombreRol = "" } = {}) {
  const source = [cargo, tipoEmpleado, nombreRol].join(" ").toLowerCase();
  const looksTeaching =
    source.includes("docente") ||
    source.includes("profesor") ||
    source.includes("maestro") ||
    source.includes("teacher");
  return looksTeaching ? "Docente" : "Empleado";
}

export function splitFullName(fullName) {
  const parts = String(fullName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) {
    return { nombre: "", apellido: "" };
  }

  if (parts.length === 1) {
    return { nombre: parts[0], apellido: parts[0] };
  }

  return {
    nombre: parts[0],
    apellido: parts.slice(1).join(" "),
  };
}

export async function resolveDefaultActiveSchoolId({ companyId, preferredSchoolId = null }) {
  if (preferredSchoolId) return preferredSchoolId;

  const school = await School.findOne({ companyId, activa: true }).select("_id").lean();
  return school?._id || null;
}

export async function resolveDefaultEmployeeRole({ companyId }) {
  return Role.findOne({
    companyId,
    code: "EMPLEADO",
    activo: { $ne: false },
  });
}

async function updateExistingAssignmentEmployee({ user, employeeId, roleLabel = "" }) {
  if (!user?._id || !user.companyId) return;

  const assignment = await UserRoleAssignment.findOne({
    companyId: user.companyId,
    userId: user._id,
    active: true,
  });

  if (!assignment) return;

  assignment.employeeId = employeeId || assignment.employeeId || null;
  if (roleLabel) {
    assignment.roleLabel = roleLabel;
  }
  await assignment.save();
}

export async function syncUserForEmployeeCreation({ employee }) {
  const email = normalizeEmail(employee?.email);
  if (!employee?._id || !employee?.companyId || !email) {
    return { action: "skipped", reason: "missing_email", user: null, temporaryPassword: null };
  }

  const existingUser = await User.findOne({
    companyId: employee.companyId,
    email,
    isSuperAdmin: false,
  });

  const roleLabel = inferEmployeeRoleLabel({
    cargo: employee.cargo,
    tipoEmpleado: employee.tipoEmpleado,
  });

  if (existingUser) {
    let changed = false;
    if (String(existingUser.employeeId || "") !== String(employee._id)) {
      existingUser.employeeId = employee._id;
      changed = true;
    }
    if (!existingUser.schoolId && employee.schoolId) {
      existingUser.schoolId = employee.schoolId;
      changed = true;
    }
    if (changed) {
      await existingUser.save();
    }
    await updateExistingAssignmentEmployee({
      user: existingUser,
      employeeId: employee._id,
      roleLabel,
    });
    return { action: "linked", user: existingUser, temporaryPassword: null, roleLabel };
  }

  const defaultRole = await resolveDefaultEmployeeRole({ companyId: employee.companyId });
  if (!defaultRole) {
    const error = new Error("No existe un rol base EMPLEADO configurado en la organización.");
    error.status = 400;
    throw error;
  }

  const temporaryPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, 10);
  const user = await User.create({
    companyId: employee.companyId,
    schoolId: employee.schoolId || null,
    roleId: defaultRole._id,
    employeeId: employee._id,
    nombre: [employee.nombre, employee.apellido].filter(Boolean).join(" ").trim(),
    email,
    passwordHash,
    activo: employee.activo !== false,
    mustChangePassword: true,
  });

  await syncPrimaryRoleAssignmentForUser({
    user,
    companyId: employee.companyId,
    employeeId: employee._id,
    roleKey: "EMPLOYEE",
    scope: "SELF",
    roleLabel,
    active: true,
  });

  return { action: "created", user, temporaryPassword, roleLabel };
}

export async function syncEmployeeForUserCreation({ user, preferredSchoolId = null, role = null }) {
  const email = normalizeEmail(user?.email);
  if (!user?._id || !user?.companyId || !email) {
    return { action: "skipped", reason: "missing_email", employee: null };
  }

  const existingEmployee = await Employee.findOne({
    companyId: user.companyId,
    email,
  });

  const roleLabel = inferEmployeeRoleLabel({
    nombreRol: role?.nombre || "",
  });

  if (existingEmployee) {
    let changed = false;
    if (String(user.employeeId || "") !== String(existingEmployee._id)) {
      user.employeeId = existingEmployee._id;
      changed = true;
    }
    if (!user.schoolId && existingEmployee.schoolId) {
      user.schoolId = existingEmployee.schoolId;
      changed = true;
    }
    if (changed) {
      await user.save();
    }
    await updateExistingAssignmentEmployee({
      user,
      employeeId: existingEmployee._id,
      roleLabel,
    });
    return { action: "linked", employee: existingEmployee, roleLabel };
  }

  const schoolId = await resolveDefaultActiveSchoolId({
    companyId: user.companyId,
    preferredSchoolId: preferredSchoolId || user.schoolId || null,
  });

  if (!schoolId) {
    const error = new Error("No hay un colegio o sede activa para crear el perfil del empleado.");
    error.status = 400;
    throw error;
  }

  const { nombre, apellido } = splitFullName(user.nombre);
  const employee = await Employee.create({
    companyId: user.companyId,
    schoolId,
    nombre: nombre || user.nombre || "Empleado",
    apellido: apellido || nombre || user.nombre || "Empleado",
    email,
    cargo: roleLabel,
    area: "",
    tipoEmpleado: roleLabel === "Docente" ? "DOCENTE" : "OTRO",
    activo: user.activo !== false,
  });

  user.employeeId = employee._id;
  if (!user.schoolId) {
    user.schoolId = schoolId;
  }
  await user.save();

  await updateExistingAssignmentEmployee({
    user,
    employeeId: employee._id,
    roleLabel,
  });

  return { action: "created", employee, roleLabel };
}
