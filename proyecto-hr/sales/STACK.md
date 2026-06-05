# ZENTOR — Sales & Growth Stack

Stack de herramientas de ventas. Todas en tier gratuito. Referencia: lo que usan empresas de 50-200 empleados.

---

## Stack completo (todo gratis)

| Herramienta | Rol | Plan Free | Link |
|-------------|-----|-----------|------|
| **HubSpot CRM** | CRM central — contactos, deals, pipeline visual | 100% gratis, sin límite de contactos | hubspot.com/crm |
| **Brevo** | Email sequences automáticas — 300 emails/día gratis | 300/día, automation básica | brevo.com |
| **Apollo.io** | Prospecting — 50 exports/mes | 50 exports | apollo.io |
| **Calendly** | Agendar demos automáticamente | 1 tipo de evento, reuniones ilimitadas | calendly.com |
| **Notion** | Sales playbook, notas de reuniones, templates | Ilimitado para individuos | notion.so |
| **LinkedIn** | Outreach directo, buscar decision-makers | Gratis (Sales Nav = $100/mes, no necesario aún) | linkedin.com |
| **Google Workspace** | Email, Calendar, Meet para demos | Gratis con cuenta Google | workspace.google.com |

---

## Setup paso a paso

### 1. HubSpot CRM (prioridad máxima — hacerlo hoy)

1. Ir a **hubspot.com/crm** → "Get started free"
2. Crear cuenta con contacto@zentor.app
3. Crear pipeline con estas etapas:
   - Prospecto nuevo
   - Contactado
   - Demo agendada
   - Demo realizada
   - Propuesta enviada
   - Cerrado ganado / Cerrado perdido
4. Importar los 10 prospectos de `sales/prospects.json`
5. Instalar extensión de Chrome de HubSpot → trackea opens de emails automáticamente

**Por qué HubSpot:** es el estándar en empresas de 50-200 empleados. Free tier es genuinamente potente. Nunca se paga hasta tener revenue.

---

### 2. Brevo (email sequences)

1. Ir a **brevo.com** → crear cuenta gratis
2. Verificar dominio zentor.app (SPF/DKIM)
3. Crear campaña "ZENTOR Outreach — Secuencia A":
   - Email 1 (Día 1): "¿Seguís gestionando evaluaciones en Excel?"
   - Email 2 (Día 7): "Una cosa que cambia cómo gestionás el desempeño"
   - Email 3 (Día 14): "Última consulta antes de cerrar el hilo"
4. Conectar con HubSpot CRM via webhook

Templates disponibles en: `sales/outreach/email_templates.md`

**Alternativa si no verifican dominio:** usar Gmail + extensión Streak (gratis, CRM dentro de Gmail).

---

### 3. Calendly (agendar demos)

1. Ir a **calendly.com** → cuenta gratis
2. Crear evento "Demo ZENTOR — 15 minutos"
3. Conectar con Google Calendar
4. Agregar el link en:
   - Landing page: botón "Pedir demo" → reemplazar mailto con link de Calendly
   - Firma de email
   - LinkedIn bio
   - Botón "Contactar" del dashboard de ZENTOR

**Link sugerido:** calendly.com/zentor/demo

---

### 4. Apollo.io (ya configurado)

API Key: configurada en agente zentor-prospector
Uso: búsqueda de empresas por industria/tamaño/ubicación
Límite free: 50 exports/mes → usar para las mejores oportunidades

---

### 5. Notion (sales playbook)

Crear workspace "ZENTOR Sales":
- **Prospectos DB**: mirror de prospects.json
- **Reuniones**: notas de cada demo
- **Playbook**: script de demo, objections, pricing
- **Competidores**: análisis de Crehana, Buk, Factorial

---

## Qué usan empresas medianas (referencia)

### Stack de una empresa de 100 empleados típica:
- CRM: HubSpot Pro ($450/mo) o Salesforce ($75/usuario/mo)
- Email: Outreach.io ($100/usuario/mo) o Salesloft ($125/usuario/mo)
- Prospecting: LinkedIn Sales Navigator ($100/mo) + ZoomInfo ($15k/año)
- Scheduling: Calendly Teams ($16/mo)
- Proposals: PandaDoc ($35/mo) o DocSend ($45/mo)
- Analytics: Gong ($150/usuario/mo) para grabar calls

### Nuestro equivalente gratuito:
- CRM: HubSpot Free ✓
- Email: Brevo Free ✓
- Prospecting: Apollo Free + LinkedIn ✓
- Scheduling: Calendly Free ✓
- Proposals: Google Docs / PDF desde ZENTOR ✓
- Analytics: HubSpot meetings recording (gratis) ✓

**Ahorro vs stack de empresa mediana: ~$600/mes**

---

## Cuándo actualizar a paid

| Herramienta | Cuando pagar | Costo |
|-------------|-------------|-------|
| Apollo Basic | Cuando necesitás emails de contactos (ya con 1er cliente) | $49/mes |
| HubSpot Starter | Cuando tenés 5+ deals activos simultáneos | $20/mes |
| Calendly Standard | Cuando querés múltiples tipos de reunión | $10/mes |
| LinkedIn Sales Nav | Cuando tenés $3k MRR y querés escalar | $100/mes |

---

*Mantenido por: zentor-prospector agent + equipo ZENTOR*
