"use client";

import { useState, useTransition } from "react";
import { ExternalLink, Trash2, Package } from "lucide-react";
import { deleteCompetitorAd } from "@/lib/competitors/actions";
import type { CompetitorAd, ProductOption } from "@/lib/competitors/queries";

interface AdCardProps {
  ad: CompetitorAd;
  products: ProductOption[];
}

export function AdCard({ ad, products }: AdCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isPending, startTransition] = useTransition();

  const mappedProduct = ad.mapped_product_id
    ? products.find((p) => p.id === ad.mapped_product_id)
    : null;

  function handleDelete() {
    startTransition(async () => {
      await deleteCompetitorAd(ad.id, ad.competitor_id);
    });
  }

  return (
    <div className="panel space-y-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {ad.title && (
            <h4 className="text-sm font-medium truncate">{ad.title}</h4>
          )}
          {ad.platform && (
            <span className="tag mt-1 inline-block text-[10px] py-0.5 px-2">
              {ad.platform}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {ad.source_url && (
            <a
              href={ad.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg p-1.5 text-muted-foreground hover:text-primary transition-colors"
              aria-label="View source"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          <button
            onClick={() => setConfirmDelete(true)}
            className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive transition-colors"
            aria-label="Delete ad"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {ad.ad_text && (
        <p className="text-small text-muted-foreground line-clamp-4 whitespace-pre-wrap">
          {ad.ad_text}
        </p>
      )}

      {mappedProduct && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Package className="h-3 w-3" />
          Mapped to: <span className="text-foreground">{mappedProduct.name}</span>
        </div>
      )}

      {ad.notes && (
        <p className="text-xs text-muted-foreground italic">{ad.notes}</p>
      )}

      {confirmDelete && (
        <div className="flex items-center gap-3 border-t pt-3">
          <span className="text-xs text-destructive">Delete this ad?</span>
          <button
            onClick={handleDelete}
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
    </div>
  );
}
