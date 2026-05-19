# Runbook de demo comercial de 10 minutos

Este runbook sirve para mostrar Performia en una demo breve, clara y repetible usando el tenant demo **Instituto Horizonte**.

Documentos relacionados:
- [C:\Dev\Gested\proyecto-hr\docs\demo-tenant-import-template.md](C:\Dev\Gested\proyecto-hr\docs\demo-tenant-import-template.md)
- [C:\Dev\Gested\proyecto-hr\docs\demo-tenant-post-import-checklist.md](C:\Dev\Gested\proyecto-hr\docs\demo-tenant-post-import-checklist.md)

## 1. Objetivo de la demo

**Frase objetivo:**  
Performia permite pasar de datos institucionales a evaluación, seguimiento, desarrollo y reporte ejecutivo en un flujo claro y trazable.

## 2. Usuario recomendado para iniciar

**Usuario de entrada sugerido**
- `admin.horizonte@performia-demo.test`

**Antes de entrar**
- usar entorno **QA/demo**
- no usar producción
- confirmar que el tenant activo sea **Instituto Horizonte**
- si se van a usar otros usuarios importados, registrar antes sus contraseñas temporales o accesos manuales de demo

## 3. Estructura por tiempo

**Duración total:** 10 minutos

- **0:00 a 1:00** — apertura y problema
- **1:00 a 2:00** — Dashboard
- **2:00 a 3:15** — Carga masiva
- **3:15 a 4:15** — Personas
- **4:15 a 5:15** — Roles y accesos
- **5:15 a 6:15** — Ciclos
- **6:15 a 7:30** — Evaluaciones
- **7:30 a 8:30** — Desarrollo
- **8:30 a 9:40** — Reporte ejecutivo
- **9:40 a 10:00** — cierre

## 4. Guion exacto por pantalla

### A. Apertura — 0:00 a 1:00

**Qué abrir**
- Login o Dashboard ya abierto

**Qué mostrar**
- tenant activo: `Instituto Horizonte`

**Qué decir**
- “Lo que solemos ver en instituciones es información dispersa entre Excel, accesos poco claros y seguimiento difícil de consolidar.”
- “En estos 10 minutos les voy a mostrar cómo Performia ordena el recorrido completo: personas, accesos, evaluación, desarrollo y reporte.”

**Dato del tenant demo a usar**
- Instituto Horizonte con 18 personas, 4 áreas y un ciclo activo

**Qué no mostrar**
- setup técnico
- consola
- flujo platform/superadmin

---

### B. Dashboard — 1:00 a 2:00

**Qué abrir**
- `Inicio`

**Qué mostrar**
- resumen general
- onboarding visible
- acciones de hoy
- accesos rápidos

**Qué decir**
- “Esta es la vista 360 del estado actual: personas, evaluaciones, planes y próximos pasos.”
- “La idea no es saturar, sino que dirección o RR. HH. puedan ver rápidamente qué está pasando y dónde intervenir.”

**Dato del tenant demo a usar**
- empleados activos
- evaluaciones pendientes
- ciclo activo
- planes visibles

**Qué no mostrar**
- cualquier alerta vacía o demasiado técnica

---

### C. Carga masiva — 2:00 a 3:15

**Qué abrir**
- `Datos / Carga masiva`

**Qué mostrar**
- plantilla oficial
- flujo de 7 pasos
- historial de una importación exitosa
- hojas incluidas: empleados, usuarios, managers, KPIs, OKRs

**Qué decir**
- “El alta institucional fuerte la resolvemos con una plantilla oficial validada.”
- “Eso permite importar personas, accesos, managers y objetivos operativos sin depender de cargas manuales fila por fila.”
- “Además queda trazabilidad del resultado de la importación.”

**Dato del tenant demo a usar**
- job demo exitoso de importación

**Qué no mostrar**
- importación avanzada legacy
- errores técnicos internos salvo que pregunten

---

### D. Personas — 3:15 a 4:15

**Qué abrir**
- `Personas`

**Qué mostrar**
- 18 empleados
- áreas:
  - Académica
  - Operaciones
  - RR. HH.
  - Tecnología Educativa
- managers vinculados

**Qué decir**
- “Una vez importados los datos, la institución ya queda estructurada con áreas, cargos y responsables.”
- “Esto nos permite pasar de una nómina plana a una organización navegable y lista para evaluar.”

