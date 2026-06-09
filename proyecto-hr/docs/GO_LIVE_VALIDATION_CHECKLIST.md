# Performia - Go Live Validation Checklist

## 1) Preparacion

- [ ] Backend desplegado en Render (estado verde).
- [ ] Frontend desplegado en Vercel (estado verde).
- [ ] Variables de entorno cargadas (`MONGO_URI`, `JWT_SECRET` recomendado 32+ caracteres, `CLOUDINARY_*`, `SMTP_*`, `AUTOMATION_TOKEN`).
- [ ] Si `JWT_SECRET` es menor a 32 en producción, revisar advertencia de seguridad y corregir antes del go-live formal.
- [ ] Ejecutado `npm run seed:validation-matrix` en backend.

## 2) Matriz de perfiles y aislamiento

Usuarios de prueba (password por defecto en seed):

- `superadmin@performia.local` (`SUPER_ADMIN`)
- `director.norte@performia.local` (`ADMIN_COLEGIO`)
- `rrhh.norte@performia.local` (`RRHH`)
- `jefe.norte@performia.local` (`JEFE`)
- `empleado.norte@performia.local` (`EMPLEADO`)
- `lector.sur@performia.local` (`LECTOR`)

Validar para cada perfil:

- [ ] Login correcto + logout.
- [ ] Login fallido (verifica lockout por intentos).
- [ ] Menu visible segun permisos.
- [ ] Intento de URL prohibida devuelve denegacion.
- [ ] No se ven datos de otra organizacion.

Checks adicionales:

- [ ] `JEFE` solo ve su equipo.
- [ ] `EMPLEADO` solo ve su propio perfil/evaluaciones.
- [ ] Descargas respetan permisos y generan `download_logs`.
- [ ] Cambio de password funciona.
- [ ] Flujo "Olvide mi contrasena" funciona.

## 3) E2E funcional minimo

- [ ] Crear organizacion/colegio.
- [ ] Crear usuario y asignar rol.
- [ ] Alta manual de empleado.
- [ ] Alta de competencias y metricas.
- [ ] Alta de ciclo.
- [ ] Alta de evaluacion.
- [ ] Alta de plan de desarrollo.
- [ ] Dashboard responde coherente.
- [ ] Exportacion por rol responde coherente.
- [ ] Auditoria registra acciones sensibles.

## 4) Importacion inteligente (UI 3 pasos)

Flujo esperado:

1. Subir archivo
2. Validar (reglas + IA si esta habilitada)
3. Confirmar importacion

Validaciones:

- [ ] Historial de importaciones visible.
- [ ] Cada importacion guarda trazabilidad (`import_jobs`).
- [ ] Errores por fila se muestran con motivo legible.
- [ ] No se insertan filas incompletas obligatorias.
- [ ] Inconsistencias pasan a estado de error/revision.

## 5) Bateria de archivos (10 casos)

- [ ] Excel tabular limpio
- [ ] Excel con headers mal nombrados
- [ ] Excel multi-hoja
- [ ] CSV con codificacion especial
- [ ] Documento narrativo
- [ ] Archivo incompleto
- [ ] Archivo con duplicados
- [ ] Archivo con tipos invalidos
- [ ] Archivo mixto
- [ ] Archivo no soportado

## 6) Smoke test tecnico rapido

- [ ] Ejecutar `npm run smoke:postdeploy` en backend con `SMOKE_API_URL`, `SMOKE_EMAIL`, `SMOKE_PASSWORD`.
- [ ] Revisar logs backend (sin errores 5xx recurrentes).
- [ ] Revisar ultimas importaciones en `/education-exports/import-jobs`.
