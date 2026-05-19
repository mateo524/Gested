# Checklist manual post-import para tenant demo

Esta guía sirve para completar manualmente un tenant demo de Performia después de usar la plantilla documentada en [C:\Dev\Gested\proyecto-hr\docs\demo-tenant-import-template.md](C:\Dev\Gested\proyecto-hr\docs\demo-tenant-import-template.md).

No ejecuta importaciones ni toca base de datos por fuera de la UI.  
Está pensada para entorno **QA/demo aislado** y datos 100% ficticios.

## 1. Precondiciones

Antes de empezar:

- [ ] Confirmar que el entorno es **QA/demo**, no producción.
- [ ] Confirmar que el tenant activo es el correcto.
- [ ] Confirmar que la sede/colegio activo corresponde al tenant demo.
- [ ] Ingresar con el usuario admin demo:
  - `admin.horizonte@performia-demo.test`
- [ ] Tener importada, o lista para importar, la plantilla de:
  - `Instituto Horizonte`
- [ ] No usar nombres reales, correos reales ni datos sensibles.
- [ ] No mezclar este tenant con QA funcional de otros flujos.

## 2. Verificación post-import

Después de importar la plantilla:

### Personas
- [ ] Abrir `Personas`
- [ ] Verificar que existan **18 empleados**
- [ ] Verificar que las áreas visibles sean:
  - Académica
  - Operaciones
  - RR. HH.
  - Tecnología Educativa
- [ ] Verificar que Lucía Ferrer, Diego Peralta, Martín Ríos y Clara Benítez existan

### Usuarios y credenciales
- [ ] Abrir `Usuarios y credenciales`
- [ ] Verificar que existan al menos estos usuarios:
  - `admin.horizonte@performia-demo.test`
  - `rrhh.horizonte@performia-demo.test`
  - `lucia.ferrer@performia-demo.test`
  - `paula.mendez@performia-demo.test`
  - `lector.horizonte@performia-demo.test`
- [ ] Verificar que estén activos

### Roles y accesos
- [ ] Abrir `Roles y accesos`
- [ ] Verificar assignments visibles para:
  - `ORG_ADMIN + ORGANIZATION`
  - `HR + ORGANIZATION`
  - `MANAGER + TEAM`
  - `EMPLOYEE + SELF`
  - `VIEWER + ORGANIZATION`
- [ ] Confirmar que el manager importado quedó con `TEAM`
- [ ] Si la demo requiere mostrar alcance por departamento:
  - [ ] ajustar manualmente después desde `Roles y accesos`
  - [ ] no modificar la plantilla importada base

### Managers
- [ ] En `Personas`, revisar que empleados del área Académica dependan de Lucía Ferrer
- [ ] Revisar que Operaciones dependa de Diego Peralta
- [ ] Revisar que RR. HH. dependa de Martín Ríos
- [ ] Revisar que Tecnología Educativa dependa de Clara Benítez

### KPIs y OKRs
- [ ] Abrir `Objetivos / Indicadores`
- [ ] Ir a tab `KPIs cargados`
- [ ] Verificar 3 KPIs visibles
- [ ] Ir a tab `OKRs cargados`
- [ ] Verificar 3 OKRs visibles

### Historial de importación
- [ ] Abrir `Datos / Carga masiva`
- [ ] Verificar 1 job de importación demo exitoso
- [ ] Verificar archivo, estado y resumen

## 3. Competencias a crear

Abrir:
- `Objetivos / Indicadores` o la vista de `Competencias`

Crear estas 6 competencias:

| Competencia | Descripción breve | Tipo / sugerencia | Área sugerida |
|---|---|---|---|
| Calidad pedagógica | Aplica criterios didácticos claros y consistentes en su práctica. | Docente / Conceptual | Académica |
| Gestión del tiempo | Organiza tareas, prioridades y tiempos de entrega de forma sostenible. | Transversal / Procedimental | Todas |
| Colaboración | Trabaja con otros equipos y comparte información de manera efectiva. | Transversal / Actitudinal | Todas |
| Comunicación | Comunica decisiones, avances y feedback con claridad y respeto. | Transversal / Actitudinal | Todas |
| Cumplimiento operativo | Sigue procesos, plazos y estándares definidos por la institución. | Transversal / Procedimental | Operaciones |
| Orientación al estudiante | Prioriza una experiencia formativa consistente y centrada en el estudiante. | Docente / Actitudinal | Académica |

