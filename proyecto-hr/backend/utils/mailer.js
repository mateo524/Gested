import nodemailer from "nodemailer";

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
