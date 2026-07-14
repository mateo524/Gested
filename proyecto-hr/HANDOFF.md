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

### "solicitud tardó mucho" al confirmar — causa real (no era infra)
- Reproduje contra producción con un archivo de 30 filas: `confirm` cortaba
  siempre justo a los 30.0s con 503 "La solicitud tardó demasiado" —
  `server.js` tenía un timeout global de 30s para TODAS las rutas, y
  `confirmPersonas` procesaba las filas **una por una en serie** (varios
  round-trips a Mongo por persona), así que el tiempo total escala
  linealmente con la cantidad de filas.
- Fix: `server.js` da 120s a las rutas de `/bulk-import/simple/:type/confirm`
  y `/bulk-import/import`; `confirmPersonas` ahora procesa filas en lotes
  concurrentes de 5 (son personas independientes; `jefe_directo` se resuelve
  en una pasada aparte después de que todas las filas ya se crearon, así que
  es seguro). `BulkImportPage.jsx` sube su timeout de cliente a 120s a
  juego.
- Reverificado en producción: mismo archivo de 30 filas, antes cortaba a
  los 30s, ahora termina en ~25s sin error. Si el archivo real tiene muchas
  más filas (cientos), igual va a tardar más — preguntar cuántas si vuelve
  a pasar.

### Bug aparte encontrado de paso: poller de Excel Sync (Google/OneDrive) roto
- Mientras revisaba logs de Render aparecía cada 15 min: `Error polling
  connection ...: No refresh token is set.` — no tiene nada que ver con
  Personas. Causa: `ExcelSyncConnection` tiene `googleRefreshToken` /
  `msRefreshToken` con `select: false` en el schema, y
  `syncPoller.js#pollAllConnections` hacía `.find({status:"active"})` sin
  pedir esos campos explícitamente — Mongoose los devolvía `undefined`
  aunque en la DB hubiera un token real guardado. El resto del código
  (`excelSync.routes.js`) ya los pedía bien con `.select("+...")`; solo
  faltaba en el poller.
- Fix en `backend/services/syncPoller.js`: agregado
  `.select("+googleAccessToken +googleRefreshToken +msAccessToken +msRefreshToken")`.
  Esto además significa que el auto-sync de Excel/Google Sheets/OneDrive
  probablemente nunca funcionó automáticamente para ninguna conexión activa
  hasta ahora (solo el primer sync manual). Vale la pena que el usuario
  revise si tiene conexiones activas que dependían de esto.

### Verificación en vivo del fix de "not primary" (2026-07-14, más tarde)
- Cree una cuenta de prueba directo en la DB (rol ADMIN_COLEGIO, misma
  empresa) e hice login + analyze + confirm contra
  `https://gested-1-backend.onrender.com` real, 4 veces seguidas — las 4
  anduvieron bien (~1.3s analyze, ~3s confirm, sin "not primary"). Cuenta
  de prueba y registros de esas corridas ya borrados.
- Detecté con los logs de Render que el servicio se estaba **redeployando**
  (SIGTERM + reboot) cada pocos minutos, coincidiendo con mis pushes
  seguidos — eso probablemente explicaba varios de los síntomas que el
  usuario vio mientras yo iteraba en simultáneo.
- Persistía igual la queja de "la solicitud tardó mucho": es el cold start
  del plan free de Render (~20-50s cuando el servicio estuvo dormido >15
  min), no algo que el código pueda arreglar. Mitigado con
  `.github/workflows/keep-backend-awake.yml` — pinguea `/health` cada 10
  minutos para que no llegue a dormirse. Si igual se quiere eliminar la
  latencia de cold start por completo, la única solución real es un plan
  pago de Render con "Always On" (decisión de costo).

### "not primary" seguía apareciendo incluso agotando los 5 reintentos
- Causa: los reintentos anteriores repetían la escritura sobre la **misma**
  conexión de mongoose. Si esa conexión (la de Render, de larga vida) quedó
  con la topología cacheada apuntando a un nodo que ya no es primary, un
  simple ping (lo que hace el middleware de `server.js`) sigue funcionando
  igual — un ping no distingue primary de secundario — así que nunca se
  detectaba el problema y cada reintento fallaba exactamente igual.
- Confirmado que era específico de la conexión de Render y no del cluster:
  reproduje el flujo completo localmente contra el mismo cluster de Atlas
  varias veces y nunca falló.
- Fix: `withMongoRetry` ahora hace `mongoose.connection.close()` +
  `mongoose.connect()` entre reintentos, forzando un descubrimiento de
  topología nuevo en vez de confiar en que la conexión existente se
  arregle sola.
- Si esto tampoco resuelve, el próximo paso sería revisar si el
  `MONGO_URI` configurado en el dashboard de Render tiene algo distinto al
  de `backend/.env` local (no lo pude comparar, no tengo acceso a Render).

### Bug propio: "Importación" desapareció del menú al sacar "Sincronizar Excel"
- `sidebarNav` (en `AppShell.jsx`) nunca empujaba `carga-masiva` como item
  standalone — solo entraba al índice del buscador global
  (`globalSearchItems`). El único item standalone real era `excel-sync`.
  Al sacarlo, quedó sin ninguna entrada clickeable en el menú.
- Fix: se agregó `carga-masiva` como item standalone en `sidebarNav`
  (`src/components/AppShell.jsx`), visible directamente en el sidebar.

### Timeout del cliente muy corto para el retry ampliado
- Al subir 5 reintentos/1000ms de base en `withMongoRetry` (ver abajo), el
  peor caso puede tardar ~15s+, más que el timeout default de `apiFetch`
  (12s) — el usuario veía "La solicitud está demorando más de lo esperado"
  aunque el backend hubiera terminado bien tras el reintento.
- Fix: `BulkImportPage.jsx` ahora pasa `timeoutMs: 30000` en las llamadas a
  `/bulk-import/simple/:type/analyze` y `/confirm`.

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
