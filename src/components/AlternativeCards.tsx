import React from "react";
import { AlternativeDish, Classification } from "@/lib/types";
import { getRiskColorHex } from "@/lib/riskEngine";
import { ArrowDown, Flame } from "lucide-react";

interface AlternativeCardsProps {
  alternatives: AlternativeDish[];
}

const classificationBadge: Record<Classification, { bg: string; text: string }> = {
  SAFE: { bg: "bg-risk-safe/15 text-risk-safe", text: "SAFE" },
  MODERATE: { bg: "bg-risk-moderate/15 text-risk-moderate", text: "MODERATE" },
  AVOID: { bg: "bg-risk-high/15 text-risk-high", text: "AVOID" },
};

export const AlternativeCards: React.FC<AlternativeCardsProps> = ({ alternatives }) => {
  if (alternatives.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <ArrowDown className="w-4 h-4 text-risk-safe" />
        <h3 className="text-sm font-semibold text-foreground font-display">Healthier Alternatives</h3>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {alternatives.map((alt) => {
          const badge = classificationBadge[alt.classification];
          return (
            <div
              key={alt.name}
              className="rounded-lg border border-border bg-card p-4 space-y-3 transition-shadow hover:shadow-md"
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold text-foreground text-sm">{alt.matchedName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Match: {alt.similarityScore}%
                  </p>
                </div>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${badge.bg}`}>
                  {badge.text}
                </span>
              </div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="text-lg font-bold tabular-nums"
                      style={{ color: getRiskColorHex(alt.overallRisk) }}
                    >
                      {alt.overallRisk.toFixed(1)}
                    </span>
                    <span className="text-xs text-muted-foreground">risk</span>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Flame className="w-3.5 h-3.5" />
                    <span className="tabular-nums">{alt.calories.toFixed(0)} kcal</span>
                  </div>
                </div>
                {alt.reason && (
                  <p className="text-xs text-muted-foreground italic">
                    {alt.reason}
                  </p>
                )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
