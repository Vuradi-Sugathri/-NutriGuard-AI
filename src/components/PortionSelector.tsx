import React from "react";
import { PORTION_SIZES, PortionSize } from "@/lib/types";

interface PortionSelectorProps {
  selected: PortionSize;
  onSelect: (portion: PortionSize) => void;
}

export const PortionSelector: React.FC<PortionSelectorProps> = ({ selected, onSelect }) => {
  return (
    <div>
      <label className="text-sm font-medium text-foreground mb-2 block">Portion Size</label>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {PORTION_SIZES.map((p) => (
          <button
            key={p.grams}
            onClick={() => onSelect(p)}
            className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 border ${
              selected.grams === p.grams
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-card text-foreground border-border hover:border-primary/50"
            }`}
          >
            <span className="block">{p.label}</span>
            <span className={`text-xs ${selected.grams === p.grams ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
              {p.grams}g
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
