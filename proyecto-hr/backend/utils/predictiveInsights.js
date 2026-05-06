function round(value, digits = 2) {
  const p = 10 ** digits;
  return Math.round((Number(value) || 0) * p) / p;
}

function toPriority(score) {
  if (score >= 75) return "ALTA";
  if (score >= 50) return "MEDIA";
  return "BAJA";
}

export function buildPredictiveInsights({
  weakestAreas = [],
  strongestAreas = [],
  riskRanking = [],
  trainingRecommendations = [],
  pendingEvaluations = 0,
  evaluationsTotal = 0,
  employeePlanSignals = [],
}) {
  const pendingRate = evaluationsTotal ? pendingEvaluations / evaluationsTotal : 0;
  const planSignalMap = new Map(
    employeePlanSignals.map((item) => [String(item.employeeId), { overdue: item.overdue || 0, open: item.open || 0 }])
  );

  const layer1Patterns = [
    weakestAreas[0]
      ? {
          type: "AREA_CRITICA",
          title: `Area con mayor brecha: ${weakestAreas[0].label}`,
          evidence: `Promedio ${weakestAreas[0].value} en ${weakestAreas[0].employees} colaboradores`,
          impact: "ALTO",
        }
      : null,
    strongestAreas[0]
      ? {
          type: "AREA_FUERTE",
          title: `Mejor rendimiento: ${strongestAreas[0].label}`,
          evidence: `Promedio ${strongestAreas[0].value} en ${strongestAreas[0].employees} colaboradores`,
          impact: "MEDIO",
        }
      : null,
    {
      type: "CARGA_OPERATIVA",
      title: "Backlog de evaluaciones",
      evidence: `${pendingEvaluations} pendientes sobre ${evaluationsTotal} (${round(pendingRate * 100, 1)}%)`,
      impact: pendingRate >= 0.25 ? "ALTO" : pendingRate >= 0.1 ? "MEDIO" : "BAJO",
    },
    trainingRecommendations[0]
      ? {
          type: "COMPETENCIA_CRITICA",
          title: `Competencia a reforzar: ${trainingRecommendations[0].competencia}`,
          evidence: `Score promedio ${trainingRecommendations[0].avgScore} | prioridad ${trainingRecommendations[0].priority}`,
          impact: trainingRecommendations[0].priority === "ALTA" ? "ALTO" : "MEDIO",
        }
      : null,
  ].filter(Boolean);

  const layer2Predictions = riskRanking.slice(0, 15).map((riskItem) => {
    const plan = planSignalMap.get(String(riskItem.employeeId)) || { overdue: 0, open: 0 };
    const baseRisk = ((5 - Number(riskItem.avgScore || 0)) / 4) * 70;
    const volumeRisk = Number(riskItem.evaluations || 0) < 2 ? 8 : 0;
    const overdueRisk = Math.min(plan.overdue * 8, 16);
    const openPlanRisk = Math.min(plan.open * 3, 9);
    const score = Math.max(0, Math.min(100, round(baseRisk + volumeRisk + overdueRisk + openPlanRisk, 1)));
    const confidence = Math.max(0.45, Math.min(0.92, round(0.45 + Number(riskItem.evaluations || 0) * 0.06, 2)));
    return {
      employeeId: riskItem.employeeId,
      empleado: riskItem.nombre,
      area: riskItem.area,
      cargo: riskItem.cargo,
      riskScore: score,
      priority: toPriority(score),
      confidence,
      evidence: [
        `score promedio ${riskItem.avgScore}`,
        `evaluaciones ${riskItem.evaluations}`,
        `planes abiertos ${plan.open}`,
        `planes vencidos ${plan.overdue}`,
      ],
      recommendation:
        score >= 75
          ? "Intervencion inmediata: mentoring semanal + objetivo de mejora a 30 dias."
          : score >= 50
            ? "Plan de refuerzo: coaching quincenal + seguimiento mensual."
            : "Mantener monitoreo: feedback mensual y plan preventivo liviano.",
    };
  });

  return {
    layer1Patterns,
    layer2Predictions,
  };
}

