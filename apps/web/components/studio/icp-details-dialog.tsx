"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Heart,
  Loader2,
  Pencil,
  ShieldAlert,
  Sparkles,
  Star,
  Trash2,
  Users,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { IcpOption } from "@/lib/studio/types";
import { deleteIcp } from "@/lib/products/icp-actions";

interface IcpDetailsDialogProps {
  icp: IcpOption;
  onClose: () => void;
  /** When provided, the "Edit" action is shown and this runs instead of
   *  the default details view — usually closing this dialog and opening
   *  an edit form. */
  onEdit?: () => void;
  /** Called after a successful soft-delete so the parent can clear any
   *  thread-level reference to this audience. */
  onDeleted?: (icpId: string) => void;
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
            <span className="leading-relaxed [overflow-wrap:anywhere]">
              {item}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function IcpDetailsDialog({
  icp,
  onClose,
  onEdit,
  onDeleted,
}: IcpDetailsDialogProps) {
  const router = useRouter();
  const [isDeleting, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const totalItems =
    icp.pains.length +
    icp.desires.length +
    icp.objections.length +
    icp.triggers.length;

  function handleDelete() {
    if (
      !window.confirm(
        `Delete "${icp.title}"? This audience won't appear in the picker anymore. You can restore it later from the product page.`
      )
    ) {
      return;
    }
    setDeleteError(null);
    startDelete(async () => {
      const result = await deleteIcp(icp.id, icp.product_id);
      if (result.error) {
        setDeleteError(result.error);
        return;
      }
      onDeleted?.(icp.id);
      router.refresh();
      onClose();
    });
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-foreground/30 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="icp-details-title"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      >
        <div className="flex w-full max-w-2xl max-h-[min(90vh,42rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-panel">
          <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <Users className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2
                    id="icp-details-title"
                    className="text-base font-semibold text-card-foreground [overflow-wrap:anywhere]"
                  >
                    {icp.title}
                  </h2>
                  {icp.is_primary && (
                    <span
                      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary"
                      title="Primary audience"
                    >
                      <Star className="h-3 w-3 fill-primary text-primary" />
                      Primary
                    </span>
                  )}
                </div>
                {icp.summary && (
                  <p className="mt-1.5 text-small leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
                    {icp.summary}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              disabled={isDeleting}
              className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-5 py-5">
            {deleteError && (
              <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {deleteError}
              </div>
            )}
            {totalItems === 0 ? (
              <p className="text-small text-muted-foreground">
                No pains, desires, objections, or triggers yet for this
                audience.
              </p>
            ) : (
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
            )}
          </div>

          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-border bg-secondary-soft/40 px-5 py-3">
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
            >
              {isDeleting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              {isDeleting ? "Deleting…" : "Delete"}
            </button>
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isDeleting}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
              >
                Close
              </button>
              {onEdit && (
                <button
                  type="button"
                  onClick={onEdit}
                  disabled={isDeleting}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </button>
              )}
            </div>
          </footer>
        </div>
      </div>
    </>
  );
}
