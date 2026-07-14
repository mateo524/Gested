# Zentor — Contexto del proyecto

## Stack
Frontend: React 19 + Vite — src/
Backend: Express 5 + Node 20 — backend/
Base de datos: MongoDB Atlas (hrdb) — tier gratis/compartido (M0/M2), no M40 dedicado
Deploy frontend: Vercel
Deploy backend: Render (Web Service, plan free) — https://gested-1-backend.onrender.com
Pagos: MercadoPago

## Infra: limitaciones conocidas
Atlas free/shared y Render free duermen/hacen mantenimiento automático:
error transitorio "not primary" en escrituras es esperable, no es bug de código.
Mitigación ya en el código: backend/server.js reconecta si detecta conexión
stale; backend/services/simpleImportService.js reintenta escrituras
transitorias (withMongoRetry). Solución de fondo: upgradear Atlas a M10+ y/o
Render a plan pago.

## Repos
App + Backend: github.com/mateo524/Gested (rama: main)
Landing: github.com/mateo524/performia-web (rama: master)

## Reglas que nunca se rompen
• NUNCA tocar AnnouncementsPage.jsx
• NUNCA instalar lucide-react — usar SVGs inline
• NUNCA cerrar sesión por errores de red — solo logout en error?.status === 401
• NUNCA usar insertMany para EvaluationScore — siempre bulkWrite con upsert
• NUNCA llamar .map() en respuestas paginadas sin Array.isArray() primero
• Toasts siempre con objeto: addToast({ message, type })
• NUNCA mostrar precios en la landing
• Antes de pushear la landing: npx tsc --noEmit

## Git
Siempre pushear juntas: git push origin main restore-good-app
Si restore-good-app quedó atrás: git push origin main:restore-good-app --force

## Archivos clave
Hay DOS sistemas de importación masiva, no confundirlos:
- "Carga rápida" (Personas/Datos/Importación, el que se usa hoy):
  backend/services/simpleImportService.js — plantilla, análisis y confirmación
  (Personas: legajo/nombre/apellido/email/departamento/puesto/jefe_directo/
  fecha_ingreso/fecha_nacimiento; jefe_directo se resuelve a managerId por
  match de nombre completo). Ruta: backend/routes/bulkImport.routes.js
  (/bulk-import/simple/:type/*). Frontend: src/pages/BulkImportPage.jsx.
- Importador "avanzado" unificado (multi-hoja, más legacy, no se usa desde la UI
  actual salvo que se reactive):
  backend/utils/bulkImportTemplate.js — genera el Excel
  backend/services/bulkImportAnalyzer.js — valida el Excel (HEADER_ALIASES español→inglés)
  backend/services/bulkImportConfirm.js — persiste en MongoDB

backend/routes/billing.routes.js — MercadoPago
backend/models/Employee.js — schoolId es optional; tiene fechaNacimiento y managerId
src/components/AppShell.jsx — shell principal
src/pages/BillingPage.jsx — billing, detecta ?billing_return=1
src/context/AuthContext.jsx — solo logout en status 401

## Tests
cd backend && npm test — correr antes de cada push
Instalá las dependencias: npm install en la raíz y en backend/
