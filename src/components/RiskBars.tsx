import React from "react";
import { ConditionScore } from "@/lib/types";
import { getRiskColorHex } from "@/lib/riskEngine";

interface RiskBarsProps {
  scores: ConditionScore[];
}

export const RiskBars: React.FC<RiskBarsProps> = ({ scores }) => {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground font-display">Condition Risk Scores</h3>
      {scores.map(({ condition, score }) => {
        const color = getRiskColorHex(score);
        const pct = (score / 10) * 100;
        return (
          <div key={condition} className="space-y-1">
            <div className="flex justify-between items-center text-sm">
              <span className="text-foreground font-medium">{condition}</span>
              <span className="font-semibold tabular-nums" style={{ color }}>
                {score.toFixed(1)}
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${pct}%`,
                  backgroundColor: color,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
