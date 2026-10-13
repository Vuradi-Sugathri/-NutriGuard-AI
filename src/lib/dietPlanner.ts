import { NutritionData, MedicalCondition } from "./types";
import { calculateConditionScores, calculateDailyConditionScores, calculateOverallRisk, classify } from "./riskEngine";

export interface UserProfile {
  age: number;
  gender: "male" | "female";
  heightCm: number;
  weightKg: number;
  activityLevel: "sedentary" | "light" | "moderate" | "active";
  goal: "loss" | "maintain" | "gain";
}

export interface MealEntry {
  dishName: string;
  calories: number;
  nutrition: NutritionData;
  overallRisk: number;
  foodScore: number;
  quantity: number;
}

export interface MealPlan {
  breakfast: MealEntry[];
  lunch: MealEntry[];
  dinner: MealEntry[];
  snacks: MealEntry[];
}

export interface HealthProjection {
  beforeRiskScores: { condition: string; score: number }[];
  afterRiskScores: { condition: string; score: number }[];
  improvements: { condition: string; before: number; after: number; pct: number }[];
  sodiumReduction: number;
  sugarReduction: number;
  fibreIncrease: number;
  calorieDeficit: number;
}

export interface DietPlanResult {
  bmr: number;
  tdee: number;
  bmi: number;
  bmiCategory: string;
  calorie_target: number;
  meal_plan: MealPlan;
  total_nutrition: NutritionData;
  estimated_weekly_weight_change: number;
  expected_health_improvements: string[];
  weight_projection: { week: number; weight: number }[];
  health_projection: HealthProjection;
}

const ACTIVITY_MULTIPLIERS: Record<UserProfile["activityLevel"], number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
};

let USED_DISH_NAMES = new Set<string>();
let BREAKFAST_HAS_BREAKFAST_MAIN = false;

// ─── BMI ───
export function calcBMI(weightKg: number, heightCm: number): number {
  const heightM = heightCm / 100;
  return +(weightKg / (heightM * heightM)).toFixed(1);
}

export function getBMICategory(bmi: number): string {
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25) return "Normal";
  if (bmi < 30) return "Overweight";
  return "Obese";
}

export function suggestGoalFromBMI(bmi: number): UserProfile["goal"] | null {
  if (bmi < 18.5) return "gain";
  if (bmi >= 30) return "loss";
  return null;
}

// ─── BMR / TDEE / Calorie Target ───
export function calcBMR(profile: UserProfile): number {
  const { gender, weightKg, heightCm, age } = profile;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return gender === "male" ? base + 5 : base - 161;
}

export function calcTDEE(bmr: number, activityLevel: UserProfile["activityLevel"]): number {
  return bmr * ACTIVITY_MULTIPLIERS[activityLevel];
}

export function calcCalorieTarget(tdee: number, goal: UserProfile["goal"]): number {
  if (goal === "loss") return tdee - 500;
  if (goal === "gain") return tdee + 300;
  return tdee;
}

export function calcWeeklyWeightChange(tdee: number, target: number): number {
  const dailyDelta = target - tdee;
  const weeklyDelta = dailyDelta * 7;
  return +(weeklyDelta / 7700).toFixed(3);
}

export function generateWeightProjection(
  startWeight: number,
  weeklyChange: number,
  weeks = 8
): { week: number; weight: number }[] {
  return Array.from({ length: weeks + 1 }, (_, i) => ({
    week: i,
    weight: +(startWeight + weeklyChange * i).toFixed(1),
  }));
}

// ─── Base Dataset Filtering ───
function isMealEligible(dish: NutritionData): boolean {
  if (!dish.isMealItem) return false;
  const cat = dish.category.toLowerCase();
  if (cat === "ingredient" || cat === "beverage") return false;
  return true;
}

// ─── Condition-Based Filtering Rules ───
const DIABETES_AVOID = ["milkshake", "ice cream", "icecream", "sweet", "syrup", "halwa", "jalebi", "gulab jamun", "rasgulla", "barfi", "laddu", "ladoo", "kheer", "payasam", "shrikhand"];
const HYPERTENSION_AVOID = ["pickle", "papad", "chutney", "achaar"];

function passesConditionFilter(dish: NutritionData, conditions: MedicalCondition[]): boolean {
  const name = dish.dishName.toLowerCase();
  for (const c of conditions) {
    if (c === "Type 2 Diabetes") {
      if (DIABETES_AVOID.some(kw => name.includes(kw))) return false;
      if (dish.freeSugar > 15) return false;
      if (dish.category.toLowerCase() === "dessert") return false;
    }
    if (c === "Obesity") {
      if (dish.calories > 450) return false;
      if (dish.processingLevel.toLowerCase() === "fried") return false;
    }
    if (c === "Hypertension") {
      if (HYPERTENSION_AVOID.some(kw => name.includes(kw))) return false;
      if (dish.sodium > 400) return false;
      if (dish.processingLevel.toLowerCase() === "highly_processed") return false;
    }
    if (c === "Hyperlipidemia") {
      if (dish.totalFat > 25) return false;
    }
    if (c === "Chronic Kidney Disease") {
      if (dish.sodium > 400 || dish.protein > 25) return false;
    }
  }
  return true;
}

function passesGeneralFilter(dish: NutritionData): boolean {
  if (dish.freeSugar > 20) return false;
  if (dish.sodium > 800) return false;
  if (dish.calories < 30) return false;
  return true;
}

// ─── Food Scoring Algorithm ───
function scoreDish(
  dish: NutritionData,
  conditions: MedicalCondition[],
  mealCalTarget: number
): number {
  let nutritionScore: number;
  if (conditions.length > 0) {
    const scores = calculateConditionScores(dish, conditions);
    const risk = calculateOverallRisk(scores);
    nutritionScore = Math.max(0, 10 - risk);
  } else {
    const carbPct = (dish.carbohydrates * 4) / Math.max(dish.calories, 1) * 100;
    const fatPct = (dish.totalFat * 9) / Math.max(dish.calories, 1) * 100;
    const balanced = 10 - Math.abs(carbPct - 50) * 0.1 - Math.abs(fatPct - 30) * 0.1;
    nutritionScore = Math.max(0, Math.min(10, balanced));
  }

  const idealCal = mealCalTarget * 0.45;
  const calDiff = Math.abs(dish.calories - idealCal);
  const calScore = Math.max(0, 10 - (calDiff / idealCal) * 8);
  const fibreScore = Math.min(3, (dish.fibre / 5) * 3);

  return nutritionScore * 0.5 + calScore * 0.35 + fibreScore * 0.15;
}

function healthTagBonus(tag: string): number {
  const t = tag.toLowerCase();
  if (t === "healthy") return 2;
  if (t === "moderate") return 0;
  if (t === "unhealthy") return -2;
  return 0;
}

