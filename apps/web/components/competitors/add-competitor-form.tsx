"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { createCompetitor } from "@/lib/competitors/actions";

interface AddCompetitorFormProps {
  brandId: string;
}

export function AddCompetitorForm({ brandId }: AddCompetitorFormProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createCompetitor(brandId, formData);
      if (result.error) {
        setError(result.error);
      } else if (result.competitorId) {
        setOpen(false);
        router.push(`/competitors/${result.competitorId}`);
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="btn-primary flex items-center gap-2"
      >
        <Plus className="h-4 w-4" />
        Add competitor
      </button>
    );
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/20"
        onClick={() => !isPending && setOpen(false)}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-panel space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="heading-md">Add competitor</h2>
            <button
              onClick={() => setOpen(false)}
              disabled={isPending}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form action={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div>
              <label className="text-xs text-muted-foreground">
                Competitor name *
              </label>
              <input
                name="name"
                className="input-field mt-1"
                placeholder="e.g., BlendJet"
                required
                disabled={isPending}
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground">Website</label>
              <input
                name="website_url"
                className="input-field mt-1"
                type="url"
                placeholder="https://competitor.com"
                disabled={isPending}
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground">Notes</label>
              <textarea
                name="notes"
                className="textarea-field mt-1"
                rows={2}
                placeholder="Quick notes about this competitor"
                disabled={isPending}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={isPending}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button type="submit" disabled={isPending} className="btn-primary">
                {isPending ? "Creating..." : "Add competitor"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
