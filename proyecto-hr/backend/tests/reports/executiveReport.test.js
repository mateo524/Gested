import test from "node:test";
import assert from "node:assert/strict";
import { assertExecutiveReportAccess, buildExecutiveBaseEmployeeFilter } from "../../routes/reports.routes.js";

test("MANAGER con DEPARTMENT no puede consultar otro departamento", () => {
  assert.throws(
    () =>
      buildExecutiveBaseEmployeeFilter(
        {
          companyId: "org-a",
          schoolId: "school-a",
          roleKey: "MANAGER",
          roleCode: "JEFE",
          roleScope: "DEPARTMENT",
          departmentCode: "SECUNDARIA",
          isSuperAdmin: false,
        },
        {
          department: "PRIMARIA",
        }
      ),
    /tu departamento asignado/
  );
});

test("EMPLEADO no puede acceder al reporte ejecutivo", () => {
  assert.throws(
    () =>
      assertExecutiveReportAccess({
        user: { permisos: ["view_reports"] },
        scope: { roleKey: "EMPLOYEE", roleCode: "EMPLEADO", isSuperAdmin: false },
      }),
    /no esta disponible/
  );
});

test("ORG_ADMIN queda filtrado a su organizacion y colegio", () => {
  const filter = buildExecutiveBaseEmployeeFilter(
    {
      companyId: "org-a",
      schoolId: "school-a",
      roleKey: "ORG_ADMIN",
      roleCode: "ADMIN_COLEGIO",
      isSuperAdmin: false,
    },
    {
      department: "SECUNDARIA",
    }
  );

  assert.equal(filter.companyId, "org-a");
  assert.equal(filter.schoolId, "school-a");
  assert.equal(filter.area, "SECUNDARIA");
});
