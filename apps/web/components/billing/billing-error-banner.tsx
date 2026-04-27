"use client";

import Link from "next/link";
import { AlertCircle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BillingError } from "@/lib/billing/client";

interface BillingErrorBannerProps {
  error: BillingError;
  className?: string;
  /**
   * If provided, renders alongside the upgrade CTA so users can dismiss the
   * error without leaving the page.
   */
  onDismiss?: () => void;
}

const TITLES: Record<BillingError["code"], string> = {
  subscription_required: "Subscribe to keep creating",
  trial_exhausted: "Your free trial credits are used up",
  insufficient_credits: "You're out of credits this month",
};

const CTAS: Record<BillingError["code"], string> = {
  subscription_required: "View plans",
  trial_exhausted: "View plans",
  insufficient_credits: "Upgrade plan",
};

export function BillingErrorBanner({
  error,
  className,
  onDismiss,
}: BillingErrorBannerProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3",
        className
      )}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertCircle className="h-4 w-4" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground leading-snug">
          {TITLES[error.code]}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{error.message}</p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted"
          >
            Dismiss
          </button>
        )}
        <Link
          href={error.upgradeUrl}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
        >
          {CTAS[error.code]}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
