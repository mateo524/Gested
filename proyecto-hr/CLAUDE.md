# Zentor — Contexto del proyecto

## Stack
Frontend: React 19 + Vite — src/
Backend: Express 5 + Node 20 — backend/
Base de datos: MongoDB Atlas (hrdb)
Deploy frontend: Vercel
Deploy backend: Google Cloud Run (GitHub Actions)
Pagos: MercadoPago

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
backend/utils/bulkImportTemplate.js — genera el Excel
backend/services/bulkImportAnalyzer.js — valida el Excel (HEADER_ALIASES español→inglés)
backend/services/bulkImportConfirm.js — persiste en MongoDB
backend/routes/bulkImport.routes.js — rutas de importación
backend/routes/billing.routes.js — MercadoPago
backend/models/Employee.js — schoolId es optional
src/components/AppShell.jsx — shell principal
src/pages/BillingPage.jsx — billing, detecta ?billing_return=1
src/context/AuthContext.jsx — solo logout en status 401

## Tests
cd backend && npm test — correr antes de cada push
Instalá las dependencias: npm install en la raíz y en backend/
