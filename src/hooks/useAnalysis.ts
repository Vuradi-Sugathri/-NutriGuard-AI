import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { loadDataset, adjustNutrition } from "@/lib/dataset";
import { findBestMatch, buildTFIDFIndex } from "@/lib/tfidf";
import { calculateConditionScores, calculateOverallRisk, classify } from "@/lib/riskEngine";
import { mapToDatasetLabel } from "@/lib/dishLabelMap";
import {
  AnalysisResult,
  GeminiVisionResult,
  MedicalCondition,
  NutritionData,
  PortionSize,
} from "@/lib/types";
import { findSmartAlternatives } from "@/lib/alternativesEngine";
import { getFallbackIngredients, generateOfflineExplanation, SAMPLE_DISHES } from "@/lib/mockDishes";

async function callDirectGemini(imageBase64: string, apiKey: string): Promise<GeminiVisionResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: `You are an Indian food nutrition expert. Identify this Indian dish and return strictly JSON format:
{"dish_name": "label_in_underscore", "ingredients": ["item1", "item2"], "alternatives": ["alt1", "alt2"]}
Choose dish_name only from: aloo_gobi, aloo_matar, aloo_methi, aloo_shimla_mirch, aloo_tikki, bhatura, bhindi, biryani, boondi, butter_chicken, chapati, chicken_tikka_masala, chikki, chole, daal_puri, dahi_vada, dal_makhani, dal_tadka, dhokla, dum_aloo, gajar_ka_halwa, gulab_jamun, idli, kachori, kadai_paneer, kadhi_pakoda, karela_bharta, kofta, lassi, makki_di_roti_sarson_da_saag, malapua, mango_pickle, masala_dosa, masala_vada, medu_vada, misti_doi, naan, palak_paneer, paneer_butter_masala, pav_bhaji, phirni, poha, rabri, rajma, rasgulla, rasmalai, samosa, sandwich, semolina_kheer, shrikhand, sohan_papdi, upma, uttapam, vada.
RULES:
- Fried golden-brown doughnut/ring-shaped savory fritter with a central hole → "medu_vada" or "vada" (NEVER identify as idli).
- Steamed white spongy round cake → "idli".
- Thin golden crepe, rolled or folded → "masala_dosa".`,
            },
            {
              inline_data: {
                mime_type: "image/jpeg",
                data: imageBase64,
              },
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Direct Gemini API error: ${response.status}`);
  }

  const json = await response.json();
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Failed to parse Gemini JSON output");
  return JSON.parse(match[0]);
}

export function useAnalysis() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Instant local recalculation without re-invoking the Vision API.
   * Call whenever portion size or conditions are toggled!
   */
  const recalculate = useCallback(
    async (
      selectedConditions: MedicalCondition[],
      portion: PortionSize,
      datasetParam?: NutritionData[],
      baseResult?: AnalysisResult | null
    ) => {
      const target = baseResult || result;
      if (!target || !target.rawNutrition) return;

      const dataset = datasetParam && datasetParam.length > 0 ? datasetParam : await loadDataset();
      const rawNutrition = target.rawNutrition;

      const adjustedNutrition = adjustNutrition(rawNutrition, portion.multiplier);
      const conditionScores = calculateConditionScores(adjustedNutrition, selectedConditions);
      const overallRisk = calculateOverallRisk(conditionScores);
      const classification = classify(overallRisk);

      const alternatives = findSmartAlternatives(
        rawNutrition,
        dataset,
        selectedConditions,
        portion.multiplier,
        3
      );

      // Re-generate local explanation to immediately match the new portion and conditions
      const newExplanation = generateOfflineExplanation({
        dish_name: target.matchedDish,
        nutrition: adjustedNutrition,
        condition_scores: conditionScores,
        overall_risk: overallRisk,
        classification,
        portion: portion.label,
      });

      const updated: AnalysisResult = {
        ...target,
        adjustedNutrition,
        selectedConditionScores: conditionScores,
        overallRisk,
        classification,
        alternatives,
        explanation: newExplanation,
      };

      setResult(updated);
      return updated;
    },
    [result]
  );

  const analyze = useCallback(
    async (
      imageBase64: string,
      selectedConditions: MedicalCondition[],
      portion: PortionSize,
      dishHint?: string
    ) => {
      setIsLoading(true);
      setError(null);

      try {
        let vision: GeminiVisionResult | null = null;
        let isOfflineDemo = false;

        // Try Stage 1.1: Direct Gemini API if configured
        const directKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (directKey && directKey.trim().length > 10) {
          try {
            console.log("[NutriGuard] Attempting direct Gemini Vision API...");
            vision = await callDirectGemini(imageBase64, directKey);
          } catch (directErr) {
            console.warn("[NutriGuard] Direct Gemini call failed, falling back to Supabase:", directErr);
          }
        }

        // Try Stage 1.2: Supabase Edge Function
        if (!vision) {
          try {
            console.log("[NutriGuard] Calling Supabase Edge Function 'analyze-dish'...");
            const { data: visionData, error: visionError } = await supabase.functions.invoke(
              "analyze-dish",
              { body: { image_base64: imageBase64, action: "identify" } }
            );

            if (visionError) throw visionError;
            if (visionData?.error) throw new Error(visionData.error);
            if (visionData?.dish_name) {
              vision = visionData;
            }
          } catch (sbErr) {
            console.warn("[NutriGuard] Supabase Edge Function unavailable:", sbErr);
          }
        }

        // Stage 1.3: Intelligent Offline Fallback
        if (!vision) {
          console.log("[NutriGuard] Operating in Offline Demo Fallback mode");
          isOfflineDemo = true;

          // Check if dishHint matches known sample dishes
          const matchedSample = dishHint
            ? SAMPLE_DISHES.find(s => s.id === dishHint || s.label === dishHint || s.name.toLowerCase() === dishHint.toLowerCase())
            : null;

          const chosenLabel = matchedSample ? matchedSample.label : (dishHint || "samosa");
          const chosenIngredients = matchedSample
            ? matchedSample.ingredients
            : getFallbackIngredients(chosenLabel);

          vision = {
            dish_name: chosenLabel,
            ingredients: chosenIngredients,
            alternatives: ["idli", "poha", "dal_tadka"],
          };
        }

        // Stage 1.5: Map Gemini prediction to standard dataset label
        const mapped = mapToDatasetLabel(vision.dish_name);
        console.log(
          `[NutriGuard] Predicted: ${vision.dish_name} → Label: ${mapped.label} → Nutrition Key: ${mapped.nutritionName} (Conf: ${mapped.confidence}%)`
        );

        // Stage 2 & 3: Dataset + TF-IDF Matching
        const dataset = await loadDataset();
        buildTFIDFIndex(dataset);

        const match = findBestMatch(mapped.nutritionName, dataset);
        const rawNutrition = dataset[match.index] || dataset[0];

        // Stage 4: Portion adjustment
        const adjustedNutrition = adjustNutrition(rawNutrition, portion.multiplier);

        // Stage 5 & 6: Risk scoring & Overall classification
        const conditionScores = calculateConditionScores(adjustedNutrition, selectedConditions);
        const overallRisk = calculateOverallRisk(conditionScores);
        const classification = classify(overallRisk);

        // Stage 7: Smart Alternatives
        const alternatives = findSmartAlternatives(
          rawNutrition,
          dataset,
          selectedConditions,
          portion.multiplier,
          3
        );

        // Stage 8: Health Explanation
        let explanation = "";
        if (selectedConditions.length > 0 && !isOfflineDemo) {
          try {
            const { data: explData } = await supabase.functions.invoke("analyze-dish", {
              body: {
                action: "explain",
                context: {
                  dish_name: match.dishName,
                  nutrition: adjustedNutrition,
                  condition_scores: conditionScores,
                  overall_risk: overallRisk,
                  classification,
                  portion: portion.label,
                },
              },
            });
            explanation = explData?.explanation || "";
          } catch {
            explanation = "";
          }
        }

        // Fallback explanation if remote call was empty or offline
        if (!explanation) {
          explanation = generateOfflineExplanation({
            dish_name: match.dishName,
            nutrition: adjustedNutrition,
            condition_scores: conditionScores,
            overall_risk: overallRisk,
            classification,
            portion: portion.label,
          });
        }

        const finalResult: AnalysisResult = {
          matchedDish: match.dishName,
          similarityScore: match.similarity,
          adjustedNutrition,
          rawNutrition,
          selectedConditionScores: conditionScores,
          overallRisk,
          classification,
          explanation,
          alternatives,
          ingredients: vision.ingredients || [],
          isOfflineDemo,
        };

        setResult(finalResult);
        return finalResult;
      } catch (err: any) {
        console.error("[NutriGuard] Analysis Error:", err);
        setError(err.message || "Dish analysis encountered an error.");
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return { analyze, recalculate, isLoading, result, error, setResult };
}
