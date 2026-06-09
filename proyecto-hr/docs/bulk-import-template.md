# Plantilla oficial de importacion masiva

## Endpoint

- `GET /bulk-import/template`
- `POST /bulk-import/analyze`
- `POST /bulk-import/confirm`
- `GET /bulk-import/jobs`
- `GET /bulk-import/jobs/:id`

## Archivo generado

- Nombre: `Plantilla_Performia_Importacion.xlsx`
- Formato: Excel `.xlsx`
- Autenticacion: requerida
- Permisos: pensado para roles operativos de administracion e importacion

## Solapas incluidas

1. `Instrucciones`
2. `Organización`
3. `Departamentos`
4. `Empleados`
5. `Usuarios_y_Roles`
6. `Managers`
7. `KPIs`
8. `OKRs`
9. `Catálogos`

## Reglas de seguridad

- `SUPER_ADMIN` no se crea desde plantilla.
- `PLATFORM` no aparece como opcion disponible para cliente.
- La organizacion real siempre la determina el backend segun el scope autenticado.
- La plantilla no debe usarse para confiar en `companyId`, `schoolId` ni IDs internos como fuente de verdad.
- La hoja `Usuarios_y_Roles` no incluye credenciales ni claves.

## Catalogos oficiales

### `roleKey`

- `ORG_OWNER`
- `ORG_ADMIN`
- `HR`
- `MANAGER`
- `EMPLOYEE`
- `VIEWER`
- `AUDITOR`

### `scope`

- `ORGANIZATION`
- `REGION_COUNTRY`
- `BUSINESS_UNIT`
- `DEPARTMENT`
- `TEAM`
- `SELF`

### `relationship_type`

- `direct`
- `dotted_line`
- `temporary`

### `status`

- `active`
- `inactive`

### `yes/no`

- `yes`
- `no`

## Notas de implementacion

- La plantilla se genera desde backend con `exceljs`, libreria ya presente en el proyecto.
- Se incluyen encabezados claros, filas ficticias y formato basico para lectura.
- El flujo unificado trabaja en dos pasos: analizar y luego confirmar.
- `POST /bulk-import/analyze` no inserta datos; valida, genera preview y crea `ImportJob` en estado `analyzed`.
- `POST /bulk-import/confirm` solo confirma previews vigentes y sin errores bloqueantes.
- `GET /bulk-import/jobs` y `GET /bulk-import/jobs/:id` listan solo trabajos del tenant autenticado.
- La importacion legacy en `educationExports.routes.js` sigue activa para compatibilidad. En produccion el endpoint directo legacy `/education-exports/import/:dataset` ya esta marcado como riesgoso y deshabilitado para uso general, porque evita la plantilla unificada y parte de sus validaciones.
