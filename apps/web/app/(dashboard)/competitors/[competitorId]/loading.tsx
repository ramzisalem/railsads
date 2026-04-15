export default function CompetitorDetailLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Back link + header */}
      <div>
        <div className="mb-4 h-4 w-32 rounded-lg bg-muted" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="h-10 w-48 rounded-xl bg-muted" />
            <div className="h-4 w-56 rounded-lg bg-muted" />
          </div>
          <div className="h-10 w-32 rounded-xl bg-muted" />
        </div>
      </div>

      {/* Three-column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1 space-y-6">
          {/* Overview card */}
          <div className="rounded-2xl border bg-card p-6 space-y-4">
            <div className="h-6 w-28 rounded-lg bg-muted" />
            <div className="space-y-2">
              <div className="h-4 w-full rounded-lg bg-muted" />
              <div className="h-4 w-3/4 rounded-lg bg-muted" />
            </div>
          </div>
          {/* Product mapping card */}
          <div className="rounded-2xl border bg-card p-6 space-y-3">
            <div className="h-6 w-36 rounded-lg bg-muted" />
            <div className="h-8 w-full rounded-xl bg-muted" />
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          {/* Ad library */}
          <div className="rounded-2xl border bg-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="h-6 w-28 rounded-lg bg-muted" />
              <div className="h-8 w-20 rounded-xl bg-muted" />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-40 rounded-xl bg-muted" />
              ))}
            </div>
          </div>
          {/* Insights */}
          <div className="rounded-2xl border bg-card p-6 space-y-3">
            <div className="h-6 w-24 rounded-lg bg-muted" />
            <div className="h-4 w-full rounded-lg bg-muted" />
            <div className="h-4 w-2/3 rounded-lg bg-muted" />
          </div>
        </div>
      </div>
    </div>
  );
}
