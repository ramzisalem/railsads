"use client";

import { useState } from "react";
import Link from "next/link";
import { MessageSquare, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ThreadListItem } from "@/lib/studio/types";

interface ThreadListProps {
  threads: ThreadListItem[];
  activeThreadId?: string;
}

function timeLabel(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function ThreadList({ threads, activeThreadId }: ThreadListProps) {
  const [open, setOpen] = useState(false);

  const activeThread = threads.find((t) => t.id === activeThreadId);

  return (
    <div className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="btn-secondary flex w-full max-w-full items-center gap-2 text-left"
      >
        <MessageSquare className="h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">
          {activeThread
            ? activeThread.title ?? activeThread.product_name
            : "Threads"}
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 z-40 mt-2 w-80 rounded-2xl border bg-card shadow-panel overflow-hidden">
            <div className="p-3 border-b">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Creative Threads
              </h4>
            </div>

            {threads.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No threads yet
              </div>
            ) : (
              <div className="max-h-[320px] overflow-y-auto divide-y">
                {threads.map((thread) => {
                  const isActive = thread.id === activeThreadId;
                  return (
                    <Link
                      key={thread.id}
                      href={`/studio/${thread.id}`}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted",
                        isActive && "bg-primary-soft"
                      )}
                    >
                      <MessageSquare
                        className={cn(
                          "h-4 w-4 shrink-0 mt-0.5",
                          isActive
                            ? "text-primary"
                            : "text-muted-foreground"
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">
                          {thread.title ?? thread.product_name}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                          <span className="truncate">
                            {thread.product_name}
                          </span>
                          {thread.icp_title && (
                            <>
                              <span>·</span>
                              <span className="truncate">
                                {thread.icp_title}
                              </span>
                            </>
                          )}
                        </div>
                        {thread.last_message_at && (
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {timeLabel(thread.last_message_at)}
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
