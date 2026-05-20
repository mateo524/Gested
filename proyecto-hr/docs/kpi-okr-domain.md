# KPI / OKR Domain

## Resumen

Performia persiste KPIs y OKRs como registros reales multi-tenant en backend.

El dominio usa dos modelos:

- `KPIRecord`
- `OKRRecord`

Ambos respetan:

- `companyId` y `schoolId` resueltos desde backend scope
- filtros por `roleKey + scope`
- compatibilidad con importación masiva unificada
- lectura desde reporte ejecutivo

## Modelos

### KPIRecord

Campos principales:

- `companyId`
- `schoolId`
- `employeeId`
- `ownerUserId`
- `departmentCode`
- `teamId`
- `cycleId`
- `lookupKey`
- `kpiCode`
- `name`
- `targetValue`
- `currentValue`
- `unit`
- `frequency`
- `period`
- `weight`
- `status`
- `active`
- `source`
- `importJobId`
- `sourceImportJobId`
- `createdBy`
- `updatedBy`
- `createdAt`
- `updatedAt`

### OKRRecord

Campos principales:

- `companyId`
- `schoolId`
- `employeeId`
- `ownerUserId`
- `departmentCode`
- `teamId`
- `cycleId`
- `lookupKey`
- `okrCode`
- `objective`
- `objectiveTitle`
- `keyResult`
- `keyResultTitle`
- `period`
- `quarter`
- `targetValue`
- `currentValue`
- `weight`
- `status`
- `active`
- `source`
- `importJobId`
- `sourceImportJobId`
- `createdBy`
- `updatedBy`
- `createdAt`
- `updatedAt`

## Endpoints

Base:

- `GET /metrics/kpi-records`
- `GET /metrics/kpi-records/:id`
- `POST /metrics/kpi-records`
- `PUT /metrics/kpi-records/:id`
- `DELETE /metrics/kpi-records/:id`

- `GET /metrics/okr-records`
- `GET /metrics/okr-records/:id`
- `POST /metrics/okr-records`
- `PUT /metrics/okr-records/:id`
- `DELETE /metrics/okr-records/:id`

## Permisos

### Lectura

Permitida para usuarios con alguno de estos permisos:

- `manage_metrics`
- `view_reports`
- `download_reports`
- `download_team_reports`
- `download_self_report`
- `read_only_access`
- `view_audit`

### Escritura

Requiere:

- `manage_metrics`

Esto deja a:

- `VIEWER` / `AUDITOR`: solo lectura
- `EMPLOYEE`: solo lectura propia cuando el scope lo permite
- `MANAGER`: lectura/gestión solo dentro de `TEAM` o `DEPARTMENT`
- `HR` / `ORG_ADMIN` / `ORG_OWNER`: dentro de su organización
- `SUPER_ADMIN`: global donde corresponde

## Scope enforcement

Los filtros usan backend scope y no confían en `companyId` ni `schoolId` del cliente para usuarios no `SUPER_ADMIN`.

Reglas principales:

- `MANAGER + TEAM` solo ve empleados de su equipo
- `MANAGER + DEPARTMENT` solo ve su departamento
- `EMPLOYEE + SELF` solo ve sus propios registros
- `ORG_ADMIN`, `ORG_OWNER` y `HR` quedan restringidos a su organización

## Integración con bulk import

La confirmación de `bulk import`:

- persiste filas de `KPIs` en `KPIRecord`
- persiste filas de `OKRs` en `OKRRecord`
- usa `companyId` y `schoolId` del scope autenticado
- resuelve `employeeId` a partir de `owner_employee_code` o `employee_email`
- resuelve `ownerUserId` si ya existe un usuario para ese email
- marca `source: "bulk_import"`
- guarda `importJobId`
- mantiene `sourceImportJobId` por compatibilidad

El `lookupKey` se arma para upsert seguro combinando:

- código o nombre base
- período
- empleado
- departamento
- equipo

## Integración con reporte ejecutivo

El reporte ejecutivo consume `KPIRecord` y `OKRRecord` para:

- disponibilidad de KPIs/OKRs en overview
- detalle por empleado

Si no hay datos persistidos:

- responde estado vacío honesto
- no inventa métricas

## Integración con dashboard

El dashboard resume conteos reales de:

- `activeKpis`
- `activeOkrs`

en el bloque `educational`.

## Limitaciones actuales

- el módulo sigue siendo operativo; no reemplaza un sistema avanzado de cascada de objetivos
- no existe todavía un dominio formal de `Department`
- `cycleId` puede quedar vacío si el origen no provee un ciclo explícito
- la plantilla oficial actual de KPIs/OKRs no exige `current_value`, `weight` ni `team_id`, pero el backend ya los soporta si vienen
