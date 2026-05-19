# Plantilla demo para Carga masiva unificada

Esta guía deja un dataset demo ficticio listo para copiar a la plantilla oficial de Performia sin tocar base de datos ni ejecutar importaciones.

## 1. Formato real esperado

- **Formato de archivo:** Excel `.xlsx`
- **Nombre esperado:** `Plantilla_Performia_Importacion.xlsx`
- **Hojas reales esperadas por backend:**
  1. `Instrucciones`
  2. `Organización`
  3. `Departamentos`
  4. `Empleados`
  5. `Usuarios_y_Roles`
  6. `Managers`
  7. `KPIs`
  8. `OKRs`
  9. `Catálogos`

## 2. Reglas importantes para este demo

- No incluir `companyId`, `schoolId`, IDs internos ni referencias de base.
- El tenant real lo resuelve el backend autenticado.
- Usar solo correos ficticios bajo `performia-demo.test`.
- La hoja `Usuarios_y_Roles` **no** incluye contraseña.
- Si se crean usuarios nuevos por importación, el backend genera contraseña temporal.
- **Compatibilidad real hoy:** `MANAGER` solo admite `TEAM` por importación.  
  No usar `MANAGER + DEPARTMENT` en esta plantilla.
- `VIEWER` y `AUDITOR` admiten `ORGANIZATION`.
- `ORG_ADMIN` y `ORG_OWNER` admiten `ORGANIZATION`.
- `HR` admite `ORGANIZATION`.
- `EMPLOYEE` admite `SELF`.

## 3. Placeholders del tenant real

Estos valores **no van como columnas** en la plantilla, pero conviene documentarlos cuando se prepare el entorno demo:

- `PLACEHOLDER_TENANT`: tenant/organización autenticada donde se hará la importación
- `PLACEHOLDER_SCHOOL`: sede/colegio autenticado donde se harán las altas

## 4. Columnas exactas por hoja

### Organización

| Columna |
|---|
| `organization_code` |
| `organization_name` |
| `legal_name` |
| `country` |
| `region_country` |
| `business_unit` |
| `status` |
| `notes` |

### Departamentos

| Columna |
|---|
| `department_code` |
| `department_name` |
| `parent_department_code` |
| `business_unit` |
| `region_country` |
| `status` |
| `is_people_area` |

### Empleados

| Columna |
|---|
| `employee_code` |
| `first_name` |
| `last_name` |
| `work_email` |
| `job_title` |
| `department_code` |
| `business_unit` |
| `region_country` |
| `hire_date` |
| `employment_status` |
| `active` |

### Usuarios_y_Roles

| Columna |
|---|
| `employee_code` |
| `work_email` |
| `role_key` |
| `scope` |
| `scope_reference_code` |
| `status` |
| `can_login` |
| `notes` |

### Managers

| Columna |
|---|
| `employee_code` |
| `manager_employee_code` |
| `relationship_type` |
| `primary_manager` |
| `start_date` |
| `end_date` |
| `status` |

### KPIs

| Columna |
|---|
| `kpi_code` |
| `kpi_name` |
| `owner_employee_code` |
| `department_code` |
| `target_value` |
| `unit` |
| `frequency` |
| `status` |
| `active` |

### OKRs

| Columna |
|---|
| `okr_code` |
| `objective_title` |
| `key_result_title` |
| `owner_employee_code` |
| `department_code` |
| `quarter` |
| `target_value` |
| `status` |

### Catálogos

Se recomienda **no editarla** y conservar la hoja generada por Performia.

## 5. Dataset demo concreto

### Hoja `Organización`

| organization_code | organization_name | legal_name | country | region_country | business_unit | status | notes |
|---|---|---|---|---|---|---|---|
| ORG-HORIZONTE | Instituto Horizonte | Instituto Horizonte Demo SA | AR | Córdoba | Educación Institucional | active | Dataset ficticio para demos. El tenant real lo resuelve PLACEHOLDER_TENANT y la sede real PLACEHOLDER_SCHOOL. |

