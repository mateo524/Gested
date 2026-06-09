const CALENDLY_LINK = "https://calendly.com/zentorhq/demo-zentor";
const FRONTEND_URL = process.env.FRONTEND_URL || "https://gested-l6ej.vercel.app";
const BACKEND_URL = process.env.BACKEND_URL || "https://gested-l6ej.vercel.app";

function header() {
  return `
<div style="margin-bottom:24px">
  <span style="font-size:20px;font-weight:700;color:#0f172a;letter-spacing:-0.3px">ZENTOR</span>
  <span style="font-size:20px;color:#14b8a6;font-weight:700">.</span>
</div>`;
}

function footer(email) {
  const encoded = encodeURIComponent(email || "");
  const unsubUrl = `${BACKEND_URL}/drip/unsubscribe?email=${encoded}`;
  return `
<p style="margin:32px 0 0;font-size:13px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:20px">
  ¿Tenés alguna duda? Escribinos a <a href="mailto:zentorhq@gmail.com" style="color:#14b8a6">zentorhq@gmail.com</a><br>
  <a href="${unsubUrl}" style="color:#94a3b8;font-size:12px">No quiero recibir más emails</a>
</p>`;
}

function ctaButton(text, url) {
  return `
<a href="${url}" style="display:inline-block;background:#14b8a6;color:#0f172a;font-weight:700;padding:14px 28px;border-radius:50px;text-decoration:none;font-size:15px">
  ${text}
</a>`;
}

function wrapper(inner) {
  return `<div style="font-family:Arial,sans-serif;max-width:600px;color:#1a1a1a;line-height:1.7;background:#fff;padding:32px;border-radius:12px">${inner}</div>`;
}

