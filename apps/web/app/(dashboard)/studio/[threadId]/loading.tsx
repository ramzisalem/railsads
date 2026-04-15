export default function ThreadLoading() {
  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)] md:h-[calc(100vh-4rem)] animate-pulse">
      {/* Page header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="h-10 w-48 rounded-xl bg-muted" />
        <div className="flex items-center gap-3">
          <div className="h-10 w-36 rounded-xl bg-muted" />
          <div className="h-10 w-36 rounded-xl bg-muted" />
        </div>
      </div>

      {/* Thread header */}
      <div className="mt-3 h-8 w-64 rounded-lg bg-muted" />

      {/* Two-column layout */}
      <div className="mt-4 flex-1 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px] min-h-0">
        {/* Conversation area */}
        <div className="rounded-2xl border bg-card p-6 space-y-6 min-h-0">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-full rounded-lg bg-muted" />
              <div className="h-4 w-3/4 rounded-lg bg-muted" />
              {i === 1 && (
                <div className="mt-3 rounded-xl border p-4 space-y-2">
                  <div className="h-5 w-24 rounded-lg bg-muted" />
                  <div className="h-4 w-full rounded-lg bg-muted" />
                  <div className="h-4 w-2/3 rounded-lg bg-muted" />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Context panel */}
        <div className="rounded-2xl bg-secondary-soft p-5 space-y-4 self-start">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-card p-4 space-y-2">
              <div className="h-3 w-16 rounded bg-muted" />
              <div className="h-5 w-32 rounded-lg bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
