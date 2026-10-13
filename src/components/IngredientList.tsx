import React from "react";
import { Beaker } from "lucide-react";
import { highlightIngredients, RISK_LABELS, RISK_STYLES, NutrientRisk } from "@/lib/ingredientHighlighter";

interface IngredientListProps {
  ingredients: string[];
}

export const IngredientList: React.FC<IngredientListProps> = ({ ingredients }) => {
  if (!ingredients || ingredients.length === 0) return null;

  const highlighted = highlightIngredients(ingredients);
  const hasAnyRisk = highlighted.some((i) => i.risks.length > 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Beaker className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground font-display">Detected Ingredients</h3>
      </div>

      <div className="flex flex-wrap gap-2">
        {highlighted.map(({ ingredient, risks }) => {
          const riskType = risks[0] as NutrientRisk | undefined;
          if (riskType) {
            return (
              <div key={ingredient} className="flex items-center gap-1 group relative">
                <span
                  className={`text-xs px-2.5 py-1 rounded-full border font-medium ${RISK_STYLES[riskType]}`}
                  title={risks.map((r) => RISK_LABELS[r]).join(", ")}
                >
                  {ingredient}
                  <span className="ml-1 opacity-60">▲</span>
                </span>
              </div>
            );
          }
          return (
            <span
              key={ingredient}
              className="text-xs px-2.5 py-1 rounded-full border border-border bg-muted text-muted-foreground"
            >
              {ingredient}
            </span>
          );
        })}
      </div>

      {hasAnyRisk && (
        <div className="flex flex-wrap gap-3 pt-1">
          {(["sugar", "fat", "sodium"] as NutrientRisk[]).map((risk) => {
            const count = highlighted.filter((i) => i.risks.includes(risk)).length;
            if (count === 0) return null;
            return (
              <span
                key={risk}
                className={`text-xs px-2 py-0.5 rounded border font-medium ${RISK_STYLES[risk]}`}
              >
                ▲ {RISK_LABELS[risk]} ({count})
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
};
