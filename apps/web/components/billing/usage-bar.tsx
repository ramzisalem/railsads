import { creditsToCreatives } from "@/lib/billing/stripe";

export interface UsageInfo {
  creditsGranted: number;
  creditsUsed: number;
  creditsRemaining: number;
  creativeGenerations: number;
  imageGenerations: number;
  icpGenerations: number;
  competitorAnalyses: number;
  websiteImports: number;
}

interface UsageBarProps {
  usage: UsageInfo;
}

export function UsageBar({ usage }: UsageBarProps) {
  const totalCreatives = creditsToCreatives(usage.creditsGranted);
  const usedCreatives = creditsToCreatives(usage.creditsUsed);
  const percentage =
    usage.creditsGranted > 0
      ? Math.min(
          Math.round((usage.creditsUsed / usage.creditsGranted) * 100),
          100
        )
      : 0;

  const isWarning = percentage >= 80;
  const isExhausted = percentage >= 100;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          {isExhausted
            ? "Credit limit reached"
            : `${usedCreatives} / ${totalCreatives} creatives used`}
        </p>
        <span className="text-xs text-muted-foreground">{percentage}%</span>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isExhausted
              ? "bg-destructive"
              : isWarning
                ? "bg-amber-500"
                : "bg-primary"
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {isWarning && !isExhausted && (
        <p className="text-xs text-amber-600">
          You&apos;re approaching your monthly limit. Consider upgrading for
          more creatives.
        </p>
      )}

      {isExhausted && (
        <p className="text-xs text-destructive">
          You&apos;ve used all your creatives this month. Upgrade your plan to
          continue creating.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 pt-1 sm:grid-cols-4">
        <UsageStat label="Creatives" value={usage.creativeGenerations} />
        <UsageStat label="Images" value={usage.imageGenerations} />
        <UsageStat label="ICPs" value={usage.icpGenerations} />
        <UsageStat label="Analyses" value={usage.competitorAnalyses} />
      </div>
    </div>
  );
}

function UsageStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <p className="text-lg font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
