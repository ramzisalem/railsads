"use client";

import { useState, useTransition } from "react";
import {
  Copy,
  Heart,
  MoreHorizontal,
  Pencil,
  ShieldAlert,
  Sparkles,
  Star,
  Trash2,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  deleteIcp,
  duplicateIcp,
  updateIcp,
} from "@/lib/products/icp-actions";
import type { IcpItem } from "@/lib/products/queries";

interface IcpCardProps {
  icp: IcpItem;
  onEdit: (icp: IcpItem) => void;
}

interface SectionProps {
  label: string;
  icon: LucideIcon;
  /** Tailwind classes for the icon chip background + text color. */
  accent: string;
  items: string[];
}

function Section({ label, icon: Icon, accent, items }: SectionProps) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="flex items-center gap-1.5">
        <span
          className={`flex h-5 w-5 items-center justify-center rounded-md ${accent}`}
        >
          <Icon className="h-3 w-3" />
        </span>
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      </div>
      <ul className="mt-2 space-y-1.5">
        {items.map((item, i) => (
          <li
            key={i}
            className="flex items-start gap-2 text-small text-card-foreground"
          >
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" />
            <span className="leading-relaxed">{item}</span>
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

  const totalItems =
    icp.pains.length +
    icp.desires.length +
    icp.objections.length +
    icp.triggers.length;

  return (
    <article
      className={cn(
        "panel relative space-y-5 p-5 transition-opacity",
        isPending && "opacity-60 pointer-events-none",
        icp.is_primary && "ring-1 ring-primary/40"
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-card-foreground">
              {icp.title}
            </h3>
            {icp.is_primary && (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary"
                title="Primary audience"
              >
                <Star className="h-3 w-3 fill-primary text-primary" />
                Primary
              </span>
            )}
          </div>
          {icp.summary && (
            <p className="mt-1.5 text-small leading-relaxed text-muted-foreground">
              {icp.summary}
            </p>
          )}
        </div>

        <div className="relative shrink-0">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Audience actions"
            aria-expanded={menuOpen}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>

          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-xl border border-border bg-card p-1 shadow-panel">
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
      </header>

      {totalItems > 0 ? (
        <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
          <Section
            label="Pains"
            icon={Heart}
            accent="text-rose-500 bg-rose-500/10"
            items={icp.pains}
          />
          <Section
            label="Desires"
            icon={Sparkles}
            accent="text-primary bg-primary-soft"
            items={icp.desires}
          />
          <Section
            label="Objections"
            icon={ShieldAlert}
            accent="text-amber-600 bg-amber-500/10"
            items={icp.objections}
          />
          <Section
            label="Triggers"
            icon={Zap}
            accent="text-violet-600 bg-violet-500/10"
            items={icp.triggers}
          />
        </div>
      ) : (
        <p className="text-small text-muted-foreground">
          No pains, desires, objections, or triggers yet.{" "}
          <button
            type="button"
            onClick={() => onEdit(icp)}
            className="text-primary hover:underline"
          >
            Add details
          </button>
          .
        </p>
      )}

      {confirmDelete && (
        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
          <span className="text-xs text-destructive">Delete this audience?</span>
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
    </article>
  );
}
