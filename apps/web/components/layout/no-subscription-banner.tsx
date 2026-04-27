"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertCircle, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SidebarBillingSummary } from "./sidebar";

interface NoSubscriptionBannerProps {
  billing: SidebarBillingSummary;
}

/**
 * Top-of-page banner that nudges users without a subscription.
 * - subscribed → hidden
 * - trial active → hidden (the sidebar usage card is enough)
 * - trial exhausted / no subscription at all → show
 */
export function NoSubscriptionBanner({ billing }: NoSubscriptionBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (billing.hasSubscription) return null;

  const trialExhausted = billing.hasTrial && billing.remaining <= 0;
  const noSubAtAll = !billing.hasTrial && !billing.hasSubscription;
  const onTrialWithCredits = billing.hasTrial && billing.remaining > 0;

  if (dismissed && onTrialWithCredits) return null;
  if (!trialExhausted && !noSubAtAll && !onTrialWithCredits) return null;

  const variant = trialExhausted || noSubAtAll ? "blocking" : "info";

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-2xl border px-4 py-3 sm:items-center",
        variant === "blocking"
          ? "border-destructive/30 bg-destructive/5"
          : "border-primary/30 bg-primary-soft"
      )}
    >
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
          variant === "blocking"
            ? "bg-destructive/10 text-destructive"
            : "bg-primary/10 text-primary"
        )}
      >
        {variant === "blocking" ? (
          <AlertCircle className="h-4 w-4" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-snug">
          {trialExhausted
            ? "Your free trial credits are used up"
            : noSubAtAll
              ? "Pick a plan to start generating creatives"
              : `You're on the free trial — ${billing.remaining} credits left`}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {trialExhausted || noSubAtAll
            ? "Subscribe to keep generating creatives, ICPs and competitor insights."
            : "Upgrade any time to unlock higher monthly limits and competitor intel."}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Link
          href="/billing"
          className="inline-flex items-center justify-center rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
        >
          {trialExhausted || noSubAtAll ? "View plans" : "Upgrade"}
        </Link>
        {onTrialWithCredits && (
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
