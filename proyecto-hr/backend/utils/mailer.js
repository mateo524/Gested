import nodemailer from "nodemailer";

// ── SendGrid helper (used when SMTP is not configured) ─────────────────────
async function sendViaSendGrid({ to, subject, html }) {
  const key = process.env.SENDGRID_API_KEY;
  if (!key) return { sent: false, reason: "no_sendgrid_key" };

  const body = JSON.stringify({
    personalizations: [{ to: [{ email: to }] }],
    from: { email: "zentorhq@gmail.com", name: "ZENTOR" },
    subject,
    content: [{ type: "text/html", value: html }],
  });

  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body,
  });

  return res.status === 202 ? { sent: true } : { sent: false, reason: `sg_${res.status}` };
}

function canSend() {
  return Boolean(process.env.SENDGRID_API_KEY) || Boolean(process.env.SMTP_HOST);
}

async function dispatch({ to, subject, html, text }) {
  if (process.env.SENDGRID_API_KEY) return sendViaSendGrid({ to, subject, html });
  if (!smtpConfigured()) return { sent: false, reason: "no_transport" };
  const t = createTransporter();
  await t.sendMail({ from: process.env.SMTP_FROM, to, subject, html, text });
  return { sent: true };
}

function smtpConfigured() {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      process.env.SMTP_FROM
  );
}

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "false") === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

// ── Welcome email when a new organization is created ──────────────────────
export async function sendWelcomeEmail({ to, nombre, companyName, password, appUrl }) {
  if (!canSend()) return { sent: false, reason: "no_transport" };

  const url = appUrl || process.env.FRONTEND_URL || "https://gested-l6ej.vercel.app";

  const html = `
<div style="font-family:Arial,sans-serif;max-width:600px;color:#1a1a1a;line-height:1.7;background:#fff;padding:32px;border-radius:12px">
  <div style="margin-bottom:24px">
    <span style="font-size:20px;font-weight:700;color:#0f172a;letter-spacing:-0.3px">ZENTOR</span>
    <span style="font-size:20px;color:#14b8a6;font-weight:700">.</span>
  </div>

  <h1 style="font-size:24px;font-weight:700;color:#0f172a;margin:0 0 8px">¡Bienvenido a ZENTOR, ${nombre}!</h1>
  <p style="color:#475569;margin:0 0 24px">Tu cuenta para <strong>${companyName}</strong> ya está activa.</p>

  <div style="background:#f8fafc;border-radius:10px;padding:20px;margin-bottom:24px;border:1px solid #e2e8f0">
    <p style="margin:0 0 8px;font-size:14px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Tus credenciales</p>
    <p style="margin:4px 0;font-size:15px"><strong>Email:</strong> ${to}</p>
    <p style="margin:4px 0;font-size:15px"><strong>Contraseña temporal:</strong> <code style="background:#e2e8f0;padding:2px 8px;border-radius:4px">${password}</code></p>
    <p style="margin:12px 0 0;font-size:13px;color:#94a3b8">Se te pedirá cambiar la contraseña en el primer acceso.</p>
  </div>

  <p style="font-weight:600;color:#0f172a;margin:0 0 12px">Primeros pasos recomendados:</p>
  <ol style="padding-left:20px;color:#475569;margin:0 0 24px">
    <li style="margin-bottom:8px">Ingresá a la plataforma y cambiá tu contraseña</li>
    <li style="margin-bottom:8px">Cargá los empleados de tu organización (podés importar desde Excel)</li>
    <li style="margin-bottom:8px">Creá las competencias o indicadores que querés evaluar</li>
    <li style="margin-bottom:8px">Configurá el primer ciclo de evaluación</li>
  </ol>

  <a href="${url}" style="display:inline-block;background:#14b8a6;color:#0f172a;font-weight:700;padding:14px 28px;border-radius:50px;text-decoration:none;font-size:15px">
    Ingresar a ZENTOR →
  </a>

  <p style="margin:32px 0 0;font-size:13px;color:#94a3b8">
    ¿Tenés alguna duda? Respondé este email o escribinos a <a href="mailto:zentorhq@gmail.com" style="color:#14b8a6">zentorhq@gmail.com</a>.<br>
    Demo en vivo: <a href="https://calendly.com/zentorhq/demo-zentor" style="color:#14b8a6">calendly.com/zentorhq/demo-zentor</a>
  </p>
</div>`;

  return dispatch({ to, subject: `Bienvenido a ZENTOR — ${companyName}`, html });
}