### Hoja `Departamentos`

| department_code | department_name | parent_department_code | business_unit | region_country | status | is_people_area |
|---|---|---|---|---|---|---|
| DEP-ACA | Académica |  | Educación Institucional | Córdoba | active | no |
| DEP-OPE | Operaciones |  | Educación Institucional | Córdoba | active | no |
| DEP-RRHH | RR. HH. |  | Educación Institucional | Córdoba | active | yes |
| DEP-TEC | Tecnología Educativa |  | Educación Institucional | Córdoba | active | no |

### Hoja `Empleados`

| employee_code | first_name | last_name | work_email | job_title | department_code | business_unit | region_country | hire_date | employment_status | active |
|---|---|---|---|---|---|---|---|---|---|---|
| EMP-0001 | Valeria | Suárez | admin.horizonte@performia-demo.test | Directora institucional | DEP-ACA | Educación Institucional | Córdoba | 2022-02-01 | active | yes |
| EMP-0002 | Martín | Ríos | rrhh.horizonte@performia-demo.test | Responsable de RR. HH. | DEP-RRHH | Educación Institucional | Córdoba | 2022-05-16 | active | yes |
| EMP-0003 | Lucía | Ferrer | lucia.ferrer@performia-demo.test | Coordinadora académica | DEP-ACA | Educación Institucional | Córdoba | 2023-02-01 | active | yes |
| EMP-0004 | Diego | Peralta | diego.peralta@performia-demo.test | Coordinador de operaciones | DEP-OPE | Educación Institucional | Córdoba | 2023-03-01 | active | yes |
| EMP-0005 | Clara | Benítez | clara.benitez@performia-demo.test | Coordinadora de tecnología educativa | DEP-TEC | Educación Institucional | Córdoba | 2023-04-03 | active | yes |
| EMP-0006 | Paula | Méndez | paula.mendez@performia-demo.test | Docente | DEP-ACA | Educación Institucional | Córdoba | 2024-02-15 | active | yes |
| EMP-0007 | Tomás | Ibarra | tomas.ibarra@performia-demo.test | Docente | DEP-ACA | Educación Institucional | Córdoba | 2024-02-15 | active | yes |
| EMP-0008 | Sofía | Quiroga | sofia.quiroga@performia-demo.test | Docente | DEP-ACA | Educación Institucional | Córdoba | 2024-03-04 | active | yes |
| EMP-0009 | Nicolás | Vega | nicolas.vega@performia-demo.test | Docente | DEP-ACA | Educación Institucional | Córdoba | 2024-03-18 | active | yes |
| EMP-0010 | Camila | Duarte | camila.duarte@performia-demo.test | Docente | DEP-ACA | Educación Institucional | Córdoba | 2024-04-08 | active | yes |
| EMP-0011 | Bruno | Salas | bruno.salas@performia-demo.test | Asistente operativo | DEP-OPE | Educación Institucional | Córdoba | 2024-01-22 | active | yes |
| EMP-0012 | Julieta | Acosta | julieta.acosta@performia-demo.test | Asistente operativo | DEP-OPE | Educación Institucional | Córdoba | 2024-02-12 | active | yes |
| EMP-0013 | Leandro | Ponce | leandro.ponce@performia-demo.test | Asistente operativo | DEP-OPE | Educación Institucional | Córdoba | 2024-02-26 | active | yes |
| EMP-0014 | Emilia | Torres | emilia.torres@performia-demo.test | Analista RR. HH. | DEP-RRHH | Educación Institucional | Córdoba | 2024-01-08 | active | yes |
| EMP-0015 | Javier | Luna | lector.horizonte@performia-demo.test | Analista RR. HH. | DEP-RRHH | Educación Institucional | Córdoba | 2024-01-29 | active | yes |
| EMP-0016 | Mateo | Gil | mateo.gil@performia-demo.test | Soporte TI educativo | DEP-TEC | Educación Institucional | Córdoba | 2024-02-05 | active | yes |
| EMP-0017 | Rocío | Paz | rocio.paz@performia-demo.test | Soporte TI educativo | DEP-TEC | Educación Institucional | Córdoba | 2024-02-19 | active | yes |
| EMP-0018 | Alan | Ferreyra | alan.ferreyra@performia-demo.test | Soporte TI educativo | DEP-TEC | Educación Institucional | Córdoba | 2024-03-11 | active | yes |