**Dato del tenant demo a usar**
- Lucía Ferrer como manager académica
- Diego Peralta en operaciones
- Clara Benítez en tecnología educativa

**Qué no mostrar**
- edición profunda de cada empleado
- módulos secundarios

---

### E. Roles y accesos — 4:15 a 5:15

**Qué abrir**
- `Roles y accesos`

**Qué mostrar**
- roles base
- scopes
- assignments reales
- diferencia conceptual entre acceso y alcance

**Qué decir**
- “Acá definimos quién puede entrar y hasta dónde llega su acceso.”
- “Usuarios resuelve credenciales; Roles y accesos gobierna permisos y scope organizacional.”
- “Esto permite dar visibilidad completa a RR. HH., acotada a un jefe, o estrictamente personal a un colaborador.”

**Dato del tenant demo a usar**
- `ORG_ADMIN + ORGANIZATION`
- `HR + ORGANIZATION`
- `MANAGER + TEAM`
- `EMPLOYEE + SELF`
- `VIEWER + ORGANIZATION`

**Qué no mostrar**
- explicación profunda del modelo híbrido legacy/nuevo
- `SUPER_ADMIN`

---

### F. Ciclos — 5:15 a 6:15

**Qué abrir**
- `Ciclos`

**Qué mostrar**
- `Ciclo Anual 2026`
- estado abierto
- etapa de seguimiento / revisión intermedia

**Qué decir**
- “Una vez ordenadas personas y accesos, definimos el ciclo institucional.”
- “Esto organiza el período, da contexto a las evaluaciones y ordena el seguimiento posterior.”

**Dato del tenant demo a usar**
- `Ciclo Anual 2026`

**Qué no mostrar**
- múltiples ciclos si ensucian el relato

---

### G. Evaluaciones — 6:15 a 7:30

**Qué abrir**
- `Evaluaciones`

**Qué mostrar**
- 10 evaluaciones
- estados variados:
  - cerradas
  - enviadas
  - revisadas
  - borrador

**Qué decir**
- “Acá ya se ve el proceso vivo, no solo configurado.”
- “Podemos seguir el avance por persona y por estado, y eso alimenta tanto el desarrollo como el reporte ejecutivo.”

**Dato del tenant demo a usar**
- Paula Méndez
- Tomás Ibarra
- Bruno Salas
- Mateo Gil

**Qué no mostrar**
- creación detallada completa de una evaluación de cero si el tiempo es corto

---

### H. Desarrollo — 7:30 a 8:30

**Qué abrir**
- `Desarrollo`

**Qué mostrar**
- 3 planes cargados
- diferentes estados
- foco en seguimiento y mejora

**Qué decir**
- “Performia no termina en la evaluación.”
- “El valor aparece cuando el resultado se transforma en acciones concretas de desarrollo y seguimiento.”

**Dato del tenant demo a usar**
- plan de liderazgo de Lucía Ferrer
- plan de comunicación de Paula Méndez
- plan operativo de Bruno Salas

**Qué no mostrar**
- edición completa del plan si no suma a la conversación

---

### I. Reporte ejecutivo — 8:30 a 9:40

**Qué abrir**
- `Reportes > Reporte ejecutivo`

**Qué mostrar**
- filtros
- tabs
- resumen
- KPIs
- OKRs
- evaluaciones
- desarrollo
- acciones recomendadas

**Qué decir**
- “Este es el cierre recomendado para dirección y RR. HH.”
- “Acá consolidamos personas, objetivos, evaluaciones, planes y acciones en una sola vista ejecutiva.”
- “La idea es pasar de la operación al criterio de decisión sin cambiar de sistema.”

**Dato del tenant demo a usar**
- KPI de satisfacción del estudiante
- KPI de calendario operativo
- OKR de participación en evaluaciones
- acciones pendientes derivadas del ciclo

**Qué no mostrar**
- exportaciones legacy antes de cerrar esta pantalla

---

### J. Cierre — 9:40 a 10:00

**Qué abrir**
- seguir en `Reporte ejecutivo` o volver a `Dashboard`

**Qué decir**
- “En resumen, Performia toma datos institucionales, los convierte en evaluación y seguimiento, y los devuelve en forma de visibilidad ejecutiva.”
- “Si les interesa, el próximo paso puede ser revisar el flujo real de implementación o profundizar permisos, reportes o importación.”

