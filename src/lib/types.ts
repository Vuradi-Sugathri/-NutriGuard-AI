export interface NutritionData {
  "Dish Name"?: string;
  Category?: string;
  dishName: string;
  calories: number;
  carbohydrates: number;
  protein: number;
  totalFat: number;
  freeSugar: number;
  fibre: number;
  sodium: number;
  calcium: number;
  iron: number;
  vitaminC: number;
  folate: number;
  // Dataset metadata columns
  category: string;
  mealType: string;
  isMealItem: boolean;
  healthTag: string;
  processingLevel: string;
  riskLevelDefault: number;
  foodCategory: string;
  originalFoodCategory?: string;
}

export interface GeminiVisionResult {
  dish_name: string;
  ingredients: string[];
  alternatives: string[];
}

export interface PortionSize {
  label: string;
  grams: number;
  multiplier: number;
}

export const PORTION_SIZES: PortionSize[] = [
  { label: "Small", grams: 150, multiplier: 0.75 },
  { label: "Standard", grams: 200, multiplier: 1.0 },
  { label: "Large", grams: 300, multiplier: 1.5 },
  { label: "Extra Large", grams: 400, multiplier: 2.0 },
];

export type MedicalCondition =
  | "Hypertension"
  | "Type 2 Diabetes"
  | "Coronary Artery Disease"
  | "Chronic Kidney Disease"
  | "Obesity"
  | "Hyperlipidemia"
  | "Anemia"
  | "Asthma"
  | "Arthritis"
  | "Hypothyroidism";

export const ALL_CONDITIONS: MedicalCondition[] = [
  "Hypertension",
  "Type 2 Diabetes",
  "Coronary Artery Disease",
  "Chronic Kidney Disease",
  "Obesity",
  "Hyperlipidemia",
  "Anemia",
  "Asthma",
  "Arthritis",
  "Hypothyroidism",
];

export type Classification = "SAFE" | "MODERATE" | "AVOID";

export interface ConditionScore {
  condition: MedicalCondition;
  score: number;
}

export interface AnalysisResult {
  matchedDish: string;
  similarityScore: number;
  adjustedNutrition: NutritionData;
  rawNutrition: NutritionData;
  selectedConditionScores: ConditionScore[];
  overallRisk: number;
  classification: Classification;
  explanation: string;
  alternatives: AlternativeDish[];
  ingredients: string[];
  isOfflineDemo?: boolean;
}


export interface AlternativeDish {
  name: string;
  matchedName: string;
  similarityScore: number;
  nutrition: NutritionData;
  overallRisk: number;
  classification: Classification;
  calories: number;
  reason?: string;
}

export interface ConditionWeight {
  condition: MedicalCondition;
  weight: number;
}

export const CONDITION_WEIGHTS: Record<MedicalCondition, number> = {
  "Hypertension": 1.3,
  "Coronary Artery Disease": 1.3,
  "Hyperlipidemia": 1.3,
  "Type 2 Diabetes": 1.2,
  "Obesity": 1.2,
  "Chronic Kidney Disease": 1.1,
  "Hypothyroidism": 1.1,
  "Anemia": 1.0,
  "Asthma": 1.0,
  "Arthritis": 1.0,
};
