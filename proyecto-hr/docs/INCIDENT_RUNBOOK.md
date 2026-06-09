# ZENTOR — Incident Runbook

> Version: 1.0
> Last updated: 2026-06-03

## Table of Contents

1. [Backend Caido](#1-backend-caido)
2. [Login Falla](#2-login-falla)
3. [MongoDB Caido](#3-mongodb-caido)
4. [Deploy Fallido](#4-deploy-fallido)
5. [CORS Bloqueado](#5-cors-bloqueado)
6. [JWT Secret Invalido](#6-jwt-secret-invalido)
7. [Sospecha de Acceso No Autorizado](#7-sospecha-de-acceso-no-autorizado)
8. [Restore desde Backup](#8-restore-desde-backup)
9. [Rollback por Tag](#9-rollback-por-tag)

---

## 1. Backend Caido

**Sintomas:**
- `/health` devuelve 503 o timeout
- Frontend muestra errores 502/503 al cargar
- Monitoreo externo alerta (UptimeRobot / Better Stack)

**Diagnostico rapido:**

```bash
# 1. Verificar health
curl -s -o /dev/null -w "%{http_code}" https://gested-1-backend.onrender.com/health

# 2. Verificar contenido health
curl -s https://gested-1-backend.onrender.com/health | jq .

# 3. Verificar logs en Render
# Render Dashboard → Service → Logs
```

**Causas comunes:**

| Causa | Indicador | Accion |
|-------|-----------|--------|
| MongoDB caido | `database.state != connected` en health | Ver [MongoDB Caido](#3-mongodb-caido) |
| Error de startup | Logs muestran `Error MongoDB:` o `process.exit(1)` | Verificar env vars, conexion a Atlas |
| JWT_SECRET invalido | Logs muestran `JWT_SECRET debe tener al menos 32 caracteres` | Ver [JWT Secret Invalido](#6-jwt-secret-invalido) |
| Out of memory | Render dashboard muestra OOM kill | Escalar plan Render o optimizar queries |
| Rate limit excedido | Health responde 429 | Esperar ventana de 15 min o verificar origen de requests |

**Accion inmediata:**

1. Verificar health endpoint manualmente
2. Revisar Render logs (ultimos 5 min)
3. Si es error de startup: hacer "Manual Deploy → Deploy last successful deploy"
4. Si persiste: verificar env vars en Render dashboard
5. Si no se resuelve en 10 min: ejecutar rollback (ver [Rollback por Tag](#9-rollback-por-tag))

---

## 2. Login Falla

**Sintomas:**
- `POST /auth/login` devuelve 401 o 500
- Usuarios no pueden acceder
- Frontend muestra pantalla de login con error

**Diagnostico rapido:**

```bash
# Probar login
curl -s -X POST https://gested-1-backend.onrender.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"orgadmin.demo@performia.test","password":"Demo1234!"}' | jq .
```

**Respuestas posibles:**

| Respuesta | Significado | Accion |
|-----------|-------------|--------|
| `401 { mensaje: "Credenciales invalidas" }` | Password incorrecta | Resetear password via seed o DB directa |
| `401 { mensaje: "Token expirado" }` | Token vencido | Re-login (normal, no es incidente) |
| `429 { mensaje: "Demasiados intentos..." }` | Rate limit de login (10/15min) | Esperar 15 min |
| `500 { mensaje: "Error en login" }` | Error interno | Revisar logs de Render, posible error de MongoDB o JWT |
| `500 { mensaje: "Error interno del servidor" }` | Error en middleware | Verificar cambios recientes en server.js |

**Accion inmediata:**

1. Verificar que el backend responde (`/health`)
2. Probar login con credenciales de admin conocidas
3. Si es rate limit: esperar 15 min
4. Si es 500: revisar Render logs y buscar stack trace
5. Si el usuario olvido password: ejecutar `SEED_CONFIRM=1 node scripts/seed-pilot.mjs --reset-passwords`

---

## 3. MongoDB Caido

**Sintomas:**
- `/health` devuelve `database.state != connected` (503)
- Todas las rutas que requieren DB devuelven 500
- Render logs muestran errores de conexion

**Diagnostico:**

```bash
# Verificar estado desde health endpoint
curl -s https://gested-1-backend.onrender.com/health | jq .database

# Verificar conectividad de red (si tienes acceso)
mongosh "$MONGO_URI" --eval "db.adminCommand('ping')"
```

**Pasos:**

1. **Verificar Atlas Dashboard:**
   - Ir a [cloud.mongodb.com](https://cloud.mongodb.com) → Cluster → Overview
   - Verificar estado del cluster (verde = OK)
   - Revisar pestaña Monitoring por picos de CPU/connections

2. **Verificar IP Whitelist:**
   - Atlas → Network Access → IP Whitelist
   - Render no tiene IP fija. Asegurar que `0.0.0.0/0` esta permitido (o el rango de Render)
   - Si se cambio la whitelist recientemente, puede tardar unos minutos en aplicar

3. **Verificar MONGO_URI:**
   - Render Dashboard → Environment → MONGO_URI
   - Asegurar que no tiene caracteres escapados incorrectamente
   - Verificar que el password no contiene caracteres especiales no escapados

4. **Verificar plan/service:**
   - Si el cluster fue pausado por inactividad (M0 free tier): reanudar desde Atlas dashboard
   - Si se supero el limite de conexiones: escalar o reducir connection pool

5. **Reiniciar backend:**
   - Render Dashboard → Service → Manual Deploy → Deploy last successful deploy
   - A veces la conexion se recupera sola al reconectar

---

## 4. Deploy Fallido

**Sintomas:**
- Render Dashboard muestra "Build failed" o "Deploy failed"
- Backend no responde o responde version anterior
- GitHub Actions (si configurado) muestra fallo

**Diagnostico:**

```bash
# Verificar ultimos deploys
# Render Dashboard → Service → Events
```

**Causas comunes:**

| Causa | Sintoma | Accion |
|-------|---------|--------|
| Error de sintaxis | Build log muestra `SyntaxError` | Corregir y redeployar |
| Dependencia faltante | Build log muestra `npm ERR!` | Verificar package.json y lockfile |
| Pruebas fallan | CI muestra test failure | Corregir test y redeployar |
| Env var faltante | Runtime log muestra `Falta MONGO_URI` | Agregar env var en Render dashboard |
| JWT_SECRET invalido | Runtime log muestra `JWT_SECRET debe tener...` | Ver [JWT Secret Invalido](#6-jwt-secret-invalido) |

**Accion inmediata:**

1. Ir a Render Dashboard → Service → Manual Deploy → Deploy last successful deploy
2. Esto restaura la ultima version que funciono
3. Investigar la causa del fallo en los build logs
4. Correccion → commit → redeploy manual

---

## 5. CORS Bloqueado

**Sintomas:**
- Frontend muestra errores de CORS en consola del browser
- Las requests desde el frontend al backend fallan con error de origen
- La API responde correctamente desde curl/Postman pero no desde el browser

**Diagnostico:**

```bash
# Probar CORS directamente
curl -s -H "Origin: https://<frontend-domain>.vercel.app" \
  -H "Access-Control-Request-Method: GET" \
  -X OPTIONS https://gested-1-backend.onrender.com/health \
  -D - 2>&1 | grep -i "access-control"
```

**Accion:**

1. Verificar que `FRONTEND_URL` o `FRONTEND_ORIGINS` incluye el dominio correcto
2. Si es preview de Vercel: asegurar `ALLOW_VERCEL_PREVIEWS=true`
3. Si es dominio personalizado: agregarlo a `CORS_ORIGINS`
4. Render Dashboard → Environment → actualizar variables → redeploy

**Configracion esperada en produccion:**

```
FRONTEND_URL=https://<dominio-produccion>.com
ALLOW_VERCEL_PREVIEWS=true (o false si no se quiere permitir)
```

---

## 6. JWT Secret Invalido

**Sintomas:**
- Backend no arranca (en produccion)
- Render logs muestran: `JWT_SECRET debe tener al menos 32 caracteres en producción.`
- Health endpoint no responde

**Causa:**
`server.js` linea 99-101 valida que `JWT_SECRET.length >= 32` cuando `NODE_ENV=production`. Si es menor, llama `process.exit(1)`.

**Accion:**

```bash
# Verificar longitud del JWT_SECRET actual
# Render Dashboard → Environment → JWT_SECRET
# Debe tener 32+ caracteres
```

1. Generar nuevo secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   # Output: <64-char-hex-string>
   ```
2. Render Dashboard → Environment → JWT_SECRET → pegar nuevo valor
3. Manual Deploy → Deploy latest commit
4. Verificar que el backend arranca: `curl https://gested-1-backend.onrender.com/health`

**Advertencia:** Cambiar JWT_SECRET invalida todos los tokens existentes. Todos los usuarios deberan re-login.

---

## 7. Sospecha de Acceso No Autorizado

**Sintomas:**
- Logs muestran requests con tokens invalidos o manipulados
- Multiples intentos de login desde IPs desconocidas
- Acceso a recursos fuera del tenant esperado
- Reporte de usuario sobre datos visibles a otros

**Diagnostico:**

```bash
# Revisar audit logs via API
curl -s https://gested-1-backend.onrender.com/audit \
  -H "Authorization: Bearer <admin-token>" \
  | jq '.items[] | select(.action | test("login|bulk_import|user_create"))' | head -20
```

**Accion inmediata:**

1. **No eliminar logs** — preservar evidencia
2. Verificar si el acceso fue via token valido o exploit
3. Si hay sospecha de token robado:
   - Rotar `JWT_SECRET` (ver [JWT Secret Invalido](#6-jwt-secret-invalido))
   - Esto invalida todos los tokens existentes
4. Si hay sospecha de exploit:
   - Revisar cambios recientes en middleware de autenticacion
   - Verificar `backend/middleware/auth.js` y `tenantScope.js`
   - Verificar que no se introdujeron bypasses
5. **Contactar al equipo de seguridad** antes de hacer cambios

**Prevencion:**
- Rate limiting en login (ya activo: 10 intentos/15 min)
- Helmet middleware activo
- Sanitizacion de input activa
- Tenant scope obligatorio en todas las rutas

---

## 8. Restore desde Backup

**Escenario:** Perdida de datos, corrupcion, o error humano requiere restaurar MongoDB desde backup.

**Pre-requisitos:**
- Acceso a MongoDB Atlas Dashboard con rol de Owner o Project Owner
- Backup automatizado configurado (Atlas Backup)
- Cluster con suficiente espacio para restore

**Paso a paso:**

### Restore desde Atlas Snapshot Automatico

1. Ir a [cloud.mongodb.com](https://cloud.mongodb.com) → Cluster → Backup
2. Seleccionar snapshot deseado (fecha/hora previa al incidente)
3. Click "Restore"
4. Elegir opcion:
   - **Restore to current cluster** — RESTAURA DIRECTAMENTE, IRREVERSIBLE
   - **Restore to new cluster** — RECOMENDADO. Crea cluster temporal para verificar
5. Si se elige restore directo: confirmar que se entiende que los datos actuales seran reemplazados
6. Monitorear progreso en Atlas → Cluster → Restore History

### Restore a Cluster Separado (Recomendado)

```
1. Backup → Restore → Restore to new cluster
2. Atlas crea un cluster temporal con los datos del backup
3. Verificar datos:
   mongosh "mongodb+srv://<temp-cluster-uri>" --eval "db.employees.countDocuments()"
4. Si los datos son correctos:
   - Opcion A: Renombrar cluster temporal como produccion
   - Opcion B: Restore directo a produccion desde el snapshot
5. Eliminar cluster temporal para evitar costos
```

### Post-Restore

1. Verificar health endpoint: `curl https://gested-1-backend.onrender.com/health`
2. Probar login con usuario conocido
3. Verificar conteo de documentos principales:
   ```bash
   # Verificar integridad basica desde el backend en produccion
   curl -s https://gested-1-backend.onrender.com/employees \
     -H "Authorization: Bearer <token>" | jq length
   ```
4. Notificar a usuarios que la operacion fue completada
5. Documentar causa del incidente

### Lo que NO hacer

- NO hacer restore directo sobre produccion sin verificar en cluster separado primero
- NO asumir que el backup mas reciente es el correcto (pudo haber sido tomado durante la corrupcion)
- NO compartir credenciales de Atlas por canales no seguros
- NO hacer restore mientras el backend esta corriendo (los usuarios pueden escribir datos nuevos)
- NO olvidar actualizar MONGO_URI si se restauro a un cluster diferente

---

## 9. Rollback por Tag

**Escenario:** Un deploy introduce un bug critico y se necesita volver a la version anterior inmediatamente.

**Metodo 1: Render Deploy Anterior (Rapido)**

```
Render Dashboard → Service → Manual Deploy → Deploy last successful deploy
```
Esto toma ~2 min y no requiere Git.

**Metodo 2: Git Tag (Cuando el metodo 1 no es suficiente)**

```bash
# Listar tags disponibles
git tag -l "v*" | sort -V

# Ver diff entre produccion actual y el tag
git log <current-deploy-commit>..<tag> --oneline

# Hacer checkout del tag
git checkout tags/<tag>

# Verificar que es el commit correcto
git log --oneline -3

# Hacer deploy manual desde Render:
# Render Dashboard → Manual Deploy → Deploy from Git branch/tag
```

**Tags recomendados:**

```bash
git tag -a v1.0.0 -m "Version inicial piloto"
git tag -a v1.1.0 -m "Primera demo con bulk import"
git push origin v1.0.0 v1.1.0  # solo cuando se haga push
```

**Post-rollback:**

1. Verificar `/health` responde 200
2. Ejecutar smoke test: `node scripts/smokeTestPostDeploy.js`
3. Probar login con usuario admin
4. Verificar funcionalidad critica (empleados, evaluaciones)
5. Crear incident ticket documentando la causa del rollback
