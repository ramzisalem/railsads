"use client";

import { useState, useTransition } from "react";
import { Archive } from "lucide-react";
import { archiveThread } from "@/lib/studio/actions";
import type { ThreadDetail } from "@/lib/studio/types";

interface ThreadHeaderProps {
  thread: ThreadDetail;
}

export function ThreadHeader({ thread }: ThreadHeaderProps) {
  const [showArchive, setShowArchive] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleArchive() {
    startTransition(async () => {
      await archiveThread(thread.id);
    });
  }

  return (
    <div className="mt-2 flex justify-end">
      <div className="shrink-0">
        {!showArchive ? (
          <button
            type="button"
            onClick={() => setShowArchive(true)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Archive className="h-3.5 w-3.5" />
            Archive
          </button>
        ) : (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="text-xs text-muted-foreground">
              Archive this thread?
            </span>
            <button
              type="button"
              onClick={handleArchive}
              disabled={isPending}
              className="rounded-lg bg-muted px-3 py-1 text-xs font-medium hover:bg-muted/80 transition-colors"
            >
              {isPending ? "Archiving..." : "Yes"}
            </button>
            <button
              type="button"
              onClick={() => setShowArchive(false)}
              disabled={isPending}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
