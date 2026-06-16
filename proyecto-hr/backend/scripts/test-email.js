#!/usr/bin/env node
/**
 * Test de envío de email via Resend.
 * Uso: RESEND_API_KEY=re_xxx RESEND_FROM_EMAIL=no-reply@tudominio.com node scripts/test-email.js tu@email.com
 */
import "dotenv/config";
import { Resend } from "resend";

const to = process.argv[2];
if (!to) {
  console.error("Uso: node scripts/test-email.js destinatario@email.com");
  process.exit(1);
}

if (!process.env.RESEND_API_KEY) {
  console.error("Falta RESEND_API_KEY en .env");
  process.exit(1);
}

const resend = new Resend(process.env.RESEND_API_KEY);
const from = process.env.RESEND_FROM_EMAIL || "no-reply@zentor.com.ar";

console.log(`Enviando email de prueba desde <${from}> a <${to}>...`);

const { data, error } = await resend.emails.send({
  from,
  to,
  subject: "✅ Zentor — test de email funcionando",
  html: `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
      <h2 style="color:#0f172a">¡Email funcionando correctamente!</h2>
      <p style="color:#475569">Si recibís este mensaje, el transporte de Resend está bien configurado en Zentor.</p>
      <p style="color:#94a3b8;font-size:12px;margin-top:32px">Enviado desde el script test-email.js · ${new Date().toLocaleString("es-AR")}</p>
    </div>
  `,
});

if (error) {
  console.error("❌ Error:", error);
  process.exit(1);
}

console.log("✅ Email enviado correctamente. ID:", data.id);
