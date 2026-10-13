/**
 * Smart Alternatives Engine
 * Finds healthier alternatives from the dataset based on:
 * - Same meal type / food category context
 * - Lower risk score for selected conditions
 * - Realistic replacements (not random foods)
 */

import { NutritionData, MedicalCondition, Classification } from "./types";
import {
  calculateConditionScores,
  calculateOverallRisk,
  classify,
} from "./riskEngine";
import { adjustNutrition } from "./dataset";

export interface SmartAlternative {
  name: string;
  matchedName: string;
  similarityScore: number;
  nutrition: NutritionData;
  overallRisk: number;
  classification: Classification;
  calories: number;
  reason: string;
}

type DatasetDish = NutritionData & {
  "Dish Name": string;
  Category: string;
};

/**
 * Build an exclusion predicate for the analyzed dish:
 * exclude exact-name matches AND any candidate sharing 2+ meaningful words
 * (length >= 4) with the analyzed dish name.
 */
function buildAnalyzedDishExcluder(
  analyzedName: string
): (candidateName: string) => boolean {
  const analyzedLower = (analyzedName || "").toLowerCase().trim();
  const analyzedWords = analyzedLower
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9]/g, ""))
    .filter((w) => w.length >= 4);
  return (candidateName: string): boolean => {
    if (!analyzedLower) return false;
    const lower = (candidateName || "").toLowerCase().trim();
    if (!lower) return false;
    if (lower === analyzedLower) return true;
    if (analyzedWords.length === 0) return false;
    let matches = 0;
    for (const w of analyzedWords) {
      if (lower.includes(w)) matches++;
      if (matches >= 2) return true;
    }
    if (analyzedWords.length === 1 && matches >= 1) return true;
    if (analyzedWords.length === 2 && matches >= 2) return true;
    return false;
  };
}

/** Generate a short reason why the alternative is healthier */
function generateReason(
  original: NutritionData,
  alt: NutritionData,
  conditions: MedicalCondition[]
): string {
  const reasons: string[] = [];

  if (alt.calories < original.calories * 0.8) {
    reasons.push(`${Math.round(((original.calories - alt.calories) / original.calories) * 100)}% fewer calories`);
  }
  if (conditions.includes("Type 2 Diabetes") && alt.freeSugar < original.freeSugar * 0.7) {
    reasons.push("lower sugar");
  }
  if (conditions.includes("Hypertension") && alt.sodium < original.sodium * 0.7) {
    reasons.push("lower sodium");
  }
  if (conditions.includes("Obesity") && alt.totalFat < original.totalFat * 0.7) {
    reasons.push("lower fat");
  }
  if (alt.fibre > original.fibre * 1.3 && alt.fibre > 2) {
    reasons.push("higher fibre");
  }
  if (alt.protein > original.protein * 1.2 && alt.protein > 5) {
    reasons.push("more protein");
  }

  if (reasons.length === 0) {
    reasons.push("better overall nutrition profile");
  }

  return reasons.slice(0, 3).join(", ");
}

/**
 * Compute a 0–100 similarity score from category match + nutritional proximity.
 * Same-category is mandatory (caller enforces) so this just scores nutrition closeness.
 */
function computeMatchPercent(
  original: NutritionData,
  alt: NutritionData
): number {
  // Compare key nutrients on a normalized scale
  const keys: Array<keyof NutritionData> = [
    "calories",
    "carbohydrates",
    "protein",
    "totalFat",
    "freeSugar",
    "fibre",
    "sodium",
  ];
  let totalDist = 0;
  let count = 0;
  for (const k of keys) {
    const a = Number(original[k]) || 0;
    const b = Number(alt[k]) || 0;
    const denom = Math.max(a, b, 1);
    const diff = Math.abs(a - b) / denom; // 0..1
    totalDist += diff;
    count++;
  }
  const avgDiff = totalDist / count; // 0 = identical, 1 = totally different
  // Category already matches → start from 60, add up to 40 from nutrition similarity
  const score = 60 + (1 - avgDiff) * 40;
  return Math.round(Math.max(0, Math.min(100, score)));
}

