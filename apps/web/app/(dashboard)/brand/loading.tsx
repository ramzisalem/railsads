export default function BrandLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Page header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="h-10 w-28 rounded-xl bg-muted" />
          <div className="h-4 w-72 rounded-lg bg-muted" />
        </div>
        <div className="h-10 w-40 rounded-xl bg-muted" />
      </div>

      {/* Two-column grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border bg-card p-6 space-y-4">
            <div className="h-6 w-32 rounded-lg bg-muted" />
            <div className="space-y-2">
              <div className="h-4 w-full rounded-lg bg-muted" />
              <div className="h-4 w-3/4 rounded-lg bg-muted" />
              <div className="h-4 w-1/2 rounded-lg bg-muted" />
            </div>
            {i === 2 && (
              <div className="flex gap-3 pt-2">
                {Array.from({ length: 5 }).map((_, j) => (
                  <div key={j} className="h-8 w-8 rounded-full bg-muted" />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Source section */}
      <div className="rounded-2xl border bg-card p-6 space-y-3">
        <div className="h-6 w-28 rounded-lg bg-muted" />
        <div className="h-4 w-64 rounded-lg bg-muted" />
      </div>
    </div>
  );
}
