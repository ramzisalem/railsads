"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { archiveThread, updateThreadTitle } from "@/lib/studio/actions";
import type { ThreadListItem } from "@/lib/studio/types";

const ACTION_MENU_W = 144; // w-36
const ACTION_MENU_H = 88; // two rows + padding

interface ThreadListProps {
  threads: ThreadListItem[];
  activeThreadId?: string;
}

export function ThreadList({ threads, activeThreadId }: ThreadListProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [actionMenu, setActionMenu] = useState<{
    threadId: string;
    top: number;
    left: number;
  } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const activeThread = threads.find((t) => t.id === activeThreadId);
  const triggerLabel = activeThread
    ? activeThread.title ?? activeThread.product_name
    : "Threads";

  const actionThread = actionMenu
    ? threads.find((t) => t.id === actionMenu.threadId)
    : null;

  useEffect(() => {
    if (!actionMenu) return;
    function close() {
      setActionMenu(null);
    }
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [actionMenu]);

  function closePopups() {
    setActionMenu(null);
    setEditingId(null);
    setConfirmDeleteId(null);
  }

  function closeList() {
    setOpen(false);
    closePopups();
  }

  function handleSelect(threadId: string) {
    closeList();
    if (threadId !== activeThreadId) router.push(`/studio/${threadId}`);
  }

  function startRename(thread: ThreadListItem) {
    setActionMenu(null);
    setEditingId(thread.id);
    setEditingValue(thread.title ?? thread.product_name);
  }

  function commitRename() {
    if (!editingId) return;
    const value = editingValue.trim();
    if (!value) {
      setEditingId(null);
      return;
    }
    const id = editingId;
    startTransition(async () => {
      await updateThreadTitle(id, value);
      router.refresh();
    });
    setEditingId(null);
  }

  function handleDelete(threadId: string) {
    startTransition(async () => {
      await archiveThread(threadId);
    });
    setConfirmDeleteId(null);
    closeList();
  }

  function openActionMenu(threadId: string, e: MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    const btn = e.currentTarget;
    if (actionMenu?.threadId === threadId) {
      setActionMenu(null);
      return;
    }
    const r = btn.getBoundingClientRect();
    let top = r.bottom + 4;
    if (top + ACTION_MENU_H > window.innerHeight - 12) {
      top = Math.max(8, r.top - ACTION_MENU_H - 4);
    }
    let left = r.right - ACTION_MENU_W;
    if (left < 8) left = 8;
    if (left + ACTION_MENU_W > window.innerWidth - 8) {
      left = window.innerWidth - ACTION_MENU_W - 8;
    }
    setActionMenu({ threadId, top, left });
  }

  return (
    <div className="relative inline-block max-w-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="group inline-flex max-w-full min-w-[14rem] items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-left transition-colors hover:bg-muted"
      >
        <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
          {triggerLabel}
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={closeList} />
          <div
            role="listbox"
            className="absolute left-0 top-full z-40 mt-1.5 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-border bg-card p-1 shadow-panel"
          >
            {threads.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                No threads yet
              </div>
            ) : (
              <div className="max-h-[min(60vh,22rem)] overflow-y-auto overflow-x-visible">
                {threads.map((thread) => (
                  <ThreadRow
                    key={thread.id}
                    thread={thread}
                    isActive={thread.id === activeThreadId}
                    isEditing={editingId === thread.id}
                    editingValue={editingValue}
                    onEditingValueChange={setEditingValue}
                    onCommitRename={commitRename}
                    onCancelRename={() => setEditingId(null)}
                    menuOpen={actionMenu?.threadId === thread.id}
                    onMenuButtonClick={(e) => openActionMenu(thread.id, e)}
                    confirmingDelete={confirmDeleteId === thread.id}
                    onSelect={() => handleSelect(thread.id)}
                    onCancelDelete={() => setConfirmDeleteId(null)}
                    onConfirmDelete={() => handleDelete(thread.id)}
                    isPending={isPending}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {actionMenu &&
        actionThread &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[100]"
              aria-hidden
              onClick={() => setActionMenu(null)}
            />
            <div
              role="menu"
              className="fixed z-[110] w-36 overflow-hidden rounded-lg border border-border bg-card p-1 shadow-panel"
              style={{
                top: actionMenu.top,
                left: actionMenu.left,
              }}
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setActionMenu(null);
                  startRename(actionThread);
                }}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-foreground transition-colors hover:bg-muted"
              >
                <Pencil className="h-3 w-3" />
                Rename
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setActionMenu(null);
                  setConfirmDeleteId(actionThread.id);
                }}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-destructive transition-colors hover:bg-destructive/10"
              >
                <Trash2 className="h-3 w-3" />
                Delete
              </button>
            </div>
          </>,
          document.body
        )}
    </div>
  );
}

interface ThreadRowProps {
  thread: ThreadListItem;
  isActive: boolean;
  isEditing: boolean;
  editingValue: string;
  onEditingValueChange: (value: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  menuOpen: boolean;
  onMenuButtonClick: (e: MouseEvent<HTMLButtonElement>) => void;
  confirmingDelete: boolean;
  onSelect: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
  isPending: boolean;
}

function ThreadRow({
  thread,
  isActive,
  isEditing,
  editingValue,
  onEditingValueChange,
  onCommitRename,
  onCancelRename,
  menuOpen,
  onMenuButtonClick,
  confirmingDelete,
  onSelect,
  onCancelDelete,
  onConfirmDelete,
  isPending,
}: ThreadRowProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  function handleEditingKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      onCommitRename();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancelRename();
    }
  }

  if (confirmingDelete) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm">
        <span className="min-w-0 flex-1 truncate text-destructive">
          Delete this thread?
        </span>
        <button
          type="button"
          onClick={onCancelDelete}
          disabled={isPending}
          className="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirmDelete}
          disabled={isPending}
          className="rounded-md bg-destructive px-2 py-1 text-xs font-medium text-destructive-foreground transition-colors hover:bg-destructive/90"
        >
          {isPending ? "..." : "Delete"}
        </button>
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-2 py-1.5">
        <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={editingValue}
          onChange={(e) => onEditingValueChange(e.target.value)}
          onKeyDown={handleEditingKey}
          onBlur={onCommitRename}
          className="min-w-0 flex-1 rounded-md border border-border bg-card px-2 py-1 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/60"
        />
        <button
          type="button"
          onClick={onCancelRename}
          aria-label="Cancel"
          className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group relative flex items-center gap-2 rounded-lg pl-2 pr-1 transition-colors",
        isActive ? "bg-primary-soft" : "hover:bg-muted"
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-2 py-2 text-left"
      >
        <MessageSquare
          className={cn(
            "h-4 w-4 shrink-0",
            isActive ? "text-primary" : "text-muted-foreground"
          )}
        />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
          {thread.title ?? thread.product_name}
        </span>
        {isActive && (
          <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
        )}
      </button>

      <div className="relative shrink-0">
        <button
          type="button"
          onClick={onMenuButtonClick}
          aria-label="Thread actions"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          className={cn(
            "rounded-md p-1.5 text-muted-foreground transition-all hover:bg-card hover:text-foreground",
            isActive || menuOpen
              ? "opacity-100"
              : "opacity-0 group-hover:opacity-100"
          )}
          data-open={menuOpen}
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