**Qué no mostrar**
- módulos secundarios
- pantallas vacías

## 5. Pantallas a evitar salvo pregunta

### EducationalExportsPage / Importación avanzada legacy
**Por qué evitarla**
- es un flujo secundario y más técnico
- compite con la carga masiva unificada, que hoy es el camino recomendado

**Si preguntan**
- “Existe una capa avanzada/legacy para compatibilidad operativa, pero para clientes nuevos trabajamos con la carga masiva unificada.”

### Storage / Plataforma
**Por qué evitarla**
- no suma al recorrido institucional principal
- parece más operativa o interna

**Si preguntan**
- “Eso forma parte de la operación de plataforma; para el usuario institucional el recorrido principal pasa por personas, evaluación, desarrollo y reportes.”

### Centro de datos legacy
**Por qué evitarla**
- puede parecer duplicado frente al reporte ejecutivo
- es más operativa que comercial

**Si preguntan**
- “Además del reporte ejecutivo, hay herramientas operativas y exportables para análisis más internos.”

### Usuarios como primera explicación de permisos
**Por qué evitarla**
- abre demasiado pronto la historia técnica
- confunde credenciales con gobierno de acceso

**Si preguntan**
- “Usuarios gestiona quién entra; Roles y accesos define qué puede ver y hacer cada perfil.”

## 6. Respuestas a preguntas esperables

### ¿Se puede importar desde Excel?
Sí. Hay una plantilla oficial validada para cargar personas, accesos, managers, KPIs y OKRs de forma controlada.

### ¿Qué ve cada rol?
Depende del rol y del alcance asignado. Un admin puede ver la organización, un jefe su equipo y un empleado solo su información.

### ¿Un jefe ve solo su equipo?
Sí. El alcance del jefe queda acotado por scope y backend.

### ¿Un empleado ve solo lo suyo?
Sí. El perfil empleado está pensado para acceso personal, no organizacional.

### ¿Se pueden exportar reportes?
Sí, existen salidas operativas y reportes, aunque para demo mostramos primero el reporte ejecutivo como vista principal.

### ¿Qué pasa si hay errores en la importación?
La carga primero valida, muestra vista previa y no confirma si hay errores bloqueantes.

### ¿Esto sirve para colegios y empresas?
Sí. La base es multi-tenant y el modelo sirve para organizaciones con personas, roles, evaluación, desarrollo y reportes.

### ¿Cómo se evita mezclar datos entre instituciones?
El tenant real lo determina el backend por scope autenticado. La UI no decide el aislamiento.

### ¿Se puede usar con varios ciclos?
Sí. La plataforma soporta múltiples ciclos y seguimiento por período.

### ¿Qué queda pendiente o en roadmap?
Todavía hay módulos operativos/legacy y algunas capas avanzadas para seguir estabilizando, pero el recorrido principal ya está resuelto para implementación institucional.

## 7. Checklist pre-demo de 3 minutos

Antes de mostrar:

- [ ] URL correcta
- [ ] entorno QA/demo correcto
- [ ] tenant correcto: `Instituto Horizonte`
- [ ] usuario correcto: `admin.horizonte@performia-demo.test`
- [ ] dashboard con datos visibles
- [ ] reporte ejecutivo con datos visibles
- [ ] historial de carga masiva visible
- [ ] no tener consola abierta
- [ ] navegador con zoom razonable
- [ ] no abrir módulos legacy primero
- [ ] tener capturas de respaldo si falla internet o el entorno

## 8. Checklist post-demo

Después de mostrar:

- [ ] anotar preguntas que hicieron
- [ ] anotar objeciones
- [ ] anotar módulos que generaron más interés
- [ ] anotar si hubo alguna pantalla floja
- [ ] anotar si pidieron ver roles, reportes o importación más a fondo
- [ ] definir siguiente acción comercial

## 9. Riesgos y cuidados

- [ ] no usar producción
- [ ] no usar datos reales
- [ ] no mostrar contraseñas
- [ ] no entrar como `SUPER_ADMIN` salvo necesidad real
- [ ] no vender multi-scope simultáneo si no está estabilizado
- [ ] no vender `EducationalExportsPage` como flujo principal
- [ ] no prometer automatizaciones no implementadas
