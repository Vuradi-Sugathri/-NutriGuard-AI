/** Keyword-based nutrient risk highlighter — no AI, fully deterministic */

export type NutrientRisk = "sugar" | "fat" | "sodium";

interface IngredientRisk {
  ingredient: string;
  risks: NutrientRisk[];
}

const SUGAR_KEYWORDS = [
  "sugar", "syrup", "jaggery", "honey", "condensed milk", "khoya", "mawa",
  "mithai", "ladoo", "halwa", "gulab", "rasgulla", "burfi", "barfi",
  "chocolate", "caramel", "molasses", "treacle", "fructose", "glucose",
  "dextrose", "maltose", "palm sugar", "coconut sugar", "cane", "sweet",
  "chashni", "rabri", "rabdi",
];

const FAT_KEYWORDS = [
  "ghee", "butter", "cream", "oil", "fried", "deep fried", "paneer",
  "cheese", "coconut", "coconut milk", "cashew", "nuts", "almonds",
  "peanuts", "sesame", "lard", "shortening", "margarine", "malai",
  "full fat", "whole milk", "avocado", "mayo", "mayonnaise",
];

const SODIUM_KEYWORDS = [
  "salt", "pickle", "papad", "achaar", "soy sauce", "chutney", "ketchup",
  "sauce", "baking soda", "baking powder", "processed", "cured", "smoked",
  "fenugreek", "amchur", "tamarind", "imli", "monosodium", "msg",
  "namak", "sendha namak",
];

function matchesKeyword(ingredient: string, keywords: string[]): boolean {
  const lower = ingredient.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

export function highlightIngredients(ingredients: string[]): IngredientRisk[] {
  return ingredients.map((ingredient) => {
    const risks: NutrientRisk[] = [];
    if (matchesKeyword(ingredient, SUGAR_KEYWORDS)) risks.push("sugar");
    if (matchesKeyword(ingredient, FAT_KEYWORDS)) risks.push("fat");
    if (matchesKeyword(ingredient, SODIUM_KEYWORDS)) risks.push("sodium");
    return { ingredient, risks };
  });
}

export const RISK_LABELS: Record<NutrientRisk, string> = {
  sugar: "High Sugar",
  fat: "High Fat",
  sodium: "High Sodium",
};

export const RISK_STYLES: Record<NutrientRisk, string> = {
  sugar: "bg-amber-100 text-amber-800 border-amber-200",
  fat: "bg-orange-100 text-orange-800 border-orange-200",
  sodium: "bg-blue-100 text-blue-800 border-blue-200",
};
