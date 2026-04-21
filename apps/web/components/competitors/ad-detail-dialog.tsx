"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ExternalLink,
  Image as ImageIcon,
  Link2,
  Package,
  Sparkles,
  X,
} from "lucide-react";
import type { CompetitorAd, ProductOption } from "@/lib/competitors/queries";

interface AdDetailDialogProps {
  ad: CompetitorAd;
  products: ProductOption[];
  onClose: () => void;
}

export function AdDetailDialog({ ad, products, onClose }: AdDetailDialogProps) {
  const mappedProduct = ad.mapped_product_id
    ? products.find((p) => p.id === ad.mapped_product_id)
    : null;

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
      <div
        className="relative z-10 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border bg-card shadow-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b p-5">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-semibold">
              {ad.title?.trim() || "Untitled ad"}
            </h3>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              {ad.platform && (
                <span className="rounded-full bg-muted px-2 py-0.5 font-medium">
                  {ad.platform}
                </span>
              )}
              <span>
                {ad.source === "upload"
                  ? "from upload"
                  : ad.source === "link"
                    ? "from URL"
                    : ad.source === "manual"
                      ? "manual entry"
                      : ad.source}
              </span>
              <span>·</span>
              <span>
                {new Date(ad.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-5 overflow-y-auto p-5 md:grid-cols-2">
          <div className="space-y-3">
            {ad.images.length === 0 ? (
              <div className="flex aspect-square w-full items-center justify-center rounded-xl border border-dashed text-muted-foreground/50">
                <ImageIcon className="h-10 w-10" />
              </div>
            ) : (
              <>
                <div className="relative w-full overflow-hidden rounded-xl border bg-muted/30">
                  <div className="relative aspect-[4/5] w-full">
                    <Image
                      src={ad.images[0].public_url}
                      alt={ad.title ?? "Competitor ad"}
                      fill
                      sizes="(max-width: 768px) 100vw, 400px"
                      className="object-contain"
                      unoptimized
                    />
                  </div>
                </div>
                {ad.images.length > 1 && (
                  <div className="grid grid-cols-4 gap-2">
                    {ad.images.slice(1).map((img) => (
                      <div
                        key={img.asset_id}
                        className="relative aspect-square overflow-hidden rounded-lg border bg-muted/30"
                      >
                        <Image
                          src={img.public_url}
                          alt=""
                          fill
                          sizes="80px"
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="space-y-4">
            {ad.ad_text && (
              <div>
                <h4 className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Ad copy
                </h4>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {ad.ad_text}
                </p>
              </div>
            )}

            {ad.notes && (
              <div>
                <h4 className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Notes
                </h4>
                <p className="text-sm italic text-muted-foreground">
                  {ad.notes}
                </p>
              </div>
            )}

            {mappedProduct && (
              <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                <Package className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">About product:</span>
                <span className="font-medium">{mappedProduct.name}</span>
              </div>
            )}

            <div className="space-y-1.5">
              {ad.source_url && (
                <a
                  href={ad.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span className="truncate">Source: {ad.source_url}</span>
                </a>
              )}
              {ad.landing_page_url && ad.landing_page_url !== ad.source_url && (
                <a
                  href={ad.landing_page_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                >
                  <Link2 className="h-3.5 w-3.5" />
                  <span className="truncate">
                    Landing page: {ad.landing_page_url}
                  </span>
                </a>
              )}
            </div>

            {ad.mapped_product_id && (
              <Link
                href={`/studio?productId=${ad.mapped_product_id}&competitorAdId=${ad.id}`}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary-soft px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Try in Studio with this ad
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
