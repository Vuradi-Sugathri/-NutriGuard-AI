import React from "react";
import { SAMPLE_DISHES, SampleDish } from "@/lib/mockDishes";
import { Sparkles } from "lucide-react";

interface SampleDishSelectorProps {
  onSelectDish: (sample: SampleDish) => void;
  isLoading: boolean;
  selectedId?: string | null;
}

export const SampleDishSelector: React.FC<SampleDishSelectorProps> = ({
  onSelectDish,
  isLoading,
  selectedId,
}) => {
  return (
    <div className="space-y-2 pt-1">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        <Sparkles className="w-3.5 h-3.5 text-primary" />
        <span>Quick Test Sample Dishes</span>
        <span className="text-[10px] lowercase font-normal text-muted-foreground/80">(click to test without upload)</span>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {SAMPLE_DISHES.map((dish) => {
          const isSelected = selectedId === dish.id;
          return (
            <button
              key={dish.id}
              type="button"
              disabled={isLoading}
              onClick={() => onSelectDish(dish)}
              className={`group relative flex flex-col items-center rounded-lg border p-1.5 text-left transition-all duration-200 overflow-hidden ${
                isSelected
                  ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary"
                  : "border-border bg-card hover:border-primary/50 hover:bg-accent/40"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <div className="w-full aspect-square rounded-md overflow-hidden bg-muted mb-1.5 flex items-center justify-center">
                <img
                  src={dish.image}
                  alt={dish.name}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                  loading="lazy"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/placeholder.svg";
                  }}
                />
              </div>
              <span className="text-[11px] font-medium text-foreground text-center truncate w-full">
                {dish.name}
              </span>
              <span className="text-[9px] text-muted-foreground text-center truncate w-full">
                {dish.category}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
