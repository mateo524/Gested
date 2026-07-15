# HANDOFF — Zentor

> Se actualiza en cada sesión de trabajo con Claude Code. Sirve para que la
> próxima sesión (u otra persona) entienda qué se hizo, por qué, y qué queda
> pendiente, sin tener que releer todo el historial de commits.

## 2026-07-15 — "not primary" CONFIRMADO RESUELTO ✅

Se pudo volver a deployar (el límite de 100 deploys/día de Vercel ya se había
reseteado). Verificado en producción real (`app.zentor.com.ar/api`):
- `GET /mongo-diag` (antes de sacarlo) mostró `type: "ReplicaSetWithPrimary"`
  con los 3 hosts del shard — ya no `Single` a una sola secundaria.
- Importación de Personas de 100 filas: `analyze` (0.8s) → `confirm` → polling
  → **100 creados, 0 errores**, sin ningún "not primary". Datos de prueba
  limpiados.
- Se sacó todo el código de diagnóstico temporal (`/mongo-diag` en
  `server.js`, el campo `diag` en `bulkImport.routes.js`) — ya no hace falta.

Si vuelve a aparecer "not primary" en el futuro, NO es este mismo bug (esa
causa específica —`MONGO_URI` de Vercel apuntando a un solo nodo secundario—
está confirmada resuelta). Sería algo nuevo; no asumir que es la misma causa
sin volver a verificar.

## 2026-07-14 (parte 2) — Investigación que encontró la causa raíz (referencia histórica)

**Quedó resuelto el 2026-07-15 (ver arriba). Lo de abajo es el registro de cómo se
llegó a la causa, útil como referencia si algo similar vuelve a pasar.**

### El hallazgo clave del día: la app real corre en Vercel, no en Render ni Cloud Run
Gran parte de esta sesión se investigó "not primary" contra `gested-1-backend.onrender.com`
(Render) y contra el servicio de Cloud Run (`zentor-backend`, deploy automático vía
`.github/workflows/deploy-backend.yml` en la raíz real del repo). **Ninguno de los dos
es lo que sirve `app.zentor.com.ar`.** Confirmado con certeza:
- `app.zentor.com.ar/api/*` es una **función serverless de Vercel**
  (`api/index.js`, que monta `backend/server.js` bajo `/api` — ver `vercel.json`).
- Un token emitido por `app.zentor.com.ar/api/auth/login` fue **rechazado** por el
  Cloud Run directo (401 "Token inválido") → JWT_SECRET distinto → confirma que
  son deployments completamente separados, no el mismo backend.
- Render y Cloud Run deployan con cada push (útil tenerlos sanos, pero no son
  producción real). No hace falta seguir probando ahí para este tipo de bugs.

### Causa raíz real, confirmada con diagnóstico en runtime
Se agregó un endpoint temporal `GET /mongo-diag` (protegido con `auth`, en
`backend/server.js`) que expone la topología real de la conexión de Mongo sin
exponer credenciales. Resultado en Vercel producción:
```json
{"host":"ac-p10bbtv-shard-00-01.s9kg1qj.mongodb.net","type":"Single","setName":null,
 "servers":{"ac-p10bbtv-shard-00-01...":"RSSecondary"}}
```
El `MONGO_URI` configurado en **Vercel** (variable de entorno separada de la de
Render/Cloud Run/local) apuntaba en modo `Single` a **un solo nodo, y ese nodo es
una secundaria**. Nunca descubre el replica set completo ni al primary. Por eso:
lecturas siempre funcionan (una secundaria puede leer), escrituras **siempre**
fallan con `NotWritablePrimary` (nunca es "a veces" — una secundaria JAMÁS puede
escribir). Esto explica el error, por qué nunca se reproducía en local (mi
`.env` sí tiene el `MONGO_URI` correcto en formato `mongodb+srv://...`), y por
qué ningún fix de reintentos/timeouts/IPv4/CPU-throttling lo resolvía — ninguno
de esos era la causa real.

### Fix aplicado (guardado, PENDIENTE DE QUE SE ACTIVE)
1. Corregido el `MONGO_URI` de Vercel (proyecto `gested-l6ej`, environment
   Production) vía `vercel env rm/add`, usando el mismo valor
   `mongodb+srv://performia_app:***@admin.s9kg1qj.mongodb.net/hrdb?retryWrites=true&w=majority&appName=Admin`
   que ya funciona en `backend/.env` local.
2. **Este cambio de env var no toma efecto hasta el próximo deploy.** Se intentó
   redeployar (`vercel --prod`) y se chocó el límite del plan free de Vercel:
   **100 deployments/día por cuenta** (agotado por la cantidad de iteraciones
   de esta sesión). El usuario eligió esperar ~24hs a que se resetee en vez de
   upgradear a Pro.

### ⚠️ Próximo paso OBLIGATORIO al retomar
1. Verificar que ya se puede deployar de nuevo: `cd ~/Dev/Gested/proyecto-hr &&
   vercel --prod --yes` (ojo: correr desde la carpeta EXTERNA `proyecto-hr`,
   no desde `proyecto-hr/proyecto-hr` — ver nota de estructura del repo más
   abajo). Si vuelve a tirar el error de límite, todavía no pasaron las 24hs.