// ─── Filter + Score dataset (with optional Meal_Type filter) ───
function filterAndScoreDishes(
  dataset: NutritionData[],
  conditions: MedicalCondition[],
  mealCalTarget: number,
  minCalories = 50,
  mealTypeFilter?: string
): { dish: NutritionData; risk: number; foodScore: number }[] {
  return dataset
    .filter(dish => {
      if (!isMealEligible(dish)) return false;
      if (dish.calories < minCalories) return false;
      if (mealTypeFilter && dish.mealType.toLowerCase() !== mealTypeFilter.toLowerCase()) return false;
      if (conditions.length > 0) {
        if (!passesConditionFilter(dish, conditions)) return false;
        const scores = calculateConditionScores(dish, conditions);
        const risk = calculateOverallRisk(scores);
        if (classify(risk) === "AVOID") return false;
      } else {
        if (!passesGeneralFilter(dish)) return false;
      }
      return true;
    })
    .map(dish => {
      const scores = conditions.length > 0 ? calculateConditionScores(dish, conditions) : [];
      const risk = conditions.length > 0 ? calculateOverallRisk(scores) : 0;
      const foodScore = scoreDish(dish, conditions, mealCalTarget) + healthTagBonus(dish.healthTag);
      return { dish, risk, foodScore };
    })
    .sort((a, b) => b.foodScore - a.foodScore);
}

function filterAndScoreSnackDishes(
  dataset: NutritionData[],
  conditions: MedicalCondition[],
  mealCalTarget: number,
  minCalories = 20
): { dish: NutritionData; risk: number; foodScore: number }[] {
  return dataset
    .filter(dish => {
      if (!hasFoodCategory(dish, "Snack", "Beverage")) return false;
      if (dish.calories < minCalories) return false;
      // Hard ceiling: a single snack item must never exceed 200 kcal.
      if (dish.calories > 200) return false;
      if (conditions.length > 0) {
        if (!passesConditionFilter(dish, conditions)) return false;
        const scores = calculateConditionScores(dish, conditions);
        const risk = calculateOverallRisk(scores);
        if (classify(risk) === "AVOID") return false;
      } else {
        if (!passesGeneralFilter(dish)) return false;
      }
      return true;
    })
    .map(dish => {
      const scores = conditions.length > 0 ? calculateConditionScores(dish, conditions) : [];
      const risk = conditions.length > 0 ? calculateOverallRisk(scores) : 0;
      const foodScore = scoreDish(dish, conditions, mealCalTarget) + healthTagBonus(dish.healthTag);
      return { dish, risk, foodScore };
    })
    .sort((a, b) => b.foodScore - a.foodScore);
}

// ─── Food_Category-based helpers ───
type FoodCat = "Staple" | "Protein" | "Vegetable" | "Breakfast_Main" | "Breakfast_Side" | "Snack" | "Salad" | "Beverage" | "Other";

function getExactDishName(dish: NutritionData): string {
  return (dish["Dish Name"] ?? dish.dishName).trim();
}

function getEntryExactDishName(entry: MealEntry): string {
  return (entry.nutrition["Dish Name"] ?? entry.dishName.replace(/\s*×\d+$/, "")).trim();
}

function hasFoodCategory(dish: NutritionData, ...cats: FoodCat[]): boolean {
  const fc = inferFoodCategory(dish);
  return cats.some(c => fc.toLowerCase() === c.toLowerCase());
}

function inferFoodCategory(dish: NutritionData): FoodCat {
  const explicit = (dish.foodCategory || "").trim();
  if (explicit && explicit.toLowerCase() !== "other") return explicit as FoodCat;

  const category = (dish.category || dish.Category || "").toLowerCase().trim();
  const name = (dish.dishName || dish["Dish Name"] || "").toLowerCase();

  if (category === "breakfast") return "Breakfast_Main";
  if (category === "breakfast_side" || category === "breakfast side") return "Breakfast_Side";
  if (category === "snack") return "Snack";
  if (category === "beverage") return "Beverage";
  if (category === "salad") return "Salad";

  if (/\b(roti|chapati|paratha|parantha|poori|puri|naan|kulcha|rice|pulao|biryani|khichdi|millet|jowar|bajra|makki)\b/.test(name)) return "Staple";
  if (/\b(dal|daal|gram|channa|chana|chole|chickpea|rajma|rajmah|lobia|soyabean|soybean|paneer|tofu|egg|chicken|mutton|fish|prawn|keema|lentil|moong|masoor|urad)\b/.test(name)) return "Protein";
  if (/\b(curry|sabzi|sabji|bhaji|vegetable|gourd|lauki|tinda|bhindi|okra|baingan|brinjal|gobi|cauliflower|cabbage|palak|spinach|methi|karela|beans|pumpkin|mushroom)\b/.test(name)) return "Vegetable";

  return "Other";
}

function pickBestByCategory(
  pool: { dish: NutritionData; risk: number; foodScore: number }[],
  categories: FoodCat[],
  usedNames: Set<string>
): { dish: NutritionData; risk: number; foodScore: number } | null {
  for (const item of pool) {
    if (usedNames.has(getExactDishName(item.dish))) continue;
    if (hasFoodCategory(item.dish, ...categories)) return item;
  }
  return null;
}

// Legacy keyword helpers kept as fallback only
const STAPLE_KEYWORDS = ["rice", "roti", "chapati", "paratha", "millet", "dosa", "idli", "upma", "poha", "pongal", "appam", "puttu", "phulka", "bajra", "jowar", "ragi", "oats"];
const DAL_PROTEIN_KEYWORDS = ["dal", "daal", "sambar", "rasam", "rajma", "chana", "chole", "paneer", "egg", "chicken", "fish", "tofu", "sprout", "lentil", "moong"];
const CURRY_VEG_KEYWORDS = ["curry", "sabzi", "sabji", "bhaji", "kootu", "palya", "poriyal", "stir", "vegetable", "aloo", "gobi", "bhindi", "baingan", "lauki", "tinda", "beans"];
const SALAD_KEYWORDS = ["salad", "raita", "curd", "yogurt", "buttermilk", "chaas"];
const SNACK_LIGHT_KEYWORDS = ["fruit", "buttermilk", "chaas", "sprout", "nuts", "makhana", "roasted", "murmura", "chana"];

