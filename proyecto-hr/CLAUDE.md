# CLAUDE.md — Proyecto ZENTOR / Gested

## REGLA PRINCIPAL: Usar agentes para cada tarea

**Antes de escribir código, leer un archivo o planificar cualquier cambio**, revisá los agentes disponibles en `~/.claude/agents/` y seleccioná los más adecuados para la tarea. Usá 1 o más en paralelo según corresponda.

### Agentes más relevantes para este proyecto

| Tarea | Agentes a usar |
|-------|----------------|
| Crear/modificar componentes React, UI | `engineering-frontend-developer` + `design-ui-designer` |
| Backend routes, lógica de negocio | `engineering-backend-architect` + `engineering-senior-developer` |
| Corrección de bugs | `engineering-code-reviewer` + `engineering-minimal-change-engineer` |
| Optimización queries MongoDB | `engineering-database-optimizer` |
| Seguridad, auth, permisos | `security-appsec-engineer` + `security-architect` |
| CI/CD, GitHub Actions, Cloud Run | `engineering-devops-automator` + `engineering-sre` |
| Testing, validación | `testing-api-tester` + `testing-reality-checker` |
| Diseño visual, UX | `design-ux-architect` + `design-visual-storyteller` |
| Feature nueva compleja | `engineering-rapid-prototyper` + `engineering-software-architect` |
| Revisión de código | `engineering-code-reviewer` + `security-appsec-engineer` |
| Performance | `testing-performance-benchmarker` + `engineering-database-optimizer` |
| Arquitectura / decisiones técnicas | `engineering-software-architect` + `engineering-multi-agent-systems-architect` |

### Cómo seleccionar agentes

1. Leer el nombre de la tarea pedida
2. Identificar la categoría principal (frontend / backend / seguridad / diseño / CI-CD / etc.)
3. Elegir el agente principal de esa categoría
4. Si la tarea toca más de una capa (ej: frontend + backend), agregar el agente de la otra capa
5. Si hay riesgo de regresión o seguridad, agregar `engineering-code-reviewer` o `security-appsec-engineer`
6. Lanzar los agentes en paralelo con el tool `Agent`

---

## Restricciones de seguridad — NUNCA violar

- **NUNCA** pushear solo a `main` — siempre `restore-good-app` + `main` juntos
- **NUNCA** hacer logout en network errors — solo en `error?.status === 401`
- **NUNCA** tocar `AnnouncementsPage.jsx`
- **NUNCA** retornar contraseñas en texto plano en respuestas HTTP

## Stack técnico

- **Frontend**: React 19 + Vite 8 + Tailwind 4 — dark only, CTA `#14b8a6` teal, bg `#091319`/`#0c1e28`
- **Backend**: Node.js + Express + MongoDB (Mongoose 9) — ES modules (`"type": "module"`)
- **Infra**: GCP Cloud Run (`zentor-backend`), Vercel (frontend), GitHub Actions CI/CD
- **Auth**: JWT, `requireAnyPermission`, `attachTenantScope`, `buildScopedFilter`

## Patrones establecidos

- Cache: `cacheGet/cacheSet/cacheGetOrFetch/cacheClearByPrefix` — llamar `invalidateReportCache(companyId)` e `invalidateDashboardCache(companyId)` en mutaciones
- Background tasks: `runInBackground(fn, label)`
- Toast: siempre `addToast({ message, type })` — nunca `addToast(string, type)`
- Seeding de scores: `bulkWrite` con upsert, nunca `insertMany` (duplicados)
- Git: commit en `restore-good-app` → merge a `main` → push ambos simultáneamente

## Comandos útiles

```bash
# Backend local
cd backend && node --env-file=.env server.js

# Frontend local
npm run dev

# Reset DB (preserva superadmin)
cd backend && node --env-file=.env scripts/wipeTenantData.js

# Push correcto (nunca solo main)
git push origin main restore-good-app
```

## MCPs disponibles

- **shadcn** — componentes UI del registry shadcn/ui (`/mcp` para verificar)
- **magic** (@21st-dev) — generación de componentes con IA (`/mcp` para verificar)

## Credenciales de producción

- MongoDB: `performia_app` en cluster `admin.s9kg1qj.mongodb.net`, DB `hrdb`
- Cloud Run: proyecto `zentor-cloud-credits-guardrail`, región `us-east1`, servicio `zentor-backend`
- Superadmin: `admin@demo.com`
