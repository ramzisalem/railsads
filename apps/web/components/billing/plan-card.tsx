import { Check } from "lucide-react";
import { creditsToCreatives } from "@/lib/billing/stripe";

export interface PlanInfo {
  code: string;
  name: string;
  monthlyPriceCents: number;
  monthlyCreditLimit: number;
  maxBrands: number | null;
  features: Record<string, boolean>;
}

interface PlanCardProps {
  plan: PlanInfo;
  isCurrentPlan: boolean;
  onSelect?: (planCode: string) => void;
  recommended?: boolean;
  className?: string;
}

const FEATURE_LABELS: Record<string, string> = {
  creative_generation: "Creative generation",
  icp_generation: "ICP generation",
  website_import: "Website import",
  competitor_insights: "Competitor insights",
  priority_generation: "Priority generation",
  image_generation: "Image generation",
};

export function PlanCard({
  plan,
  isCurrentPlan,
  onSelect,
  recommended,
  className,
}: PlanCardProps) {
  const creatives = creditsToCreatives(plan.monthlyCreditLimit);
  const features = Object.entries(plan.features).filter(([, v]) => v);

  return (
    <div
      className={`relative flex h-full min-h-0 flex-col rounded-2xl border p-6 transition-colors ${
        recommended
          ? "border-primary bg-primary/[0.02]"
          : isCurrentPlan
            ? "border-primary/50 bg-card"
            : "bg-card hover:border-primary/30"
      } ${className ?? ""}`}
    >
      {recommended && (
        <span className="tag-card-primary absolute -top-2.5 left-4 z-10">
          Recommended
        </span>
      )}

      <div className="grid min-h-0 w-full flex-1 grid-rows-[minmax(0,1fr)_auto] pt-1">
        <div className="min-h-0">
          <div className="space-y-4">
            <div>
              <h3 className="heading-md">{plan.name}</h3>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-bold">
                  ${(plan.monthlyPriceCents / 100).toFixed(0)}
                </span>
                <span className="text-sm text-muted-foreground">/ month</span>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              ~{creatives} creatives / month ·{" "}
              {plan.monthlyCreditLimit.toLocaleString()} credits / month
              {plan.maxBrands
                ? ` · ${plan.maxBrands} brand${plan.maxBrands > 1 ? "s" : ""}`
                : " · Unlimited brands"}
            </p>

            <ul className="space-y-2">
              {features.map(([key]) => (
                <li key={key} className="flex items-center gap-2 text-sm">
                  <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                  {FEATURE_LABELS[key] ?? key}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="shrink-0 pt-6">
          {!isCurrentPlan && onSelect && (
            <button
              type="button"
              onClick={() => onSelect(plan.code)}
              className={
                recommended ? "btn-primary w-full" : "btn-secondary w-full"
              }
            >
              {recommended ? "Get started" : "Choose plan"}
            </button>
          )}

          {isCurrentPlan && (
            <p className="text-center text-xs text-muted-foreground">
              Your current plan
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