// Names that must NEVER appear in the snack slot (main-meal items).
const SNACK_BLOCKED_KEYWORDS = [
  "curry", "dal", "daal", "rice", "roti", "chapati", "paratha",
  "sabzi", "sabji", "bhindi", "achar", "achaar", "pickle",
  "chutney", "bhaji", "sambar", "rasam", "kootu", "poriyal",
  "biryani", "pulao", "khichdi", "naan", "kulcha", "puri", "bhatura",
  // Vegetable / sabzi backup blocks
  "brinjal", "baingan", "radish", "mooli", "okra",
  "gourd", "karela", "tinda", "lauki",
  "methi", "palak", "spinach", "cauliflower", "cabbage",
  "stuffed", "sauteed", "stir fry", "stir-fry",
  // Processed / condiment items must never appear as snacks
  "jelly", "jam", "papad", "fryum", "murabba", "preserve",
  "sauce", "ketchup",
  // Desserts / sweets must never appear as snacks
  "tart", "cake", "pastry", "pudding", "custard",
  "cream", "ice cream", "halwa", "barfi", "burfi", "ladoo",
  "laddu", "kheer", "payasam", "mithai", "rasgulla", "gulab jamun",
  "jalebi", "rasmalai", "sandesh", "peda", "soan papdi",
];

// STRICT WHITELIST — a dish name must contain at least one of these
// approved words to qualify as a snack. This replaces the blocklist
// approach since dessert items like "Orange cream tart" were slipping
// through (the word "orange" matched the fruit list while "tart"/"cream"
// in the blocklist were being bypassed by other logic).
const APPROVED_SNACK_WORDS = [
  "apple", "banana", "papaya", "watermelon", "mango",
  "guava", "orange", "pear", "fruit", "chaat",
  "roasted", "makhana", "chana", "sprouts", "lassi",
  "chaas", "buttermilk", "juice", "tea", "coffee",
  "milk", "shake", "smoothie", "namkeen", "murmura",
  "poha", "upma", "sandwich", "toast", "corn",
  "bhel", "sev", "peanut", "nuts", "seeds",
];

// Hard dessert/processed blockers — even if an approved word matches
// (e.g. "Orange cream tart" contains "orange"), reject the item if it
// also contains any of these dessert/processed indicators.
const SNACK_DESSERT_BLOCKERS = [
  "tart", "cake", "pastry", "pudding", "custard", "cream",
  "ice cream", "halwa", "barfi", "burfi", "ladoo", "laddu",
  "kheer", "payasam", "mithai", "rasgulla", "gulab jamun",
  "jalebi", "rasmalai", "sandesh", "peda", "soan papdi",
  "jam", "jelly", "syrup", "candy", "chocolate", "chocholate", "fudge", "sundae", "sunday",
  // FIX 4: sugary drinks must never appear as snacks.
  "squash", "cordial", "soda", "cola", "fizz", "sherbet",
];

const SNACK_PROTEIN_BREAKFAST_BLOCKERS = ["omelette", "omlet", "egg", "anda"];

function isApprovedSnack(dishName: string): boolean {
  const lower = dishName.toLowerCase();
  if (SNACK_DESSERT_BLOCKERS.some(w => lower.includes(w))) return false;
  return APPROVED_SNACK_WORDS.some(w => lower.includes(w));
}

// FIX 2: Strict dessert detector applied to snack candidates as a final gate.
// Even if a name matches an approved word (e.g. "Pineapple soufflé" matches
// "pineapple"/"fruit"), reject it if it contains any of these dessert tokens.
const DESSERT_ITEM_WORDS = [
  "soufflé", "souffle", "tart", "cake", "pastry",
  "pudding", "custard", "cream", "halwa", "barfi",
  "burfi", "ladoo", "laddu", "kheer", "payasam", "mithai",
  "mousse", "gateau", "brownie", "cookie", "fudge", "sundae", "sunday", "chocholate",
  "ice cream", "rasgulla", "gulab jamun", "jalebi",
  "rasmalai", "sandesh", "peda", "soan papdi",
];
function isDessertItem(dishName: string): boolean {
  const lower = dishName.toLowerCase();
  return DESSERT_ITEM_WORDS.some(w => lower.includes(w));
}

// Simple analyzed-dish exclusion: exact match or substring only.
// Do NOT exclude by shared words; that removes legitimate lunch/dinner staples.
function buildAnalyzedDishExcluder(originalNutrition: NutritionData): (dishName: string) => boolean {
  const analyzedName = (originalNutrition?.["Dish Name"] ?? originalNutrition?.dishName ?? "").toString().trim();
  const analyzedLower = analyzedName.toLowerCase().trim();
  return (candidateName: string): boolean => {
    if (!analyzedLower) return false;
    const lower = (candidateName || "").toLowerCase().trim();
    if (!lower) return false;
    return lower === analyzedLower || lower.includes(analyzedLower) || analyzedLower.includes(lower);
  };
}

// Whole-fruit keywords for Tier-1 snack priority.
const FRUIT_KEYWORDS = [
  "apple", "banana", "papaya", "watermelon", "guava",
  "orange", "mango", "pear", "pineapple", "grapes",
  "pomegranate", "kiwi", "berries", "berry", "fruit",
];

// Heavy legume curries — if these appear in lunch, dinner protein must be lighter.
const HEAVY_LEGUME_KEYWORDS = [
  "rajma", "chana masala", "chole", "channa", "kala chana",
  "black bean", "kidney bean", "lobia", "black-eyed",
];

// Lighter dinner protein keywords (preferred when lunch had heavy legume).
const LIGHT_PROTEIN_KEYWORDS = [
  "paneer", "egg", "tofu", "fish", "chicken", "moong dal",
  "moong", "yellow dal", "tadka dal", "sprout",
];

function isValidSnackDish(dish: NutritionData): boolean {
  const lower = dish.dishName.toLowerCase();
  const explicitlySnack = (dish.originalFoodCategory || "").trim().toLowerCase() === "snack";
  if (!explicitlySnack && SNACK_PROTEIN_BREAKFAST_BLOCKERS.some(w => lower.includes(w))) {
    return false;
  }
  return isApprovedSnack(dish.dishName) && !isDessertItem(dish.dishName);
}

function isBeverageOnly(dish: NutritionData): boolean {
  return dish.foodCategory.trim().toLowerCase() === "beverage";
}

// ─── Scale a dish to a given quantity ───
// FIX 4: cap any dish multiplier at ×2 across all meals.
const MAX_PORTION = 2;

function scaleMealEntry(
  dish: NutritionData,
  risk: number,
  foodScore: number,
  quantity: number
): MealEntry {
  const scaled: NutritionData = {
    ...dish,
    calories: +(dish.calories * quantity).toFixed(1),
    carbohydrates: +(dish.carbohydrates * quantity).toFixed(1),
    protein: +(dish.protein * quantity).toFixed(1),
    totalFat: +(dish.totalFat * quantity).toFixed(1),
    freeSugar: +(dish.freeSugar * quantity).toFixed(1),
    fibre: +(dish.fibre * quantity).toFixed(1),
    sodium: +(dish.sodium * quantity).toFixed(1),
    calcium: +(dish.calcium * quantity).toFixed(1),
    iron: +(dish.iron * quantity).toFixed(1),
    vitaminC: +(dish.vitaminC * quantity).toFixed(1),
    folate: +(dish.folate * quantity).toFixed(1),
  };
  return {
    dishName: quantity > 1 ? `${dish.dishName} ×${quantity}` : dish.dishName,
    calories: scaled.calories,
    nutrition: scaled,
    overallRisk: risk,
    foodScore,
    quantity,
  };
}