### Checklist
- [ ] Crear 6 competencias
- [ ] Verificarlas en listado
- [ ] Confirmar que al menos Académica y Operaciones queden representadas

## 4. Indicadores base a crear

Abrir:
- `Objetivos / Indicadores`

Crear entre 6 y 8 indicadores base. Recomendación:

| Indicador | Descripción | Competencia sugerida | Escala esperada | Área sugerida |
|---|---|---|---|---|
| Planifica clases con objetivos claros | Define objetivos, secuencia y criterios de evaluación visibles. | Calidad pedagógica | 1 a 5 | Académica |
| Entrega seguimiento en fecha | Cumple plazos de seguimiento, reportes o tareas comprometidas. | Gestión del tiempo | 1 a 5 | Todas |
| Comparte información con otras áreas | Coordina acciones y comunica cambios relevantes a tiempo. | Colaboración | 1 a 5 | Todas |
| Da feedback claro y accionable | Formula observaciones útiles y concretas para mejorar resultados. | Comunicación | 1 a 5 | Todas |
| Cumple procesos operativos definidos | Sigue checklists, calendarios y estándares sin desvíos críticos. | Cumplimiento operativo | 1 a 5 | Operaciones |
| Responde con foco en el estudiante | Toma decisiones considerando impacto en la experiencia educativa. | Orientación al estudiante | 1 a 5 | Académica |
| Escala incidentes de forma oportuna | Identifica y deriva bloqueos técnicos u operativos a tiempo. | Comunicación | 1 a 5 | Tecnología Educativa |
| Coordina prioridades del área | Ordena trabajo propio y del equipo según objetivos del período. | Gestión del tiempo | 1 a 5 | Liderazgo / jefaturas |

### Checklist
- [ ] Crear al menos 6 indicadores
- [ ] Asociarlos a competencias
- [ ] Completar descripciones observables
- [ ] Revisar que la escala 1 a 5 quede clara

## 5. Ciclo activo

Abrir:
- `Ciclos`

Crear este ciclo:

- **Nombre / período:** `Ciclo Anual 2026`
- **Año:** `2026`
- **Estado:** `ABIERTO`
- **Etapa:** `REVISION_INTERMEDIA`

### Fechas sugeridas

Estas fechas son solo recomendadas y se pueden ajustar al entorno:

- **Inicio:** `2026-03-01`
- **Evaluación intermedia visible:** `2026-06-15`
- **Revisión:** `2026-08-15`
- **Cierre:** `2026-11-30`

Como la pantalla actual usa `fechaInicio` y `fechaFin`, la guía práctica es:

- `fechaInicio = 2026-03-01`
- `fechaFin = 2026-11-30`

Y usar `etapa = REVISION_INTERMEDIA` para que la demo cuente una historia de seguimiento real.

### Checklist
- [ ] Crear `Ciclo Anual 2026`
- [ ] Confirmar que quede visible en listado
- [ ] Confirmar estado abierto
- [ ] Confirmar etapa de seguimiento / revisión intermedia

## 6. Evaluaciones demo

Abrir:
- `Evaluaciones`

Crear 10 evaluaciones para el ciclo `Ciclo Anual 2026` usando estos empleados:

| Empleado | Área | Tipo sugerido | Estado | Evaluador / manager sugerido |
|---|---|---|---|---|
| Paula Méndez | Académica | JEFATURA | CERRADA | Lucía Ferrer |
| Tomás Ibarra | Académica | JEFATURA | CERRADA | Lucía Ferrer |
| Sofía Quiroga | Académica | AUTOEVALUACION | CERRADA | Sofía Quiroga |
| Nicolás Vega | Académica | FINAL | CERRADA | Lucía Ferrer |
| Camila Duarte | Académica | JEFATURA | ENVIADA | Lucía Ferrer |
| Bruno Salas | Operaciones | JEFATURA | ENVIADA | Diego Peralta |
| Julieta Acosta | Operaciones | AUTOEVALUACION | ENVIADA | Julieta Acosta |
| Leandro Ponce | Operaciones | JEFATURA | REVISADA | Diego Peralta |
| Mateo Gil | Tecnología Educativa | JEFATURA | REVISADA | Clara Benítez |
| Rocío Paz | Tecnología Educativa | BORRADOR | BORRADOR | Clara Benítez |

### Distribución objetivo
- [ ] 4 cerradas
- [ ] 3 enviadas
- [ ] 2 revisadas
- [ ] 1 borrador

### Recomendación de carga
- usar comentarios breves y plausibles
- cargar puntajes en varios indicadores
- no dejar todas las evaluaciones con el mismo resultado final

## 7. Planes de desarrollo

Abrir:
- `Desarrollo`

Crear estos 3 planes:

### 1. Plan de liderazgo para Lucía Ferrer
- **Empleado:** Lucía Ferrer
- **Objetivo:** fortalecer liderazgo de mandos medios y seguimiento del equipo académico
- **Acciones:**
  - organizar una instancia mensual de seguimiento con docentes
  - revisar pendientes de evaluaciones cada dos semanas
  - documentar acuerdos y próximos pasos
- **Responsable sugerido:** Martín Ríos o Valeria Suárez
- **Fecha sugerida de seguimiento:** `2026-07-15`
- **Estado:** `EN_CURSO`
- **Métrica de seguimiento:** porcentaje de evaluaciones del área académica cerradas en fecha

### 2. Plan de comunicación para Paula Méndez
- **Empleado:** Paula Méndez
- **Objetivo:** mejorar claridad y frecuencia del feedback pedagógico
- **Acciones:**
  - practicar devoluciones estructuradas en reuniones 1:1
  - registrar acuerdos de seguimiento por clase
  - revisar avances con Lucía Ferrer
- **Responsable sugerido:** Lucía Ferrer
- **Fecha sugerida de seguimiento:** `2026-06-30`
- **Estado:** `PENDIENTE`
- **Métrica de seguimiento:** calidad percibida del feedback y cumplimiento de acuerdos

### 3. Plan de seguimiento operativo para Bruno Salas
- **Empleado:** Bruno Salas
- **Objetivo:** mejorar trazabilidad y tiempos de respuesta operativa
- **Acciones:**
  - registrar solicitudes con fecha y estado
  - revisar prioridades semanales con Diego Peralta
  - cerrar incidentes con evidencia simple
- **Responsable sugerido:** Diego Peralta
- **Fecha sugerida de seguimiento:** `2026-07-05`
- **Estado:** `EN_CURSO`
- **Métrica de seguimiento:** tiempo promedio de cierre de tareas operativas

### Checklist
- [ ] Crear 3 planes
- [ ] Vincularlos al empleado correcto
- [ ] Si existe evaluación asociada, seleccionarla
- [ ] Confirmar estados variados

## 8. Verificación final de pantallas

### Dashboard
- **Qué debería verse:** resumen con empleados, pendientes, ciclos, planes, onboarding, alertas y accesos rápidos
- **Qué valida:** que el tenant ya tiene vida operativa
- **Peso en demo:** **fuerte**

### Personas
- **Qué debería verse:** 18 empleados, áreas, managers y estructura razonable
- **Qué valida:** que la base institucional está cargada
- **Peso en demo:** **fuerte**

### Usuarios y credenciales
- **Qué debería verse:** usuarios demo activos
- **Qué valida:** credenciales separadas de permisos finos
- **Peso en demo:** **media**

### Roles y accesos
- **Qué debería verse:** assignments con scopes reales
- **Qué valida:** gobierno de permisos y alcance
- **Peso en demo:** **fuerte**

