import React from "react";
import { Classification } from "@/lib/types";
import { getRiskColorHex } from "@/lib/riskEngine";

interface RiskGaugeProps {
  score: number;
  classification: Classification;
}

export const RiskGauge: React.FC<RiskGaugeProps> = ({ score, classification }) => {
  const color = getRiskColorHex(score);
  const angle = (score / 10) * 180;
  const radius = 80;
  const cx = 100;
  const cy = 95;

  // Calculate arc endpoint
  const rad = ((180 - angle) * Math.PI) / 180;
  const x = cx + radius * Math.cos(rad);
  const y = cy - radius * Math.sin(rad);
  const largeArc = angle > 180 ? 1 : 0;

  const classificationColors: Record<Classification, string> = {
    SAFE: "bg-risk-safe text-primary-foreground",
    MODERATE: "bg-risk-moderate text-primary-foreground",
    AVOID: "bg-risk-high text-primary-foreground",
  };

  const classificationMessages: Record<Classification, string> = {
    SAFE: "Yes, this is safe for you.",
    MODERATE: "Consume in moderation.",
    AVOID: "No, you should not eat this.",
  };

  return (
    <div className="flex flex-col items-center gap-3 animate-scale-in">
      <svg viewBox="0 0 200 120" className="w-56 h-32">
        {/* Background arc */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth="12"
          strokeLinecap="round"
        />
        {/* Colored arc */}
        {score > 0 && (
          <path
            d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 ${largeArc} 1 ${x} ${y}`}
            fill="none"
            stroke={color}
            strokeWidth="12"
            strokeLinecap="round"
            style={{
              transition: "all 1s ease-out",
            }}
          />
        )}
        {/* Score text */}
        <text x={cx} y={cy - 15} textAnchor="middle" className="text-3xl font-bold fill-foreground font-display">
          {score.toFixed(1)}
        </text>
        <text x={cx} y={cy + 5} textAnchor="middle" className="text-xs fill-muted-foreground">
          out of 10
        </text>
      </svg>

      <div className={`px-4 py-2 rounded-full text-sm font-semibold ${classificationColors[classification]}`}>
        {classification}
      </div>
      <p className="text-sm text-center font-medium text-foreground">
        {classificationMessages[classification]}
      </p>
    </div>
  );
};