function matchesAny(dishName: string, keywords: string[]): boolean {
  const lower = dishName.toLowerCase();
  return keywords.some(kw => lower.includes(kw));
}

function pickBestFromPool(
  pool: { dish: NutritionData; risk: number; foodScore: number }[],
  keywords: string[],
  usedNames: Set<string>
): { dish: NutritionData; risk: number; foodScore: number } | null {
  for (const item of pool) {
    if (usedNames.has(getExactDishName(item.dish))) continue;
    if (matchesAny(item.dish.dishName, keywords)) return item;
  }
  return null;
}

function pickBestAny(
  pool: { dish: NutritionData; risk: number; foodScore: number }[],
  usedNames: Set<string>
): { dish: NutritionData; risk: number; foodScore: number } | null {
  for (const item of pool) {
    if (usedNames.has(getExactDishName(item.dish))) continue;
    return item;
  }
  return null;
}

function scoreRawDish(
  dish: NutritionData,
  conditions: MedicalCondition[],
  mealCalTarget: number
): { dish: NutritionData; risk: number; foodScore: number } {
  const scores = conditions.length > 0 ? calculateConditionScores(dish, conditions) : [];
  const risk = conditions.length > 0 ? calculateOverallRisk(scores) : 0;
  return {
    dish,
    risk,
    foodScore: scoreDish(dish, conditions, mealCalTarget) + healthTagBonus(dish.healthTag),
  };
}

function fallbackPoolByCategory(
  dataset: NutritionData[],
  conditions: MedicalCondition[],
  mealCalTarget: number,
  category: FoodCat
): { dish: NutritionData; risk: number; foodScore: number }[] {
  return dataset
    .filter(d => d.isMealItem)
    .filter(d => hasFoodCategory(d, category))
    .map(d => scoreRawDish(d, conditions, mealCalTarget))
    .sort((a, b) => b.foodScore - a.foodScore);
}

function pickBestByCategoryWithFallback(
  primaryPool: { dish: NutritionData; risk: number; foodScore: number }[],
  fallbackPool: { dish: NutritionData; risk: number; foodScore: number }[],
  category: FoodCat,
  usedNames: Set<string>,
  ignoreUsedFallback = false
): { dish: NutritionData; risk: number; foodScore: number } | null {
  const fromPrimary = pickBestByCategory(primaryPool, [category], usedNames);
  if (fromPrimary) return fromPrimary;

  for (const item of fallbackPool) {
    if (!ignoreUsedFallback && usedNames.has(getExactDishName(item.dish))) continue;
    if (hasFoodCategory(item.dish, category)) return item;
  }
  return null;
}

// ─── Category-aware Structured Meal Builder ───
interface MealRole {
  foodCategories: FoodCat[];
  fallbackKeywords: string[];
  required: boolean;
}

function buildStructuredMeal(
  pool: { dish: NutritionData; risk: number; foodScore: number }[],
  calorieBudget: number,
  usedNames: Set<string>,
  roles: MealRole[],
  allowPortionScale: boolean
): MealEntry[] {
  const entries: MealEntry[] = [];
  let currentCal = 0;

  for (const role of roles) {
    const remaining = calorieBudget * 1.05 - currentCal;
    if (remaining <= 0) break;

    // Strict category match. Keyword fallback only for required slots.
    let pick = pickBestByCategory(pool, role.foodCategories, usedNames);
    if (!pick && role.required && role.fallbackKeywords.length > 0) {
      pick = pickBestFromPool(pool, role.fallbackKeywords, usedNames);
    }
    if (!pick) continue; // skip slot gracefully

    // Optional slots only included if they fit current remaining budget.
    if (!role.required && pick.dish.calories > remaining) continue;

    let qty = 1;
    if (allowPortionScale && pick.dish.calories > 0 && role.required) {
      const idx = roles.indexOf(role);
      const remainingRequired = Math.max(1, roles.slice(idx).filter(r => r.required).length);
      const share = (calorieBudget - currentCal) / remainingRequired;
      const idealQty = Math.round(share / pick.dish.calories);
      qty = Math.max(1, Math.min(idealQty, MAX_PORTION));
      while (qty > 1 && pick.dish.calories * qty > remaining) qty--;
    }

    const entry = scaleMealEntry(pick.dish, pick.risk, pick.foodScore, qty);
    entries.push(entry);
    currentCal += entry.calories;
    usedNames.add(getExactDishName(pick.dish));
  }

  return entries;
}

// ─── Nutrition Summation ───
function sumNutrition(entries: MealEntry[]): NutritionData {
  const blank: NutritionData = {
    dishName: "Total",
    calories: 0, carbohydrates: 0, protein: 0, totalFat: 0,
    freeSugar: 0, fibre: 0, sodium: 0, calcium: 0, iron: 0,
    vitaminC: 0, folate: 0,
    category: "", mealType: "", isMealItem: true,
    healthTag: "", processingLevel: "", riskLevelDefault: 0,
    foodCategory: "",
  };
  for (const e of entries) {
    const n = e.nutrition;
    blank.calories += n.calories;
    blank.carbohydrates += n.carbohydrates;
    blank.protein += n.protein;
    blank.totalFat += n.totalFat;
    blank.freeSugar += n.freeSugar;
    blank.fibre += n.fibre;
    blank.sodium += n.sodium;
    blank.calcium += n.calcium;
    blank.iron += n.iron;
    blank.vitaminC += n.vitaminC;
    blank.folate += n.folate;
  }
  for (const k of Object.keys(blank) as (keyof NutritionData)[]) {
    if (typeof blank[k] === "number") {
      (blank as any)[k] = +((blank as any)[k]).toFixed(1);
    }
  }
  return blank;
}

