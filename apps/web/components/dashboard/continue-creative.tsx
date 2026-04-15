import Link from "next/link";
import { ArrowRight, MessageSquare, Sparkles } from "lucide-react";
import type { RecentThread } from "@/lib/dashboard/queries";
import { timeAgo } from "@/lib/utils/time";

interface ContinueCreativeProps {
  thread: RecentThread | null;
}

export function ContinueCreative({ thread }: ContinueCreativeProps) {
  if (!thread) {
    return (
      <section className="space-y-4">
        <h2 className="heading-md">Continue where you left off</h2>
        <div className="rounded-2xl border bg-card p-6 shadow-soft">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">No creatives yet</p>
              <p className="text-small text-muted-foreground">
                Create your first ad to get started
              </p>
            </div>
            <Link
              href="/studio"
              className="btn-primary flex items-center gap-2"
            >
              <Sparkles className="h-4 w-4" />
              Create ad
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h2 className="heading-md">Continue where you left off</h2>
      <Link
        href={`/studio/${thread.id}`}
        className="group block rounded-2xl border bg-card p-6 shadow-soft transition-colors hover:bg-muted/50"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary shrink-0" />
              <p className="text-sm font-medium truncate">
                {thread.title ?? `${thread.product_name} creative`}
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{thread.product_name}</span>
              {thread.icp_title && (
                <>
                  <span className="text-border">|</span>
                  <span>{thread.icp_title}</span>
                </>
              )}
              {thread.last_message_at && (
                <>
                  <span className="text-border">|</span>
                  <span>{timeAgo(thread.last_message_at)}</span>
                </>
              )}
            </div>
            {thread.last_hook && (
              <p className="text-sm text-muted-foreground line-clamp-1 italic">
                &ldquo;{thread.last_hook}&rdquo;
              </p>
            )}
          </div>
          <div className="shrink-0 mt-1">
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
              Continue <ArrowRight className="h-4 w-4" />
            </span>
          </div>
        </div>
      </Link>
    </section>
  );
}
