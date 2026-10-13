import { NutritionData } from "./types";
import * as XLSX from "xlsx";

let cachedDataset: NutritionData[] | null = null;

export async function loadDataset(): Promise<NutritionData[]> {
  if (cachedDataset) return cachedDataset;

  const response = await fetch("/data/indian_food_nutrition.xlsx");
  const buffer = await response.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);

  const data: NutritionData[] = rows.map((row) => {
    const dishName = String(row["Dish Name"] || "").trim();
    const category = normalizeDatasetCategory(String(row["Category"] || "").trim(), dishName);
    const originalFoodCategory = String(row["Food_Category"] || row["Food Category"] || "").trim();

    return {
    "Dish Name": dishName,
    Category: category,
    dishName,
    calories: parseFloat(row["Calories (kcal)"]) || 0,
    carbohydrates: parseFloat(row["Carbohydrates (g)"]) || 0,
    protein: parseFloat(row["Protein (g)"]) || 0,
    totalFat: parseFloat(row["Fats (g)"]) || 0,
    freeSugar: parseFloat(row["Free Sugar (g)"]) || 0,
    fibre: parseFloat(row["Fibre (g)"]) || 0,
    sodium: parseFloat(row["Sodium (mg)"]) || 0,
    calcium: parseFloat(row["Calcium (mg)"]) || 0,
    iron: parseFloat(row["Iron (mg)"]) || 0,
    vitaminC: parseFloat(row["Vitamin C (mg)"]) || 0,
    folate: parseFloat(row["Folate (µg)"] || row["Folate (Âµg)"] || row["Folate"]) || 0,
    category,
    mealType: String(row["Meal_Type"] || row["Meal Type"] || "").trim(),
    isMealItem: String(row["Is_Meal_Item"] || row["Is Meal Item"] || "").trim().toLowerCase() === "yes",
    healthTag: String(row["Health_Tag"] || row["Health Tag"] || "").trim(),
    processingLevel: String(row["Processing_Level"] || row["Processing Level"] || "").trim(),
    riskLevelDefault: parseFloat(row["Risk_Level_Default"] || row["Risk Level Default"]) || 5,
    foodCategory: deriveFoodCategory(originalFoodCategory, category, dishName),
    originalFoodCategory,
  };
  });

  cachedDataset = data;
  console.log(
    `[NutriGuard Dataset] Loaded ${data.length} rows. ` +
    `Healthy+Fresh: ${data.filter(d => d.healthTag === "Healthy" && d.processingLevel === "Fresh").length}, ` +
    `Healthy+Cooked: ${data.filter(d => d.healthTag === "Healthy" && d.processingLevel === "Cooked").length}, ` +
    `Beverages: ${data.filter(d => (d.foodCategory || "").toLowerCase() === "beverage").length}`
  );
  return data;
}

// Derive Food_Category from Category column when Food_Category is missing.
function normalizeDatasetCategory(category: string, dishName: string): string {
  const name = dishName.toLowerCase();
  const dessertKeywords = /gulab\s*jamun|rasgulla|kheer|halwa|ladoo|laddu|barfi|burfi|peda|sandesh|shrikhand|payasam|modak|mysore\s*pak|jalebi|imarti|custard|pudding|ice\s*cream|cake|tart|biscuit|icing|jam\s*filling|sweetened\s*yogurt/;
  if (category === "Ingredient" && dessertKeywords.test(name)) return "Dessert";
  return category;
}

function deriveFoodCategory(existing: string, category: string, dishName = ""): string {
  if (existing) return existing;
  const c = category.toLowerCase();
  if (c === "breakfast") return "Breakfast_Main";
  if (c === "breakfast_side" || c === "breakfast side") return "Breakfast_Side";
  if (c === "snack") return "Snack";
  if (c === "beverage") return "Beverage";
  if (c === "dessert") return "Other";
  if (c === "staple") return "Staple";
  if (c === "protein") return "Protein";
  if (c === "vegetable") return "Vegetable";
  if (c === "salad") return "Salad";
  const name = dishName.toLowerCase();
  if (c === "main_course" || c === "main course" || c === "lunch/dinner") {
    if (/\b(roti|chapati|paratha|parantha|poori|puri|naan|kulcha|rice|pulao|biryani|khichdi|millet|jowar|bajra|makki)\b/.test(name)) return "Staple";
    if (/\b(dal|daal|gram|channa|chana|chole|chickpea|rajma|rajmah|lobia|soyabean|soybean|paneer|tofu|egg|chicken|mutton|fish|prawn|keema|lentil|moong|masoor|urad)\b/.test(name)) return "Protein";
    if (/\b(curry|sabzi|sabji|bhaji|vegetable|gourd|lauki|tinda|bhindi|okra|baingan|brinjal|gobi|cauliflower|cabbage|palak|spinach|methi|karela|beans|pumpkin|mushroom)\b/.test(name)) return "Vegetable";
  }
  return "Other";
}

export function adjustNutrition(nutrition: NutritionData, multiplier: number): NutritionData {
  return {
    ...nutrition,
    dishName: nutrition.dishName,
    calories: +(nutrition.calories * multiplier).toFixed(2),
    carbohydrates: +(nutrition.carbohydrates * multiplier).toFixed(2),
    protein: +(nutrition.protein * multiplier).toFixed(2),
    totalFat: +(nutrition.totalFat * multiplier).toFixed(2),
    freeSugar: +(nutrition.freeSugar * multiplier).toFixed(2),
    fibre: +(nutrition.fibre * multiplier).toFixed(2),
    sodium: +(nutrition.sodium * multiplier).toFixed(2),
    calcium: +(nutrition.calcium * multiplier).toFixed(2),
    iron: +(nutrition.iron * multiplier).toFixed(2),
    vitaminC: +(nutrition.vitaminC * multiplier).toFixed(2),
    folate: +(nutrition.folate * multiplier).toFixed(2),
  };
}
