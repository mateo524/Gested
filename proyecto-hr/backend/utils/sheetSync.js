/**
 * Thin orchestrator: loads all data for a company and calls syncCompanySpreadsheet.
 * Designed to run via runInBackground — never blocks HTTP responses.
 */
import Company from "../models/Company.js";
import School from "../models/School.js";
import Employee from "../models/Employee.js";
import Competency from "../models/Competency.js";
import EvaluationCycle from "../models/EvaluationCycle.js";
import Evaluation from "../models/Evaluation.js";
import { syncCompanySpreadsheet, isGoogleSheetsEnabled } from "./googleSheets.js";

async function loadCompanyData(companyId, schoolId = null) {
  const baseFilter = { companyId };
  if (schoolId) baseFilter.schoolId = schoolId;

  const [employees, competencies, cycles, evaluations] = await Promise.all([
    Employee.find(baseFilter).lean(),
    Competency.find(baseFilter).lean(),
    EvaluationCycle.find(baseFilter).lean(),
    Evaluation.find(baseFilter)
      .populate("employeeId", "nombre apellido")
      .populate("cycleId", "periodo anio")
      .lean(),
  ]);

  return { employees, competencies, cycles, evaluations };
}

/**
 * Trigger a background sync for the company/school that owns a given scope.
 * scope = { companyId, schoolId? }
 */
export async function triggerSheetSync(scope = {}) {
  if (!isGoogleSheetsEnabled()) return;
  const { companyId, schoolId } = scope;
  if (!companyId) return;

  // Determine the entity to update (school-level first, then company-level)
  if (schoolId) {
    await syncSchool(companyId, schoolId);
  } else {
    await syncCompany(companyId);
  }
}

async function syncCompany(companyId) {
  const company = await Company.findById(companyId).lean();
  if (!company) return;

  const data = await loadCompanyData(companyId);
  const result = await syncCompanySpreadsheet({
    companyName: company.nombre,
    existingSpreadsheetId: company.spreadsheetId,
    ...data,
  });

  await Company.findByIdAndUpdate(companyId, {
    spreadsheetId: result.spreadsheetId,
    spreadsheetUrl: result.spreadsheetUrl,
    spreadsheetLastSync: new Date(),
  });
}

async function syncSchool(companyId, schoolId) {
  const [company, school] = await Promise.all([
    Company.findById(companyId).lean(),
    School.findById(schoolId).lean(),
  ]);
  if (!school) return;

  const label = school.nombre || company?.nombre || "Organización";
  const data = await loadCompanyData(companyId, schoolId);
  const result = await syncCompanySpreadsheet({
    companyName: label,
    existingSpreadsheetId: school.spreadsheetId,
    ...data,
  });

  await School.findByIdAndUpdate(schoolId, {
    spreadsheetId: result.spreadsheetId,
    spreadsheetUrl: result.spreadsheetUrl,
    spreadsheetLastSync: new Date(),
  });
}
