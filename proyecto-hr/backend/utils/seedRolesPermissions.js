import Permission from "../models/Permission.js";
import Role from "../models/Role.js";
import { PERMISSION_SEED, ROLE_DEFINITIONS } from "./permissions.js";

export async function ensurePermissionsSeed() {
  for (const permission of PERMISSION_SEED) {
    await Permission.updateOne({ code: permission.code }, { $set: permission }, { upsert: true });
  }
}

export async function ensureEducationalRoles({ companyId, schoolId = null }) {
  for (const roleDefinition of ROLE_DEFINITIONS) {
    await Role.updateOne(
      {
        companyId,
        nombre: roleDefinition.nombre,
      },
      {
        $set: {
          companyId,
          schoolId,
          code: roleDefinition.code,
          nombre: roleDefinition.nombre,
          permisos: roleDefinition.permisos,
          scope: roleDefinition.scope,
          activo: true,
        },
      },
      { upsert: true }
    );
  }
}
