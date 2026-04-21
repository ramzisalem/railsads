"use client";

import { useState, useTransition } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { deleteBrand } from "@/lib/brand/actions";
import { Button } from "@/components/ui/button";

interface DeleteBrandSectionProps {
  brandId: string;
  brandName: string;
}

export function DeleteBrandSection({ brandId, brandName }: DeleteBrandSectionProps) {
  const [open, setOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    setError(null);
    const fd = new FormData();
    fd.set("brandId", brandId);
    fd.set("confirmName", confirmName.trim());
    startTransition(async () => {
      const result = await deleteBrand(fd);
      if (result?.error) {
        setError(result.error);
      }
    });
  }

  return (
    <section
      className="panel border-destructive/25 p-6"
      aria-labelledby="delete-brand-heading"
    >
      <h2
        id="delete-brand-heading"
        className="text-sm font-semibold text-destructive"
      >
        Delete brand
      </h2>
      <p className="mt-2 text-body text-muted-foreground">
        Permanently delete this brand and all of its data — products, creatives,
        competitors, billing records tied to this brand, and uploaded assets. This
        cannot be undone.
      </p>

      {!open ? (
        <Button
          type="button"
          variant="destructive"
          className="mt-4"
          onClick={() => {
            setOpen(true);
            setConfirmName("");
            setError(null);
          }}
        >
          <Trash2 data-icon="inline-start" />
          Delete brand
        </Button>
      ) : (
        <div className="mt-4 space-y-4">
          <div>
            <label htmlFor="delete-brand-confirm" className="text-sm font-medium">
              Type <span className="font-semibold text-foreground">{brandName}</span>{" "}
              to confirm
            </label>
            <input
              id="delete-brand-confirm"
              type="text"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              autoComplete="off"
              disabled={pending}
              className="input-field mt-1.5 max-w-md py-2.5"
              placeholder={brandName}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="destructive"
              disabled={pending || confirmName.trim() !== brandName}
              onClick={handleDelete}
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 data-icon="inline-start" />
              )}
              {pending ? "Deleting…" : "Permanently delete"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => {
                setOpen(false);
                setConfirmName("");
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