/**
 * Find smart, contextually relevant healthier alternatives from the dataset.
 * STRICT same-Category matching only.
 */
export function findSmartAlternatives(
  originalDish: NutritionData,
  dataset: NutritionData[],
  conditions: MedicalCondition[],
  portionMultiplier: number = 1.0,
  maxResults: number = 3
): SmartAlternative[] {
  if (conditions.length === 0) return [];

  const allDishes: DatasetDish[] = dataset.map((dish) => ({
    ...dish,
    "Dish Name": dish["Dish Name"] ?? dish.dishName,
    Category: dish.Category ?? dish.category,
  }));
  const analyzedDish: DatasetDish = {
    ...originalDish,
    "Dish Name": originalDish["Dish Name"] ?? originalDish.dishName,
    Category: originalDish.Category ?? originalDish.category,
  };
  const isAnalyzedOverlap = buildAnalyzedDishExcluder(analyzedDish["Dish Name"]);
  const sameCategoryCount = allDishes.filter(
    (dish) => dish.Category === analyzedDish.Category
  ).length;
  const rowsMissingCategory = allDishes.filter((dish) => !dish.Category).length;
  let candidates = allDishes.filter(
    (dish) =>
      dish.Category === analyzedDish.Category &&
      !isAnalyzedOverlap(dish["Dish Name"])
  );

  console.log("[NutriGuard Alternatives Debug]", {
    analyzedCategory: analyzedDish.Category,
    top10CandidateCategories: candidates.slice(0, 10).map((dish) => dish.Category),
    sameCategoryCount,
    rowsMissingCategory,
  });

  if (!analyzedDish.Category || candidates.length === 0) return [];

  const originalAdjusted = adjustNutrition(originalDish, portionMultiplier);
  const originalScores = calculateConditionScores(originalAdjusted, conditions);
  const originalRisk = calculateOverallRisk(originalScores);
  const originalRiskDefault = originalDish.riskLevelDefault || originalRisk;

  const rankedCandidates: SmartAlternative[] = [];

  for (const item of candidates) {
    // Must have a strictly lower default risk than the analyzed dish
    if (!(item.riskLevelDefault < originalRiskDefault)) continue;

    const altAdjusted = adjustNutrition(item, portionMultiplier);
    const altScores = calculateConditionScores(altAdjusted, conditions);
    const altRisk = calculateOverallRisk(altScores);
    const altClassification = classify(altRisk);

    // Don't recommend AVOID-tier items
    if (altClassification === "AVOID") continue;

    const reason = generateReason(originalAdjusted, altAdjusted, conditions);
    const matchPct = computeMatchPercent(originalAdjusted, altAdjusted);

    rankedCandidates.push({
      name: item.dishName,
      matchedName: item.dishName,
      similarityScore: matchPct,
      nutrition: altAdjusted,
      overallRisk: altRisk,
      classification: altClassification,
      calories: altAdjusted.calories,
      reason,
    });
  }

  // Sort by Risk_Level_Default ascending, then calories ascending
  rankedCandidates.sort((a, b) => {
    const ra = a.nutrition.riskLevelDefault ?? a.overallRisk;
    const rb = b.nutrition.riskLevelDefault ?? b.overallRisk;
    if (ra !== rb) return ra - rb;
    return a.calories - b.calories;
  });

  // Dedup near-duplicate dish names
  const results: SmartAlternative[] = [];
  const usedKeys = new Set<string>();
  for (const c of rankedCandidates) {
    const key = c.name.toLowerCase().split(/\s+/).slice(0, 2).join(" ");
    if (usedKeys.has(key)) continue;
    usedKeys.add(key);
    results.push(c);
    if (results.length >= maxResults) break;
  }

  return results;
}
