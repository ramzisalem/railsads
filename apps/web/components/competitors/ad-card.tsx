"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ExternalLink,
  Image as ImageIcon,
  Sparkles,
  Trash2,
} from "lucide-react";
import { deleteCompetitorAd } from "@/lib/competitors/actions";
import type { CompetitorAd, ProductOption } from "@/lib/competitors/queries";

interface AdCardProps {
  ad: CompetitorAd;
  products: ProductOption[];
  onOpen?: () => void;
}

/**
 * Compact ad tile used in the dense Ad Library grid. Image-first; metadata
 * lives on a hover overlay so the tile stays small even with hundreds of
 * ads. Click anywhere on the tile to open the full detail dialog.
 */
export function AdCard({ ad, products, onOpen }: AdCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isPending, startTransition] = useTransition();

  const mappedProduct = ad.mapped_product_id
    ? products.find((p) => p.id === ad.mapped_product_id)
    : null;
  const heroImage = ad.images[0];
  const titleLabel = ad.title?.trim() || ad.ad_text?.trim().slice(0, 60) || "Untitled ad";

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    startTransition(async () => {
      await deleteCompetitorAd(ad.id, ad.competitor_id);
    });
  }

  return (
    <div
      onClick={onOpen}
      className="group relative cursor-pointer overflow-hidden rounded-xl border bg-card transition-all hover:border-primary/50 hover:shadow-panel"
    >
      <div className="relative aspect-[4/5] w-full bg-muted/40">
        {heroImage ? (
          <Image
            src={heroImage.public_url}
            alt={titleLabel}
            fill
            sizes="(max-width: 768px) 50vw, (max-width: 1280px) 25vw, 20vw"
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground/40">
            <ImageIcon className="h-8 w-8" />
          </div>
        )}

        {ad.images.length > 1 && (
          <div className="absolute right-2 top-2 rounded-full bg-background/80 px-1.5 py-0.5 text-[10px] font-medium backdrop-blur">
            +{ad.images.length - 1}
          </div>
        )}

        {ad.platform && (
          <div className="absolute left-2 top-2 rounded-full bg-background/80 px-1.5 py-0.5 text-[10px] font-medium backdrop-blur">
            {ad.platform}
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-background via-background/85 to-transparent p-3 pt-10 opacity-0 transition-opacity group-hover:opacity-100">
          <p className="text-xs font-medium text-foreground line-clamp-2">
            {titleLabel}
          </p>
          {mappedProduct && (
            <p className="mt-1 text-[10px] text-muted-foreground">
              About {mappedProduct.name}
            </p>
          )}
        </div>

        <div className="absolute right-2 bottom-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {ad.mapped_product_id && (
            <Link
              href={`/studio?productId=${ad.mapped_product_id}&competitorAdId=${ad.id}`}
              onClick={(e) => e.stopPropagation()}
              className="pointer-events-auto rounded-full bg-primary p-1.5 text-primary-foreground shadow-md hover:bg-primary/90"
              aria-label="Try in Studio"
              title="Try in Studio"
            >
              <Sparkles className="h-3 w-3" />
            </Link>
          )}
          {ad.source_url && (
            <a
              href={ad.source_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="pointer-events-auto rounded-full bg-background/90 p-1.5 text-foreground shadow-md hover:bg-background"
              aria-label="View source"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setConfirmDelete(true);
            }}
            className="pointer-events-auto rounded-full bg-background/90 p-1.5 text-foreground shadow-md hover:bg-destructive hover:text-destructive-foreground"
            aria-label="Delete ad"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      <div className="px-3 py-2">
        <p className="text-xs font-medium text-foreground line-clamp-1">
          {titleLabel}
        </p>
        <p className="text-[10px] text-muted-foreground">
          {mappedProduct
            ? `About ${mappedProduct.name}`
            : ad.source === "upload"
              ? "from upload"
              : ad.source === "link"
                ? "from URL"
                : ad.source === "manual"
                  ? "manual"
                  : ad.source}
        </p>
      </div>

      {confirmDelete && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-background/95 p-4 text-center"
        >
          <p className="text-xs font-medium">Delete this ad?</p>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="rounded-lg bg-destructive px-3 py-1 text-xs font-medium text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? "Deleting…" : "Confirm"}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              disabled={isPending}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
