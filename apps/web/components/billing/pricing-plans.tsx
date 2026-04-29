"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Loader2 } from "lucide-react";
import { creditsToCreatives } from "@/lib/billing/stripe";
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

      <div className="grid items-stretch gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => (
          <div key={plan.code} className="relative flex h-full min-h-0 flex-col">
            {loading === plan.code && (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-background/80">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}

            {loggedIn ? (
              <PlanCard
                className="min-h-0 flex-1"
                plan={plan}
                isCurrentPlan={plan.code === currentPlanCode}
                onSelect={handleCheckout}
                recommended={plan.code === "pro"}
              />
            ) : (
              <SignupCtaPlan
                className="min-h-0 flex-1"
                plan={plan}
                recommended={plan.code === "pro"}
              />
            )}
          </div>
        ))}

        {!plans.some((p) => p.code === "enterprise") && (
          <div className="flex h-full min-h-0 flex-col">
            <EnterpriseCard
              className="min-h-0 flex-1"
              onSelect={() => handleCheckout("enterprise")}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function SignupCtaPlan({
  plan,
  recommended,
  className,
}: {
  plan: PlanInfo;
  recommended: boolean;
  className?: string;
}) {
  const features = Object.entries(plan.features).filter(([, v]) => v);
  const creatives = creditsToCreatives(plan.monthlyCreditLimit);

  return (
    <div
      className={`relative flex h-full min-h-0 flex-col rounded-2xl border p-6 transition-colors ${
        recommended
          ? "border-primary bg-primary/[0.02]"
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

            <ul className="space-y-2 text-sm">
              {features.map(([key]) => (
                <li
                  key={key}
                  className="flex items-center gap-2 text-muted-foreground"
                >
                  <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                  {FEATURE_LABEL[key] ?? key}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="shrink-0 pt-6">
          <Link
            href={`/signup?plan=${plan.code}`}
            className={
              recommended
                ? "btn-primary block w-full text-center"
                : "btn-secondary block w-full text-center"
            }
          >
            Start with {plan.name}
          </Link>
        </div>
      </div>
    </div>
  );
}

function EnterpriseCard({
  onSelect,
  className,
}: {
  onSelect: () => void;
  className?: string;
}) {
  return (
    <div
      className={`flex h-full min-h-0 flex-col rounded-2xl border border-dashed bg-card p-6 ${className ?? ""}`}
    >
      <div className="grid min-h-0 w-full flex-1 grid-rows-[minmax(0,1fr)_auto] pt-1">
        <div className="min-h-0">
          <div className="space-y-4">
            <div>
              <h3 className="heading-md">Enterprise</h3>
              <p className="mt-1 text-sm text-muted-foreground">Custom pricing</p>
            </div>

            <p className="text-sm text-muted-foreground">
              10,000+ credits per month
            </p>

            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2 text-muted-foreground">
                <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                Unlimited brands &amp; seats
              </li>
              <li className="flex items-center gap-2 text-muted-foreground">
                <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                Custom templates
              </li>
              <li className="flex items-center gap-2 text-muted-foreground">
                <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                Dedicated support
              </li>
            </ul>
          </div>
        </div>

        <div className="shrink-0 pt-6">
          <button type="button" onClick={onSelect} className="btn-secondary w-full">
            Talk to sales
          </button>
        </div>
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
