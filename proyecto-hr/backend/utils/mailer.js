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

export async function sendPasswordResetEmail({ to, resetUrl }) {
  if (!smtpConfigured()) {
    return { sent: false, reason: "smtp_not_configured" };
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "false") === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

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
