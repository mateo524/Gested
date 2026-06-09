import test from "node:test";
import assert from "node:assert/strict";
import Employee from "../../models/Employee.js";
import Role from "../../models/Role.js";
import School from "../../models/School.js";
import User from "../../models/User.js";
import UserRoleAssignment from "../../models/UserRoleAssignment.js";
import {
  inferEmployeeRoleLabel,
  syncEmployeeForUserCreation,
  syncUserForEmployeeCreation,
} from "../../utils/userEmployeeSync.js";

function withPatched(object, overrides, run) {
  const originals = new Map();
  for (const [key, value] of Object.entries(overrides)) {
    originals.set(key, object[key]);
    object[key] = value;
  }

  const restore = () => {
    for (const [key, value] of originals.entries()) {
      object[key] = value;
    }
  };

  return Promise.resolve()
    .then(run)
    .finally(restore);
}

test("inferEmployeeRoleLabel detecta perfiles docentes", () => {
  assert.equal(inferEmployeeRoleLabel({ cargo: "Docente de Matemática" }), "Docente");
  assert.equal(inferEmployeeRoleLabel({ cargo: "Analista de RRHH" }), "Empleado");
});

test("crear empleado con email crea usuario EMPLOYEE/SELF y no duplica tenant", async () => {
  let createdUserPayload = null;
  let assignmentPayload = null;

  await withPatched(
    User,
    {
      findOne: async () => null,
      create: async (payload) => {
        createdUserPayload = payload;
        return {
          _id: "user-1",
          companyId: payload.companyId,
          schoolId: payload.schoolId,
          roleId: payload.roleId,
          employeeId: payload.employeeId,
          email: payload.email,
          activo: payload.activo,
          save: async () => null,
        };
      },
    },
    async () =>
      withPatched(
        Role,
        {
          findOne: async () => ({ _id: "role-employee", code: "EMPLEADO", nombre: "Empleado" }),
        },
        async () =>
          withPatched(
            UserRoleAssignment,
            {
              updateMany: async () => null,
              findOne: async () => null,
              findOneAndUpdate: async (_filter, update) => {
                assignmentPayload = update.$set;
                return { _id: "assign-1", ...assignmentPayload };
              },
            },
            async () => {
              const result = await syncUserForEmployeeCreation({
                employee: {
                  _id: "emp-1",
                  companyId: "org-a",
                  schoolId: "school-a",
                  nombre: "Ana",
                  apellido: "Perez",
                  email: "ana@org.com",
                  cargo: "Docente",
                  tipoEmpleado: "DOCENTE",
                  activo: true,
                },
              });

              assert.equal(result.action, "created");
              assert.equal(createdUserPayload.companyId, "org-a");
              assert.equal(createdUserPayload.schoolId, "school-a");
              assert.equal(createdUserPayload.employeeId, "emp-1");
              assert.equal(createdUserPayload.email, "ana@org.com");
              assert.equal(createdUserPayload.mustChangePassword, true);
              assert.equal(assignmentPayload.roleKey, "EMPLOYEE");
              assert.equal(assignmentPayload.scope, "SELF");
              assert.equal(assignmentPayload.roleLabel, "Docente");
            }
          )
      )
  );
});

test("crear empleado con usuario existente vincula y no duplica", async () => {
  let userSaveCount = 0;
  const existingUser = {
    _id: "user-2",
    companyId: "org-a",
    schoolId: null,
    employeeId: null,
    email: "maria@org.com",
    save: async () => {
      userSaveCount += 1;
    },
  };

  await withPatched(
    User,
    {
      findOne: async () => existingUser,
      create: async () => {
        throw new Error("No deberia crear un usuario duplicado");
      },
    },
    async () =>
      withPatched(
        UserRoleAssignment,
        {
          findOne: async () => ({
            employeeId: null,
            roleLabel: "",
            save: async function save() {
              return this;
            },
          }),
        },
        async () => {
          const result = await syncUserForEmployeeCreation({
            employee: {
              _id: "emp-2",
              companyId: "org-a",
              schoolId: "school-a",
              email: "maria@org.com",
              cargo: "Analista",
              tipoEmpleado: "OTRO",
            },
          });

          assert.equal(result.action, "linked");
          assert.equal(existingUser.employeeId, "emp-2");
          assert.equal(existingUser.schoolId, "school-a");
          assert.equal(userSaveCount, 1);
        }
      )
  );
});

test("crear usuario con email crea empleado basico si no existe", async () => {
  let createdEmployeePayload = null;
  const user = {
    _id: "user-3",
    companyId: "org-a",
    schoolId: null,
    employeeId: null,
    nombre: "Laura Gomez",
    email: "laura@org.com",
    activo: true,
    save: async function save() {
      return this;
    },
  };

  await withPatched(
    Employee,
    {
      findOne: async () => null,
      create: async (payload) => {
        createdEmployeePayload = payload;
        return { _id: "emp-3", ...payload };
      },
    },
    async () =>
      withPatched(
        School,
        {
          findOne: () => ({
            select: () => ({
              lean: async () => ({ _id: "school-a" }),
            }),
          }),
        },
        async () =>
          withPatched(
            UserRoleAssignment,
            {
              findOne: async () => null,
            },
            async () => {
              const result = await syncEmployeeForUserCreation({
                user,
                role: { nombre: "Docente" },
              });

              assert.equal(result.action, "created");
              assert.equal(createdEmployeePayload.companyId, "org-a");
              assert.equal(createdEmployeePayload.schoolId, "school-a");
              assert.equal(createdEmployeePayload.email, "laura@org.com");
              assert.equal(createdEmployeePayload.cargo, "Docente");
              assert.equal(user.employeeId, "emp-3");
              assert.equal(user.schoolId, "school-a");
            }
          )
      )
  );
});

test("crear usuario con empleado existente vincula y no duplica", async () => {
  let userSaveCount = 0;
  const user = {
    _id: "user-4",
    companyId: "org-a",
    schoolId: null,
    employeeId: null,
    nombre: "Pedro Ruiz",
    email: "pedro@org.com",
    save: async () => {
      userSaveCount += 1;
    },
  };

  await withPatched(
    Employee,
    {
      findOne: async () => ({
        _id: "emp-4",
        companyId: "org-a",
        schoolId: "school-a",
        email: "pedro@org.com",
      }),
      create: async () => {
        throw new Error("No deberia crear un empleado duplicado");
      },
    },
    async () =>
      withPatched(
        UserRoleAssignment,
        {
          findOne: async () => ({
            employeeId: null,
            roleLabel: "",
            save: async function save() {
              return this;
            },
          }),
        },
        async () => {
          const result = await syncEmployeeForUserCreation({
            user,
            role: { nombre: "Empleado" },
          });

          assert.equal(result.action, "linked");
          assert.equal(user.employeeId, "emp-4");
          assert.equal(user.schoolId, "school-a");
          assert.equal(userSaveCount, 1);
        }
      )
  );
});
