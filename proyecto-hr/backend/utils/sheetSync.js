/**
 * Thin orchestrator: loads all data for a company and calls syncCompanySpreadsheet.
 * Designed to run via runInBackground — never blocks HTTP responses.
 */
import Company from "../models/Company.js";
import School from "../models/School.js";
import Employee from "../models/Employee.js";
import Competency from "../models/Competency.js";
import Metric from "../models/Metric.js";
import EvaluationCycle from "../models/EvaluationCycle.js";
import Evaluation from "../models/Evaluation.js";
import DevelopmentPlan from "../models/DevelopmentPlan.js";
import KPIRecord from "../models/KPIRecord.js";
import OKRRecord from "../models/OKRRecord.js";
import EvaluationScore from "../models/EvaluationScore.js";
import { syncCompanySpreadsheet, isGoogleSheetsEnabled } from "./googleSheets.js";

async function loadCompanyData(companyId, schoolId = null) {
  const baseFilter = { companyId };
  if (schoolId) baseFilter.schoolId = schoolId;

  const [employees, competencies, metrics, cycles, evaluations, plans, kpis, okrs] = await Promise.all([
    Employee.find(baseFilter).lean(),
    Competency.find(baseFilter).lean(),
    Metric.find({ ...baseFilter, activa: true }).lean(),
    EvaluationCycle.find(baseFilter).lean(),
    Evaluation.find(baseFilter)
      .populate("employeeId", "nombre apellido")
      .populate("cycleId", "periodo anio")
      .lean(),
    DevelopmentPlan.find(baseFilter).lean(),
    KPIRecord.find(baseFilter).lean(),
    OKRRecord.find(baseFilter).lean(),
  ]);

  // Load EvaluationScores keyed to the evaluations fetched above
  const evalIds = evaluations.map(e => e._id);
  const scores = evalIds.length > 0
    ? await EvaluationScore.find({ evaluationId: { $in: evalIds } })
        .populate({
          path: "metricId",
          select: "nombre competencyId",
          populate: { path: "competencyId", select: "nombre" },
        })
        .lean()
    : [];

  // Attach evaluation context to each score so the formatter can access it
  const evalMap = new Map(evaluations.map(e => [String(e._id), e]));
  scores.forEach(s => { s._evalObj = evalMap.get(String(s.evaluationId)) || {}; });

  return { employees, competencies, metrics, cycles, evaluations, plans, kpis, okrs, scores };
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