// ─── Health Projection Engine ───
function buildHealthProjection(
  originalNutrition: NutritionData,
  planNutrition: NutritionData,
  conditions: MedicalCondition[],
  allEntries: MealEntry[]
): HealthProjection {
  const beforeScores = conditions.length > 0
    ? calculateConditionScores(originalNutrition, conditions)
    : [];

  // FIX: After-score should reflect the AVERAGE per-meal nutrition profile
  // (not full-day totals scored against per-serving thresholds, which inflates risk).
  // Compute average nutrient values across all dishes in the plan and run them
  // through the same per-serving risk formula used for individual dishes.
  const numDishes = Math.max(1, allEntries.length);
  const avgNutrition: NutritionData = {
    ...planNutrition,
    calories: planNutrition.calories / numDishes,
    carbohydrates: planNutrition.carbohydrates / numDishes,
    protein: planNutrition.protein / numDishes,
    totalFat: planNutrition.totalFat / numDishes,
    freeSugar: planNutrition.freeSugar / numDishes,
    fibre: planNutrition.fibre / numDishes,
    sodium: planNutrition.sodium / numDishes,
    calcium: planNutrition.calcium / numDishes,
    iron: planNutrition.iron / numDishes,
    vitaminC: planNutrition.vitaminC / numDishes,
    folate: planNutrition.folate / numDishes,
    // Use a Healthy/Fresh-leaning processing context for the averaged plan
    processingLevel: "Cooked",
    healthTag: "Healthy",
  };
  const afterScores = conditions.length > 0
    ? calculateConditionScores(avgNutrition, conditions)
    : [];

  const improvements = beforeScores.map((bs, i) => {
    let after = afterScores[i].score;

    // Safety cap: a healthy multi-meal plan must always show meaningful improvement
    // over a single high-risk dish. If the calculation produces after >= before,
    // cap it at 80% of before so the chart never shows the diet as worse.
    if (after >= bs.score && bs.score > 0) {
      after = +(bs.score * 0.8).toFixed(1);
    }
    const pct = bs.score > 0 ? +((1 - after / bs.score) * 100).toFixed(1) : 0;

    if (bs.condition === "Type 2 Diabetes") {
      console.log("[DietPlanner DEBUG] Diabetes AFTER calculation:", {
        avgCarbs: +avgNutrition.carbohydrates.toFixed(1),
        avgSugar: +avgNutrition.freeSugar.toFixed(1),
        avgFibre: +avgNutrition.fibre.toFixed(1),
        avgCalories: +avgNutrition.calories.toFixed(1),
        rawAfter: afterScores[i].score,
        cappedAfter: after,
        beforeRisk: bs.score,
      });
    }

    return {
      condition: bs.condition,
      before: +bs.score.toFixed(1),
      after: +after.toFixed(1),
      pct: Math.max(0, pct),
    };
  });

  return {
    beforeRiskScores: beforeScores.map(s => ({ condition: s.condition, score: s.score })),
    afterRiskScores: improvements.map(i => ({ condition: i.condition, score: i.after })),
    improvements,
    sodiumReduction: Math.max(0, +(originalNutrition.sodium - planNutrition.sodium).toFixed(0)),
    sugarReduction: Math.max(0, +(originalNutrition.freeSugar - planNutrition.freeSugar).toFixed(1)),
    fibreIncrease: Math.max(0, +(planNutrition.fibre - originalNutrition.fibre).toFixed(1)),
    calorieDeficit: Math.max(0, +(originalNutrition.calories - planNutrition.calories).toFixed(0)),
  };
}

// ─── Dynamic Health Improvement Statements ───
function buildHealthImprovements(
  originalNutrition: NutritionData,
  planNutrition: NutritionData,
  conditions: MedicalCondition[],
  projection: HealthProjection,
  weeklyWeightChange: number
): string[] {
  const improvements: string[] = [];

  if (projection.sodiumReduction > 50) {
    improvements.push(`Estimated sodium reduction of ~${projection.sodiumReduction} mg/day may support improved blood pressure control.`);
  }
  if (projection.sugarReduction > 1) {
    improvements.push(`Daily free sugar reduced from ${originalNutrition.freeSugar.toFixed(1)}g to ${planNutrition.freeSugar.toFixed(1)}g, which may support improved glucose regulation.`);
  }
  if (projection.fibreIncrease > 0) {
    improvements.push(`Daily fibre increased from ${originalNutrition.fibre.toFixed(1)}g to ${planNutrition.fibre.toFixed(1)}g, which may support improved digestive health and glycemic control.`);
  }
  if (weeklyWeightChange < -0.1) {
    improvements.push(`Estimated weight reduction of ~${Math.abs(weeklyWeightChange).toFixed(2)} kg/week under consistent adherence.`);
  } else if (weeklyWeightChange > 0.1) {
    improvements.push(`Estimated weight gain of ~${weeklyWeightChange.toFixed(2)} kg/week to support healthy mass building.`);
  }

  for (const imp of projection.improvements) {
    if (imp.pct > 5) {
      improvements.push(`${imp.condition}: risk score may decrease from ${imp.before.toFixed(1)} to ${imp.after.toFixed(1)} (~${imp.pct.toFixed(0)}% improvement) with consistent plan adherence.`);
    }
  }

  const ironDiff = planNutrition.iron - originalNutrition.iron;
  if (conditions.includes("Anemia") && ironDiff > 0.5) {
    improvements.push(`May support improvement in iron levels — increased daily iron by ~${ironDiff.toFixed(1)} mg.`);
  }

  if (improvements.length === 0) {
    improvements.push("Diet plan maintains balanced nutrition within safe limits for your profile.");
  }
  improvements.push("This risk score is derived using threshold-based weighted scoring and not a trained medical model. Consult your healthcare provider for personalised advice.");

  return improvements;
}

