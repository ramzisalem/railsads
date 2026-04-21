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

interface AdRowProps {
  ad: CompetitorAd;
  products: ProductOption[];
  isLast: boolean;
  onOpen?: () => void;
}

export function AdRow({ ad, products, isLast, onOpen }: AdRowProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isPending, startTransition] = useTransition();

  const mappedProduct = ad.mapped_product_id
    ? products.find((p) => p.id === ad.mapped_product_id)
    : null;
  const heroImage = ad.images[0];
  const titleLabel =
    ad.title?.trim() || ad.ad_text?.trim().slice(0, 60) || "Untitled ad";

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    startTransition(async () => {
      await deleteCompetitorAd(ad.id, ad.competitor_id);
    });
  }

  return (
    <div
      onClick={onOpen}
      className={
        "group flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/40 " +
        (isLast ? "" : "border-b")
      }
    >
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted/40">
        {heroImage ? (
          <Image
            src={heroImage.public_url}
            alt={titleLabel}
            fill
            sizes="48px"
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground/40">
            <ImageIcon className="h-4 w-4" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{titleLabel}</p>
          {ad.platform && (
            <span className="shrink-0 rounded-full bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
              {ad.platform}
            </span>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {ad.ad_text?.replace(/\s+/g, " ").trim() || "—"}
        </p>
      </div>

      {mappedProduct && (
        <span className="hidden shrink-0 rounded-full border bg-card px-2 py-0.5 text-[11px] text-muted-foreground md:inline-block">
          About <span className="text-foreground">{mappedProduct.name}</span>
        </span>
      )}

      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        {ad.mapped_product_id && (
          <Link
            href={`/studio?productId=${ad.mapped_product_id}&competitorAdId=${ad.id}`}
            onClick={(e) => e.stopPropagation()}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-primary"
            aria-label="Try in Studio"
            title="Try in Studio"
          >
            <Sparkles className="h-3.5 w-3.5" />
          </Link>
        )}
        {ad.source_url && (
          <a
            href={ad.source_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="View source"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setConfirmDelete(true);
          }}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
          aria-label="Delete ad"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {confirmDelete && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="ml-2 flex shrink-0 items-center gap-2 rounded-md border bg-background px-2 py-1"
        >
          <span className="text-[11px] text-destructive">Delete?</span>
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="rounded bg-destructive px-2 py-0.5 text-[11px] font-medium text-destructive-foreground"
          >
            {isPending ? "…" : "Yes"}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setConfirmDelete(false);
            }}
            disabled={isPending}
            className="text-[11px] text-muted-foreground hover:text-foreground"
          >
            No
          </button>
        </div>
      )}
    </div>
  );
}
