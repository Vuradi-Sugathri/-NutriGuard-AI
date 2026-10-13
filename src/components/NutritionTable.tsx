import React from "react";
import { NutritionData } from "@/lib/types";

interface NutritionTableProps {
  nutrition: NutritionData;
}

export const NutritionTable: React.FC<NutritionTableProps> = ({ nutrition }) => {
  const rows = [
    { label: "Calories", value: nutrition.calories, unit: "kcal" },
    { label: "Carbohydrates", value: nutrition.carbohydrates, unit: "g" },
    { label: "Protein", value: nutrition.protein, unit: "g" },
    { label: "Total Fat", value: nutrition.totalFat, unit: "g" },
    { label: "Sugar", value: nutrition.freeSugar, unit: "g" },
    { label: "Fibre", value: nutrition.fibre, unit: "g" },
    { label: "Sodium", value: nutrition.sodium, unit: "mg" },
    { label: "Iron", value: nutrition.iron, unit: "mg" },
    { label: "Calcium", value: nutrition.calcium, unit: "mg" },
    { label: "Vitamin C", value: nutrition.vitaminC, unit: "mg" },
  ];

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 bg-accent/50 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground font-display">Nutrition Profile</h3>
      </div>
      <div className="divide-y divide-border">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between items-center px-4 py-2.5 text-sm">
            <span className="text-muted-foreground">{row.label}</span>
            <span className="font-medium text-foreground tabular-nums">
              {row.value.toFixed(1)} {row.unit}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
