"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { createIcp, updateIcp } from "@/lib/products/icp-actions";
import type { IcpItem } from "@/lib/products/queries";

interface IcpFormProps {
  brandId: string;
  productId: string;
  icp?: IcpItem | null;
  onClose: () => void;
}

export function IcpForm({ brandId, productId, icp, onClose }: IcpFormProps) {
  const isEdit = !!icp;
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);

    const title = (form.get("title") as string)?.trim();
    const summary = (form.get("summary") as string)?.trim() || null;
    const pains = parseLines(form.get("pains") as string);
    const desires = parseLines(form.get("desires") as string);
    const objections = parseLines(form.get("objections") as string);
    const triggers = parseLines(form.get("triggers") as string);

    if (!title) {
      setError("Title is required");
      return;
    }

    startTransition(async () => {
      const data = { title, summary, pains, desires, objections, triggers };
      const result = isEdit
        ? await updateIcp(icp.id, productId, data)
        : await createIcp(brandId, productId, data);

      if (result.error) {
        setError(result.error);
      } else {
        onClose();
      }
    });
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/20"
        onClick={() => !isPending && onClose()}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border bg-card p-6 shadow-panel space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="heading-md">{isEdit ? "Edit ICP" : "Add ICP"}</h2>
            <button
              onClick={onClose}
              disabled={isPending}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div>
              <label className="text-xs text-muted-foreground">Title *</label>
              <input
                name="title"
                className="input-field mt-1"
                defaultValue={icp?.title ?? ""}
                placeholder="e.g., Busy Professionals"
                required
                disabled={isPending}
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground">Summary</label>
              <textarea
                name="summary"
                className="textarea-field mt-1"
                rows={2}
                defaultValue={icp?.summary ?? ""}
                placeholder="Brief description of this audience"
                disabled={isPending}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs text-muted-foreground">
                  Pains (one per line)
                </label>
                <textarea
                  name="pains"
                  className="textarea-field mt-1"
                  rows={3}
                  defaultValue={icp?.pains.join("\n") ?? ""}
                  placeholder={"No time to cook\nUnhealthy eating habits"}
                  disabled={isPending}
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground">
                  Desires (one per line)
                </label>
                <textarea
                  name="desires"
                  className="textarea-field mt-1"
                  rows={3}
                  defaultValue={icp?.desires.join("\n") ?? ""}
                  placeholder={"Quick healthy meals\nPortable nutrition"}
                  disabled={isPending}
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground">
                  Objections (one per line)
                </label>
                <textarea
                  name="objections"
                  className="textarea-field mt-1"
                  rows={3}
                  defaultValue={icp?.objections.join("\n") ?? ""}
                  placeholder={"Too expensive\nWon't work for me"}
                  disabled={isPending}
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground">
                  Triggers (one per line)
                </label>
                <textarea
                  name="triggers"
                  className="textarea-field mt-1"
                  rows={3}
                  defaultValue={icp?.triggers.join("\n") ?? ""}
                  placeholder={"New Year resolution\nDoctor's advice"}
                  disabled={isPending}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="btn-primary"
              >
                {isPending
                  ? isEdit
                    ? "Saving..."
                    : "Creating..."
                  : isEdit
                    ? "Save changes"
                    : "Create ICP"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

function parseLines(text: string): string[] {
  return (text ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}
