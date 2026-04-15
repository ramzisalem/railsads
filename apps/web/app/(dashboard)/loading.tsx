export default function DashboardLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Header: greeting + button */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-10 w-64 rounded-xl bg-muted" />
          <div className="h-4 w-40 rounded-lg bg-muted" />
        </div>
        <div className="h-10 w-36 rounded-xl bg-muted" />
      </div>

      {/* Continue creative card */}
      <div className="h-32 rounded-2xl bg-muted" />

      {/* Recent creatives grid */}
      <div className="space-y-4">
        <div className="h-6 w-40 rounded-lg bg-muted" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-muted" />
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div className="space-y-4">
        <div className="h-6 w-32 rounded-lg bg-muted" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-muted" />
          ))}
        </div>
      </div>
    </div>
  );
}
