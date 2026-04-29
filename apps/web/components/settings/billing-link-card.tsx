import Link from "next/link";
import { CreditCard, ChevronRight } from "lucide-react";
import type { BillingOverview } from "@/lib/billing/queries";

interface BillingLinkCardProps {
  billing: BillingOverview;
}

export function BillingLinkCard({ billing }: BillingLinkCardProps) {
  const { state, subscription, usage } = billing;

  const heading =
    state === "subscribed"
      ? `${subscription?.plan?.name ?? "Subscription"} plan`
      : state === "trial"
        ? "Free trial"
        : state === "trial_exhausted"
          ? "Trial exhausted"
          : "No subscription";

  const subline =
    state === "subscribed"
      ? subscription?.currentPeriodEnd
        ? `Renews ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`
        : "Active subscription"
      : state === "trial"
        ? `${usage.creditsRemaining.toLocaleString()} credits left in trial`
        : state === "trial_exhausted"
          ? "Pick a plan to continue creating"
          : "Pick a plan to start creating";

  return (
    <Link
      href="/billing"
      className="panel block p-6 transition-colors hover:border-primary/40"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <CreditCard className="h-5 w-5" />
          </div>
          <div>
            <h2 className="heading-md">Billing &amp; usage</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {heading} · {subline}
            </p>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
      </div>
    </Link>
  );
}
