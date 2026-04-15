export default function ProductDetailLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Back link + header */}
      <div>
        <div className="mb-3 h-4 w-20 rounded-lg bg-muted" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="h-10 w-56 rounded-xl bg-muted" />
            <div className="h-4 w-80 rounded-lg bg-muted" />
          </div>
          <div className="h-10 w-48 rounded-xl bg-muted" />
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_1fr]">
        {/* Product overview */}
        <div className="rounded-2xl border bg-card p-6 space-y-4">
          <div className="h-6 w-32 rounded-lg bg-muted" />
          <div className="space-y-2">
            <div className="h-4 w-full rounded-lg bg-muted" />
            <div className="h-4 w-3/4 rounded-lg bg-muted" />
            <div className="h-4 w-1/2 rounded-lg bg-muted" />
          </div>
          <div className="flex gap-2 pt-2">
            <div className="h-6 w-16 rounded-full bg-muted" />
            <div className="h-6 w-20 rounded-full bg-muted" />
            <div className="h-6 w-14 rounded-full bg-muted" />
          </div>
        </div>

        {/* ICPs section */}
        <div className="rounded-2xl border bg-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="h-6 w-40 rounded-lg bg-muted" />
            <div className="h-8 w-24 rounded-xl bg-muted" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl border p-4 space-y-2">
                <div className="h-5 w-40 rounded-lg bg-muted" />
                <div className="h-4 w-full rounded-lg bg-muted" />
                <div className="h-4 w-2/3 rounded-lg bg-muted" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
