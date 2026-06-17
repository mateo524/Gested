#!/usr/bin/env node
/**
 * Test de envÃ­o de email via Resend (sin dependencias externas).
 * Uso: RESEND_API_KEY=re_xxx RESEND_FROM_EMAIL=no-reply@tudominio.com node scripts/test-email.js tu@email.com
 */
import "dotenv/config";

const to = process.argv[2];
if (!to) {
  console.error("Uso: node scripts/test-email.js destinatario@email.com");
  process.exit(1);
}

if (!process.env.RESEND_API_KEY) {
  console.error("Falta RESEND_API_KEY en .env");
  process.exit(1);
}

const from = process.env.RESEND_FROM_EMAIL || "no-reply@zentorhq.com.ar";
console.log(`Enviando desde <${from}> a <${to}>...`);

const res = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    from,
    to,
    subject: "âœ… Zentor â€” test de email funcionando",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
        <h2 style="color:#0f172a">Â¡Email funcionando correctamente!</h2>
        <p style="color:#475569">Si recibÃ­s este mensaje, el transporte de Resend estÃ¡ bien configurado en Zentor.</p>
        <p style="color:#94a3b8;font-size:12px;margin-top:32px">Enviado desde test-email.js Â· ${new Date().toLocaleString("es-AR")}</p>
      </div>
    `,
  }),
});

const data = await res.json().catch(() => ({}));

if (res.status === 200 || res.status === 201) {
  console.log("âœ… Email enviado correctamente. ID:", data.id);
} else {
  console.error("âŒ Error:", res.status, data?.message || data);
  process.exit(1);
}
