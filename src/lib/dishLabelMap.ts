/**
 * Dish Label Mapping System
 * Maps image dataset folder labels & AI predictions → nutrition dataset dish names.
 * Uses exact matching, domain-specific culinary rules, and fuzzy matching.
 */

/** Valid image dataset labels (extended with common Indian dishes) */
export const VALID_DISH_LABELS = [
  "aloo_gobi",
  "aloo_matar",
  "aloo_methi",
  "aloo_shimla_mirch",
  "aloo_tikki",
  "bhatura",
  "bhindi",
  "bhindi_masala",
  "biryani",
  "boondi",
  "butter_chicken",
  "chai",
  "chapati",
  "chicken_tikka_masala",
  "chikki",
  "chole",
  "daal_puri",
  "dahi_vada",
  "dal_makhani",
  "dal_tadka",
  "dhokla",
  "dum_aloo",
  "gajar_ka_halwa",
  "gulab_jamun",
  "idli",
  "kachori",
  "kadai_paneer",
  "kadhi_pakoda",
  "karela_bharta",
  "kofta",
  "lassi",
  "makki_di_roti_sarson_da_saag",
  "malapua",
  "mango_pickle",
  "masala_dosa",
  "masala_vada",
  "medu_vada",
  "misti_doi",
  "naan",
  "palak_paneer",
  "paneer_butter_masala",
  "pav_bhaji",
  "phirni",
  "poha",
  "qubani_ka_meetha",
  "rabri",
  "rajma",
  "ras_malai",
  "rasgulla",
  "rasmalai",
  "samosa",
  "sandwich",
  "semolina_kheer",
  "sheer_korma",
  "shrikhand",
  "sohan_papdi",
  "upma",
  "uttapam",
  "vada",
] as const;

export type DishLabel = typeof VALID_DISH_LABELS[number];

