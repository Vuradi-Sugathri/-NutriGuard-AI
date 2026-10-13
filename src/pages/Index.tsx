import React, { useState, useCallback, useEffect, useMemo } from "react";
import { ImageUpload, urlToBase64 } from "@/components/ImageUpload";
import { PortionSelector } from "@/components/PortionSelector";
import { ConditionSelector } from "@/components/ConditionSelector";
import { RiskGauge } from "@/components/RiskGauge";
import { NutritionTable } from "@/components/NutritionTable";
import { RiskBars } from "@/components/RiskBars";
import { AlternativeCards } from "@/components/AlternativeCards";
import { IngredientList } from "@/components/IngredientList";
import { VisualizationSection } from "@/components/VisualizationSection";
import { DietPlannerModal } from "@/components/DietPlannerModal";
import { SampleDishSelector } from "@/components/SampleDishSelector";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAnalysis } from "@/hooks/useAnalysis";
import { MedicalCondition, PortionSize, PORTION_SIZES, NutritionData } from "@/lib/types";
import { SampleDish, getFallbackIngredients, generateOfflineExplanation } from "@/lib/mockDishes";
import { calculateConditionScores, calculateOverallRisk, classify } from "@/lib/riskEngine";
import { findSmartAlternatives } from "@/lib/alternativesEngine";
import { loadDataset, adjustNutrition } from "@/lib/dataset";
import {
  Loader2,
  ShieldCheck,
  AlertTriangle,
  Info,
  Salad,
  BarChart2,
  ClipboardList,
  Sparkles,
  Zap,
  Edit3,
  Search,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(null);
  const [dishHint, setDishHint] = useState<string | undefined>(undefined);
  const [portion, setPortion] = useState<PortionSize>(PORTION_SIZES[1]);
  const [selectedConditions, setSelectedConditions] = useState<MedicalCondition[]>([]);
  const [showDietPlanner, setShowDietPlanner] = useState(false);
  const [dataset, setDataset] = useState<NutritionData[]>([]);
  const [activeTab, setActiveTab] = useState("analysis");

  // Manual dish correction / override state
  const [isEditingDish, setIsEditingDish] = useState(false);
  const [dishSearchQuery, setDishSearchQuery] = useState("");

  const { analyze, recalculate, isLoading, result, error, setResult } = useAnalysis();
  const { toast } = useToast();

  // Pre-load dataset on mount so that it's immediately ready for Diet Planner and TF-IDF
  useEffect(() => {
    loadDataset().then((data) => {
      setDataset(data);
    });
  }, []);

  const handleImageSelected = useCallback((base64: string, preview: string) => {
    setImageBase64(base64);
    setImagePreview(preview);
    setSelectedSampleId(null);
    setDishHint(undefined);
  }, []);

  const handleClearImage = useCallback(() => {
    setImageBase64(null);
    setImagePreview(null);
    setSelectedSampleId(null);
    setDishHint(undefined);
    setResult(null);
  }, [setResult]);

  const handleSelectSampleDish = useCallback(
    async (sample: SampleDish) => {
      setSelectedSampleId(sample.id);
      setDishHint(sample.label);
      try {
        const { base64, preview } = await urlToBase64(sample.image);
        setImageBase64(base64);
        setImagePreview(preview);
        toast({
          title: `Loaded ${sample.name}`,
          description: `Click 'Analyze Dish' to run complete nutritional & risk evaluation.`,
        });
      } catch (e) {
        console.error("Failed to load sample image:", e);
        toast({
          title: "Image loading error",
          description: "Could not read sample dish image.",
          variant: "destructive",
        });
      }
    },
    [toast]
  );

  // Reactive instant condition toggling without API re-fetch
  const toggleCondition = useCallback(
    (condition: MedicalCondition) => {
      setSelectedConditions((prev) => {
        const next = prev.includes(condition)
          ? prev.filter((c) => c !== condition)
          : [...prev, condition];

        if (result) {
          recalculate(next, portion, dataset, result);
        }
        return next;
      });
    },
    [result, portion, dataset, recalculate]
  );

  // Reactive instant portion size scaling without API re-fetch
  const handlePortionSelect = useCallback(
    (newPortion: PortionSize) => {
      setPortion(newPortion);
      if (result) {
        recalculate(selectedConditions, newPortion, dataset, result);
      }
    },
    [result, selectedConditions, dataset, recalculate]
  );

  const handleAnalyze = useCallback(async () => {
    if (!imageBase64) {
      toast({
        title: "Please choose an image",
        description: "Upload your own dish photo or choose one of the sample dishes below.",
        variant: "destructive",
      });
      return;
    }
    setActiveTab("analysis");
    await analyze(imageBase64, selectedConditions, portion, dishHint);
  }, [imageBase64, selectedConditions, portion, dishHint, analyze, toast]);

  const handleOpenDietPlanner = useCallback(() => {
    if (!result) return;
    setShowDietPlanner(true);
  }, [result]);

  // Search filter for manual dish selection
  const filteredDishes = useMemo(() => {
    const q = dishSearchQuery.toLowerCase().trim();
    if (!q || dataset.length === 0) return [];
    return dataset.filter((d) => d.dishName.toLowerCase().includes(q));
  }, [dishSearchQuery, dataset]);

  const handleManualDishSelect = useCallback(
    (selectedDishRow: NutritionData) => {
      if (!result) return;
      setIsEditingDish(false);
      setDishSearchQuery("");

      const adjustedNutrition = adjustNutrition(selectedDishRow, portion.multiplier);
      const conditionScores = calculateConditionScores(adjustedNutrition, selectedConditions);
      const overallRisk = calculateOverallRisk(conditionScores);
      const classification = classify(overallRisk);
      const alternatives = findSmartAlternatives(
        selectedDishRow,
        dataset,
        selectedConditions,
        portion.multiplier,
        3
      );
      const explanation = generateOfflineExplanation({
        dish_name: selectedDishRow.dishName,
        nutrition: adjustedNutrition,
        condition_scores: conditionScores,
        overall_risk: overallRisk,
        classification,
        portion: portion.label,
      });

      setResult({
        ...result,
        matchedDish: selectedDishRow.dishName,
        similarityScore: 100,
        rawNutrition: selectedDishRow,
        adjustedNutrition,
        selectedConditionScores: conditionScores,
        overallRisk,
        classification,
        alternatives,
        explanation,
        ingredients: getFallbackIngredients(selectedDishRow.dishName),
      });

      toast({
        title: "Dish updated",
        description: `Now analyzing: ${selectedDishRow.dishName}`,
      });
    },
    [result, portion, selectedConditions, dataset, setResult, toast]
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <ShieldCheck className="w-6 h-6 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold font-display text-foreground leading-tight">
                  NutriGuard AI
                </h1>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
                  XAI Nutrition System
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Indian Dish Recognition & Clinical Risk Assessment
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden md:inline">
              {dataset.length > 0 ? `Database: ${dataset.length} Dishes` : "Loading Dataset..."}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* 1. Input Section */}
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <ImageUpload
              onImageSelected={handleImageSelected}
              isLoading={isLoading}
              externalPreview={imagePreview}
              onClear={handleClearImage}
            />
            {/* Quick Test Sample Dishes Gallery */}
            <SampleDishSelector
              onSelectDish={handleSelectSampleDish}
              isLoading={isLoading}
              selectedId={selectedSampleId}
            />
          </div>

          <div className="space-y-5">
            <ConditionSelector selected={selectedConditions} onToggle={toggleCondition} />
            <PortionSelector selected={portion} onSelect={handlePortionSelect} />

            <button
              onClick={handleAnalyze}
              disabled={isLoading || !imageBase64}
              className="w-full py-3.5 rounded-lg font-semibold text-sm transition-all duration-200 bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing Dish & Computing Risk…
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  Analyze Dish
                </>
              )}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-5 animate-fade-in">
            {/* 2. Dish Recognition Header with Human-in-the-Loop Override */}
            <div className="rounded-lg border border-border bg-card p-5">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">
                      Matched Dish
                    </p>
                    {result.isOfflineDemo && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                        <Sparkles className="w-3 h-3" />
                        Offline Intelligence Mode
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-bold font-display text-foreground mt-0.5">
                      {result.matchedDish}
                    </h2>
                    <button
                      type="button"
                      onClick={() => setIsEditingDish((prev) => !prev)}
                      className="text-xs text-primary hover:underline inline-flex items-center gap-1 font-medium px-2 py-0.5 rounded bg-primary/10 transition-colors"
                      title="Manually correct or select a different dish"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>{isEditingDish ? "Close" : "Not this dish? Change"}</span>
                    </button>
                  </div>

                  {/* Manual Dish Search Dropdown */}
                  {isEditingDish && (
                    <div className="mt-3 p-3 rounded-lg border border-border bg-muted/40 space-y-2 max-w-md animate-fade-in">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                        <input
                          type="text"
                          placeholder="Search dish (e.g. Medu Vada, Masala Vada, Dosa, Idli)..."
                          value={dishSearchQuery}
                          onChange={(e) => setDishSearchQuery(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                          autoFocus
                        />
                      </div>

                      {dishSearchQuery.trim().length > 1 && (
                        <div className="max-h-48 overflow-y-auto rounded-md border border-border bg-card shadow-lg divide-y divide-border">
                          {filteredDishes.length === 0 ? (
                            <p className="p-2.5 text-xs text-muted-foreground text-center">
                              No dishes found matching "{dishSearchQuery}"
                            </p>
                          ) : (
                            filteredDishes.slice(0, 10).map((d) => (
                              <button
                                key={d.dishName}
                                type="button"
                                onClick={() => handleManualDishSelect(d)}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-accent flex justify-between items-center transition-colors"
                              >
                                <span className="font-medium text-foreground truncate mr-2">
                                  {d.dishName}
                                </span>
                                <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
                                  {d.category || "Dish"} · {d.calories.toFixed(0)} kcal
                                </span>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="text-right shrink-0">
                  <p className="text-xs text-muted-foreground">Match Confidence</p>
                  <p className="text-lg font-bold text-primary tabular-nums">
                    {result.similarityScore}%
                  </p>
                </div>
              </div>
            </div>

            {/* Detected Ingredients with deterministic risk highlighting */}
            {result.ingredients.length > 0 && (
              <div className="rounded-lg border border-border bg-card p-5">
                <IngredientList ingredients={result.ingredients} />
              </div>
            )}

            {/* 3. Tab Navigation */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="w-full grid grid-cols-3 h-auto p-1">
                <TabsTrigger value="analysis" className="flex items-center gap-1.5 py-2 text-xs sm:text-sm">
                  <ClipboardList className="w-3.5 h-3.5" />
                  Analysis
                </TabsTrigger>
                <TabsTrigger value="visuals" className="flex items-center gap-1.5 py-2 text-xs sm:text-sm">
                  <BarChart2 className="w-3.5 h-3.5" />
                  Visual Insights
                </TabsTrigger>
                <TabsTrigger value="diet" className="flex items-center gap-1.5 py-2 text-xs sm:text-sm">
                  <Salad className="w-3.5 h-3.5" />
                  Diet Planner
                </TabsTrigger>
              </TabsList>

              {/* ─── TAB 1: Analysis ─── */}
              <TabsContent value="analysis" className="space-y-5 mt-4">
                {/* Gauge + Nutrition */}
                <div className="grid lg:grid-cols-3 gap-5">
                  <div className="flex justify-center items-start pt-4 rounded-lg border border-border bg-card p-5">
                    <RiskGauge
                      score={result.overallRisk}
                      classification={result.classification}
                    />
                  </div>
                  <div className="lg:col-span-2">
                    <NutritionTable nutrition={result.adjustedNutrition} />
                  </div>
                </div>

                {/* Condition Risk Bars */}
                {result.selectedConditionScores.length > 0 && (
                  <div className="rounded-lg border border-border bg-card p-5">
                    <RiskBars scores={result.selectedConditionScores} />
                  </div>
                )}

                {/* Alternatives */}
                <div className="rounded-lg border border-border bg-card p-5">
                  {result.alternatives.length > 0 ? (
                    <AlternativeCards alternatives={result.alternatives} />
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Info className="w-4 h-4 shrink-0" />
                      <p>
                        No healthier alternatives found in this specific category. Consider fresh salads,
                        buttermilk, or steamed options.
                      </p>
                    </div>
                  )}
                </div>

                {/* Explainable AI Health Assessment */}
                {result.explanation && (
                  <div className="rounded-lg border border-border bg-card p-5 space-y-3">
                    <h3 className="text-sm font-semibold text-foreground font-display flex items-center gap-2">
                      <Info className="w-4 h-4 text-primary" />
                      Explainable AI (XAI) Health Assessment
                    </h3>
                    <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                      {result.explanation}
                    </div>
                  </div>
                )}

                {/* Disclaimer */}
                <div className="rounded-lg bg-muted/50 border border-border p-4 text-xs text-muted-foreground">
                  <p className="font-semibold mb-1">⚕️ Medical Disclaimer</p>
                  <p>
                    NutriGuard AI is an academic research clinical decision-support tool based on
                    ICMR-NIN and WHO dietary reference guidelines. It is not intended to replace
                    professional medical diagnosis. Consult a registered dietitian for personalized clinical plans.
                  </p>
                </div>
              </TabsContent>

              {/* ─── TAB 2: Visual Insights ─── */}
              <TabsContent value="visuals" className="space-y-5 mt-4">
                <div className="rounded-lg border border-border bg-card p-5">
                  <VisualizationSection
                    conditionScores={result.selectedConditionScores}
                    nutrition={result.adjustedNutrition}
                  />
                </div>
              </TabsContent>

              {/* ─── TAB 3: Diet Planner ─── */}
              <TabsContent value="diet" className="space-y-5 mt-4">
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground font-display flex items-center gap-2">
                      <Salad className="w-4 h-4 text-primary" />
                      Personalised 1-Day Diet Plan
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Generates a balanced meal plan tailored to your BMR, TDEE, health conditions, and
                      calorie targets using Indian dishes from the verified dataset.
                    </p>
                  </div>
                  <button
                    onClick={handleOpenDietPlanner}
                    className="shrink-0 px-5 py-2.5 rounded-lg font-semibold text-sm bg-primary text-primary-foreground hover:opacity-90 transition-all flex items-center gap-2 shadow-sm"
                  >
                    <Salad className="w-4 h-4" />
                    Open Diet Planner
                  </button>
                </div>

                <div className="rounded-lg bg-muted/50 border border-border p-4 text-xs text-muted-foreground">
                  <p className="font-semibold mb-1">⚕️ Clinical Note</p>
                  <p>
                    Meal plans adhere to balanced macronutrient distribution (25% Breakfast, 40% Lunch,
                    25% Dinner, 10% Snacks) and clinical avoidance rules for multi-morbid conditions.
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </main>

      {/* Diet Planner Modal */}
      {showDietPlanner && result && (
        <DietPlannerModal
          onClose={() => setShowDietPlanner(false)}
          dataset={dataset}
          conditions={selectedConditions}
          originalNutrition={result.adjustedNutrition}
        />
      )}
    </div>
  );
};

export default Index;
