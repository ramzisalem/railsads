"use client";

import { Lightbulb } from "lucide-react";
import type { CompetitorInsight } from "@/lib/competitors/queries";

interface InsightsDisplayProps {
  insights: CompetitorInsight[];
}

const patternSections: {
  key: keyof Pick<
    CompetitorInsight,
    | "hook_patterns"
    | "angle_patterns"
    | "emotional_triggers"
    | "visual_patterns"
    | "offer_patterns"
    | "cta_patterns"
  >;
  label: string;
}[] = [
  { key: "hook_patterns", label: "Hook Patterns" },
  { key: "angle_patterns", label: "Angle Patterns" },
  { key: "emotional_triggers", label: "Emotional Triggers" },
  { key: "visual_patterns", label: "Visual Patterns" },
  { key: "offer_patterns", label: "Offer Patterns" },
  { key: "cta_patterns", label: "CTA Patterns" },
];

export function InsightsDisplay({ insights }: InsightsDisplayProps) {
  if (insights.length === 0) {
    return (
      <div className="panel space-y-4 p-6">
        <h2 className="heading-md">Insights</h2>
        <div className="flex min-h-[120px] items-center justify-center rounded-xl border border-dashed p-6">
          <div className="text-center">
            <Lightbulb className="mx-auto h-8 w-8 text-muted-foreground opacity-50" />
            <p className="mt-2 text-sm text-muted-foreground">
              No insights generated yet. Add ads and use the AI to extract
              patterns.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const latest = insights[0];

  return (
    <div className="panel space-y-5 p-6">
      <div className="flex items-center justify-between">
        <h2 className="heading-md">Insights</h2>
        {latest.confidence_score != null && (
          <span className="text-xs text-muted-foreground">
            Confidence: {Number(latest.confidence_score).toFixed(0)}%
          </span>
        )}
      </div>

      {latest.summary && (
        <p className="text-small text-muted-foreground whitespace-pre-wrap">
          {latest.summary}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {patternSections.map(({ key, label }) => {
          const items = latest[key];
          if (!items || items.length === 0) return null;
          return (
            <div key={key} className="space-y-2">
              <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {label}
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {items.map((item, i) => (
                  <span key={i} className="tag">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {insights.length > 1 && (
        <p className="text-xs text-muted-foreground">
          Showing latest insight of {insights.length} total runs.
        </p>
      )}
    </div>
  );
}
