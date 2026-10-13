import React from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { ConditionScore, NutritionData } from "@/lib/types";
import { getRiskColorHex } from "@/lib/riskEngine";
import { BarChart2, PieChart as PieIcon, ShieldAlert } from "lucide-react";

interface VisualizationProps {
  conditionScores: ConditionScore[];
  nutrition: NutritionData;
}

// ICMR-NIN Daily Recommended Dietary Allowances (RDA) for Adults
const ICMR_RDA = {
  iron: { label: "Iron", target: 19, unit: "mg", description: "Blood health & Anemia prevention" },
  calcium: { label: "Calcium", target: 1000, unit: "mg", description: "Bone density & neuromuscular support" },
  vitaminC: { label: "Vitamin C", target: 80, unit: "mg", description: "Immunity & antioxidant defence" },
  folate: { label: "Folate", target: 300, unit: "µg", description: "Cell repair & DNA synthesis" },
  fibre: { label: "Dietary Fibre", target: 30, unit: "g", description: "Glycemic regulation & satiety" },
  sodium: { label: "Sodium Limit", target: 2000, unit: "mg", isLimit: true, description: "WHO upper limit for blood pressure" },
};

export const VisualizationSection: React.FC<VisualizationProps> = ({
  conditionScores,
  nutrition,
}) => {
  // Risk Bar Chart data
  const barData = conditionScores.map((cs) => ({
    name: cs.condition.length > 14 ? cs.condition.slice(0, 13) + "…" : cs.condition,
    fullName: cs.condition,
    score: cs.score,
  }));

  // Macronutrient Energy Distribution
  const carbKcal = nutrition.carbohydrates * 4;
  const proteinKcal = nutrition.protein * 4;
  const fatKcal = nutrition.totalFat * 9;
  const totalMacroKcal = carbKcal + proteinKcal + fatKcal;

  const pieRaw = totalMacroKcal > 0
    ? [
        { name: "Carbohydrates", value: +((carbKcal / totalMacroKcal) * 100).toFixed(1) },
        { name: "Protein", value: +((proteinKcal / totalMacroKcal) * 100).toFixed(1) },
        { name: "Fat", value: +((fatKcal / totalMacroKcal) * 100).toFixed(1) },
      ].filter((d) => d.value > 0)
    : [];

  const PIE_COLORS = ["hsl(217, 91%, 60%)", "hsl(142, 71%, 45%)", "hsl(0, 84%, 60%)"];

  const CustomBar = (props: any) => {
    const { x, y, width, height, score } = props;
    return <rect x={x} y={y} width={width} height={height} fill={getRiskColorHex(score)} rx={3} />;
  };

  // Micronutrient benchmark calculations
  const microList = [
    { key: "fibre", actual: nutrition.fibre, ...ICMR_RDA.fibre },
    { key: "iron", actual: nutrition.iron, ...ICMR_RDA.iron },
    { key: "calcium", actual: nutrition.calcium, ...ICMR_RDA.calcium },
    { key: "vitaminC", actual: nutrition.vitaminC, ...ICMR_RDA.vitaminC },
    { key: "folate", actual: nutrition.folate, ...ICMR_RDA.folate },
    { key: "sodium", actual: nutrition.sodium, ...ICMR_RDA.sodium },
  ];

  return (
    <div className="space-y-6">
      {/* 1. Risk Bar Chart */}
      {conditionScores.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground font-display">Condition Risk Comparison</h3>
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 4, right: 8, left: -12, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} interval={0} angle={-20} textAnchor="end" height={48} />
                <YAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} label={{ value: "Risk Score", angle: -90, position: "insideLeft", offset: 14, style: { fontSize: 10, fill: "hsl(var(--muted-foreground))" } }} />
                <Tooltip formatter={(value: number, _name, props) => [`${value.toFixed(1)} / 10`, props.payload.fullName]} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="score" shape={<CustomBar />} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 2. Macronutrient Energy Distribution Pie Chart */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <PieIcon className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground font-display">Macronutrient Energy Distribution</h3>
          <span className="text-xs text-muted-foreground">(% of total macro calories)</span>
        </div>
        {pieRaw.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Insufficient macronutrient data to generate chart.</p>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieRaw} cx="50%" cy="50%" outerRadius={80} dataKey="value" isAnimationActive={false} label={({ name, value }) => `${name.split(" ")[0]} ${value}%`} labelLine={false}>
                  {pieRaw.map((_, idx) => (
                    <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Legend iconType="circle" iconSize={8} formatter={(value) => `${value}`} wrapperStyle={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }} />
                <Tooltip formatter={(value: number, name: string) => [`${value.toFixed(1)}%`, name]} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Carbs: {carbKcal.toFixed(0)} kcal · Protein: {proteinKcal.toFixed(0)} kcal · Fat: {fatKcal.toFixed(0)} kcal · Total macro: {totalMacroKcal.toFixed(0)} kcal
        </p>
      </div>

      {/* 3. Micronutrient & Fibre ICMR-NIN RDA Benchmarks */}
      <div className="space-y-3 pt-2 border-t border-border">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground font-display">Micronutrient & RDA Benchmarking</h3>
          <span className="text-xs text-muted-foreground">(vs ICMR-NIN Indian Adult Daily Values)</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {microList.map((item) => {
            const pct = Math.min(100, Math.round((item.actual / item.target) * 100));
            const isSodium = (item as any).isLimit;
            const barColor = isSodium
              ? pct > 40
                ? "bg-destructive"
                : "bg-primary"
              : pct >= 25
              ? "bg-primary"
              : "bg-amber-500";

            return (
              <div key={item.key} className="rounded-lg border border-border bg-card p-3 space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-foreground">{item.label}</span>
                  <span className="font-medium tabular-nums text-muted-foreground">
                    {item.actual.toFixed(1)} {item.unit} / {item.target} {item.unit} ({pct}%)
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground truncate">{item.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
