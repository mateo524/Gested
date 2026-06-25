/**
 * resetCompanies.js
 *
 * Deletes ALL companies and their tenant data, then creates a fresh
 * "Colegio Pilar" company with plan=pro and a far-future planExpiresAt
 * so the billing gate is bypassed during testing.
 *
 * Usage:
 *   node --env-file=.env scripts/resetCompanies.js
 *   MONGO_URI=mongodb+srv://... node scripts/resetCompanies.js
 */

import "dotenv/config";
import mongoose from "mongoose";
import { ensureCompanyStructure } from "../utils/bootstrap.js";
import { ensureEducationalRoles } from "../utils/bootstrap.js";
import Company from "../models/Company.js";

const TENANT_COLLECTIONS = [
  "employees", "users", "roles", "schools",
  "evaluationcycles", "evaluations", "evaluationscores",
  "developmentplans", "metrics", "competencies", "announcements",
  "subscriptions", "auditlogs",
];

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Conectado a MongoDB:", mongoose.connection.db.databaseName);

  // 1. Get all company IDs before deleting
  const companies = await Company.find({}).select("_id nombre").lean();
  console.log(`Empresas encontradas: ${companies.length} →`, companies.map(c => c.nombre).join(", ") || "(ninguna)");

  // 2. Delete all tenant data for those companies
  const companyIds = companies.map(c => c._id);
  for (const col of TENANT_COLLECTIONS) {
    const result = await mongoose.connection.db
      .collection(col)
      .deleteMany(companyIds.length ? { companyId: { $in: companyIds } } : {});
    if (result.deletedCount > 0) console.log(`  ${col}: eliminados ${result.deletedCount}`);
  }

  // 3. Delete company documents
  await Company.deleteMany({});
  console.log("Todas las empresas eliminadas.");

  // 4. Create Colegio Pilar
  const { company, adminRole, school } = await ensureCompanyStructure({
    companyName: "Colegio Pilar",
    companySlug:  "colegio-pilar",
    schoolName:   "Sede Principal",
  });

  await ensureEducationalRoles({ companyId: company._id, schoolId: school?._id || null });

  // Pro plan with expiry far in the future so billing gate is bypassed
  company.plan          = "pro";
  company.planExpiresAt = new Date("2030-01-01");
  company.tipoCliente   = "educativo";
  await company.save();

  console.log("\n=== Colegio Pilar creada ===");
  console.log("ID:          ", String(company._id));
  console.log("Plan:        ", company.plan, "→ vence", company.planExpiresAt.toLocaleDateString("es-AR"));
  console.log("Escuela:     ", school?.nombre || "(sin escuela)");

  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
