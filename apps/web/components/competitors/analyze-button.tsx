"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Loader2, RefreshCw, Sparkles } from "lucide-react";
import type {
  LinkedProductOption,
  NewAdsByScope,
} from "@/lib/competitors/queries";
import {
  BillingError,
  fetchJson,
  isBillingError,
} from "@/lib/billing/client";
import { BillingErrorBanner } from "@/components/billing/billing-error-banner";

interface AnalyzeButtonProps {
  brandId: string;
  competitorId: string;
  hasAds: boolean;
  /** Products mapped to this competitor — enables scoped analysis. */
  linkedProducts: LinkedProductOption[];
  /** Per-scope counts of how many ads are still un-analyzed. Drives the
   *  primary CTA copy ("Analyze N new ads") and the menu enablement. */
  newAdCounts: NewAdsByScope;
}

interface ScopeChoice {
  productId: string | null;
  productName: string | null;
  newCount: number;
  totalCount: number;
}

export function AnalyzeButton({
  brandId,
  competitorId,
  hasAds,
  linkedProducts,
  newAdCounts,
}: AnalyzeButtonProps) {
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [billingError, setBillingError] = useState<BillingError | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedScope, setSelectedScope] = useState<ScopeChoice>({
    productId: null,
    productName: null,
    newCount: newAdCounts.whole.new,
    totalCount: newAdCounts.whole.total,
  });
  const router = useRouter();

  const allScopes: ScopeChoice[] = [
    {
      productId: null,
      productName: null,
      newCount: newAdCounts.whole.new,
      totalCount: newAdCounts.whole.total,
    },
    ...linkedProducts.map<ScopeChoice>((p) => ({
      productId: p.id,
      productName: p.name,
      newCount: newAdCounts.byProduct[p.id]?.new ?? 0,
      totalCount: newAdCounts.byProduct[p.id]?.total ?? 0,
    })),
  ];

  async function handleAnalyze(scope: ScopeChoice, mode: "incremental" | "all") {
    setAnalyzing(true);
    setError(null);
    setBillingError(null);
    setMenuOpen(false);
    setSelectedScope(scope);

    try {
      const res = await fetch("/api/competitors/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId,
          competitorId,
          productId: scope.productId,
          onlyNewAds: mode === "incremental",
        }),
      });

      await fetchJson(res);
      router.refresh();
    } catch (err) {
      if (isBillingError(err)) {
        setBillingError(err);
      } else {
        setError(err instanceof Error ? err.message : "Analysis failed");
      }
    } finally {
      setAnalyzing(false);
    }
  }

  const newCount = selectedScope.newCount;
  const totalCount = selectedScope.totalCount;
  const noNewAds = hasAds && newCount === 0;
  const primaryDisabled = analyzing || !hasAds || noNewAds;

  let primaryLabel: string;
  if (analyzing) {
    primaryLabel = "Analyzing…";
  } else if (!hasAds) {
    primaryLabel = "Analyze ads";
  } else if (noNewAds) {
    primaryLabel = "All ads analyzed";
  } else {
    const adsWord = `${newCount} new ad${newCount === 1 ? "" : "s"}`;
    primaryLabel = selectedScope.productName
      ? `Analyze ${adsWord} for ${truncate(selectedScope.productName, 14)}`
      : `Analyze ${adsWord}`;
  }

  // When the primary action is unavailable (no new ads, or no ads at all)
  // we render the split button as a muted/secondary control so it visibly
  // signals "not clickable", while keeping the chevron interactive so the
  // user can still open the menu and reach "Re-analyze all".
  const primaryClasses = primaryDisabled
    ? "inline-flex items-center justify-center gap-2 rounded-xl rounded-r-none border border-border bg-muted px-4 py-2 text-sm font-medium text-muted-foreground cursor-not-allowed"
    : "btn-primary flex items-center gap-2 rounded-r-none";
  const chevronClasses = primaryDisabled
    ? "inline-flex items-center justify-center rounded-xl rounded-l-none border border-l-0 border-border bg-muted px-2 text-muted-foreground hover:bg-muted/70 hover:text-foreground transition-colors"
    : "btn-primary rounded-l-none border-l border-primary-foreground/20 px-2";

  return (
    <div className="relative flex items-center gap-3">
      {billingError && (
        <BillingErrorBanner
          error={billingError}
          onDismiss={() => setBillingError(null)}
          className="hidden lg:flex"
        />
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex items-stretch overflow-hidden rounded-xl">
        <button
          onClick={() => handleAnalyze(selectedScope, "incremental")}
          disabled={primaryDisabled}
          className={primaryClasses}
          title={
            !hasAds
              ? "Add ads before analyzing"
              : noNewAds
                ? "Add more ads, or use Re-analyze all from the menu"
                : `Will send ${newCount} of ${totalCount} ads to the model`
          }
        >
          {analyzing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : noNewAds ? (
            <Check className="h-4 w-4" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {primaryLabel}
        </button>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          disabled={analyzing || !hasAds}
          aria-label="Pick analysis options"
          className={chevronClasses}
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border bg-card p-1 shadow-panel">
            <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Analyze new ads in scope
            </p>
            {allScopes.map((scope) => (
              <ScopeOption
                key={scope.productId ?? "whole"}
                active={selectedScope.productId === scope.productId}
                label={
                  scope.productName
                    ? `Just for ${scope.productName}`
                    : "Whole library"
                }
                hint={
                  scope.totalCount === 0
                    ? "No ads in this scope yet"
                    : scope.newCount === 0
                      ? `All ${scope.totalCount} ads analyzed`
                      : `${scope.newCount} of ${scope.totalCount} ad${scope.totalCount === 1 ? "" : "s"} are new`
                }
                disabled={scope.newCount === 0}
                onClick={() => handleAnalyze(scope, "incremental")}
              />
            ))}

            <div className="my-1 border-t" />
            <p className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Start over
            </p>
            <button
              type="button"
              onClick={() => handleAnalyze(selectedScope, "all")}
              disabled={selectedScope.totalCount === 0}
              className="flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left transition-colors hover:bg-muted disabled:opacity-50 disabled:hover:bg-transparent"
            >
              <RefreshCw className="mt-[3px] h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">
                  Re-analyze all
                  {selectedScope.productName
                    ? ` for ${selectedScope.productName}`
                    : ""}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Sends every ad in this scope ({selectedScope.totalCount}) to
                  the model from scratch.
                </div>
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function ScopeOption({
  active,
  label,
  hint,
  disabled,
  onClick,
}: {
  active: boolean;
  label: string;
  hint: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        "w-full rounded-lg px-3 py-2 text-left transition-colors hover:bg-muted disabled:opacity-50 disabled:hover:bg-transparent " +
        (active ? "bg-muted" : "")
      }
    >
      <div className="text-sm font-medium">{label}</div>
      <div className="text-[11px] text-muted-foreground">{hint}</div>
    </button>
  );
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
