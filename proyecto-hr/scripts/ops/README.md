# ZENTOR — MongoDB Manual Backups

> Base de datos real: `hrdb`
> Plan MongoDB Atlas: **Free Tier** (sin backups automáticos avanzados ni PITR)
> Sistema operativo: Windows (PowerShell 5.1+)

## Requisito: MongoDB Database Tools

Los scripts `backup-mongo.ps1` y `restore-mongo-test.ps1` requieren **mongodump** y **mongorestore**.

### Instalación

**Opción A — Chocolatey (recomendada para Windows):**

```powershell
choco install mongodb-database-tools
```

**Opción B — Descarga oficial:**

1. Ir a [MongoDB Database Tools](https://www.mongodb.com/try/download/database-tools)
2. Seleccionar **Windows** → **MSI** o **ZIP**
3. Instalar y agregar `C:\Program Files\MongoDB\Tools\100\bin` al `PATH`

### Verificar instalación

```powershell
mongodump --version
mongorestore --version
```

Ambos deben mostrar información de versión sin errores.

---

## Backup Manual

### Sintaxis

```powershell
$env:MONGO_URI = "mongodb+srv://<usuario>:<password>@<cluster>.mongodb.net/hrdb"
.\scripts\ops\backup-mongo.ps1
```

### Parámetros opcionales

| Parámetro | Default | Descripción |
|-----------|---------|-------------|
| `-DatabaseName` | `hrdb` | Base de datos a respaldar |
| `-OutputRoot` | `C:\Backups\Zentor` | Carpeta raíz para los backups |
| `-NoZip` | — | Si se incluye, omite la compresión ZIP |

### Ejemplos

```powershell
# Backup completo con compresión
$env:MONGO_URI = "mongodb+srv://..."
.\scripts\ops\backup-mongo.ps1

# Backup sin ZIP, carpeta personalizada
.\scripts\ops\backup-mongo.ps1 -DatabaseName hrdb -OutputRoot D:\Backups -NoZip
```

### Salida

```
C:\Backups\Zentor\
  backup-2026-06-03-12-00-00\       ← carpeta con BSON
    hrdb\
      employees.bson
      users.bson
      ...
  backup-2026-06-03-12-00-00.zip     ← comprimido
```

---

## Restore a Base de Prueba

### Sintaxis

```powershell
$env:MONGO_URI = "mongodb+srv://<usuario>:<password>@<cluster>.mongodb.net/hrdb"
.\scripts\ops\restore-mongo-test.ps1 -BackupPath "C:\Backups\Zentor\backup-2026-06-03-12-00-00\hrdb"
```

### Parámetros

| Parámetro | Requerido | Default | Descripción |
|-----------|-----------|---------|-------------|
| `-BackupPath` | **Sí** | — | Ruta completa a la carpeta del dump BSON (ej. `...\hrdb`) |
| `-TargetDatabase` | No | `hrdb_restore_test` | Nombre de la base destino (solo prueba) |
| `-Drop` | No | — | Elimina la base destino antes de restaurar (solo para `*_test`) |

### Seguridad

- **NUNCA** restaura sobre `hrdb`, `production`, `prod` o `admin`.
- Requiere confirmación interactiva escribiendo `RESTORE`.
- La opción `-Drop` solo funciona si `TargetDatabase` termina en `_test`.

### Verificar restore

```powershell
# Conectar a MongoDB y listar colecciones
mongosh "$env:MONGO_URI" --eval "use hrdb_restore_test; db.getCollectionNames()"
```

---

## Reglas de Seguridad

1. **No comitear MONGO_URI** — la URI se pasa por variable de entorno, nunca en el código.
2. **No restaurar sobre `hrdb`** — este script lo bloquea explícitamente.
3. **No compartir backups** — los archivos ZIP contienen datos reales. No subirlos a lugares públicos ni compartirlos por canales no seguros.
4. **No dejar backups sin proteger** — si guardas backups en la nube, usa cifrado.
5. **No pegar MONGO_URI en chats** — ni Slack, Discord, WhatsApp, etc.
6. **Verificar el backup** — después de generar el ZIP, asegúrate de que el tamaño es razonable.
7. **Probar el restore** — al menos una vez antes de una demo crítica, restaura a `hrdb_restore_test` y verifica los datos.
8. **Rotar credenciales** — si alguna vez se expone MONGO_URI, rota el password del usuario de base de datos desde Atlas.

---

## Frecuencia Recomendada

| Cuándo | Acción |
|--------|--------|
| Antes de cada demo importante | Backup completo + verificar ZIP |
| Después de cargar datos importantes | Backup completo |
| Semanal (durante piloto) | Backup completo |
| Antes de actualizar backend | Backup completo |
| Después de restore exitoso | Backup completo del estado verificado |

---

## Checklist Pre-Demo

- [ ] Backup generado: `scripts/ops/backup-mongo.ps1` ejecutado sin errores
- [ ] ZIP guardado en ubicación segura (nube privada o disco externo)
- [ ] Tamaño del ZIP verificado (coincide con lo esperado)
- [ ] Restore probado en `hrdb_restore_test` si hay cambios de esquema
- [ ] Health backend OK: `curl https://gested-1-backend.onrender.com/health`
- [ ] Backup listado en `scripts/ops/README.md` como referencia

---

## Upload a Google Cloud Storage

### Prerrequisitos

1. **Google Cloud SDK instalado** — [Instalar gcloud](https://cloud.google.com/sdk/docs/install-sdk)
2. **Autenticado localmente:**
   ```powershell
   gcloud auth login
   gcloud config set project zentor-cloud-credits-guardrail
   ```
3. **Bucket ya creado** — `gs://zentor-backups-zentor-cloud-credits-guardrail` (us-central1, STANDARD)
4. No se requiere service account key — se usa la sesión local de gcloud.

### Script

```
scripts/ops/upload-backup-gcs.ps1
```

### Uso — último ZIP automático

```powershell
.\scripts\ops\upload-backup-gcs.ps1
```

Detecta el ZIP más reciente en `C:\Backups\Zentor\` y lo sube a:
```
gs://zentor-backups-zentor-cloud-credits-guardrail/hrdb/YYYY-MM-DD/<filename>.zip
```

### Uso — ZIP explícito

```powershell
.\scripts\ops\upload-backup-gcs.ps1 -BackupZipPath "C:\Backups\Zentor\backup-2026-06-05.zip"
```

### DryRun — sin subir nada

```powershell
.\scripts\ops\upload-backup-gcs.ps1 -DryRun
```

Muestra cuenta activa, bucket destino, objeto destino y el comando que se ejecutaría — sin subir.

### Parámetros

| Parámetro | Default | Descripción |
|-----------|---------|-------------|
| `-BackupZipPath` | Último ZIP en `C:\Backups\Zentor` | Ruta a un ZIP específico |
| `-BucketName` | `zentor-backups-zentor-cloud-credits-guardrail` | Bucket destino |
| `-Prefix` | `hrdb` | Carpeta dentro del bucket |
| `-ProjectId` | `zentor-cloud-credits-guardrail` | Proyecto GCP |
| `-DryRun` | — | Solo muestra, no sube |

### Seguridad

- **No service account key** — el script usa `gcloud auth login` local.
- **No secretos en repo** — no se guarda MONGO_URI ni ninguna credencial en el script.
- **Bucket privado** — `public_access_prevention: enforced`, `uniform_bucket_level_access: true`.
- **No borra el ZIP local** — el backup queda en `C:\Backups\Zentor` después de subir.

### Lifecycle automático

Los objetos en GCS se eliminan automáticamente después de **60 días** (lifecycle configurado en el bucket). No requiere limpieza manual.

### Costos estimados

- ~50 MB/día × 60 días = ~3 GB activos
- STANDARD storage: ~$0.02/GB/mes → **~$0.06/mes** con crédito GCP activo
- Prácticamente gratuito para este volumen

### Restore desde GCS

```powershell
gcloud storage cp "gs://zentor-backups-zentor-cloud-credits-guardrail/hrdb/2026-06-05/backup-2026-06-05.zip" "C:\Backups\Zentor\" --project=zentor-cloud-credits-guardrail
```

Luego restaurar con `restore-mongo-test.ps1` como de costumbre.
