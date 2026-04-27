"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Loader2 } from "lucide-react";
import {
  BillingError,
  fetchJson,
  isBillingError,
} from "@/lib/billing/client";
import { BillingErrorBanner } from "@/components/billing/billing-error-banner";

interface ReimportButtonProps {
  brandId: string;
  websiteUrl: string | null;
}

export function ReimportButton({ brandId, websiteUrl }: ReimportButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [billingError, setBillingError] = useState<BillingError | null>(null);
  const router = useRouter();

  async function handleReimport() {
    if (!websiteUrl) return;
    setLoading(true);
    setError(null);
    setBillingError(null);

    try {
      const res = await fetch("/api/brand/reimport", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId, websiteUrl }),
      });

      await fetchJson(res);
      router.refresh();
    } catch (err) {
      if (isBillingError(err)) {
        setBillingError(err);
      } else {
        setError(err instanceof Error ? err.message : "Re-import failed");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {billingError && (
        <BillingErrorBanner
          error={billingError}
          onDismiss={() => setBillingError(null)}
        />
      )}
      <div className="flex items-center gap-3">
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button
          onClick={handleReimport}
          disabled={loading || !websiteUrl}
          className="btn-secondary flex items-center gap-2"
          title={!websiteUrl ? "No website URL on file" : undefined}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {loading ? "Re-importing…" : "Re-import website"}
        </button>
      </div>
    </div>
  );
}
