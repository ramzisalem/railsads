"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { PlanCard, type PlanInfo } from "./plan-card";

interface PricingPlansProps {
  plans: PlanInfo[];
  loggedIn: boolean;
  /** Pass the active plan code when used inside the dashboard. */
  currentPlanCode?: string | null;
}

/**
 * Plan grid used on both the public /pricing page and the in-app /billing
 * page. When the user isn't logged in, each plan links to /signup with the
 * intended plan code so we can route them to checkout right after onboarding.
 */
export function PricingPlans({
  plans,
  loggedIn,
  currentPlanCode = null,
}: PricingPlansProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCheckout(planCode: string) {
    if (planCode === "enterprise") {
      window.location.href = "mailto:hello@railsads.com?subject=Enterprise plan";
      return;
    }

    setError(null);
    setLoading(planCode);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planCode }),
      });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      setError(data.error ?? "Failed to start checkout");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => (
          <div key={plan.code} className="relative">
            {loading === plan.code && (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-background/80">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}

            {loggedIn ? (
              <PlanCard
                plan={plan}
                isCurrentPlan={plan.code === currentPlanCode}
                onSelect={handleCheckout}
                recommended={plan.code === "pro"}
              />
            ) : (
              <SignupCtaPlan
                plan={plan}
                recommended={plan.code === "pro"}
              />
            )}
          </div>
        ))}

        {!plans.some((p) => p.code === "enterprise") && (
          <EnterpriseCard onSelect={() => handleCheckout("enterprise")} />
        )}
      </div>
    </div>
  );
}

function SignupCtaPlan({
  plan,
  recommended,
}: {
  plan: PlanInfo;
  recommended: boolean;
}) {
  const features = Object.entries(plan.features).filter(([, v]) => v);
  const creatives = Math.floor(plan.monthlyCreditLimit / 15);

  return (
    <div
      className={`relative rounded-2xl border p-6 transition-colors ${
        recommended
          ? "border-primary bg-primary/[0.02]"
          : "bg-card hover:border-primary/30"
      }`}
    >
      {recommended && (
        <span className="tag-primary absolute -top-2.5 left-4">
          Recommended
        </span>
      )}

      <div className="space-y-4 pt-1">
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
          ~{creatives} creatives / month
          {plan.maxBrands
            ? ` · ${plan.maxBrands} brand${plan.maxBrands > 1 ? "s" : ""}`
            : " · Unlimited brands"}
        </p>

        <ul className="space-y-2 text-sm">
          {features.map(([key]) => (
            <li key={key} className="text-muted-foreground">
              {FEATURE_LABEL[key] ?? key}
            </li>
          ))}
        </ul>

        <Link
          href={`/signup?plan=${plan.code}`}
          className={
            recommended ? "btn-primary block w-full text-center" : "btn-secondary block w-full text-center"
          }
        >
          Start with {plan.name}
        </Link>
      </div>
    </div>
  );
}

function EnterpriseCard({ onSelect }: { onSelect: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed bg-card p-6">
      <div className="space-y-4">
        <div>
          <h3 className="heading-md">Enterprise</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Custom pricing
          </p>
        </div>

        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>10,000+ credits per month</li>
          <li>Unlimited brands &amp; seats</li>
          <li>Custom templates</li>
          <li>Dedicated support</li>
        </ul>

        <button onClick={onSelect} className="btn-secondary w-full">
          Talk to sales
        </button>
      </div>
    </div>
  );
}

const FEATURE_LABEL: Record<string, string> = {
  creative_generation: "Creative generation",
  icp_generation: "ICP generation",
  website_import: "Website import",
  competitor_insights: "Competitor insights",
  priority_generation: "Priority generation",
  image_generation: "Image generation",
  dedicated_support: "Dedicated support",
  custom_templates: "Custom templates",
};
