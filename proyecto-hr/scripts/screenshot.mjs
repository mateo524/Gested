import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "../dist-screenshots");
mkdirSync(OUT, { recursive: true });

// Uses production by default — no local backend needed
const BASE = process.env.APP_URL || "https://gested-l6ej.vercel.app";
const EMAIL = process.env.DEMO_EMAIL;
const PASSWORD = process.env.DEMO_PASSWORD || "123456";

if (!EMAIL) {
  console.error("Set DEMO_EMAIL env var before running.");
  process.exit(1);
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

async function shot(name) {
  await page.waitForTimeout(900);
  await page.screenshot({ path: join(OUT, `${name}.png`) });
  console.log(`✓ ${name}.png`);
}

async function nav(label) {
  const btn = page.locator(`button:has-text("${label}")`).first();
  if (await btn.count() === 0) { console.warn(`⚠ skip: "${label}"`); return false; }
  await btn.click();
  await page.waitForTimeout(2000);
  return true;
}

// ── 01 Login ────────────────────────────────────────────────────────────────
await page.goto(BASE);
await page.waitForLoadState("networkidle");
await shot("01-login");

// ── Login ────────────────────────────────────────────────────────────────────
await page.locator('input[type="email"]').first().fill(EMAIL);
await page.locator('input[type="password"]').first().fill(PASSWORD);
await page.locator('button[type="submit"]').click();
await page.waitForTimeout(40000); // flat 40s — backend cold start on Render free tier
await shot("02-dashboard");

// Debug nav
const btns = await page.locator("button").allTextContents();
console.log("Visible buttons:", btns.map(t => t.trim()).filter(Boolean).slice(0, 40));

// ── Sections ─────────────────────────────────────────────────────────────────
const sections = [
  ["Personas",     "03-personas"],
  ["Evaluaciones", "04-evaluaciones"],
  ["Ciclos",       "06-ciclos"],
  ["Mediciones",   "07-mediciones"],
  ["Desarrollo",   "08-desarrollo"],
  ["Reportes",     "09-reportes"],
];

for (const [label, name] of sections) {
  if (await nav(label)) await shot(name);
}

// ── 05 Score form ─────────────────────────────────────────────────────────────
await nav("Evaluaciones");
await page.evaluate(() => window.scrollTo({ top: 400, behavior: "instant" }));
await page.waitForTimeout(600);
await shot("05-evaluacion-form");

await browser.close();
console.log(`\nDone — ${OUT}`);
