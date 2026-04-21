"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { InlineField } from "@/components/brand/inline-field";
import {
  updateCompetitor,
  deleteCompetitor,
  setCompetitorStatus,
} from "@/lib/competitors/actions";
import type { CompetitorDetail } from "@/lib/competitors/queries";
import { Archive, ArchiveRestore, Check, Globe, Pencil, Trash2, X } from "lucide-react";

interface CompetitorOverviewProps {
  competitor: CompetitorDetail;
}

function WebsiteField({
  competitorId,
  url,
}: {
  competitorId: string;
  url: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(url ?? "");
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function startEdit() {
    setDraft(url ?? "");
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
  }

  function save() {
    const trimmed = draft.trim();
    if (trimmed === (url ?? "")) {
      setEditing(false);
      return;
    }
    startTransition(async () => {
      const result = await updateCompetitor(competitorId, {
        website_url: trimmed || null,
      });
      if (!result?.error) setEditing(false);
    });
  }

  if (editing) {
    return (
      <div className="space-y-1.5">
        <div className="text-xs text-muted-foreground">Website</div>
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") cancel();
              if (e.key === "Enter") {
                e.preventDefault();
                save();
              }
            }}
            className="input-field flex-1"
            placeholder="https://competitor.com"
            disabled={isPending}
          />
          <button
            onClick={save}
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
      </div>
    );
  }

  return (
    <div className="group">
      <div className="text-xs text-muted-foreground">Website</div>
      <div
        className="mt-1 flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 -mx-2 cursor-pointer hover:bg-muted transition-colors"
        onClick={startEdit}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && startEdit()}
      >
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            <Globe className="h-3.5 w-3.5" />
            {url.replace(/^https?:\/\//, "")}
          </a>
        ) : (
          <span className="text-sm text-muted-foreground italic">
            No website set
          </span>
        )}
        <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
}

export function CompetitorOverview({ competitor }: CompetitorOverviewProps) {
  const [showDelete, setShowDelete] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      await deleteCompetitor(competitor.id);
    });
  }

  function handleArchiveToggle() {
    const next = competitor.status === "archived" ? "active" : "archived";
    startTransition(async () => {
      await setCompetitorStatus(competitor.id, next);
    });
  }

  const isArchived = competitor.status === "archived";

  return (
    <div className="panel space-y-5 p-6">
      <div className="flex items-center justify-between">
        <h2 className="heading-md">Overview</h2>
        {isArchived && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Archived
          </span>
        )}
      </div>

      <div className="space-y-4">
        <InlineField
          label="Competitor name"
          value={competitor.name}
          onSave={async (name) =>
            updateCompetitor(competitor.id, { name })
          }
        />

        <WebsiteField competitorId={competitor.id} url={competitor.website_url} />

        <InlineField
          label="Notes"
          value={competitor.notes}
          placeholder="Notes about this competitor"
          multiline
          onSave={async (v) =>
            updateCompetitor(competitor.id, { notes: v || null })
          }
        />
      </div>

      <div className="border-t pt-4 space-y-3">
        <button
          onClick={handleArchiveToggle}
          disabled={isPending}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          {isArchived ? (
            <>
              <ArchiveRestore className="h-3.5 w-3.5" />
              Restore competitor
            </>
          ) : (
            <>
              <Archive className="h-3.5 w-3.5" />
              Archive competitor
            </>
          )}
        </button>
        {!showDelete ? (
          <button
            onClick={() => setShowDelete(true)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete competitor
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-xs text-destructive">
              Delete this competitor and all its ads?
            </span>
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="rounded-lg bg-destructive px-3 py-1 text-xs font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors"
            >
              {isPending ? "Deleting..." : "Confirm"}
            </button>
            <button
              onClick={() => setShowDelete(false)}
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