### Carga masiva
- **Qué debería verse:** al menos un historial exitoso y la lógica de plantilla oficial
- **Qué valida:** onboarding e importación institucional
- **Peso en demo:** **fuerte**

### Objetivos / Indicadores
- **Qué debería verse:** competencias, indicadores base, KPIs y OKRs cargados
- **Qué valida:** que hay marco evaluativo y objetivos operativos
- **Peso en demo:** **fuerte**

### Ciclos
- **Qué debería verse:** `Ciclo Anual 2026` abierto y visible
- **Qué valida:** que existe período activo para evaluación
- **Peso en demo:** **media / fuerte**

### Evaluaciones
- **Qué debería verse:** 10 evaluaciones con estados distintos
- **Qué valida:** ejecución real del proceso
- **Peso en demo:** **fuerte**

### Desarrollo
- **Qué debería verse:** 3 planes con estados y seguimiento
- **Qué valida:** que la plataforma no termina en evaluar, sino en desarrollar
- **Peso en demo:** **fuerte**

### Reporte ejecutivo
- **Qué debería verse:** resumen, personas, KPIs, OKRs, evaluaciones, desarrollo y acciones con datos conectados
- **Qué valida:** cierre ejecutivo del recorrido completo
- **Peso en demo:** **muy fuerte**

## 9. Guion de demo ligado al tenant

Orden recomendado:

### 1. Dashboard
**Qué decir:**  
“Acá vemos el estado general del tenant: personas, evaluaciones, planes y próximos pasos en una sola vista.”  
“Esta pantalla nos sirve para abrir la historia completa sin ir módulo por módulo desde cero.”

### 2. Carga masiva
**Qué decir:**  
“El alta institucional fuerte la hacemos desde una plantilla oficial validada.”  
“Eso nos permite cargar personas, accesos, managers, KPIs y OKRs de forma controlada.”

### 3. Personas
**Qué decir:**  
“Una vez importado, ya vemos la estructura real de la institución: áreas, cargos y responsables.”  
“Esto evita trabajar con planillas sueltas.”

### 4. Roles y accesos
**Qué decir:**  
“Acá definimos quién entra y hasta dónde llega su alcance.”  
“Usuarios resuelve credenciales; Roles y accesos gobierna scopes y permisos.”

### 5. Ciclos
**Qué decir:**  
“Después abrimos el período institucional de evaluación.”  
“Eso ordena toda la operación posterior y el reporte.”

### 6. Evaluaciones
**Qué decir:**  
“Acá se ve el proceso vivo: borradores, enviadas, revisadas y cerradas.”  
“No solo configuramos, también hacemos seguimiento real.”

### 7. Desarrollo
**Qué decir:**  
“Performia no termina en la evaluación.”  
“El resultado se convierte en planes concretos de desarrollo y seguimiento.”

### 8. Reporte ejecutivo
**Qué decir:**  
“Este es el cierre recomendado para dirección y RR. HH.”  
“Consolida personas, resultados, objetivos, planes y acciones en una sola vista ejecutiva.”

## 10. Riesgos y cuidados

- [ ] No usar producción
- [ ] No usar datos reales
- [ ] No mezclar QA funcional con tenant demo
- [ ] Cuidar usuarios importados y contraseñas temporales
- [ ] Recordar que por importación el manager queda como `MANAGER + TEAM`
- [ ] Si se quiere mostrar `DEPARTMENT`, ajustarlo manualmente después
- [ ] No usar `EducationalExportsPage` como flujo principal
- [ ] No mostrar módulos legacy salvo que pregunten por casos avanzados

## 11. Cierre operativo sugerido

Antes de dar por listo el tenant demo:

- [ ] recorrer Dashboard
- [ ] validar Reporte ejecutivo
- [ ] probar al menos un login con perfil no admin si el entorno lo permite
- [ ] anotar cualquier contraseña temporal generada para no improvisar durante la demo
- [ ] dejar registrada la fecha de la última carga demo
