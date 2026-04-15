import Link from "next/link";
import { MessageSquare, ArrowRight } from "lucide-react";
import type { RecentThread } from "@/lib/dashboard/queries";
import { timeAgo } from "@/lib/utils/time";

interface RecentCreativesProps {
  threads: RecentThread[];
}

export function RecentCreatives({ threads }: RecentCreativesProps) {
  if (threads.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="heading-md">Recent creatives</h2>
        <Link
          href="/studio"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
        >
          View all <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {threads.map((thread) => (
          <Link
            key={thread.id}
            href={`/studio/${thread.id}`}
            className="group rounded-2xl border bg-card p-5 shadow-soft transition-colors hover:bg-muted/50"
          >
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              <p className="text-sm font-medium truncate">
                {thread.title ?? `${thread.product_name} creative`}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="tag text-xs">{thread.product_name}</span>
                {thread.icp_title && (
                  <span className="tag text-xs">{thread.icp_title}</span>
                )}
              </div>

              {thread.last_hook && (
                <p className="text-xs text-muted-foreground line-clamp-2 italic">
                  &ldquo;{thread.last_hook}&rdquo;
                </p>
              )}

              <p className="text-xs text-muted-foreground">
                {thread.last_message_at
                  ? timeAgo(thread.last_message_at)
                  : "No messages yet"}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
