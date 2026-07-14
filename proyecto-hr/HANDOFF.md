# HANDOFF — Zentor

> Se actualiza en cada sesión de trabajo con Claude Code. Sirve para que la
> próxima sesión (u otra persona) entienda qué se hizo, por qué, y qué queda
> pendiente, sin tener que releer todo el historial de commits.

## 2026-07-14

### Contexto de partida
- UsersPage aparecía vacío (se investigó `resolveCompanyScope`, JWT stale,
  filtros de Mongo — el código estaba bien, no se llegó a una causa raíz
  100% confirmada en la sesión antes de pasar a otras tareas).
- Se pidió borrar los datos de prueba (141 `employees` de prueba, 386
  `evaluations` y 1 `evaluationcycle` huérfanos) para cargar datos reales.
  **Ya ejecutado directamente contra Atlas, sin backup previo (pedido
  explícito del usuario).**

### Cambios de código (todos pusheados a `main` + `restore-good-app`)
1. **Simplificación del importador "avanzado" unificado**
   (`backend/utils/bulkImportTemplate.js`, `bulkImportAnalyzer.js`,
   `bulkImportConfirm.js`) — resultó ser el sistema equivocado, la UI real
   usa el importador "simple". Se dejó simplificado igual por si se
   reactiva en el futuro, pero **no es el que hay que tocar para cambios de
   la plantilla de Personas**.
2. **El importador real usado hoy es "Carga rápida"**
   (`backend/services/simpleImportService.js`, rutas en
   `backend/routes/bulkImport.routes.js` bajo `/bulk-import/simple/:type/*`,
   UI en `src/pages/BulkImportPage.jsx`). Cambios ahí:
   - Plantilla "Personas" simplificada a: legajo, nombre, apellido,
     email_laboral, departamento, puesto, **jefe_directo** (nuevo),
     fecha_ingreso, **fecha_nacimiento** (nuevo). Se sacaron
     unidad_negocio/region/tipo_contrato/activo.
   - `jefe_directo` (texto libre, nombre y apellido) se resuelve a
     `Employee.managerId` por match de nombre completo al confirmar la
     importación — no requiere una fila separada en Managers/Jerarquías.
   - Se sacó la card "Jerarquías" de la UI de Carga rápida: el nivel de
     acceso (EMPLEADO/MANDO_MEDIO/DIRECCION) ya se carga por persona en la
     columna `rol` de la misma hoja Personas.
   - Se agregó reintento automático (`withMongoRetry`) en las escrituras de
     `confirmPersonas` para absorber errores transitorios "not primary".
3. **`backend/models/Employee.js`** — nuevo campo `fechaNacimiento` (Date).
4. **`backend/server.js`** — middleware que hace ping a Mongo y reconecta si
   detecta conexión "stale" (antes solo existía para `VERCEL`, ahora
   también para el resto de entornos / Render).
5. **`src/pages/BulkImportPage.jsx`** — toast de éxito explícito al
   confirmar una importación simple + texto más claro en el preview
   ("todavía no se guardó, hacé click en Confirmar").

### Hallazgo de infraestructura (importante, no es bug de código)
- El backend real corre en **Render** (plan free), no en Cloud Run como
  decía este repo antes. `CLAUDE.md` ya está corregido.
- MongoDB Atlas está en tier **gratis/compartido** (M0/M2), no M40+ como
  recomienda `docs/OPERATIONS.md`.
- Ambos duermen/hacen mantenimiento automático → errores transitorios
  "not primary" en escrituras son esperables, no un bug. Mitigado
  parcialmente con reintentos (ver arriba), pero **la solución de fondo es
  de infraestructura**: upgradear Atlas a M10+ y/o Render a plan pago.

### Fix adicional: "Preview expirado" en Carga rápida
- Causa real: `simpleImportService.js` guardaba el preview del Excel
  analizado en un `Map` **en memoria del proceso**. Si Render reiniciaba el
  proceso entre el click de "analizar" y el de "confirmar" (por un redeploy
  nuestro en simultáneo, o por el ciclo sleep/wake del free tier), el token
  dejaba de existir aunque no hubieran pasado los 15 minutos de TTL.
- Fix: se creó `backend/models/SimpleImportPreview.js` (colección Mongo con
  índice TTL) y se migró `storePreview`/`loadPreview`/`deletePreview` para
  persistir ahí en vez de en memoria. Verificado end-to-end contra la DB
  real (el preview sobrevive y se borra al confirmar).

### Nav: se sacó "Sincronizar Excel"
- Personas/Habilidades ya viven en "Importación" (Carga rápida), así que el
  ítem de nav separado "Sincronizar Excel" (`excel-sync` / `ExcelSyncPage`)
  quedaba redundante. Se sacó del menú, del router (`src/App.jsx`), del
  command palette y de los íconos (`src/components/AppShell.jsx`), y se
  borró `src/pages/ExcelSyncPage.jsx`. Ojo: esto es distinto del botón
  "Sincronizar Excel" que existe dentro de `EvaluationsPage.jsx` (export a
  Excel/Sheets de evaluaciones) — ese no se tocó, es una feature aparte.

### "not primary" seguía apareciendo justo al subir el Excel (no al confirmar)
- El fix de "Preview expirado" (persistir el preview en Mongo) agregó una
  escritura a la DB **en el paso de analizar**, que antes no existía. Eso
  corrió el punto de falla más temprano en el flujo.
- El `withMongoRetry` original (2 reintentos, 400ms de base) sumaba ~1.2s
  de ventana total — insuficiente: una reelección real de un cluster Atlas
  compartido puede tardar hasta ~10-12s en resolverse. Se subió a 5
  reintentos / 1000ms de base (~15s de ventana total).
- Si el error persiste después de este cambio, ya no es un tema de ventana
  de reintento — ahí sí conviene mirar logs de Render directamente o
  considerar el upgrade de infraestructura (ver más abajo).

### Pendiente / próximos pasos
- [ ] Confirmar si el usuario quiere upgradear Atlas/Render (decisión de
      costo, no de código).
- [ ] Revalidar si el bug original de "UsersPage vacío" sigue ocurriendo
      ahora que hay datos reales cargados (se investigó pero no se cerró
      con una causa raíz confirmada — puede haber sido simplemente que no
      había usuarios reales aún).
- [ ] Verificar que el deploy automático a Render esté realmente activado
      (el usuario no estaba seguro). Si no lo está, los últimos commits
      pueden no estar reflejados en producción todavía.
- [ ] Cargar los datos reales de personas con la plantilla nueva.
