"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { createThread } from "@/lib/studio/actions";
import type { StudioContext, IcpOption } from "@/lib/studio/types";
import { FieldSelect } from "@/components/ui/field-select";

interface NewThreadFormProps {
  brandId: string;
  context: StudioContext;
  preselectedProductId?: string;
}

export function NewThreadForm({
  brandId,
  context,
  preselectedProductId,
}: NewThreadFormProps) {
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState(
    preselectedProductId ?? context.products[0]?.id ?? ""
  );
  const [icpId, setIcpId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const icpsForProduct = context.icps.filter(
    (i: IcpOption) => i.product_id === productId
  );

  function handleSubmit() {
    if (!productId) {
      setError("Please select a product");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await createThread(
        brandId,
        productId,
        icpId || null
      );
      if ("error" in result) {
        setError(result.error);
      } else {
        setOpen(false);
        router.push(`/studio/${result.threadId}`);
      }
    });
  }

  function openModal() {
    setError(null);
    setOpen(true);
  }

  if (!open) {
    return (
      <button
        onClick={openModal}
        className="btn-primary flex items-center gap-2"
      >
        <Plus className="h-4 w-4" />
        New creative
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
            <h2 className="heading-md">New creative</h2>
            <button
              onClick={() => setOpen(false)}
              disabled={isPending}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {error && (
            <div className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {context.products.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You need to add a product before creating ads.
            </p>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground">
                  Product *
                </label>
                <div className="mt-1">
                  <FieldSelect
                    value={productId}
                    onChange={(v) => {
                      setProductId(v ?? "");
                      setIcpId("");
                    }}
                    allowUnset={false}
                    disabled={isPending}
                    aria-label="Product for this creative"
                    options={context.products.map((p) => ({
                      value: p.id,
                      label: p.name,
                    }))}
                    triggerClassName="py-3"
                  />
                </div>
              </div>

              {icpsForProduct.length > 0 && (
                <div>
                  <label className="text-xs text-muted-foreground">
                    ICP (optional)
                  </label>
                  <div className="mt-1">
                    <FieldSelect
                      value={icpId || null}
                      onChange={(v) => setIcpId(v ?? "")}
                      allowUnset
                      unsetLabel="None"
                      disabled={isPending}
                      aria-label="Ideal customer profile"
                      options={icpsForProduct.map((i: IcpOption) => ({
                        value: i.id,
                        label: i.title,
                      }))}
                      triggerClassName="py-3"
                    />
                  </div>
                </div>
              )}

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
                  onClick={handleSubmit}
                  disabled={isPending}
                  className="btn-primary"
                >
                  {isPending ? "Creating..." : "Start creating"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
