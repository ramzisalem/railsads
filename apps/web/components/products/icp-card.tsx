"use client";

import { useState, useTransition } from "react";
import { Copy, MoreHorizontal, Pencil, Star, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { deleteIcp, duplicateIcp, updateIcp } from "@/lib/products/icp-actions";
import type { IcpItem } from "@/lib/products/queries";

interface IcpCardProps {
  icp: IcpItem;
  onEdit: (icp: IcpItem) => void;
}

function TagList({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <ul className="mt-1 space-y-0.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-small">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-secondary" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function IcpCard({ icp, onEdit }: IcpCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDuplicate() {
    setMenuOpen(false);
    startTransition(async () => {
      await duplicateIcp(icp.id, icp.product_id);
    });
  }

  function handleDelete() {
    setMenuOpen(false);
    setConfirmDelete(true);
  }

  function confirmDeleteAction() {
    startTransition(async () => {
      await deleteIcp(icp.id, icp.product_id);
    });
  }

  function handleTogglePrimary() {
    setMenuOpen(false);
    startTransition(async () => {
      await updateIcp(icp.id, icp.product_id, {
        is_primary: !icp.is_primary,
      });
    });
  }

  return (
    <div
      className={cn(
        "panel relative space-y-4 p-5 transition-opacity",
        isPending && "opacity-60 pointer-events-none",
        icp.is_primary && "ring-1 ring-primary/30"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium truncate">{icp.title}</h3>
            {icp.is_primary && (
              <Star className="h-3.5 w-3.5 shrink-0 fill-primary text-primary" />
            )}
          </div>
          {icp.summary && (
            <p className="mt-1 text-small text-muted-foreground line-clamp-2">
              {icp.summary}
            </p>
          )}
        </div>

        <div className="relative shrink-0">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="ICP actions"
            aria-expanded={menuOpen}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>

          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 top-full z-50 mt-1 w-40 rounded-xl border bg-card p-1 shadow-panel">
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onEdit(icp);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </button>
                <button
                  onClick={handleDuplicate}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted transition-colors"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Duplicate
                </button>
                <button
                  onClick={handleTogglePrimary}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted transition-colors"
                >
                  <Star className="h-3.5 w-3.5" />
                  {icp.is_primary ? "Unset primary" : "Set as primary"}
                </button>
                <button
                  onClick={handleDelete}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TagList label="Pains" items={icp.pains} />
        <TagList label="Desires" items={icp.desires} />
        <TagList label="Objections" items={icp.objections} />
        <TagList label="Triggers" items={icp.triggers} />
      </div>

      {confirmDelete && (
        <div className="flex items-center gap-3 border-t pt-3">
          <span className="text-xs text-destructive">Delete this ICP?</span>
          <button
            onClick={confirmDeleteAction}
            disabled={isPending}
            className="rounded-lg bg-destructive px-3 py-1 text-xs font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors"
          >
            {isPending ? "Deleting..." : "Confirm"}
          </button>
          <button
            onClick={() => setConfirmDelete(false)}
            disabled={isPending}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {icp.source === "ai_generated" && !confirmDelete && (
        <div className="text-[10px] text-muted-foreground">AI-generated</div>
      )}
    </div>
  );
}