// ── Pending evaluations reminder ───────────────────────────────────────────
export async function sendEvaluationReminderEmail({ to, nombre, pendingCount, cycleEndDate, appUrl }) {
  if (!canSend()) return { sent: false, reason: "no_transport" };

  const url = appUrl || process.env.FRONTEND_URL || "https://gested-l6ej.vercel.app";
  const dateStr = cycleEndDate ? new Date(cycleEndDate).toLocaleDateString("es-AR", { day: "numeric", month: "long" }) : "";

  const html = `
<div style="font-family:Arial,sans-serif;max-width:600px;color:#1a1a1a;line-height:1.7;background:#fff;padding:32px;border-radius:12px">
  <div style="margin-bottom:24px">
    <span style="font-size:20px;font-weight:700;color:#0f172a">ZENTOR</span><span style="color:#14b8a6;font-weight:700">.</span>
  </div>
  <h1 style="font-size:22px;font-weight:700;color:#0f172a;margin:0 0 8px">Tenés ${pendingCount} evaluacion${pendingCount > 1 ? "es" : ""} pendiente${pendingCount > 1 ? "s" : ""}</h1>
  <p style="color:#475569;margin:0 0 24px">Hola ${nombre}${dateStr ? `, el ciclo actual cierra el <strong>${dateStr}</strong>` : ""}. Completalas para que el reporte ejecutivo quede completo.</p>
  <a href="${url}?view=evaluaciones" style="display:inline-block;background:#14b8a6;color:#0f172a;font-weight:700;padding:14px 28px;border-radius:50px;text-decoration:none;font-size:15px">
    Completar evaluaciones →
  </a>
  <p style="margin:24px 0 0;font-size:13px;color:#94a3b8">¿Necesitás ayuda? <a href="mailto:zentorhq@gmail.com" style="color:#14b8a6">zentorhq@gmail.com</a></p>
</div>`;

  return dispatch({ to, subject: `Recordatorio: ${pendingCount} evaluacion${pendingCount > 1 ? "es" : ""} pendiente${pendingCount > 1 ? "s" : ""} en ZENTOR`, html });
}

export async function sendPasswordResetEmail({ to, resetUrl }) {
  if (!smtpConfigured()) {
    return { sent: false, reason: "smtp_not_configured" };
  }

  const transporter = createTransporter();

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: "Performia - Recuperar contrasena",
    text: `Recibimos una solicitud para restablecer tu contrasena.\n\nUsa este enlace:\n${resetUrl}\n\nSi no lo solicitaste, ignora este correo.`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a">
        <h2>Performia</h2>
        <p>Recibimos una solicitud para restablecer tu contrasena.</p>
        <p>
          <a href="${resetUrl}" style="display:inline-block;padding:10px 14px;background:#1e3a8a;color:#fff;border-radius:8px;text-decoration:none">
            Restablecer contrasena
          </a>
        </p>
        <p>Si no lo solicitaste, ignora este correo.</p>
      </div>
    `,
  });

  return { sent: true };
}

export async function sendContactRequestNotification(contactRequest) {
  if (!smtpConfigured()) {
    return { sent: false, reason: "smtp_not_configured" };
  }

  const transporter = createTransporter();
  const to = process.env.CONTACT_NOTIFICATIONS_TO || process.env.SUPPORT_CONTACT_TO || process.env.SMTP_FROM;

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: `Performia - Nueva solicitud comercial (${contactRequest.source || "landing"})`,
    text: [
      "Nueva solicitud comercial en Performia",
      `Nombre: ${contactRequest.name}`,
      `Email: ${contactRequest.email}`,
      `Institucion: ${contactRequest.institution || "-"}`,
      `Rol: ${contactRequest.role || "-"}`,
      `Tamano: ${contactRequest.size || "-"}`,
      `Origen: ${contactRequest.source || "-"}`,
      "",
      "Mensaje:",
      contactRequest.message || "-",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a">
        <h2>Nueva solicitud comercial</h2>
        <p><strong>Nombre:</strong> ${contactRequest.name}</p>
        <p><strong>Email:</strong> ${contactRequest.email}</p>
        <p><strong>Institucion:</strong> ${contactRequest.institution || "-"}</p>
        <p><strong>Rol:</strong> ${contactRequest.role || "-"}</p>
        <p><strong>Tamano:</strong> ${contactRequest.size || "-"}</p>
        <p><strong>Origen:</strong> ${contactRequest.source || "-"}</p>
        <p><strong>Mensaje:</strong></p>
        <p>${String(contactRequest.message || "-").replace(/\n/g, "<br/>")}</p>
      </div>
    `,
  });

  return { sent: true };
}