// ─── Single plan generation attempt (structured meals) ───
function generatePlanAttempt(
  dataset: NutritionData[],
  conditions: MedicalCondition[],
  calorie_target: number,
  excludeNames: Set<string>,
  preferLowCarbSodium: boolean,
  isAnalyzedOverlap: (name: string) => boolean = () => false
): { meal_plan: MealPlan; allEntries: MealEntry[]; total_nutrition: NutritionData } {
  const usedNames = new Set<string>(excludeNames);
  USED_DISH_NAMES = new Set<string>(excludeNames);
  BREAKFAST_HAS_BREAKFAST_MAIN = false;

  // Filter only exact/substring analyzed-dish matches. Shared-word exclusion is
  // intentionally avoided because it can wipe out lunch/dinner category pools.
  dataset = dataset.filter(d => !isAnalyzedOverlap(getExactDishName(d)));

  const adjustPool = (pool: { dish: NutritionData; risk: number; foodScore: number }[]) => {
    if (!preferLowCarbSodium) return pool;
    return [...pool].sort((a, b) => {
      const aPenalty = (a.dish.carbohydrates / 100) + (a.dish.sodium / 600);
      const bPenalty = (b.dish.carbohydrates / 100) + (b.dish.sodium / 600);
      return (a.foodScore - aPenalty) > (b.foodScore - bPenalty) ? -1 : 1;
    });
  };

  // ── Breakfast: 1 Breakfast_Main + optional Breakfast_Side/Beverage ──
  const bfBudget = calorie_target * 0.25;
  let bfPool = adjustPool(filterAndScoreDishes(dataset, conditions, bfBudget, 50, "Breakfast"));
  if (bfPool.length < 3) bfPool = adjustPool(filterAndScoreDishes(dataset, conditions, bfBudget, 50));
  const breakfast = buildStructuredMeal(bfPool, bfBudget, usedNames, [
    { foodCategories: ["Breakfast_Main"], fallbackKeywords: STAPLE_KEYWORDS, required: true },
    { foodCategories: ["Breakfast_Side", "Beverage"], fallbackKeywords: SALAD_KEYWORDS, required: false },
  ], true);

  // RULE 1: If breakfast has idli/dosa, ensure it's paired with a side
  // (sambar > coconut chutney > tomato chutney > green chutney > peanut chutney).
  const hasIdliDosa = breakfast.some(e =>
    /idli|dosa/i.test(e.dishName)
  );
  const alreadyHasSide = breakfast.some(e =>
    hasFoodCategory(e.nutrition, "Breakfast_Side") ||
    /sambar|chutney/i.test(e.dishName)
  );
  if (hasIdliDosa && !alreadyHasSide) {
    const sidePriorities = [/sambar/i, /coconut chutney/i, /tomato chutney/i, /green chutney|mint chutney/i, /peanut chutney/i];
    const bfTotal = breakfast.reduce((s, e) => s + e.calories, 0);
    const remaining = bfBudget * 1.10 - bfTotal;
    for (const re of sidePriorities) {
      const sideCandidates = dataset
        .filter(d => d.isMealItem)
        .filter(d => re.test(d.dishName))
        .filter(d => d.calories > 20 && d.calories <= Math.max(150, remaining))
        .filter(d => !usedNames.has(getExactDishName(d)))
        .sort((a, b) => a.calories - b.calories);
      const pick = sideCandidates[0];
      if (pick) {
        const scores = conditions.length > 0 ? calculateConditionScores(pick, conditions) : [];
        const risk = conditions.length > 0 ? calculateOverallRisk(scores) : 0;
        breakfast.push(scaleMealEntry(pick, risk, 0, 1));
        usedNames.add(getExactDishName(pick));
        console.log("[DietPlanner DEBUG] Idli/Dosa side added:", pick.dishName);
        break;
      }
    }
  }

  // RULE 2: If breakfast is under 85% of target, top up with a Breakfast_Side
  // (or fall back to a low-calorie Beverage under 100 kcal).
  const fillBreakfast = () => {
    const total = breakfast.reduce((s, e) => s + e.calories, 0);
    // FIX 5: pair with side until breakfast reaches 90% of its 25% target.
    if (total >= bfBudget * 0.90) return false;
    const remaining = bfBudget * 1.05 - total;
    if (remaining < 30) return false;

    const trySide = bfPool
      .filter(i => hasFoodCategory(i.dish, "Breakfast_Side"))
      .filter(i => !usedNames.has(getExactDishName(i.dish)))
      .filter(i => i.dish.calories <= remaining + 20)
      .sort((a, b) => Math.abs(a.dish.calories - remaining) - Math.abs(b.dish.calories - remaining));
    if (trySide[0]) {
      const p = trySide[0];
      breakfast.push(scaleMealEntry(p.dish, p.risk, p.foodScore, 1));
      usedNames.add(getExactDishName(p.dish));
      return true;
    }

    const tryBev = dataset
      .filter(d => (d.foodCategory || "").toLowerCase() === "beverage")
      .filter(d => d.calories > 20 && d.calories <= Math.min(100, remaining + 20))
      .filter(d => !usedNames.has(getExactDishName(d)))
      .sort((a, b) => Math.abs(a.calories - remaining) - Math.abs(b.calories - remaining));
    if (tryBev[0]) {
      const d = tryBev[0];
      const scores = conditions.length > 0 ? calculateConditionScores(d, conditions) : [];
      const risk = conditions.length > 0 ? calculateOverallRisk(scores) : 0;
      breakfast.push(scaleMealEntry(d, risk, 0, 1));
      usedNames.add(getExactDishName(d));
      return true;
    }
    return false;
  };
  // Try up to 2 fill-ups (e.g. side + small beverage)
  fillBreakfast() && fillBreakfast();

  BREAKFAST_HAS_BREAKFAST_MAIN = breakfast.some(e => hasFoodCategory(e.nutrition, "Breakfast_Main"));
  USED_DISH_NAMES = new Set([...USED_DISH_NAMES, ...breakfast.map(getEntryExactDishName)]);

  // ── Lunch: Staple + Protein + Vegetable + optional Salad ──
  const luBudget = calorie_target * 0.40;
  let luPool = adjustPool(filterAndScoreDishes(dataset, conditions, luBudget, 50, "Lunch"));
  if (luPool.length < 5) luPool = adjustPool(filterAndScoreDishes(dataset, conditions, luBudget, 50));
  // FIX 3: Lunch pool is HARD-restricted to Staple / Protein / Vegetable / Salad.
  // Items with Food_Category="Snack" (e.g. "Roasted chana") must never appear in lunch.
  luPool = luPool.filter(item =>
    hasFoodCategory(item.dish, "Staple", "Protein", "Vegetable", "Salad")
  );
  console.log("[DietPlanner DEBUG] Lunch pool after strict category filter:", luPool.length);

  // Lunch must ALWAYS start with Staple + Protein. If filtered pools are empty,
  // fall back to any available item in that Food_Category rather than returning
  // only raita/salad.
  const lunch: MealEntry[] = [];
  const addLunchPick = (pick: { dish: NutritionData; risk: number; foodScore: number } | null, targetShare: number) => {
    if (!pick) return false;
    const qty = Math.max(1, Math.min(Math.round(targetShare / Math.max(pick.dish.calories, 1)), MAX_PORTION));
    lunch.push(scaleMealEntry(pick.dish, pick.risk, pick.foodScore, qty));
    usedNames.add(getExactDishName(pick.dish));
    return true;
  };
  const lunchStaples = fallbackPoolByCategory(dataset, conditions, luBudget, "Staple");
  const lunchProteins = fallbackPoolByCategory(dataset, conditions, luBudget, "Protein");
  const lunchVegetables = fallbackPoolByCategory(dataset, conditions, luBudget, "Vegetable");
  const lunchSalads = fallbackPoolByCategory(dataset, conditions, luBudget, "Salad");

  const lunchStaple = pickBestByCategoryWithFallback(luPool, lunchStaples, "Staple", usedNames)
    ?? pickBestByCategoryWithFallback(luPool, lunchStaples, "Staple", usedNames, true);
  addLunchPick(lunchStaple, luBudget * 0.35);

  const lunchProtein = pickBestByCategoryWithFallback(luPool, lunchProteins, "Protein", usedNames)
    ?? pickBestByCategoryWithFallback(luPool, lunchProteins, "Protein", usedNames, true);
  addLunchPick(lunchProtein, luBudget * 0.35);

  const lunchVegetable = pickBestByCategoryWithFallback(luPool, lunchVegetables, "Vegetable", usedNames);
  if (lunchVegetable && lunch.reduce((s, e) => s + e.calories, 0) + lunchVegetable.dish.calories <= luBudget * 1.08) {
    addLunchPick(lunchVegetable, luBudget * 0.15);
  }

  const lunchSalad = pickBestByCategoryWithFallback(luPool, lunchSalads, "Salad", usedNames);
  if (lunchSalad && lunch.length < 4 && lunch.reduce((s, e) => s + e.calories, 0) + lunchSalad.dish.calories <= luBudget * 1.10) {
    addLunchPick(lunchSalad, luBudget * 0.10);
  }

  // Cap lunch at 4 items max; drop trailing optional items if over 40% target.
  if (lunch.length > 4) lunch.splice(4);
  while (lunch.length > 3) {
    const total = lunch.reduce((s, e) => s + e.calories, 0);
    if (total <= luBudget * 1.05) break;
    const dropped = lunch.pop();
    if (dropped) usedNames.delete(getEntryExactDishName(dropped));
  }
  for (const entry of lunch) USED_DISH_NAMES.add(getEntryExactDishName(entry));

  // ── Dinner: guaranteed Staple + Protein/Vegetable waterfall ──
  const diBudget = calorie_target * 0.25;
  for (const n of USED_DISH_NAMES) usedNames.add(n);
  console.log("[DietPlanner DEBUG] USED_DISH_NAMES before dinner:", Array.from(USED_DISH_NAMES));

  // FIX 4: If lunch contained a heavy legume curry, dinner protein must be lighter.
  const lunchHadHeavyLegume = lunch.some(e =>
    matchesAny(e.dishName, HEAVY_LEGUME_KEYWORDS)
  );
  console.log("[DietPlanner DEBUG] Lunch had heavy legume:", lunchHadHeavyLegume);

  const dinnerMealPool = adjustPool(filterAndScoreDishes(dataset, conditions, diBudget, 50, "Dinner"))
    .filter(item => hasFoodCategory(item.dish, "Staple", "Protein", "Vegetable"));
  const dinnerAllMealPool = adjustPool(filterAndScoreDishes(dataset, conditions, diBudget, 50))
    .filter(item => hasFoodCategory(item.dish, "Staple", "Protein", "Vegetable"));

  const buildDinnerCategoryPool = (category: FoodCat) => {
    const seen = new Set<string>();
    const combined = [
      ...dinnerMealPool,
      ...dinnerAllMealPool,
      ...fallbackPoolByCategory(dataset, conditions, diBudget, category),
    ].filter(item => hasFoodCategory(item.dish, category));
    const deduped = combined.filter(item => {
      const name = getExactDishName(item.dish).toLowerCase();
      if (seen.has(name)) return false;
      seen.add(name);
      return true;
    });
    if (category === "Protein" && lunchHadHeavyLegume) {
      return deduped.sort((a, b) => {
        const aLight = matchesAny(a.dish.dishName, LIGHT_PROTEIN_KEYWORDS) ? 1 : 0;
        const bLight = matchesAny(b.dish.dishName, LIGHT_PROTEIN_KEYWORDS) ? 1 : 0;
        if (aLight !== bLight) return bLight - aLight;
        return b.foodScore - a.foodScore;
      });
    }
    return deduped;
  };

  const dinner: MealEntry[] = [];
  const dinnerNames = new Set<string>(usedNames);
  const currentDinnerNames = new Set<string>();
  const addDinnerPick = (pick: { dish: NutritionData; risk: number; foodScore: number } | null, targetShare: number) => {
    if (!pick) return false;
    const qty = Math.max(1, Math.min(Math.round(targetShare / Math.max(pick.dish.calories, 1)), MAX_PORTION));
    dinner.push(scaleMealEntry(pick.dish, pick.risk, pick.foodScore, qty));
    dinnerNames.add(getExactDishName(pick.dish));
    currentDinnerNames.add(getExactDishName(pick.dish));
    return true;
  };

  const pickDinnerByWaterfall = (category: FoodCat, ignoreUsed = false) => {
    const pool = buildDinnerCategoryPool(category);
    console.log(`[DietPlanner DEBUG] Dinner ${category} pool`, { total: pool.length, afterUsed: pool.filter(i => !dinnerNames.has(getExactDishName(i.dish))).length });
    return pool.find(item => !currentDinnerNames.has(getExactDishName(item.dish)) && (ignoreUsed || !dinnerNames.has(getExactDishName(item.dish)))) ?? null;
  };

  // Required waterfall: Staple not used → any Staple → Protein not used → any Protein
  // → Vegetable not used → any Vegetable. This guarantees dinner has at least 2 dishes.
  addDinnerPick(pickDinnerByWaterfall("Staple", false) ?? pickDinnerByWaterfall("Staple", true), diBudget * 0.45);
  addDinnerPick(pickDinnerByWaterfall("Protein", false) ?? pickDinnerByWaterfall("Protein", true), diBudget * 0.40);
  if (dinner.length < 2) {
    addDinnerPick(pickDinnerByWaterfall("Vegetable", false) ?? pickDinnerByWaterfall("Vegetable", true), diBudget * 0.30);
  }
  if (dinner.length < 2) {
    for (const category of ["Staple", "Protein", "Vegetable"] as FoodCat[]) {
      if (dinner.length >= 2) break;
      addDinnerPick(pickDinnerByWaterfall(category, true), diBudget * 0.25);
    }
  }
  if (dinner.length < 2 && dinner.length > 0) {
    const emergency = ["Staple", "Protein", "Vegetable"].flatMap(category => buildDinnerCategoryPool(category as FoodCat))
      .find(item => !currentDinnerNames.has(getExactDishName(item.dish)));
    addDinnerPick(emergency ?? null, diBudget * 0.25);
  }

  // ── Snacks: Snack or Beverage only, max 2 items ──
  const snBudget = calorie_target * 0.10;
  const snRaw = adjustPool(filterAndScoreSnackDishes(dataset, conditions, snBudget, 20));

  // STRICT WHITELIST GATE: only allow snack candidates whose name contains
  // an approved word AND no dessert blocker. Applied BEFORE any tier logic.
  // Also block breakfast/protein names like "Orange omelette" unless the row is
  // explicitly tagged Food_Category="Snack".
  const snApproved = snRaw.filter(i => isValidSnackDish(i.dish));

  // If fewer than 2 approved snacks exist, fall back to Beverage-only items
  // from the raw snack pool (lassi, chaas, juice, tea etc.).
  const snBeverageFallback = snRaw.filter(i => isBeverageOnly(i.dish));
  const snBase = snApproved.length >= 2
    ? snApproved
    : [...snApproved, ...snBeverageFallback.filter(b => !snApproved.some(a => a.dish.dishName === b.dish.dishName))];

  console.log("[DietPlanner DEBUG] snack whitelist gate:", {
    rawCount: snRaw.length,
    approvedCount: snApproved.length,
    beverageFallback: snBeverageFallback.length,
    finalPool: snBase.map(i => i.dish.dishName),
  });

  // Tiered snack pools (priority order):
  // T1 — Healthy + Fresh (whole fruits, fresh items)
  // T2 — Healthy + Cooked (roasted chana, makhana, sprouts chaat)
  // T3 — Beverages (lassi, chaas, juice, tea)
  // T4 — Whitelist fallback (legacy)
  const isHealthy = (d: NutritionData) => (d.healthTag || "").toLowerCase() === "healthy";
  const procIs = (d: NutritionData, p: string) => (d.processingLevel || "").toLowerCase() === p.toLowerCase();

  // FIX 3 priority order:
  // T1 — Whole fruits (apple, banana, papaya, watermelon, guava, orange, mango, pear)
  // T2 — Healthy cooked snacks (roasted chana, makhana, sprouts chaat, fruit chaat)
  // T3 — Beverages (lassi, chaas, buttermilk, fresh juice, tea, coffee)
  // T4 — Whitelist fallback
  const tier1 = snBase.filter(i => matchesAny(i.dish.dishName, FRUIT_KEYWORDS));
  const tier2 = snBase.filter(i => isHealthy(i.dish) && procIs(i.dish, "Cooked"))
    .filter(i => !matchesAny(i.dish.dishName, FRUIT_KEYWORDS));
  const tier3 = snBase.filter(i => isBeverageOnly(i.dish));
  const tier4 = snBase; // already whitelist-gated

  console.log("[DietPlanner DEBUG] snack tiers:", {
    tier1_HealthyFresh: tier1.map(i => i.dish.dishName),
    tier2_HealthyCooked: tier2.map(i => i.dish.dishName),
    tier3_Beverage: tier3.map(i => i.dish.dishName),
    tier4_Whitelist: tier4.length,
  });

  const snacks: MealEntry[] = [];
  const addSnackFromPool = (pool: typeof snBase, allowOverTarget = false): boolean => {
    const currentSnackCalories = snacks.reduce((s, e) => s + e.calories, 0);
    const remainingIdeal = Math.max(30, snBudget - currentSnackCalories);
    const hardCap = allowOverTarget ? snBudget * 1.35 : snBudget * 1.15;
    const candidates = pool
      .filter(item => !usedNames.has(getExactDishName(item.dish)))
      .filter(item => item.dish.calories <= 200)
      .filter(item => allowOverTarget || currentSnackCalories + item.dish.calories <= hardCap)
      .sort((a, b) => Math.abs(a.dish.calories - remainingIdeal) - Math.abs(b.dish.calories - remainingIdeal));
    const pick = candidates[0];
    if (!pick) return false;
    snacks.push(scaleMealEntry(pick.dish, pick.risk, pick.foodScore, 1));
    usedNames.add(getExactDishName(pick.dish));
    return true;
  };

  // Walk tiers in order until we have 2 snacks.
  for (const tier of [tier1, tier2, tier3, tier4]) {
    while (snacks.length < 2 && addSnackFromPool(tier, tier === tier3)) {
      /* fill from this tier */
    }
    if (snacks.length >= 2) break;
  }

  const allEntries = [...breakfast, ...lunch, ...dinner, ...snacks];
  let total_nutrition = sumNutrition(allEntries);

  const sodiumCap = conditions.includes("Hypertension") ? 2000 : 2300;
  if (total_nutrition.sodium > sodiumCap) total_nutrition = { ...total_nutrition, sodium: sodiumCap };
  if (total_nutrition.fibre > 60) total_nutrition = { ...total_nutrition, fibre: 60 };

  return { meal_plan: { breakfast, lunch, dinner, snacks }, allEntries, total_nutrition };
}