export async function buildLayer3Forecast({ companyId, patterns = [], predictions = [], trainingRecommendations = [] }) {
  const webhookUrl = process.env.INSIGHTS_AI_WEBHOOK_URL;
  const webhookToken = process.env.INSIGHTS_AI_TOKEN;
  const enabled = process.env.INSIGHTS_AI_ENABLED === "true";

  const localForecast = {
    source: "local-heuristic",
    status: "fallback",
    strategicActions: [
      "Priorizar capacitacion en las 2 competencias con menor score promedio.",
      "Reducir backlog de evaluaciones por debajo del 10% del total mensual.",
      "Aplicar plan intensivo a empleados con riesgo >= 75 y re-medicion en 30 dias.",
    ],
    projectedImpact: {
      riskReductionPct: 12,
      avgScoreUplift: 0.3,
      horizonDays: 60,
    },
    evidenceSummary: {
      criticalPatterns: patterns.filter((item) => item.impact === "ALTO").length,
      highRiskEmployees: predictions.filter((item) => item.priority === "ALTA").length,
      topCompetencyRisk: trainingRecommendations[0]?.competencia || "N/D",
    },
  };

  if (!enabled || !webhookUrl) {
    return localForecast;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Number(process.env.INSIGHTS_AI_TIMEOUT_MS || 7000));
    const response = await fetch(webhookUrl, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(webhookToken ? { Authorization: `Bearer ${webhookToken}` } : {}),
      },
      body: JSON.stringify({
        companyId: String(companyId),
        patterns,
        predictions: predictions.slice(0, 12),
        trainingRecommendations: trainingRecommendations.slice(0, 6),
      }),
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return { ...localForecast, status: "fallback_http_error" };
    }

    const data = await response.json();
    if (!data || typeof data !== "object") {
      return { ...localForecast, status: "fallback_invalid_payload" };
    }

    return {
      ...localForecast,
      ...data,
      source: data.source || "external-ai",
      status: data.status || "ok",
    };
  } catch {
    return { ...localForecast, status: "fallback_exception" };
  }
}

export function simulateTrainingImpact({
  predictions = [],
  trainingRecommendations = [],
  competency = "",
  investment = "media",
}) {
  const normalizedInvestment = String(investment || "media").toLowerCase();
  const upliftByInvestment = {
    baja: 0.12,
    media: 0.22,
    alta: 0.34,
  };
  const uplift = upliftByInvestment[normalizedInvestment] ?? upliftByInvestment.media;

  const baseAvgRisk = predictions.length
    ? predictions.reduce((sum, item) => sum + Number(item.riskScore || 0), 0) / predictions.length
    : 0;
  const highRiskCount = predictions.filter((item) => Number(item.riskScore || 0) >= 75).length;
  const currentComp = trainingRecommendations.find(
    (item) => String(item.competencia).toLowerCase() === String(competency).toLowerCase()
  );
  const compScore = Number(currentComp?.avgScore || 3);
  const needFactor = Math.max(0.5, (5 - compScore) / 2.2);

  const projectedRiskReductionPct = round(uplift * needFactor * 100, 1);
  const projectedRiskAfter = round(baseAvgRisk * (1 - projectedRiskReductionPct / 100), 1);
  const projectedAvgScoreUplift = round(0.15 + uplift * needFactor, 2);
  const projectedHighRiskAfter = Math.max(
    0,
    Math.round(highRiskCount * (1 - projectedRiskReductionPct / 130))
  );

  return {
    competency: competency || currentComp?.competencia || "Competencia prioritaria",
    investment: normalizedInvestment,
    baseline: {
      avgRisk: round(baseAvgRisk, 1),
      highRiskEmployees: highRiskCount,
      competencyAvgScore: compScore,
    },
    projection: {
      avgRisk: projectedRiskAfter,
      highRiskEmployees: projectedHighRiskAfter,
      avgScoreUplift: projectedAvgScoreUplift,
      riskReductionPct: projectedRiskReductionPct,
      horizonDays: 60,
    },
    evidence: [
      `inversion ${normalizedInvestment}`,
      `competencia base ${round(compScore, 2)}`,
      `empleados alto riesgo ${highRiskCount}`,
    ],
  };
}
