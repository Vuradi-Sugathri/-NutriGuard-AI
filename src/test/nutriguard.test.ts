import { describe, it, expect } from "vitest";
import { calcBMI, getBMICategory, calcBMR, calcTDEE, calcCalorieTarget } from "@/lib/dietPlanner";
import { calculateConditionScores, calculateOverallRisk, classify } from "@/lib/riskEngine";
import { adjustNutrition } from "@/lib/dataset";
import { NutritionData } from "@/lib/types";

describe("NutriGuard Clinical & Mathematical Engine", () => {
  describe("BMI & Metabolic Calculations (Mifflin-St Jeor)", () => {
    it("should accurately compute BMI and standard categories", () => {
      const normalBMI = calcBMI(70, 175);
      expect(normalBMI).toBe(22.9);
      expect(getBMICategory(normalBMI)).toBe("Normal");

      const overweightBMI = calcBMI(85, 170);
      expect(overweightBMI).toBe(29.4);
      expect(getBMICategory(overweightBMI)).toBe("Overweight");

      const obeseBMI = calcBMI(100, 170);
      expect(obeseBMI).toBe(34.6);
      expect(getBMICategory(obeseBMI)).toBe("Obese");
    });

    it("should accurately calculate BMR using Mifflin-St Jeor equation", () => {
      // Male, 70kg, 175cm, 25 years: 10(70) + 6.25(175) - 5(25) + 5 = 700 + 1093.75 - 125 + 5 = 1673.75
      const maleBmr = calcBMR({
        age: 25,
        gender: "male",
        heightCm: 175,
        weightKg: 70,
        activityLevel: "moderate",
        goal: "maintain",
      });
      expect(maleBmr).toBe(1673.75);

      // Female, 60kg, 160cm, 30 years: 10(60) + 6.25(160) - 5(30) - 161 = 600 + 1000 - 150 - 161 = 1289
      const femaleBmr = calcBMR({
        age: 30,
        gender: "female",
        heightCm: 160,
        weightKg: 60,
        activityLevel: "light",
        goal: "maintain",
      });
      expect(femaleBmr).toBe(1289);
    });

    it("should calculate correct TDEE based on physical activity multipliers", () => {
      const bmr = 1500;
      expect(calcTDEE(bmr, "sedentary")).toBe(1800);
      expect(calcTDEE(bmr, "light")).toBe(2062.5);
      expect(calcTDEE(bmr, "moderate")).toBe(2325);
      expect(calcTDEE(bmr, "active")).toBe(2587.5);
    });

    it("should apply correct calorie goals (-500 kcal for loss, +300 kcal for gain)", () => {
      const tdee = 2200;
      expect(calcCalorieTarget(tdee, "loss")).toBe(1700);
      expect(calcCalorieTarget(tdee, "maintain")).toBe(2200);
      expect(calcCalorieTarget(tdee, "gain")).toBe(2500);
    });
  });

  describe("Clinical Health Risk Scoring Engine", () => {
    const mockHighSodiumDish: NutritionData = {
      dishName: "High Sodium Dish",
      calories: 350,
      carbohydrates: 45,
      protein: 10,
      totalFat: 15,
      freeSugar: 2,
      fibre: 3,
      sodium: 900, // Very high sodium (>600mg threshold)
      calcium: 50,
      iron: 2,
      vitaminC: 5,
      folate: 20,
      category: "Main Course",
      mealType: "Lunch",
      isMealItem: true,
      healthTag: "Moderate",
      processingLevel: "Processed",
      riskLevelDefault: 6,
      foodCategory: "Staple",
    };

    it("should flag high sodium food with elevated Hypertension risk", () => {
      const scores = calculateConditionScores(mockHighSodiumDish, ["Hypertension"]);
      expect(scores[0].condition).toBe("Hypertension");
      expect(scores[0].score).toBeGreaterThanOrEqual(7); // Score is high
    });

    it("should correctly classify overall risk into SAFE, MODERATE, or AVOID", () => {
      expect(classify(2.5)).toBe("SAFE");
      expect(classify(5.0)).toBe("MODERATE");
      expect(classify(7.8)).toBe("AVOID");
    });
  });

  describe("Portion Scaling Engine", () => {
    const baseDish: NutritionData = {
      dishName: "Dal",
      calories: 200,
      carbohydrates: 30,
      protein: 10,
      totalFat: 5,
      freeSugar: 0,
      fibre: 6,
      sodium: 300,
      calcium: 40,
      iron: 3,
      vitaminC: 4,
      folate: 50,
      category: "Main Course",
      mealType: "Lunch",
      isMealItem: true,
      healthTag: "Healthy",
      processingLevel: "Cooked",
      riskLevelDefault: 2,
      foodCategory: "Protein",
    };

    it("should scale all nutrients accurately with portion multipliers", () => {
      const large = adjustNutrition(baseDish, 1.5);
      expect(large.calories).toBe(300);
      expect(large.carbohydrates).toBe(45);
      expect(large.protein).toBe(15);
      expect(large.sodium).toBe(450);

      const small = adjustNutrition(baseDish, 0.75);
      expect(small.calories).toBe(150);
      expect(small.protein).toBe(7.5);
    });
  });
});
