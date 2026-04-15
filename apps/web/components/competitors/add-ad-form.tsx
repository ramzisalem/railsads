"use client";

import { useState, useTransition, useEffect } from "react";
import { Plus, X } from "lucide-react";
import { createCompetitorAd } from "@/lib/competitors/actions";
import type { ProductOption } from "@/lib/competitors/queries";
import { FieldSelect } from "@/components/ui/field-select";

interface AddAdFormProps {
  brandId: string;
  competitorId: string;
  products: ProductOption[];
}

export function AddAdForm({ brandId, competitorId, products }: AddAdFormProps) {
  const [open, setOpen] = useState(false);
  const [mappedProductId, setMappedProductId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) setMappedProductId("");
  }, [open]);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createCompetitorAd(brandId, competitorId, formData);
      if (result.error) {
        setError(result.error);
      } else {
        setOpen(false);
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="btn-secondary flex items-center gap-2 text-xs"
      >
        <Plus className="h-3.5 w-3.5" />
        Add ad
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
        <div className="w-full max-w-lg rounded-2xl border bg-card p-6 shadow-panel space-y-5 max-h-[80vh] overflow-y-auto">
          <div className="flex items-center justify-between">
            <h2 className="heading-md">Add competitor ad</h2>
            <button
              onClick={() => setOpen(false)}
              disabled={isPending}
              aria-label="Close dialog"
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
              <label htmlFor="ad-title" className="text-xs text-muted-foreground">
                Ad title
              </label>
              <input
                id="ad-title"
                name="title"
                className="input-field mt-1"
                placeholder="e.g., Summer sale video ad"
                disabled={isPending}
              />
            </div>

            <div>
              <label htmlFor="ad-platform" className="text-xs text-muted-foreground">
                Platform
              </label>
              <input
                id="ad-platform"
                name="platform"
                className="input-field mt-1"
                placeholder="e.g., Facebook, Instagram, TikTok"
                disabled={isPending}
              />
            </div>

            <div>
              <label htmlFor="ad-text" className="text-xs text-muted-foreground">
                Ad copy / text
              </label>
              <textarea
                id="ad-text"
                name="ad_text"
                className="textarea-field mt-1"
                rows={4}
                placeholder="Paste the ad's headline and body copy"
                disabled={isPending}
              />
            </div>

            <div>
              <label htmlFor="ad-source-url" className="text-xs text-muted-foreground">
                Source URL
              </label>
              <input
                id="ad-source-url"
                name="source_url"
                type="url"
                className="input-field mt-1"
                placeholder="https://..."
                disabled={isPending}
              />
            </div>

            <div>
              <label htmlFor="ad-landing-url" className="text-xs text-muted-foreground">
                Landing page URL
              </label>
              <input
                id="ad-landing-url"
                name="landing_page_url"
                type="url"
                className="input-field mt-1"
                placeholder="https://..."
                disabled={isPending}
              />
            </div>

            {products.length > 0 && (
              <div>
                <span id="ad-product-label" className="text-xs text-muted-foreground">
                  Map to product
                </span>
                <input
                  type="hidden"
                  name="mapped_product_id"
                  value={mappedProductId}
                />
                <div className="mt-1">
                  <FieldSelect
                    value={mappedProductId || null}
                    onChange={(v) => setMappedProductId(v ?? "")}
                    allowUnset
                    unsetLabel="None"
                    disabled={isPending}
                    aria-labelledby="ad-product-label"
                    options={products.map((p) => ({
                      value: p.id,
                      label: p.name,
                    }))}
                    triggerClassName="py-3"
                  />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="ad-notes" className="text-xs text-muted-foreground">Notes</label>
              <textarea
                id="ad-notes"
                name="notes"
                className="textarea-field mt-1"
                rows={2}
                placeholder="Any notes about this ad"
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
                {isPending ? "Adding..." : "Add ad"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
