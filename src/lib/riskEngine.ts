import {
  NutritionData,
  MedicalCondition,
  ConditionScore,
  Classification,
  CONDITION_WEIGHTS,
} from "./types";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// Normalize a nutrient value against a threshold, capped at 1
function norm(actual: number, threshold: number): number {
  return Math.min(actual / threshold, 1);
}

function processingPenalty(n: NutritionData): number {
  const p = n.processingLevel.toLowerCase();
  if (p === "highly_processed" || p === "fried") return 1;
  if (p === "processed") return 0.5;
  return 0;
}

function calcHypertension(n: NutritionData): number {
  // Sodium-dominant + processing level; no carb/calorie influence
  return clamp(norm(n.sodium, 600) * 7 + processingPenalty(n) * 3, 0, 10);
}

function calcDiabetes(n: NutritionData): number {
  // Carbs 50%, Sugar 30%, Low-fibre penalty 20%, Processing bonus
  const normalizedCarbs = Math.min(n.carbohydrates / 75, 1);
  const normalizedSugar = Math.min(n.freeSugar / 25, 1);
  const lowFibrePenalty = n.fibre < 5 ? 0.4 : 0;
  const procBonus = processingPenalty(n) * 0.15;
  const raw = (0.5 * normalizedCarbs + 0.3 * normalizedSugar + 0.2 * lowFibrePenalty + procBonus) * 10;
  return clamp(raw, 0, 10);
}

function calcCAD(n: NutritionData): number {
  const satFat = n.totalFat * 0.4;
  return clamp(
    norm(satFat, 10) * 5 + norm(n.totalFat, 30) * 2 + norm(n.sodium, 600) * 2 + norm(n.calories, 500) * 1,
    0, 10
  );
}

function calcCKD(n: NutritionData): number {
  return clamp(norm(n.sodium, 600) * 4 + norm(n.protein, 30) * 3 + norm(n.calories, 500) * 1, 0, 10);
}

function calcObesity(n: NutritionData): number {
  // Calories 50%, Fat 30%, Fibre reduction 20%
  return clamp(
    norm(n.calories, 500) * 5 + norm(n.totalFat, 30) * 3 - norm(n.fibre, 10) * 2,
    0, 10
  );
}

function calcHyperlipidemia(n: NutritionData): number {
  const satFat = n.totalFat * 0.4;
  return clamp(
    norm(n.totalFat, 30) * 4 + norm(satFat, 10) * 3 + norm(n.calories, 500) * 2,
    0, 10
  );
}

function calcAnemia(n: NutritionData): number {
  // Lower iron → higher risk
  return clamp(10 - norm(n.iron, 5) * 8, 0, 10);
}

function calcAsthma(n: NutritionData): number {
  return clamp(
    norm(n.totalFat, 30) * 3 + norm(n.sodium, 600) * 3 + norm(n.freeSugar, 20) * 2 - norm(n.vitaminC, 50) * 2,
    0, 10
  );
}

function calcArthritis(n: NutritionData): number {
  return clamp(
    norm(n.freeSugar, 20) * 3 + norm(n.totalFat, 30) * 3 + norm(n.sodium, 600) * 2 - norm(n.fibre, 10) * 1,
    0, 10
  );
}

function calcHypothyroidism(n: NutritionData): number {
  return clamp(
    norm(n.freeSugar, 20) * 3 + norm(n.carbohydrates, 60) * 3 + norm(n.totalFat, 30) * 2 - norm(n.fibre, 10) * 1,
    0, 10
  );
}

const RISK_CALCULATORS: Record<MedicalCondition, (n: NutritionData) => number> = {
  "Hypertension": calcHypertension,
  "Type 2 Diabetes": calcDiabetes,
  "Coronary Artery Disease": calcCAD,
  "Chronic Kidney Disease": calcCKD,
  "Obesity": calcObesity,
  "Hyperlipidemia": calcHyperlipidemia,
  "Anemia": calcAnemia,
  "Asthma": calcAsthma,
  "Arthritis": calcArthritis,
  "Hypothyroidism": calcHypothyroidism,
};

export function calculateConditionScores(
  nutrition: NutritionData,
  selectedConditions: MedicalCondition[]
): ConditionScore[] {
  return selectedConditions.map(condition => ({
    condition,
    score: +RISK_CALCULATORS[condition](nutrition).toFixed(1),
  }));
}

export function calculateOverallRisk(scores: ConditionScore[]): number {
  if (scores.length === 0) return 0;

  // Priority weighting: Obesity 0.4, Hypertension 0.3, Diabetes 0.3
  const PRIORITY_WEIGHTS: Partial<Record<MedicalCondition, number>> = {
    "Obesity": 0.4,
    "Hypertension": 0.3,
    "Type 2 Diabetes": 0.3,
  };

  const priorityConditions = scores.filter(s => s.condition in PRIORITY_WEIGHTS);
  const otherConditions = scores.filter(s => !(s.condition in PRIORITY_WEIGHTS));

  if (priorityConditions.length > 0 && otherConditions.length === 0) {
    // Only priority conditions selected – use priority weights
    let sum = 0;
    let wTotal = 0;
    for (const { condition, score } of priorityConditions) {
      const w = PRIORITY_WEIGHTS[condition]!;
      sum += score * w;
      wTotal += w;
    }
    return +(sum / wTotal).toFixed(1);
  }

  // Mixed or non-priority conditions – use original category weights
  let weightedSum = 0;
  let totalWeight = 0;

  for (const { condition, score } of scores) {
    const weight = CONDITION_WEIGHTS[condition];
    weightedSum += score * weight;
    totalWeight += weight;
  }

  return +(weightedSum / totalWeight).toFixed(1);
}