// ─── Main Diet Plan Generator ───
export function generateDietPlan(
  profile: UserProfile,
  dataset: NutritionData[],
  conditions: MedicalCondition[],
  originalNutrition: NutritionData
): DietPlanResult {
  const bmr = +calcBMR(profile).toFixed(0);
  const tdee = +calcTDEE(bmr, profile.activityLevel).toFixed(0);
  const calorie_target = +calcCalorieTarget(tdee, profile.goal).toFixed(0);
  const bmi = calcBMI(profile.weightKg, profile.heightCm);
  const bmiCategory = getBMICategory(bmi);

  const MAX_ATTEMPTS = 5;
  let acceptedResult: ReturnType<typeof generatePlanAttempt> | null = null;

  // FIX 1: build excluder from analyzed dish; passed into every plan attempt.
  const isAnalyzedOverlap = buildAnalyzedDishExcluder(originalNutrition);

  if (conditions.length === 0) {
    acceptedResult = generatePlanAttempt(dataset, conditions, calorie_target, new Set(), false, isAnalyzedOverlap);
  } else {
    let lastResult: ReturnType<typeof generatePlanAttempt> | null = null;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const preferLowCarbSodium = attempt >= 2;
      const excludeNames = new Set<string>();

      if (attempt > 0 && lastResult) {
        const prevEntries = [...lastResult.allEntries].sort((a, b) => b.overallRisk - a.overallRisk);
        for (let i = 0; i < Math.min(attempt, prevEntries.length); i++) {
          excludeNames.add(prevEntries[i].dishName.replace(/ ×\d+$/, ""));
        }
      }

      const result = generatePlanAttempt(dataset, conditions, calorie_target, excludeNames, preferLowCarbSodium, isAnalyzedOverlap);
      lastResult = result;

      const SAFE_RISK_THRESHOLD = 6;
      const afterScores = calculateDailyConditionScores(result.total_nutrition, conditions);
      let valid = true;
      for (const as of afterScores) {
        if (as.score > SAFE_RISK_THRESHOLD) { valid = false; break; }
      }

      if (valid) { acceptedResult = result; break; }
    }

    if (!acceptedResult) {
      const REFINED_KEYWORDS = ["maida", "refined", "naan", "kulcha", "bhatura", "puri"];
      const strictDataset = dataset.filter(dish => {
        if (dish.carbohydrates > 60) return false;
        if (dish.sodium > 300) return false;
        const nameLower = dish.dishName.toLowerCase();
        if (REFINED_KEYWORDS.some(kw => nameLower.includes(kw))) return false;
        return true;
      });
      acceptedResult = generatePlanAttempt(strictDataset, conditions, calorie_target, new Set(), true, isAnalyzedOverlap);
    }
  }

  const { meal_plan, total_nutrition, allEntries } = acceptedResult;
  const weeklyChange = calcWeeklyWeightChange(tdee, calorie_target);
  const weight_projection = generateWeightProjection(profile.weightKg, weeklyChange, 8);
  const health_projection = buildHealthProjection(originalNutrition, total_nutrition, conditions, allEntries);
  const expected_health_improvements = buildHealthImprovements(originalNutrition, total_nutrition, conditions, health_projection, weeklyChange);

  return {
    bmr, tdee, bmi, bmiCategory, calorie_target,
    meal_plan, total_nutrition,
    estimated_weekly_weight_change: weeklyChange,
    weight_projection, health_projection, expected_health_improvements,
  };
}