// Build steps as functions so footer can include the lead's email dynamically
export const DRIP_STEPS = [
  {
    dayOffset: 0,
    subject: "Gracias por tu interés en ZENTOR",
    buildHtml: (lead) =>
      wrapper(`
      ${header()}
      <h1 style="font-size:24px;font-weight:700;color:#0f172a;margin:0 0 8px">Hola${lead.name ? `, ${lead.name.split(" ")[0]}` : ""}! Gracias por contactarte.</h1>
      <p style="color:#475569;margin:0 0 20px">Nos alegra que hayas llegado hasta acá. Queremos contarte brevemente qué hace ZENTOR y por qué puede ser útil para tu equipo.</p>

      <div style="background:#f8fafc;border-radius:10px;padding:20px;margin-bottom:24px;border:1px solid #e2e8f0">
        <p style="margin:0 0 12px;font-size:14px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">¿Qué hace ZENTOR?</p>
        <ul style="padding-left:20px;color:#475569;margin:0;font-size:15px">
          <li style="margin-bottom:10px"><strong>Evaluaciones de desempeño en minutos</strong> — Ciclos completos con competencias, autoevaluación y evaluación de jefes, sin depender de planillas.</li>
          <li style="margin-bottom:10px"><strong>Reporte ejecutivo automático</strong> — Narrativa lista para presentar a dirección, sin armar una presentación desde cero.</li>
          <li style="margin-bottom:0"><strong>Planes de desarrollo individuales</strong> — Acciones concretas para cada empleado, vinculadas a los resultados de la evaluación.</li>
        </ul>
      </div>

      <p style="color:#475569;margin:0 0 24px">Si querés verlo en acción, podés agendar una demo de 20 minutos con nosotros. Sin compromiso.</p>
      ${ctaButton("Agendar una demo →", CALENDLY_LINK)}
      ${footer(lead.email)}
    `),
  },
  {
    dayOffset: 3,
    subject: "Cómo hacer tu primera evaluación en 10 minutos",
    buildHtml: (lead) =>
      wrapper(`
      ${header()}
      <h1 style="font-size:24px;font-weight:700;color:#0f172a;margin:0 0 8px">Tu primera evaluación, paso a paso</h1>
      <p style="color:#475569;margin:0 0 20px">Hola${lead.name ? ` ${lead.name.split(" ")[0]}` : ""}. Una de las cosas que más valoran los equipos que usan ZENTOR es lo rápido que se puede arrancar. Acá te mostramos cómo:</p>

      <div style="background:#f8fafc;border-radius:10px;padding:20px;margin-bottom:24px;border:1px solid #e2e8f0">
        <div style="display:flex;align-items:flex-start;margin-bottom:16px">
          <span style="background:#14b8a6;color:#0f172a;font-weight:700;border-radius:50%;width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0;margin-right:12px;margin-top:2px">1</span>
          <div><strong style="color:#0f172a">Cargar empleados</strong><br><span style="color:#64748b;font-size:14px">Importá desde Excel o cargalos manualmente. Solo lleva unos minutos.</span></div>
        </div>
        <div style="display:flex;align-items:flex-start;margin-bottom:16px">
          <span style="background:#14b8a6;color:#0f172a;font-weight:700;border-radius:50%;width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0;margin-right:12px;margin-top:2px">2</span>
          <div><strong style="color:#0f172a">Definir competencias</strong><br><span style="color:#64748b;font-size:14px">Elegí las competencias que querés evaluar — tenemos plantillas listas para usar o podés crear las tuyas.</span></div>
        </div>
        <div style="display:flex;align-items:flex-start;margin-bottom:16px">
          <span style="background:#14b8a6;color:#0f172a;font-weight:700;border-radius:50%;width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0;margin-right:12px;margin-top:2px">3</span>
          <div><strong style="color:#0f172a">Crear el ciclo</strong><br><span style="color:#64748b;font-size:14px">Configurás fechas, participantes y tipo de evaluación (autoevaluación, 180°, 360°). Un clic para lanzar.</span></div>
        </div>
        <div style="display:flex;align-items:flex-start">
          <span style="background:#14b8a6;color:#0f172a;font-weight:700;border-radius:50%;width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0;margin-right:12px;margin-top:2px">4</span>
          <div><strong style="color:#0f172a">Ver el reporte</strong><br><span style="color:#64748b;font-size:14px">Cuando se cierran las evaluaciones, el reporte ejecutivo se genera solo. Listo para descargar o presentar.</span></div>
        </div>
      </div>

      <p style="color:#475569;margin:0 0 24px">¿Querés probarlo con tu propio equipo? La demo es en vivo y podemos recorrer el proceso con datos reales.</p>
      ${ctaButton("Probar la demo gratis →", CALENDLY_LINK)}
      ${footer(lead.email)}
    `),
  },
  {
    dayOffset: 7,
    subject: "El reporte ejecutivo que tus directivos van a agradecer",
    buildHtml: (lead) =>
      wrapper(`
      ${header()}
      <h1 style="font-size:24px;font-weight:700;color:#0f172a;margin:0 0 8px">Sin armar una presentación desde cero</h1>
      <p style="color:#475569;margin:0 0 20px">Hola${lead.name ? ` ${lead.name.split(" ")[0]}` : ""}. Una de las partes más pesadas del proceso de evaluación siempre fue la misma: tomar todos los datos y convertirlos en algo que dirección pueda leer en 5 minutos.</p>

      <p style="color:#475569;margin:0 0 20px">ZENTOR genera ese reporte automáticamente. Incluye:</p>

      <div style="background:#f8fafc;border-radius:10px;padding:20px;margin-bottom:24px;border:1px solid #e2e8f0">
        <ul style="padding-left:20px;color:#475569;margin:0;font-size:15px">
          <li style="margin-bottom:10px">Narrativa automática con los puntos fuertes y áreas de mejora del equipo</li>
          <li style="margin-bottom:10px">Ranking de desempeño por área o departamento</li>
          <li style="margin-bottom:10px">Comparativa entre autoevaluación y evaluación del jefe</li>
          <li style="margin-bottom:0">Acciones de desarrollo sugeridas por perfil</li>
        </ul>
      </div>

      <div style="background:#e0fdf4;border-left:4px solid #14b8a6;padding:16px 20px;border-radius:0 8px 8px 0;margin-bottom:24px">
        <p style="margin:0;color:#0f172a;font-size:14px;font-style:italic">"Antes tardábamos dos semanas en armar la presentación para el comité. Con ZENTOR lo tenemos listo al día siguiente de cerrar el ciclo."</p>
      </div>

      <p style="color:#475569;margin:0 0 24px">¿Querés ver cómo se ve el reporte con datos reales? Te lo mostramos en la demo.</p>
      ${ctaButton("Agendar demo →", CALENDLY_LINK)}
      ${footer(lead.email)}
    `),
  },
  {
    dayOffset: 14,
    subject: "¿Cómo están manejando el desempeño en tu empresa hoy?",
    buildHtml: (lead) =>
      wrapper(`
      ${header()}
      <h1 style="font-size:24px;font-weight:700;color:#0f172a;margin:0 0 8px">Una pregunta rápida</h1>
      <p style="color:#475569;margin:0 0 20px">Hola${lead.name ? ` ${lead.name.split(" ")[0]}` : ""}. Antes de seguir, nos gustaría entender mejor tu situación actual para poder mostrarte lo más relevante de ZENTOR.</p>

      <p style="color:#475569;margin:0 0 16px"><strong>¿Cómo manejan hoy las evaluaciones de desempeño en tu empresa?</strong></p>

      <div style="background:#f8fafc;border-radius:10px;padding:20px;margin-bottom:24px;border:1px solid #e2e8f0">
        <p style="margin:0 0 12px;color:#475569;font-size:15px">✓ &nbsp;<strong>Excel o planillas</strong> — Lo hacemos a mano, por email o en un Google Sheet compartido</p>
        <p style="margin:0 0 12px;color:#475569;font-size:15px">✓ &nbsp;<strong>Sin sistema formal</strong> — Las evaluaciones son informales o muy esporádicas</p>
        <p style="margin:0;color:#475569;font-size:15px">✓ &nbsp;<strong>Otra herramienta</strong> — Usamos algún sistema, pero no estamos del todo conformes</p>
      </div>

      <p style="color:#475569;margin:0 0 24px">Respondé este email con tu situación — con esa info podemos personalizar la demo y mostrarte exactamente qué puede cambiar en tu caso.</p>
      ${ctaButton("Agendar la demo →", CALENDLY_LINK)}
      ${footer(lead.email)}
    `),
  },
  {
    dayOffset: 21,
    subject: "Último recordatorio — demo disponible esta semana",
    buildHtml: (lead) =>
      wrapper(`
      ${header()}
      <h1 style="font-size:24px;font-weight:700;color:#0f172a;margin:0 0 8px">Sin presión — pero el link sigue disponible</h1>
      <p style="color:#475569;margin:0 0 20px">Hola${lead.name ? ` ${lead.name.split(" ")[0]}` : ""}. Este es el último email de esta serie.</p>

      <p style="color:#475569;margin:0 0 20px">Si ahora mismo no es el momento para explorar una herramienta de evaluación de desempeño, no hay problema. Los procesos cambian, los equipos crecen, y cuando llegue el momento, seguimos acá.</p>

      <p style="color:#475569;margin:0 0 20px">Pero si tienen 20 minutos disponibles esta semana y quieren ver ZENTOR en acción, el link para agendar una demo sigue abierto:</p>

      ${ctaButton("Ver disponibilidad →", CALENDLY_LINK)}

      <p style="color:#475569;margin:24px 0 0">Gracias por el interés, y si en algún momento quieren retomar la conversación, solo tienen que escribirnos a <a href="mailto:zentorhq@gmail.com" style="color:#14b8a6">zentorhq@gmail.com</a>.</p>
      <p style="color:#475569;margin:8px 0 0">— El equipo de ZENTOR</p>
      ${footer(lead.email)}
    `),
  },
];
