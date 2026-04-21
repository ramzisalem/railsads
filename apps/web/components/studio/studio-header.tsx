"use client";

import { ThreadList } from "./thread-list";
import { NewThreadForm } from "./new-thread-form";
import type {
  ThreadDetail,
  ThreadListItem,
  StudioContext,
} from "@/lib/studio/types";

interface StudioHeaderProps {
  brandId: string;
  thread: ThreadDetail;
  threads: ThreadListItem[];
  context: StudioContext;
}

/**
 * Compact, single-row top bar for the Studio thread page.
 *
 * Mirrors the title typography of other dashboard pages (heading-xl) so the
 * Studio doesn't feel like a different product. The thread switcher sits on
 * the right next to the primary "+ New creative" action — that's the natural
 * grouping (both are actions on the thread surface), and it keeps the title
 * uncluttered on the left.
 */
export function StudioHeader({
  brandId,
  thread,
  threads,
  context,
}: StudioHeaderProps) {
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <h1 className="heading-md min-w-0 truncate">Creative Studio</h1>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <ThreadList threads={threads} activeThreadId={thread.id} />
        <NewThreadForm brandId={brandId} context={context} />
      </div>
    </div>
  );
}