2. Una vez deployado, volver a pegarle a `GET https://app.zentor.com.ar/api/mongo-diag`
   (con un token de un usuario logueado) y confirmar que ahora devuelve
   `type: "ReplicaSetWithPrimary"` y los 3 hosts del shard
   (`ac-p10bbtv-shard-00-0[0-2]`), no solo uno.
3. Reprobar la importación de Personas (analyze + confirm) contra
   `app.zentor.com.ar/api` con un archivo de 100 filas — debería andar sin
   "not primary".
4. **Sacar el código de diagnóstico temporal** una vez confirmado:
   - `GET /mongo-diag` en `backend/server.js` (buscar el comentario "TEMP diagnostic").
   - El campo `diag` en las respuestas de error de
     `backend/routes/bulkImport.routes.js` (buscar "TEMP diagnostic" /
     `diagFromError`).
   Ninguno de los dos es peligroso dejar (no expone credenciales), pero son
   ruido que no debería quedar permanente.

### ⚠️ Estructura del repo (importante, confundió bastante durante la sesión)
El repo de git tiene su raíz real en `~/Dev/Gested/proyecto-hr/` (carpeta
EXTERNA). Todo el código de la app (`backend/`, `src/`, etc.) vive DENTRO de
una subcarpeta también llamada `proyecto-hr/` (`~/Dev/Gested/proyecto-hr/proyecto-hr/`).
- `git`/`npm`/edición de código: correr desde la carpeta INTERNA
  (`~/Dev/Gested/proyecto-hr/proyecto-hr/`), como se vino haciendo toda la sesión.
- `vercel` CLI: el proyecto `gested-l6ej` tiene su Root Directory configurado
  como `proyecto-hr` — hay que correr `vercel` desde la carpeta **EXTERNA**
  (`~/Dev/Gested/proyecto-hr/`), si no busca una carpeta `proyecto-hr` que no
  existe y falla, o peor, crea/deploya a un proyecto de Vercel distinto por
  error (esto pasó una vez en la sesión — se creó y se borró un proyecto
  llamado "proyecto-hr" por accidente, ver commit history / este documento).
- Los workflows de GitHub Actions (`.github/workflows/*.yml`) viven en la raíz
  EXTERNA también, no dentro de la subcarpeta `proyecto-hr/`.
- `gh` CLI: funciona bien desde cualquiera de las dos carpetas (git-aware).

### Otros hallazgos/fixes de la sesión que siguen siendo válidos
(aunque no eran la causa raíz del "not primary", no está de más tenerlos)
- `backend/server.js`: middleware de ping+reconexión para detectar conexión
  stale (solo aplica al modelo de proceso persistente de Render/Cloud Run, no
  afecta a Vercel serverless).
- `backend/services/simpleImportService.js`: `withMongoRetry` ya NO fuerza
  `close()+reconnect()` entre reintentos (podía cortarle la conexión a otro
  request concurrente en un contenedor Vercel "tibio" compartido) — ahora solo
  hace backoff y reintenta sobre la misma conexión.
- Cloud Run: `--no-cpu-throttling` + `--memory 512Mi` en
  `.github/workflows/deploy-backend.yml` (para que el patrón de job en
  background de confirmPersonas/analyzePersonasFile no se congele a mitad de
  camino en ESE deployment — sigue siendo válido si algún día se usa Cloud Run
  de verdad, aunque hoy no es el backend real).

### Contexto de partida (2026-07-14, parte 1)
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

### Confirm pasado a job en background (2026-07-14, más tarde)
- Con 150+ filas, ningún timeout fijo alcanza siempre. `confirmPersonas`
  ahora crea un `SimpleImportJob` (modelo nuevo,
  `backend/models/SimpleImportJob.js`, TTL 1h) y arranca el procesamiento
  sin bloquear la respuesta — devuelve `{ok:true, status:"processing",
  jobId}` casi al instante. Nuevo endpoint
  `GET /bulk-import/simple/personas/confirm/:jobId/status`. El frontend
  (`BulkImportPage.jsx`) hace polling cada 2s hasta 15 minutos.
- Verificado en producción con 200 filas reales: confirm respondió en
  1.7s, el job terminó bien (200 creados, 0 errores). Limpieza de datos de
  prueba hecha.
- Jerarquías/Habilidades quedaron síncronas (son catálogos chicos, no
  escalan con la nómina).

### El mismo mensaje de demora seguía apareciendo, pero en "analizar" no en "confirmar"
- El usuario reportó timeout de nuevo; al preguntar en qué paso, era al
  **subir/analizar** el archivo, no al confirmar. Ese paso nunca se tocó —
  seguía con el timeout viejo de 30s (server.js) y 30000ms (cliente).
- Fix: se agregó `/^\/bulk-import\/simple\/.+\/analyze$/` a
  `LONG_RUNNING_PATHS` en `server.js` (ahora 120s como confirm), y se subió
  el `timeoutMs` del fetch de analyze en `BulkImportPage.jsx` a 120000.
- Sin verificar en producción todavía (recién pusheado) — si el usuario
  reporta que sigue tardando en analizar, probar con su archivo real a
  esa escala.

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
