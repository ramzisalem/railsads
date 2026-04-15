"use client";

import { useState } from "react";
import { CreditCard, ExternalLink, Loader2 } from "lucide-react";
import { PlanCard } from "./plan-card";
import type { PlanInfo } from "./plan-card";
import { UsageBar } from "./usage-bar";
import type { UsageInfo } from "./usage-bar";

interface SubscriptionInfo {
  id: string;
  status: string;
  plan: PlanInfo | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  trialEnd: string | null;
}

export interface BillingOverview {
  subscription: SubscriptionInfo | null;
  usage: UsageInfo;
  plans: PlanInfo[];
  hasSubscription: boolean;
}

interface BillingSectionProps {
  billing: BillingOverview;
}

export function BillingSection({ billing }: BillingSectionProps) {
  const [loading, setLoading] = useState<string | null>(null);

  async function handleCheckout(planCode: string) {
    setLoading(planCode);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planCode }),
      });

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error ?? "Failed to start checkout");
      }
    } catch {
      alert("Something went wrong. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  async function handleManage() {
    setLoading("portal");
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error ?? "Failed to open billing portal");
      }
    } catch {
      alert("Something went wrong. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  const { subscription, usage, plans } = billing;
  const currentPlanCode = subscription?.plan?.code ?? null;

  return (
    <div className="space-y-6">
      {subscription && (
        <>
          <div className="panel p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="heading-md">
                  {subscription.plan?.name ?? "Subscription"} Plan
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {subscription.status === "active"
                    ? "Active"
                    : subscription.status === "trialing"
                      ? "Trial"
                      : subscription.status === "past_due"
                        ? "Past due"
                        : subscription.status}
                  {subscription.cancelAtPeriodEnd && " · Cancels at period end"}
                  {subscription.currentPeriodEnd &&
                    ` · Renews ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`}
                </p>
              </div>
              <button
                onClick={handleManage}
                disabled={loading === "portal"}
                className="btn-secondary flex items-center gap-2"
              >
                {loading === "portal" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4" />
                )}
                Manage subscription
              </button>
            </div>
          </div>

          <div className="panel p-6 space-y-4">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <h2 className="heading-md">Usage this month</h2>
            </div>
            <UsageBar usage={usage} />
          </div>
        </>
      )}

      {!subscription && (
        <div className="space-y-4">
          <div className="panel p-6 space-y-2">
            <h2 className="heading-md">Choose a plan</h2>
            <p className="text-sm text-muted-foreground">
              Subscribe to start creating AI-powered ads for your brand.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {plans.map((plan) => (
              <div key={plan.code} className="relative">
                {loading === plan.code && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-background/80">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                )}
                <PlanCard
                  plan={plan}
                  isCurrentPlan={plan.code === currentPlanCode}
                  onSelect={handleCheckout}
                  recommended={plan.code === "pro"}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {subscription && plans.length > 0 && (
        <div className="space-y-4">
          <h2 className="heading-md">Available plans</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {plans.map((plan) => (
              <div key={plan.code} className="relative">
                {loading === plan.code && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-background/80">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                )}
                <PlanCard
                  plan={plan}
                  isCurrentPlan={plan.code === currentPlanCode}
                  onSelect={handleCheckout}
                  recommended={
                    plan.code === "pro" && currentPlanCode !== "pro"
                  }
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
