export default function SettingsLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Page header */}
      <div className="space-y-2">
        <div className="h-10 w-32 rounded-xl bg-muted" />
        <div className="h-4 w-64 rounded-lg bg-muted" />
      </div>

      <div className="max-w-2xl space-y-6">
        {/* Profile card */}
        <div className="rounded-2xl border bg-card p-6 space-y-4">
          <div className="h-6 w-20 rounded-lg bg-muted" />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <div className="h-3 w-16 rounded bg-muted" />
                <div className="h-5 w-48 rounded-lg bg-muted" />
              </div>
            ))}
          </div>
        </div>

        {/* Billing card */}
        <div className="rounded-2xl border bg-card p-6 space-y-4">
          <div className="h-6 w-32 rounded-lg bg-muted" />
          <div className="h-4 w-56 rounded-lg bg-muted" />
          <div className="h-3 w-full rounded-full bg-muted" />
          <div className="h-10 w-40 rounded-xl bg-muted" />
        </div>

        {/* Account card */}
        <div className="rounded-2xl border bg-card p-6 space-y-4">
          <div className="h-6 w-24 rounded-lg bg-muted" />
          <div className="h-10 w-24 rounded-xl bg-muted" />
        </div>
      </div>
    </div>
  );
}
