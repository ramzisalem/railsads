"use client";

import { useState, useTransition } from "react";
import { ClipboardPaste, Loader2, X } from "lucide-react";
import { bulkPasteCompetitorAds } from "@/lib/competitors/actions";
import type { ProductOption } from "@/lib/competitors/queries";
import { FieldSelect } from "@/components/ui/field-select";

interface BulkPasteDialogProps {
  brandId: string;
  competitorId: string;
  products: ProductOption[];
}

export function BulkPasteDialog({
  brandId,
  competitorId,
  products,
}: BulkPasteDialogProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [platform, setPlatform] = useState("");
  const [mappedProductId, setMappedProductId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function reset() {
    setText("");
    setPlatform("");
    setMappedProductId(null);
    setError(null);
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await bulkPasteCompetitorAds({
        brandId,
        competitorId,
        rawText: text,
        platform: platform || null,
        mappedProductId,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      reset();
      setOpen(false);
    });
  }

  // Cheap counter so users see what they're about to import.
  const blockCount = text
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter((b) => b.length > 0).length;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ClipboardPaste className="h-3.5 w-3.5" />
        Bulk paste
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="panel relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden p-0">
            <div className="flex items-start justify-between border-b p-5">
              <div>
                <h3 className="heading-md">Bulk paste competitor ads</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Paste many ads at once — separate each ad with a{" "}
                  <strong>blank line</strong>. The first line of each block
                  becomes the title. No images / vision extraction; great for
                  onboarding from a doc.
                </p>
              </div>
              <button
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
                className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={12}
                placeholder={
                  "Big bold hook line\nFollow-up copy that sells the product …\n\nAnother ad's hook\nIts body copy …\n\nA third ad …"
                }
                className="input-field w-full font-mono text-xs"
                disabled={isPending}
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs text-muted-foreground">
                    Platform (applied to all)
                  </span>
                  <input
                    className="input-field mt-1"
                    placeholder="Facebook, TikTok, …"
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value)}
                    disabled={isPending}
                  />
                </label>
                {products.length > 0 && (
                  <label className="block">
                    <span className="text-xs text-muted-foreground">
                      About product (applied to all)
                    </span>
                    <div className="mt-1">
                      <FieldSelect
                        value={mappedProductId}
                        onChange={(v) => setMappedProductId(v ?? null)}
                        allowUnset
                        unsetLabel="Not specific"
                        disabled={isPending}
                        options={products.map((p) => ({
                          value: p.id,
                          label: p.name,
                        }))}
                        triggerClassName="py-3"
                      />
                    </div>
                  </label>
                )}
              </div>
              {error && (
                <p className="text-xs text-destructive">{error}</p>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t bg-muted/30 px-5 py-3">
              <span className="text-xs text-muted-foreground">
                {blockCount > 0
                  ? `${blockCount} ad${blockCount === 1 ? "" : "s"} ready to import`
                  : "Add at least one ad"}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setOpen(false);
                    reset();
                  }}
                  disabled={isPending}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isPending || blockCount === 0}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Import {blockCount > 0 ? blockCount : ""}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
