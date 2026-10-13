/**
 * Curated offline sample dishes and intelligent fallback dictionary.
 * Ensures the system never fails during viva/interviews if API keys or internet are unavailable.
 */

export interface SampleDish {
  id: string;
  name: string;
  label: string;
  category: string;
  image: string;
  description: string;
  ingredients: string[];
}

export const SAMPLE_DISHES: SampleDish[] = [
  {
    id: "samosa",
    name: "Samosa",
    label: "samosa",
    category: "Snack",
    image: "/images/Indian Food Images/samosa/001.jpg",
    description: "Crispy fried pastry with spiced potato filling",
    ingredients: [
      "Potatoes",
      "Refined flour (Maida)",
      "Cooking oil",
      "Green peas",
      "Green chillies",
      "Cumin seeds",
      "Salt",
      "Garam masala",
    ],
  },
  {
    id: "biryani",
    name: "Mutton Biryani",
    label: "biryani",
    category: "Main Course",
    image: "/images/Indian Food Images/biryani/04d39a92fc.jpg",
    description: "Layered aromatic basmati rice with spiced tender meat",
    ingredients: [
      "Basmati rice",
      "Mutton / Meat",
      "Ghee",
      "Fried onions (Birista)",
      "Yogurt",
      "Ginger-garlic paste",
      "Saffron",
      "Garam masala spices",
    ],
  },
  {
    id: "idli",
    name: "Idli",
    label: "idli",
    category: "Breakfast",
    image: "/images/Indian Food Images/idli/001.jpg",
    description: "Steamed fermented rice and urad dal cakes",
    ingredients: [
      "Parboiled rice",
      "Urad dal (Black gram)",
      "Fenugreek seeds",
      "Water",
      "Salt",
    ],
  },
  {
    id: "gulab_jamun",
    name: "Gulab Jamun",
    label: "gulab_jamun",
    category: "Dessert",
    image: "/images/Indian Food Images/gulab_jamun/03e3d2fccb.jpg",
    description: "Fried milk-solid dumplings soaked in rose sugar syrup",
    ingredients: [
      "Khoya (Mawa)",
      "Paneer",
      "Sugar syrup (Chashni)",
      "Refined flour",
      "Ghee",
      "Cardamom",
      "Rose water",
    ],
  },
  {
    id: "palak_paneer",
    name: "Palak Paneer",
    label: "palak_paneer",
    category: "Curry / Main Course",
    image: "/images/Indian Food Images/palak_paneer/0014af7366.jpg",
    description: "Fresh cottage cheese cubes in smooth spiced spinach gravy",
    ingredients: [
      "Fresh spinach (Palak)",
      "Paneer (Cottage cheese)",
      "Onions",
      "Tomatoes",
      "Garlic & Ginger",
      "Fresh cream",
      "Ghee / Butter",
      "Cumin & Garam masala",
    ],
  },
  {
    id: "dal_makhani",
    name: "Dal Makhani",
    label: "dal_makhani",
    category: "Lentil / Main Course",
    image: "/images/Indian Food Images/dal_makhani/00cf330f1d.jpg",
    description: "Slow-cooked black lentils and kidney beans with butter and cream",
    ingredients: [
      "Whole black urad dal",
      "Rajma (Kidney beans)",
      "Butter (Makhan)",
      "Fresh cream",
      "Tomato puree",
      "Garlic & Ginger",
      "Kasuri methi",
      "Kashmiri red chilli",
    ],
  },
];

const DISH_INGREDIENTS_MAP: Record<string, string[]> = {
  samosa: ["Potatoes", "Refined flour (Maida)", "Vegetable oil", "Green peas", "Cumin", "Salt"],
  biryani: ["Basmati rice", "Mutton", "Ghee", "Fried onions", "Yogurt", "Garam masala", "Saffron"],
  idli: ["Parboiled rice", "Urad dal", "Fenugreek seeds", "Water", "Salt"],
  gulab_jamun: ["Khoya (Mawa)", "Paneer", "Sugar syrup (Chashni)", "Ghee", "Cardamom"],
  palak_paneer: ["Spinach (Palak)", "Paneer", "Onions", "Tomatoes", "Fresh cream", "Garlic", "Ghee"],
  dal_makhani: ["Black lentils (Urad)", "Kidney beans (Rajma)", "Butter", "Fresh cream", "Tomato puree"],
  butter_chicken: ["Chicken", "Butter", "Fresh cream", "Tomato gravy", "Cashew paste", "Kasuri methi"],
  aloo_gobi: ["Potatoes", "Cauliflower", "Turmeric", "Cumin", "Ginger", "Mustard oil"],
  masala_dosa: ["Rice & Lentil batter", "Spiced potato masala", "Onions", "Mustard seeds", "Curry leaves"],
  dal_tadka: ["Yellow toor dal", "Ghee", "Cumin seeds", "Garlic", "Tomatoes", "Turmeric"],
  bhatura: ["Refined flour (Maida)", "Yogurt", "Baking powder", "Cooking oil", "Salt"],
  chapati: ["Whole wheat flour (Atta)", "Water", "Salt", "Ghee"],
  poha: ["Flattened rice", "Peanuts", "Mustard seeds", "Turmeric", "Curry leaves", "Onions"],
  lassi: ["Curd (Yogurt)", "Sugar", "Cardamom", "Rose water", "Cream"],
  vada: ["Urad dal (Black gram)", "Curry leaves", "Black pepper", "Ginger", "Green chillies", "Cooking oil", "Salt"],
  medu_vada: ["Urad dal (Black gram)", "Curry leaves", "Black pepper", "Ginger", "Green chillies", "Cooking oil", "Salt"],
  dahi_vada: ["Urad dal dumplings", "Thick curd (Dahi)", "Sweet tamarind chutney", "Green mint chutney", "Roasted cumin", "Black salt"],
  masala_vada: ["Chana dal (Bengal gram)", "Onions", "Fennel seeds", "Curry leaves", "Green chillies", "Cooking oil", "Salt"],
  mango_pickle: ["Raw mango", "Mustard oil", "Fenugreek", "Salt", "Red chilli powder"],
};

