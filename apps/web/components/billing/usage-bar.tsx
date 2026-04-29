export interface UsageInfo {
  creditsGranted: number;
  creditsUsed: number;
  creditsRemaining: number;
  /** Plan or trial allowance — use this as the bar denominator. */
  creditsLimit?: number;
}

interface UsageBarProps {
  usage: UsageInfo;
}

export function UsageBar({ usage }: UsageBarProps) {
  const denominator = Math.max(usage.creditsLimit ?? usage.creditsGranted, 0);
  const percentage =
    denominator > 0
      ? Math.min(Math.round((usage.creditsUsed / denominator) * 100), 100)
      : 0;

  const isWarning = percentage >= 80;
  const isExhausted = percentage >= 100;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          {isExhausted
            ? "Credit limit reached"
            : `${usage.creditsUsed.toLocaleString()} / ${denominator.toLocaleString()} credits used`}
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
          You&apos;re approaching your monthly credit limit. Consider upgrading
          for more credits.
        </p>
      )}

      {isExhausted && (
        <p className="text-xs text-destructive">
          You&apos;ve used all your credits this month. Upgrade your plan to
          continue creating.
        </p>
      )}
    </div>
  );
}