/** Human-readable label for display */
export function labelToDisplayName(label: string): string {
  return label.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Maps image dataset labels to exact nutrition dataset dish names in indian_food_nutrition.xlsx
 */
export const LABEL_TO_NUTRITION_NAME: Record<string, string> = {
  aloo_gobi: "Cauliflower, pea and potato bhujia",
  aloo_matar: "Pea potato curry (Aloo Matar)",
  aloo_methi: "Potato fenugreek (Aloo Methi)",
  aloo_shimla_mirch: "Dry potato (Sookhe aloo)",
  aloo_tikki: "Potato samosa (Aloo ka samosa)",
  bhatura: "Bhatura",
  bhindi: "Stuffed okra (Bharwa Bhindi)",
  bhindi_masala: "Okra/Lady's fingers fry (Bhindi sabzi/sabji/subji)",
  biryani: "Mutton biryani/biriyani",
  boondi: "Boondi raita",
  butter_chicken: "Butter chicken",
  chai: "Hot tea (Garam Chai)",
  chapati: "Chapati/Roti",
  chicken_tikka_masala: "Chicken curry",
  chikki: "Peanut brittle (Moongfali ki chikki)",
  chole: "Kabuli chana (Chole)",
  daal_puri: "Dal stuffed poori",
  dahi_vada: "Dahi vadas/Dahi bhalla",
  dal_makhani: "Dal makhani",
  dal_tadka: "Dal moong",
  dhokla: "Khaman dhokla",
  dum_aloo: "Dum aloo",
  gajar_ka_halwa: "Carrot halwa (Gajar ka halwa)",
  gulab_jamun: "Gulab jamun with khoya",
  idli: "Idli",
  kachori: "Khasta kachori",
  kadai_paneer: "Chilli paneer",
  kadhi_pakoda: "Besan kadhi with pakodies",
  karela_bharta: "Brinjal bhartha (Baingan ka bhartha)",
  kofta: "Gravy for kofta",
  lassi: "Sweet lassi (Meethi lassi)",
  makki_di_roti_sarson_da_saag: "Chapati/Roti",
  malapua: "Malapua",
  mango_pickle: "Mango pickle (Aam ka achaar)",
  masala_dosa: "Masala dosa",
  masala_vada: "Masala vada",
  medu_vada: "Plain urad dal vada (Uzunne vada/Minapa garelu/Ulundu vadai/Medu vada)",
  misti_doi: "Sweetened yogurt (Shrikhand)",
  naan: "Naan",
  palak_paneer: "Spinach paneer kofta curry (Palak paneer kofta curry)",
  paneer_butter_masala: "Chilli paneer",
  pav_bhaji: "Pav bhaji",
  phirni: "Phirni",
  poha: "Poha",
  qubani_ka_meetha: "Apricot fool",
  rabri: "Thickened sweetened milk (Rabri)",
  rajma: "Rajma",
  ras_malai: "Rasmalai",
  rasgulla: "Rasgulla",
  rasmalai: "Rasmalai",
  samosa: "Potato samosa (Aloo ka samosa)",
  sandwich: "Cheese and chilli sandwich",
  semolina_kheer: "Semolina kheer (Suji/Rava kheer)",
  sheer_korma: "Vermicelli kheer (Semiya/Seviyan ki kheer)",
  shrikhand: "Sweetened yogurt (Shrikhand)",
  sohan_papdi: "Papdi",
  upma: "Semolina upma (Suji/Rava upma)",
  uttapam: "Plain uthappam",
  vada: "Plain urad dal vada (Uzunne vada/Minapa garelu/Ulundu vadai/Medu vada)",
};

/**
 * Map a prediction string to the closest valid dataset label or canonical nutrition name.
 */
export function mapToDatasetLabel(prediction: string): {
  label: string;
  nutritionName: string;
  confidence: number;
} {
  const input = prediction.toLowerCase().trim().replace(/[^a-z0-9\s]/g, "");
  const inputWords = input.split(/\s+/);

  // 1. VADA & SOUTH INDIAN SAVORY FRITTERS RULES (HIGHEST PRIORITY)
  if (inputWords.some(w => ["vada", "vadai", "wada", "garelu", "medu", "vadas"].includes(w))) {
    if (inputWords.some(w => ["dahi", "bhalla", "curd"].includes(w))) {
      return {
        label: "dahi_vada",
        nutritionName: LABEL_TO_NUTRITION_NAME["dahi_vada"],
        confidence: 96,
      };
    }
    if (inputWords.some(w => ["masala", "chana", "paruppu", "crispy"].includes(w))) {
      return {
        label: "masala_vada",
        nutritionName: LABEL_TO_NUTRITION_NAME["masala_vada"],
        confidence: 95,
      };
    }
    return {
      label: "medu_vada",
      nutritionName: LABEL_TO_NUTRITION_NAME["medu_vada"],
      confidence: 95,
    };
  }

  // 2. BIRYANI DISAMBIGUATION
  if (inputWords.some(w => ["biryani", "biriyani", "biriani", "pulao", "pilaf"].includes(w))) {
    const hasMeat = inputWords.some(w =>
      ["mutton", "chicken", "meat", "lamb", "egg", "non-veg", "nonveg", "gosht"].includes(w)
    );
    if (hasMeat) {
      return {
        label: "biryani",
        nutritionName: "Mutton biryani/biriyani",
        confidence: 95,
      };
    }
    const hasVeg = inputWords.some(w =>
      ["vegetable", "veg", "mixed", "sabzi"].includes(w)
    );
    if (hasVeg) {
      return {
        label: "biryani",
        nutritionName: "Vegetable biryani",
        confidence: 95,
      };
    }
    return {
      label: "biryani",
      nutritionName: "Mutton biryani/biriyani",
      confidence: 85,
    };
  }

  // 3. IDLI & DOSA & SOUTH INDIAN BREAKFAST
  if (inputWords.some(w => ["idli", "idly", "thatte"].includes(w))) {
    return {
      label: "idli",
      nutritionName: LABEL_TO_NUTRITION_NAME["idli"],
      confidence: 95,
    };
  }

  if (inputWords.some(w => ["dosa", "dosai", "masala dosa"].includes(w))) {
    return {
      label: "masala_dosa",
      nutritionName: LABEL_TO_NUTRITION_NAME["masala_dosa"],
      confidence: 95,
    };
  }

  // 4. Exact dictionary key match
  const underscoreKey = input.replace(/\s+/g, "_");
  if (LABEL_TO_NUTRITION_NAME[underscoreKey]) {
    return {
      label: underscoreKey,
      nutritionName: LABEL_TO_NUTRITION_NAME[underscoreKey],
      confidence: 95,
    };
  }

  // 5. Score each label by word overlap
  let bestLabel: string = VALID_DISH_LABELS[0];
  let bestScore = 0;

  for (const label of VALID_DISH_LABELS) {
    const labelWords = label.replace(/_/g, " ").split(/\s+/);
    let overlap = 0;
    for (const lw of labelWords) {
      if (inputWords.some(iw => iw === lw || iw.includes(lw) || lw.includes(iw))) {
        overlap++;
      }
    }
    const score = labelWords.length > 0 ? (overlap / labelWords.length) * 100 : 0;
    if (score > bestScore) {
      bestScore = score;
      bestLabel = label;
    }
  }

  // If match is found with reasonable confidence
  if (bestScore >= 35) {
    return {
      label: bestLabel,
      nutritionName: LABEL_TO_NUTRITION_NAME[bestLabel] || labelToDisplayName(bestLabel),
      confidence: Math.min(Math.round(bestScore), 100),
    };
  }

  // 6. Direct fallback: return prediction itself for the TF-IDF engine to match directly against all 1,000+ dishes
  return {
    label: input.replace(/\s+/g, "_"),
    nutritionName: prediction.trim(),
    confidence: 70,
  };
}