### Hoja `Usuarios_y_Roles`

> Nota: para que valide, el `work_email` debe existir en `Empleados`.

| employee_code | work_email | role_key | scope | scope_reference_code | status | can_login | notes |
|---|---|---|---|---|---|---|---|
| EMP-0001 | admin.horizonte@performia-demo.test | ORG_ADMIN | ORGANIZATION | ORG-HORIZONTE | active | yes | Usuario principal de administración institucional demo. |
| EMP-0002 | rrhh.horizonte@performia-demo.test | HR | ORGANIZATION | ORG-HORIZONTE | active | yes | Usuario de RR. HH. demo. |
| EMP-0003 | lucia.ferrer@performia-demo.test | MANAGER | TEAM | TEAM-ACADEMICA | active | yes | Import-compatible. Si luego se quiere DEPARTMENT, ajustarlo manualmente en Roles y accesos. |
| EMP-0006 | paula.mendez@performia-demo.test | EMPLOYEE | SELF | EMP-0006 | active | yes | Colaboradora demo para visión personal. |
| EMP-0015 | lector.horizonte@performia-demo.test | VIEWER | ORGANIZATION | ORG-HORIZONTE | active | yes | Usuario lector demo para revisión de reportes y vistas de lectura. |

### Hoja `Managers`

| employee_code | manager_employee_code | relationship_type | primary_manager | start_date | end_date | status |
|---|---|---|---|---|---|---|
| EMP-0002 | EMP-0001 | direct | yes | 2024-01-01 |  | active |
| EMP-0003 | EMP-0001 | direct | yes | 2024-01-01 |  | active |
| EMP-0004 | EMP-0001 | direct | yes | 2024-01-01 |  | active |
| EMP-0005 | EMP-0001 | direct | yes | 2024-01-01 |  | active |
| EMP-0006 | EMP-0003 | direct | yes | 2024-02-15 |  | active |
| EMP-0007 | EMP-0003 | direct | yes | 2024-02-15 |  | active |
| EMP-0008 | EMP-0003 | direct | yes | 2024-03-04 |  | active |
| EMP-0009 | EMP-0003 | direct | yes | 2024-03-18 |  | active |
| EMP-0010 | EMP-0003 | direct | yes | 2024-04-08 |  | active |
| EMP-0011 | EMP-0004 | direct | yes | 2024-01-22 |  | active |
| EMP-0012 | EMP-0004 | direct | yes | 2024-02-12 |  | active |
| EMP-0013 | EMP-0004 | direct | yes | 2024-02-26 |  | active |
| EMP-0014 | EMP-0002 | direct | yes | 2024-01-08 |  | active |
| EMP-0015 | EMP-0002 | direct | yes | 2024-01-29 |  | active |
| EMP-0016 | EMP-0005 | direct | yes | 2024-02-05 |  | active |
| EMP-0017 | EMP-0005 | direct | yes | 2024-02-19 |  | active |
| EMP-0018 | EMP-0005 | direct | yes | 2024-03-11 |  | active |

### Hoja `KPIs`

| kpi_code | kpi_name | owner_employee_code | department_code | target_value | unit | frequency | status | active |
|---|---|---|---|---|---|---|---|---|
| KPI-ACA-001 | Satisfacción del estudiante | EMP-0003 | DEP-ACA | 88 | percent | quarterly | active | yes |
| KPI-OPE-001 | Cumplimiento de calendario operativo | EMP-0004 | DEP-OPE | 95 | percent | monthly | active | yes |
| KPI-TEC-001 | Tiempo de respuesta a incidentes TI | EMP-0005 | DEP-TEC | 24 | hours | monthly | active | yes |

