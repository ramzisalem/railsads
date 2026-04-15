"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { Archive, Check, Pencil, X } from "lucide-react";
import { updateThreadTitle, archiveThread } from "@/lib/studio/actions";
import type { ThreadDetail } from "@/lib/studio/types";

interface ThreadHeaderProps {
  thread: ThreadDetail;
}

export function ThreadHeader({ thread }: ThreadHeaderProps) {
  const [showArchive, setShowArchive] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(thread.title ?? "");
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function startEdit() {
    setDraft(thread.title ?? "");
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
  }

  function saveTitle() {
    const trimmed = draft.trim();
    if (trimmed === (thread.title ?? "")) {
      setEditing(false);
      return;
    }
    startTransition(async () => {
      const result = await updateThreadTitle(thread.id, trimmed);
      if (!result?.error) setEditing(false);
    });
  }

  function handleArchive() {
    startTransition(async () => {
      await archiveThread(thread.id);
    });
  }

  return (
    <div className="mt-4 flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") cancel();
                if (e.key === "Enter") {
                  e.preventDefault();
                  saveTitle();
                }
              }}
              className="input-field flex-1 text-sm"
              placeholder="Thread title"
              disabled={isPending}
            />
            <button
              onClick={saveTitle}
              disabled={isPending}
              className="rounded-lg p-1.5 text-primary hover:bg-primary-soft transition-colors"
              aria-label="Save"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              onClick={cancel}
              disabled={isPending}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors"
              aria-label="Cancel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div
            className="group flex items-center gap-2 rounded-lg px-2 py-1.5 -mx-2 cursor-pointer hover:bg-muted transition-colors"
            onClick={startEdit}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && startEdit()}
          >
            <span className="text-sm font-medium truncate">
              {thread.title || "Untitled thread"}
            </span>
            <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        )}
      </div>

      <div className="shrink-0">
        {!showArchive ? (
          <button
            onClick={() => setShowArchive(true)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Archive className="h-3.5 w-3.5" />
            Archive
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Archive this thread?
            </span>
            <button
              onClick={handleArchive}
              disabled={isPending}
              className="rounded-lg bg-muted px-3 py-1 text-xs font-medium hover:bg-muted/80 transition-colors"
            >
              {isPending ? "Archiving..." : "Yes"}
            </button>
            <button
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
