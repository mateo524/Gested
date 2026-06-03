# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Runtime del backend (Performia)

Para iniciar `backend/server.js`, el entorno debe definir:

- `MONGO_URI`
- `JWT_SECRET`

En producción (`NODE_ENV=production`), se recomienda `JWT_SECRET` de al menos 32 caracteres.  
Actualmente, si es menor, el backend no bloquea el arranque pero emite advertencia de seguridad.  
Debe corregirse antes de una salida productiva formal.

Variables de referencia sin secretos reales: [backend/.env.example](/C:/Dev/Gested/proyecto-hr/backend/.env.example)

## Tests de seguridad backend

Desde `backend/`:

- `npm test`
- `npm run test:security`

Estos tests cubren regresiones de aislamiento multi-tenant y acceso por rol.

## Documentación operativa

- [Manual de operaciones](docs/OPERATIONS.md) — arquitectura, despliegue, tareas comunes y troubleshooting
- [Checklist de producción](docs/PRODUCTION_CHECKLIST.md) — pasos pre-go-live: seguridad, monitoreo, backups
- [Checklist de validación go-live](docs/GO_LIVE_VALIDATION_CHECKLIST.md) — matriz de perfiles, E2E funcional, importación
