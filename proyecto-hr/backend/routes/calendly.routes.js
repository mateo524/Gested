import { Router } from "express";

const router = Router();
const HUBSPOT_BASE = "https://api.hubapi.com";

function hs() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.HUBSPOT_PAT}`,
  };
}

async function findContactByEmail(email) {
  const res = await fetch(`${HUBSPOT_BASE}/crm/v3/objects/contacts/search`, {
    method: "POST",
    headers: hs(),
    body: JSON.stringify({
      filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: email }] }],
      properties: ["email", "firstname", "lastname"],
      limit: 1,
    }),
  });
  if (!res.ok) throw new Error(`HubSpot contact search failed (${res.status})`);
  const data = await res.json();
  return data.results?.[0] ?? null;
}

async function createContact(name, email) {
  const [firstname, ...rest] = name.trim().split(" ");
  const res = await fetch(`${HUBSPOT_BASE}/crm/v3/objects/contacts`, {
    method: "POST",
    headers: hs(),
    body: JSON.stringify({ properties: { email, firstname, lastname: rest.join(" ") || "" } }),
  });
  if (!res.ok) throw new Error(`HubSpot contact creation failed (${res.status})`);
  return res.json();
}

async function createDeal(dealname, contactId) {
  const res = await fetch(`${HUBSPOT_BASE}/crm/v3/objects/deals`, {
    method: "POST",
    headers: hs(),
    body: JSON.stringify({
      properties: { dealname, pipeline: "default", dealstage: "appointmentscheduled", amount: "0" },
      associations: [{ to: { id: contactId }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 3 }] }],
    }),
  });
  if (!res.ok) throw new Error(`HubSpot deal creation failed (${res.status})`);
  return res.json();
}

router.get("/calendly/test", (_req, res) => res.json({ ok: true }));

router.post("/calendly", async (req, res) => {
  try {
    const { event, payload } = req.body ?? {};
    if (event !== "invitee.created") return res.status(200).json({ ok: true, skipped: true });

    const name = payload?.invitee?.name ?? "Unknown";
    const email = payload?.invitee?.email;
    if (!email) return res.status(400).json({ error: "Missing invitee email" });

    let contact = await findContactByEmail(email);
    if (!contact) contact = await createContact(name, email);

    const deal = await createDeal(`Demo ZENTOR — ${name}`, contact.id);
    console.log(`[calendly] Deal creado: ${deal.id} para ${email}`);

    return res.status(200).json({ ok: true, contactId: contact.id, dealId: deal.id });
  } catch (err) {
    console.error("[calendly] Error:", err.message);
    return res.status(500).json({ error: "Internal error" });
  }
});

export default router;
