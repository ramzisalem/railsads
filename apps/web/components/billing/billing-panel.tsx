"use client";

import { useState } from "react";
import {
  CreditCard,
  ExternalLink,
  Loader2,
  Sparkles,
  ReceiptText,
  Check,
} from "lucide-react";
import { PricingPlans } from "./pricing-plans";
import { UsageBar } from "./usage-bar";
import { CreditHistory } from "./credit-history";
import type {
  BillingOverview,
  BillingInvoiceInfo,
  CreditHistoryEntry,
} from "@/lib/billing/queries";

interface BillingPanelProps {
  billing: BillingOverview;
  invoices: BillingInvoiceInfo[];
  history: CreditHistoryEntry[];
}

export function BillingPanel({ billing, invoices, history }: BillingPanelProps) {
  const [openingPortal, setOpeningPortal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleManage() {
    setError(null);
    setOpeningPortal(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      setError(data.error ?? "Failed to open billing portal");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setOpeningPortal(false);
    }
  }

  const { subscription, usage, plans, state } = billing;
  const currentPlanCode = subscription?.plan?.code ?? null;

  return (
    <div className="space-y-8">
      {error && (
        <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Current state — different banner per state */}
      {state === "subscribed" && subscription && (
        <SubscribedHeader
          subscription={subscription}
          openingPortal={openingPortal}
          onManage={handleManage}
        />
      )}

      {state === "trial" && (
        <TrialHeader
          remaining={usage.creditsRemaining}
          limit={usage.creditsLimit}
        />
      )}

      {state === "trial_exhausted" && <TrialExhaustedHeader />}

      {state === "no_subscription" && <NoSubscriptionHeader />}

      {/* Usage panel — visible whenever there's a usable allotment */}
      {(state === "subscribed" || state === "trial") && (
        <div className="panel space-y-4 p-6">
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <h2 className="heading-md">Usage this month</h2>
          </div>
          <UsageBar usage={usage} />
        </div>
      )}

      {/* Plan grid */}
      <div className="space-y-4">
        <h2 className="heading-md">
          {subscription ? "Available plans" : "Choose a plan"}
        </h2>
        <PricingPlans
          plans={plans}
          loggedIn={true}
          currentPlanCode={currentPlanCode}
        />
      </div>

      {/* Credit history — every grant and deduction */}
      <CreditHistory entries={history} />

      {/* Invoice history */}
      {invoices.length > 0 && (
        <div className="panel space-y-3 p-6">
          <div className="flex items-center gap-2">
            <ReceiptText className="h-4 w-4 text-muted-foreground" />
            <h2 className="heading-md">Invoice history</h2>
          </div>

          <div className="divide-y">
            {invoices.map((inv) => (
              <InvoiceRow key={inv.id} invoice={inv} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SubscribedHeader({
  subscription,
  openingPortal,
  onManage,
}: {
  subscription: NonNullable<BillingOverview["subscription"]>;
  openingPortal: boolean;
  onManage: () => void;
}) {
  return (
    <div className="panel flex items-center justify-between p-6">
      <div>
        <div className="flex items-center gap-2">
          <Check className="h-4 w-4 text-success" />
          <h2 className="heading-md">
            {subscription.plan?.name ?? "Subscription"} plan
          </h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {subscription.status === "active"
            ? "Active"
            : subscription.status === "trialing"
              ? "Trial"
              : subscription.status === "past_due"
                ? "Past due — update your payment method"
                : subscription.status}
          {subscription.cancelAtPeriodEnd && " · Cancels at period end"}
          {subscription.currentPeriodEnd &&
            ` · Renews ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`}
        </p>
      </div>
      <button
        onClick={onManage}
        disabled={openingPortal}
        className="btn-secondary flex items-center gap-2"
      >
        {openingPortal ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ExternalLink className="h-4 w-4" />
        )}
        Manage subscription
      </button>
    </div>
  );
}

function TrialHeader({
  remaining,
  limit,
}: {
  remaining: number;
  limit: number;
}) {
  const percent = limit > 0 ? Math.round((remaining / limit) * 100) : 0;
  return (
    <div className="panel space-y-2 border-primary/30 bg-primary/[0.03] p-6">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h2 className="heading-md">You&apos;re on the free trial</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        {percent}% of trial credits remaining. Pick a plan below to keep
        creating once your trial is used up.
      </p>
    </div>
  );
}

function TrialExhaustedHeader() {
  return (
    <div className="panel space-y-2 border-warning/40 bg-warning/[0.05] p-6">
      <h2 className="heading-md">Free trial used up</h2>
      <p className="text-sm text-muted-foreground">
        Pick a plan below to grant new credits and keep creating ads.
      </p>
    </div>
  );
}

function NoSubscriptionHeader() {
  return (
    <div className="panel space-y-2 p-6">
      <h2 className="heading-md">Choose a plan to get started</h2>
      <p className="text-sm text-muted-foreground">
        Subscribe to a plan to start generating ads, ICPs and competitor
        insights for this brand.
      </p>
    </div>
  );
}

function InvoiceRow({ invoice }: { invoice: BillingInvoiceInfo }) {
  const date = new Date(invoice.createdAt).toLocaleDateString();
  const amount =
    invoice.amountPaidCents != null
      ? `$${(invoice.amountPaidCents / 100).toFixed(2)}`
      : "—";

  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0 space-y-0.5">
        <p className="truncate text-sm font-medium">{date}</p>
        <p className="text-xs text-muted-foreground">
          {invoice.status ?? "—"}
          {invoice.periodStart &&
            invoice.periodEnd &&
            ` · ${new Date(invoice.periodStart).toLocaleDateString()} – ${new Date(invoice.periodEnd).toLocaleDateString()}`}
        </p>
      </div>
      <div className="flex items-center gap-4 shrink-0">
        <span className="text-sm tabular-nums">{amount}</span>
        {invoice.hostedInvoiceUrl && (
          <a
            href={invoice.hostedInvoiceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline"
          >
            View
          </a>
        )}
      </div>
    </div>
  );
}
