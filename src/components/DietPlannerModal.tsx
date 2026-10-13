import React, { useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceDot, BarChart, Bar, Legend,
  PieChart, Pie, Cell,
} from "recharts";
import {
  UserProfile, DietPlanResult, generateDietPlan,
  calcBMI, getBMICategory, suggestGoalFromBMI,
} from "@/lib/dietPlanner";
import { NutritionData, MedicalCondition } from "@/lib/types";
import { X, ChevronRight, Salad, TrendingDown, TrendingUp, Minus, Activity, AlertCircle, Printer } from "lucide-react";

interface DietPlannerModalProps {
  onClose: () => void;
  dataset: NutritionData[];
  conditions: MedicalCondition[];
  originalNutrition: NutritionData;
}

const FIELD_CLASS =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const LABEL_CLASS = "block text-xs font-medium text-muted-foreground mb-1";

const DEFAULT_PROFILE: UserProfile = {
  age: 30, gender: "male", heightCm: 170, weightKg: 70,
  activityLevel: "moderate", goal: "maintain",
};

interface ValidationErrors { age?: string; heightCm?: string; weightKg?: string; }

function validate(profile: UserProfile): ValidationErrors {
  const errors: ValidationErrors = {};
  if (profile.age < 10 || profile.age > 120) errors.age = "Age must be 10–120";
  if (profile.heightCm < 100 || profile.heightCm > 250) errors.heightCm = "Height must be 100–250 cm";
  if (profile.weightKg < 20 || profile.weightKg > 300) errors.weightKg = "Weight must be 20–300 kg";
  return errors;
}

const MealSlot: React.FC<{ label: string; entries: DietPlanResult["meal_plan"]["breakfast"]; targetPct: number; calorieTarget: number }> = ({
  label, entries, targetPct, calorieTarget,
}) => {
  const totalCal = entries.reduce((s, e) => s + e.calories, 0);
  const actualPct = calorieTarget > 0 ? Math.round((totalCal / calorieTarget) * 100) : 0;
  return (
  <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
    <div className="flex justify-between items-center">
      <span className="text-xs font-semibold text-foreground">{label}</span>
      <span className="text-xs text-muted-foreground tabular-nums">
        {totalCal.toFixed(0)} kcal · {actualPct}% / {targetPct}% target
      </span>
    </div>
    {entries.length === 0 ? (
      <p className="text-xs text-muted-foreground italic">No suitable dishes found.</p>
    ) : (
      entries.map((e) => (
        <div key={e.dishName} className="flex justify-between text-xs">
          <span className="text-foreground">{e.dishName}</span>
          <span className="text-muted-foreground tabular-nums">{e.calories.toFixed(0)} kcal</span>
        </div>
      ))
    )}
  </div>
  );
};

const BMI_COLORS: Record<string, string> = {
  Underweight: "hsl(217, 91%, 60%)",
  Normal: "hsl(142, 71%, 45%)",
  Overweight: "hsl(25, 95%, 53%)",
  Obese: "hsl(0, 84%, 60%)",
};

const RISK_BAR_COLOR = (score: number) => {
  if (score >= 7) return "hsl(0, 84%, 60%)";
  if (score >= 4) return "hsl(25, 95%, 53%)";
  return "hsl(142, 71%, 45%)";
};

const CALORIE_PIE_COLORS = [
  "hsl(217, 91%, 60%)", "hsl(142, 71%, 45%)",
  "hsl(25, 95%, 53%)", "hsl(48, 96%, 53%)",
];

