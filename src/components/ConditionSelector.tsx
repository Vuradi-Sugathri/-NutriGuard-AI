import React from "react";
import { ALL_CONDITIONS, MedicalCondition } from "@/lib/types";
import {
  Heart,
  Droplets,
  Activity,
  Brain,
  Scale,
  Beaker,
  Bone,
  Wind,
  CircleDot,
  Thermometer,
} from "lucide-react";

const CONDITION_ICONS: Record<MedicalCondition, React.ReactNode> = {
  Hypertension: <Activity className="w-4 h-4" />,
  "Type 2 Diabetes": <Droplets className="w-4 h-4" />,
  "Coronary Artery Disease": <Heart className="w-4 h-4" />,
  "Chronic Kidney Disease": <Beaker className="w-4 h-4" />,
  Obesity: <Scale className="w-4 h-4" />,
  Hyperlipidemia: <CircleDot className="w-4 h-4" />,
  Anemia: <Bone className="w-4 h-4" />,
  Asthma: <Wind className="w-4 h-4" />,
  Arthritis: <Brain className="w-4 h-4" />,
  Hypothyroidism: <Thermometer className="w-4 h-4" />,
};

interface ConditionSelectorProps {
  selected: MedicalCondition[];
  onToggle: (condition: MedicalCondition) => void;
}

export const ConditionSelector: React.FC<ConditionSelectorProps> = ({ selected, onToggle }) => {
  return (
    <div>
      <label className="text-sm font-medium text-foreground mb-3 block">
        Select Your Health Conditions
      </label>
      <div className="flex flex-wrap gap-2.5">
        {ALL_CONDITIONS.map((condition) => {
          const isSelected = selected.includes(condition);
          return (
            <button
              key={condition}
              onClick={() => onToggle(condition)}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-xs font-medium transition-all duration-200 border whitespace-nowrap ${
                isSelected
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-card text-foreground border-border hover:border-primary/50"
              }`}
            >
              <span className={`shrink-0 ${isSelected ? "text-primary-foreground" : "text-primary"}`}>
                {CONDITION_ICONS[condition]}
              </span>
              <span>{condition}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