### Hoja `OKRs`

| okr_code | objective_title | key_result_title | owner_employee_code | department_code | quarter | target_value | status |
|---|---|---|---|---|---|---|---|
| OKR-2026-Q2-001 | Mejorar la participación en evaluaciones al 90% | Alcanzar 90% de evaluaciones enviadas antes del cierre de ciclo | EMP-0002 | DEP-RRHH | 2026-Q2 | 90 | active |
| OKR-2026-Q2-002 | Reducir tiempos de resolución operativa | Bajar el tiempo promedio de resolución operativa a 48 horas | EMP-0004 | DEP-OPE | 2026-Q2 | 48 | active |
| OKR-2026-Q2-003 | Aumentar adopción de herramientas educativas digitales | Lograr 80% de uso activo mensual de la plataforma educativa | EMP-0005 | DEP-TEC | 2026-Q2 | 80 | active |

### Hoja `Catálogos`

No reemplazarla.  
Usar la hoja oficial descargada desde la app para conservar:

- `roleKey`
- `scope`
- `relationship_type`
- `status`
- `yes/no`

## 6. Validaciones esperadas

Si esta plantilla se completa con estos datos y se mantiene el formato oficial, debería validar correctamente al menos en estas reglas:

- hojas requeridas presentes
- columnas requeridas presentes
- `employee_code` únicos
- `work_email` con formato válido
- `department_code` existente en `Departamentos`
- `Usuarios_y_Roles` referenciando empleados existentes
- `role_key` válidos
- `scope` válidos para cada `role_key`
- relaciones de manager con empleados existentes
- `target_value` numérico en KPIs
- `objective_title` y `key_result_title` obligatorios en OKRs

## 7. Errores que debería detectar si algo está mal

El analizador debería marcar, entre otros:

- falta de una hoja requerida
- falta de una columna requerida
- `department_code` duplicado en `Departamentos`
- `employee_code` duplicado en `Empleados`
- `employee_code` existente con otro email
- `work_email` inválido o no existente
- `role_key` bloqueado (`SUPER_ADMIN`, `PLATFORM`)
- `scope` inválido para el `role_key`
- `MANAGER + DEPARTMENT` como combinación no permitida por la importación actual
- `manager_employee_code` inexistente
- `target_value` no numérico en KPIs
- fechas inválidas
- `companyId` / `schoolId` informados en columnas extra, que serían ignorados con advertencia

## 8. Notas operativas para demo

### Credenciales

La plantilla no lleva contraseñas.  
Si se crean usuarios nuevos por importación:

- el backend genera contraseña temporal
- la UI actual no expone esas contraseñas de manera amigable en pantalla

Por eso, si la demo necesita iniciar sesión con cada perfil importado, conviene una de estas dos opciones:

1. registrar las contraseñas temporales desde la respuesta controlada del backend en entorno QA, o
2. recrear luego esos usuarios manualmente desde `Usuarios y credenciales` con claves demo explícitas

### Scope de manager

El caso pedido originalmente como `MANAGER + DEPARTMENT` no es compatible con el validador actual de importación.  
Para esta plantilla se usa:

- `MANAGER + TEAM`
- `scope_reference_code = TEAM-ACADEMICA`

Si en la demo se quiere mostrar alcance departamental, se puede ajustar después manualmente desde `Roles y accesos`, sin cambiar esta plantilla base.

### Campos resueltos por backend

Aunque la hoja `Organización` tenga datos descriptivos, el backend sigue mandando en:

- tenant real
- organización real
- sede real

Por eso esta plantilla sirve para una demo consistente, pero no debe usarse para inferir `companyId` ni `schoolId`.