export const DietPlannerModal: React.FC<DietPlannerModalProps> = ({
  onClose, dataset, conditions, originalNutrition,
}) => {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [plan, setPlan] = useState<DietPlanResult | null>(null);
  const [generating, setGenerating] = useState(false);

  const set = <K extends keyof UserProfile>(key: K, value: UserProfile[K]) =>
    setProfile((p) => ({ ...p, [key]: value }));

  const liveBMI = calcBMI(profile.weightKg, profile.heightCm);
  const liveBMICategory = getBMICategory(liveBMI);
  const goalSuggestion = suggestGoalFromBMI(liveBMI);

  const handleGenerate = () => {
    const errs = validate(profile);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setGenerating(true);
    setTimeout(() => {
      const result = generateDietPlan(profile, dataset, conditions, originalNutrition);
      setPlan(result);
      setGenerating(false);
    }, 50);
  };

  const goalIcon = profile.goal === "loss" ? <TrendingDown className="w-4 h-4 text-destructive" />
    : profile.goal === "gain" ? <TrendingUp className="w-4 h-4 text-primary" />
    : <Minus className="w-4 h-4 text-muted-foreground" />;

  // Calorie distribution pie data
  const calDistData = plan ? [
    { name: "Breakfast (25%)", value: 25 },
    { name: "Lunch (40%)", value: 40 },
    { name: "Dinner (25%)", value: 25 },
    { name: "Snacks (10%)", value: 10 },
  ] : [];


  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl my-8 rounded-xl border border-border bg-card shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <Salad className="w-5 h-5 text-primary" />
            <h2 className="text-base font-bold font-display text-foreground">Personalised Diet Planner</h2>
          </div>
          <div className="flex items-center gap-2">
            {plan && (
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary transition-all"
                title="Print or Save as PDF"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Export PDF</span>
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-full hover:bg-muted transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* User Profile Form */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLASS}>Age (years)</label>
              <input type="number" className={FIELD_CLASS} value={profile.age} min={10} max={120} onChange={(e) => set("age", +e.target.value)} />
              {errors.age && <p className="text-xs text-destructive mt-1">{errors.age}</p>}
            </div>
            <div>
              <label className={LABEL_CLASS}>Gender</label>
              <select className={FIELD_CLASS} value={profile.gender} onChange={(e) => set("gender", e.target.value as UserProfile["gender"])}>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
            <div>
              <label className={LABEL_CLASS}>Height (cm)</label>
              <input type="number" className={FIELD_CLASS} value={profile.heightCm} min={100} max={250} onChange={(e) => set("heightCm", +e.target.value)} />
              {errors.heightCm && <p className="text-xs text-destructive mt-1">{errors.heightCm}</p>}
            </div>
            <div>
              <label className={LABEL_CLASS}>Weight (kg)</label>
              <input type="number" className={FIELD_CLASS} value={profile.weightKg} min={20} max={300} onChange={(e) => set("weightKg", +e.target.value)} />
              {errors.weightKg && <p className="text-xs text-destructive mt-1">{errors.weightKg}</p>}
            </div>
            <div>
              <label className={LABEL_CLASS}>Activity Level</label>
              <select className={FIELD_CLASS} value={profile.activityLevel} onChange={(e) => set("activityLevel", e.target.value as UserProfile["activityLevel"])}>
                <option value="sedentary">Sedentary (×1.2)</option>
                <option value="light">Light (×1.375)</option>
                <option value="moderate">Moderate (×1.55)</option>
                <option value="active">Active (×1.725)</option>
              </select>
            </div>
            <div>
              <label className={LABEL_CLASS}>Goal</label>
              <select className={FIELD_CLASS} value={profile.goal} onChange={(e) => set("goal", e.target.value as UserProfile["goal"])}>
                <option value="loss">Weight Loss (−500 kcal)</option>
                <option value="maintain">Maintain Weight</option>
                <option value="gain">Weight Gain (+300 kcal)</option>
              </select>
            </div>
          </div>

          {/* BMI Display */}
          <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
            <Activity className="w-5 h-5 text-primary" />
            <div className="flex-1">
              <p className="text-sm text-foreground font-medium">
                BMI: <span className="tabular-nums font-bold">{liveBMI}</span>
                <span className="ml-2 text-xs px-2 py-0.5 rounded-full" style={{ background: BMI_COLORS[liveBMICategory] + "22", color: BMI_COLORS[liveBMICategory] }}>
                  {liveBMICategory}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">BMI = weight / (height²)</p>
            </div>
            {goalSuggestion && goalSuggestion !== profile.goal && (
              <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Consider "{goalSuggestion === "loss" ? "Weight Loss" : "Weight Gain"}" goal</span>
              </div>
            )}
          </div>

          {conditions.length === 0 && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5 text-xs text-muted-foreground">
              No health conditions selected — using <strong>General Balanced Diet Logic</strong> (50% carbs, 20% protein, 30% fat, fibre ≥ 25g, sodium &lt; 2300 mg).
            </div>
          )}

          <button onClick={handleGenerate} disabled={generating}
            className="w-full py-2.5 rounded-lg font-semibold text-sm bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 transition-all">
            {generating ? "Generating…" : (<>Generate My 1-Day Diet Plan <ChevronRight className="w-4 h-4" /></>)}
          </button>

          {/* Results */}
          {plan && (
            <div className="space-y-5 pt-1">
              {/* Stats Row */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "BMR", value: `${plan.bmr} kcal` },
                  { label: "TDEE", value: `${plan.tdee} kcal` },
                  { label: "Daily Target", value: `${plan.calorie_target} kcal` },
                  { label: "BMI", value: `${plan.bmi} (${plan.bmiCategory})` },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-lg border border-border bg-muted/30 p-3 text-center">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-sm font-bold text-foreground tabular-nums">{value}</p>
                  </div>
                ))}
              </div>

              {/* Weekly change */}
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-2.5">
                {goalIcon}
                <span className="text-sm text-foreground">
                  Estimated weekly weight change: <strong className="tabular-nums">
                    {plan.estimated_weekly_weight_change > 0 ? "+" : ""}{plan.estimated_weekly_weight_change.toFixed(2)} kg/week
                  </strong>
                </span>
              </div>

              {/* Meal Plan */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground font-display">1-Day Meal Plan</h3>
                <MealSlot label="🌅 Breakfast" entries={plan.meal_plan.breakfast} targetPct={25} calorieTarget={plan.calorie_target} />
                <MealSlot label="🌞 Lunch" entries={plan.meal_plan.lunch} targetPct={40} calorieTarget={plan.calorie_target} />
                <MealSlot label="🌙 Dinner" entries={plan.meal_plan.dinner} targetPct={25} calorieTarget={plan.calorie_target} />
                <MealSlot label="🍎 Snacks" entries={plan.meal_plan.snacks} targetPct={10} calorieTarget={plan.calorie_target} />
              </div>

              {/* Total Nutrition */}
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
                <p className="text-xs font-semibold text-foreground mb-2">Total Plan Nutrition</p>
                <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {[
                    ["Calories", `${plan.total_nutrition.calories.toFixed(0)} kcal`],
                    ["Carbs", `${plan.total_nutrition.carbohydrates.toFixed(1)} g`],
                    ["Protein", `${plan.total_nutrition.protein.toFixed(1)} g`],
                    ["Fat", `${plan.total_nutrition.totalFat.toFixed(1)} g`],
                    ["Fibre", `${plan.total_nutrition.fibre.toFixed(1)} g`],
                    ["Sodium", `${plan.total_nutrition.sodium.toFixed(0)} mg`],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <span>{k}</span>
                      <span className="font-medium text-foreground tabular-nums">{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* (Macro bar chart removed — same data shown in Visual Insights pie chart) */}

              {/* Calorie Distribution Pie */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground font-display">Calorie Distribution by Meal</h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={calDistData} cx="50%" cy="50%" outerRadius={70} dataKey="value" isAnimationActive={false} label={({ name, value }) => `${value}%`} labelLine={false}>
                        {calDistData.map((_, idx) => (
                          <Cell key={idx} fill={CALORIE_PIE_COLORS[idx]} />
                        ))}
                      </Pie>
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }} />
                      <Tooltip formatter={(value: number) => [`${value}%`]} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Before vs After Risk Comparison */}
              {plan.health_projection.improvements.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground font-display">Condition Risk: Before vs After Diet Plan</h3>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={plan.health_projection.improvements.map(imp => ({
                          name: imp.condition.length > 14 ? imp.condition.slice(0, 13) + "…" : imp.condition,
                          Before: imp.before,
                          After: imp.after,
                          pct: imp.pct,
                        }))}
                        margin={{ top: 8, right: 16, left: 0, bottom: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} interval={0} angle={-20} textAnchor="end" height={48} />
                        <YAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} label={{ value: "Risk Score", angle: -90, position: "insideLeft", offset: 14, style: { fontSize: 10, fill: "hsl(var(--muted-foreground))" } }} />
                        <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="Before" fill="hsl(0, 84%, 60%)" isAnimationActive={false} />
                        <Bar dataKey="After" fill="hsl(142, 71%, 45%)" isAnimationActive={false} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Weight Projection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground font-display">Projected Health & Weight Trends (6–8 Weeks)</h3>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {plan.estimated_weekly_weight_change > 0 ? "+" : ""}{plan.estimated_weekly_weight_change.toFixed(2)} kg/week
                  </span>
                </div>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={plan.weight_projection} margin={{ top: 8, right: 16, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="week" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} label={{ value: "Weeks", position: "insideBottom", offset: -12, style: { fontSize: 11, fill: "hsl(var(--muted-foreground))" } }} />
                      <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} domain={["auto", "auto"]} label={{ value: "Body Weight (kg)", angle: -90, position: "insideLeft", offset: 12, style: { fontSize: 10, fill: "hsl(var(--muted-foreground))" } }} width={52} />
                      <Tooltip formatter={(v: number) => [`${v.toFixed(1)} kg`, "Weight"]} labelFormatter={(label) => `Week ${label}`} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                      <ReferenceDot x={0} y={plan.weight_projection[0]?.weight} r={5} fill="hsl(var(--primary))" stroke="hsl(var(--background))" strokeWidth={2} />
                      <Line type="monotone" dataKey="weight" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 3, fill: "hsl(var(--primary))", strokeWidth: 0 }} activeDot={{ r: 5 }} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs text-muted-foreground italic">
                  Estimated weight change if plan is followed consistently. Based on 7700 kcal ≈ 1 kg fat rule. Individual results vary.
                </p>
              </div>

              {/* Health Improvement Summary Panel */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground font-display">Health Improvement Summary</h3>

                {/* Improvement % cards */}
                {plan.health_projection.improvements.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {plan.health_projection.improvements.filter(i => i.pct > 0).map(imp => (
                      <div key={imp.condition} className="rounded-lg border border-border bg-muted/30 p-2.5 text-center">
                        <p className="text-xs text-muted-foreground truncate">{imp.condition}</p>
                        <p className="text-lg font-bold tabular-nums" style={{ color: RISK_BAR_COLOR(imp.after) }}>
                          {imp.pct > 0 ? `↓ ${imp.pct.toFixed(0)}%` : "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">{imp.before.toFixed(1)} → {imp.after.toFixed(1)}</p>
                      </div>
                    ))}
                  </div>
                )}

                <ul className="space-y-1.5">
                  {plan.expected_health_improvements.map((imp, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <span className="text-primary mt-0.5">•</span>
                      {imp}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Disclaimer */}
              <div className="rounded-lg bg-muted/50 border border-border p-3 text-xs text-muted-foreground">
                <p className="font-semibold mb-1">⚕️ Disclaimer</p>
                <p>This risk score is derived using threshold-based weighted scoring and not a trained medical model. This tool is a non-clinical advisory system. Consult your healthcare provider for personalised advice.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