export function classify(overallRisk: number): Classification {
  if (overallRisk <= 3) return "SAFE";
  if (overallRisk <= 6) return "MODERATE";
  return "AVOID";
}

export function getRiskColor(score: number): string {
  if (score >= 7) return "risk-high";
  if (score >= 4) return "risk-moderate";
  if (score >= 2) return "risk-low";
  return "risk-safe";
}

export function getRiskColorHex(score: number): string {
  if (score >= 7) return "hsl(0, 84%, 60%)";
  if (score >= 4) return "hsl(25, 95%, 53%)";
  if (score >= 2) return "hsl(48, 96%, 53%)";
  return "hsl(142, 71%, 45%)";
}

// ─── Daily-threshold risk calculators for full-day nutrition totals ───
// These use WHO/ICMR daily limits instead of per-serving thresholds.
function normDaily(actual: number, threshold: number): number {
  return Math.min(actual / threshold, 1);
}

function calcHypertensionDaily(n: NutritionData): number {
  // Sodium-dominant + processing; no carb/calorie influence
  return clamp(normDaily(n.sodium, 2300) * 7 + processingPenalty(n) * 3, 0, 10);
}

function calcDiabetesDaily(n: NutritionData): number {
  // Daily: Carbs 50%, Sugar 30%, Low-fibre penalty 20%, Processing bonus
  const normalizedCarbs = Math.min(n.carbohydrates / 325, 1);
  const normalizedSugar = Math.min(n.freeSugar / 50, 1);
  const lowFibrePenalty = n.fibre < 25 ? 0.4 : 0;
  const procBonus = processingPenalty(n) * 0.15;
  const raw = (0.5 * normalizedCarbs + 0.3 * normalizedSugar + 0.2 * lowFibrePenalty + procBonus) * 10;
  return clamp(raw, 0, 10);
}

function calcCADDaily(n: NutritionData): number {
  const satFat = n.totalFat * 0.4;
  return clamp(
    normDaily(satFat, 22) * 5 + normDaily(n.totalFat, 78) * 2 + normDaily(n.sodium, 2300) * 2 + normDaily(n.calories, 2200) * 1,
    0, 10
  );
}

function calcCKDDaily(n: NutritionData): number {
  return clamp(normDaily(n.sodium, 2300) * 4 + normDaily(n.protein, 60) * 3 + normDaily(n.calories, 2200) * 1, 0, 10);
}

function calcObesityDaily(n: NutritionData): number {
  // Calories 50%, Fat 30%, Fibre reduction 20%
  return clamp(
    normDaily(n.calories, 2200) * 5 + normDaily(n.totalFat, 78) * 3 - Math.min(n.fibre / 30, 1) * 2,
    0, 10
  );
}

function calcHyperlipidemiaDaily(n: NutritionData): number {
  const satFat = n.totalFat * 0.4;
  return clamp(
    normDaily(n.totalFat, 78) * 4 + normDaily(satFat, 22) * 3 + normDaily(n.calories, 2200) * 2,
    0, 10
  );
}

function calcAnemiaDaily(n: NutritionData): number {
  return clamp(10 - normDaily(n.iron, 18) * 8, 0, 10);
}

function calcAsthmaDaily(n: NutritionData): number {
  const vitCBonus = 1 - Math.min(n.vitaminC / 90, 1);
  return clamp(
    normDaily(n.totalFat, 78) * 3 + normDaily(n.sodium, 2300) * 3 + normDaily(n.freeSugar, 50) * 2 - (1 - vitCBonus) * 2,
    0, 10
  );
}

function calcArthritisDaily(n: NutritionData): number {
  const fibreBonus = 1 - Math.min(n.fibre / 30, 1);
  return clamp(
    normDaily(n.freeSugar, 50) * 3 + normDaily(n.totalFat, 78) * 3 + normDaily(n.sodium, 2300) * 2 - (1 - fibreBonus) * 1,
    0, 10
  );
}

function calcHypothyroidismDaily(n: NutritionData): number {
  const fibreBonus = 1 - Math.min(n.fibre / 30, 1);
  return clamp(
    normDaily(n.freeSugar, 50) * 3 + normDaily(n.carbohydrates, 325) * 3 + normDaily(n.totalFat, 78) * 2 - (1 - fibreBonus) * 1,
    0, 10
  );
}

const DAILY_RISK_CALCULATORS: Record<MedicalCondition, (n: NutritionData) => number> = {
  "Hypertension": calcHypertensionDaily,
  "Type 2 Diabetes": calcDiabetesDaily,
  "Coronary Artery Disease": calcCADDaily,
  "Chronic Kidney Disease": calcCKDDaily,
  "Obesity": calcObesityDaily,
  "Hyperlipidemia": calcHyperlipidemiaDaily,
  "Anemia": calcAnemiaDaily,
  "Asthma": calcAsthmaDaily,
  "Arthritis": calcArthritisDaily,
  "Hypothyroidism": calcHypothyroidismDaily,
};

/** Calculate condition scores using daily thresholds (for full-day nutrition totals) */
export function calculateDailyConditionScores(
  nutrition: NutritionData,
  selectedConditions: MedicalCondition[]
): ConditionScore[] {
  return selectedConditions.map(condition => ({
    condition,
    score: +DAILY_RISK_CALCULATORS[condition](nutrition).toFixed(1),
  }));
}
