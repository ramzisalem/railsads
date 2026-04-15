export default function StudioLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Page header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="h-10 w-48 rounded-xl bg-muted" />
        <div className="flex items-center gap-3">
          <div className="h-10 w-36 rounded-xl bg-muted" />
          <div className="h-10 w-36 rounded-xl bg-muted" />
        </div>
      </div>

      {/* Empty state placeholder */}
      <div className="flex min-h-[400px] items-center justify-center rounded-2xl border border-dashed">
        <div className="text-center space-y-4">
          <div className="mx-auto h-10 w-10 rounded-full bg-muted" />
          <div className="h-6 w-40 mx-auto rounded-lg bg-muted" />
          <div className="h-4 w-64 mx-auto rounded-lg bg-muted" />
        </div>
      </div>
    </div>
  );
}