export function getFallbackIngredients(dishLabel: string): string[] {
  const normalized = dishLabel.toLowerCase().trim();
  if (DISH_INGREDIENTS_MAP[normalized]) return DISH_INGREDIENTS_MAP[normalized];
  
  for (const [key, ingredients] of Object.entries(DISH_INGREDIENTS_MAP)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return ingredients;
    }
  }

  return ["Spices", "Onions", "Tomatoes", "Oil", "Salt", "Indian herbs"];
}

/**
 * Deterministic clinical explanation generator based on actual nutrient values and condition scores.
 * Used when the external LLM gateway is offline or unavailable.
 */
export function generateOfflineExplanation(context: {
  dish_name: string;
  nutrition: any;
  condition_scores: Array<{ condition: string; score: number }>;
  overall_risk: number;
  classification: string;
  portion: string;
}): string {
  const { dish_name, nutrition, condition_scores, overall_risk, classification, portion } = context;

  const topRisks = [...condition_scores].sort((a, b) => b.score - a.score);
  const primaryHigh = topRisks.filter(r => r.score >= 6);
  const moderate = topRisks.filter(r => r.score >= 3.5 && r.score < 6);

  let p1 = `Based on nutritional profiling for ${dish_name} (${portion} portion: ${nutrition.calories.toFixed(0)} kcal), this dish is categorized as ${classification} with an overall clinical risk index of ${overall_risk.toFixed(1)}/10. `;

  if (primaryHigh.length > 0) {
    p1 += `It exhibits elevated risk scores for ${primaryHigh.map(r => `${r.condition} (${r.score.toFixed(1)}/10)`).join(", ")}. `;
  } else if (moderate.length > 0) {
    p1 += `It carries moderate risk primarily concerning ${moderate.map(r => `${r.condition} (${r.score.toFixed(1)}/10)`).join(", ")}. `;
  } else {
    p1 += `Its nutrient distribution remains within safe clinical thresholds across your selected medical conditions. `;
  }

  const nutrientFactors: string[] = [];
  if (nutrition.sodium > 400) nutrientFactors.push(`elevated sodium content (${nutrition.sodium.toFixed(0)} mg) which impacts arterial blood pressure`);
  if (nutrition.freeSugar > 10) nutrientFactors.push(`high free sugars (${nutrition.freeSugar.toFixed(1)} g) contributing to postprandial glycemic spikes`);
  if (nutrition.totalFat > 18) nutrientFactors.push(`notable fat density (${nutrition.totalFat.toFixed(1)} g) affecting lipid profile and caloric balance`);
  if (nutrition.fibre < 3) nutrientFactors.push(`low dietary fibre (${nutrition.fibre.toFixed(1)} g) resulting in faster digestion rates`);

  let p2 = `Nutritional breakdown indicates ${nutrientFactors.length > 0 ? nutrientFactors.join(", ") : "a balanced distribution of macronutrients"}. Carbohydrates total ${nutrition.carbohydrates.toFixed(1)} g with ${nutrition.protein.toFixed(1)} g protein. `;

  let p3 = `Recommendation: `;
  if (classification === "AVOID") {
    p3 += `Due to the high risk profile, it is advisable to replace this dish with lighter whole-grain or boiled/steamed alternatives. Consider smaller portions or non-fried preparations to prevent compounding metabolic load.`;
  } else if (classification === "MODERATE") {
    p3 += `This dish can be enjoyed occasionally in controlled portions. Pairing with a fibre-rich salad or raita will help blunt glycemic response and improve satiety.`;
  } else {
    p3 += `This dish aligns well with healthy dietary patterns. Ensure proper hydration and maintain consistent meal timing.`;
  }

  return `${p1}\n\n${p2}\n\n${p3}`;
}
