"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { createProduct } from "@/lib/products/actions";

interface AddProductFormProps {
  brandId: string;
}

export function AddProductForm({ brandId }: AddProductFormProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createProduct(brandId, formData);
      if (result.error) {
        setError(result.error);
      } else if (result.productId) {
        setOpen(false);
        router.push(`/products/${result.productId}`);
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
        Add product
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
        <div className="w-full max-w-lg rounded-2xl border bg-card p-6 shadow-panel space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="heading-md">Add product</h2>
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
                Product name *
              </label>
              <input
                name="name"
                className="input-field mt-1"
                placeholder="e.g., Portable Blender"
                required
                disabled={isPending}
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground">
                Short description
              </label>
              <input
                name="short_description"
                className="input-field mt-1"
                placeholder="One-line summary"
                disabled={isPending}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground">Price</label>
                <input
                  name="price_amount"
                  className="input-field mt-1"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="29.99"
                  disabled={isPending}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">
                  Currency
                </label>
                <input
                  name="price_currency"
                  className="input-field mt-1"
                  defaultValue="USD"
                  placeholder="USD"
                  disabled={isPending}
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground">
                Product URL
              </label>
              <input
                name="product_url"
                className="input-field mt-1"
                type="url"
                placeholder="https://yourstore.com/product"
                disabled={isPending}
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground">
                Description
              </label>
              <textarea
                name="description"
                className="textarea-field mt-1"
                rows={3}
                placeholder="Detailed product description"
                disabled={isPending}
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground">
                Key benefits (one per line)
              </label>
              <textarea
                name="benefits"
                className="textarea-field mt-1"
                rows={3}
                placeholder={"Portable and lightweight\nUSB-C rechargeable\nBPA-free materials"}
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
              <button
                type="submit"
                disabled={isPending}
                className="btn-primary"
              >
                {isPending ? "Creating..." : "Create product"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
