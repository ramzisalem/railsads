"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2 } from "lucide-react";

interface AnalyzeButtonProps {
  brandId: string;
  competitorId: string;
  hasAds: boolean;
}

export function AnalyzeButton({
  brandId,
  competitorId,
  hasAds,
}: AnalyzeButtonProps) {
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleAnalyze() {
    setAnalyzing(true);
    setError(null);

    try {
      const res = await fetch("/api/competitors/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId, competitorId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Analysis failed");
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
      <button
        onClick={handleAnalyze}
        disabled={analyzing || !hasAds}
        className="btn-primary flex items-center gap-2"
        title={!hasAds ? "Add ads before analyzing" : undefined}
      >
        {analyzing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        {analyzing ? "Analyzing…" : "Analyze ads"}
      </button>
    </div>
  );
}
