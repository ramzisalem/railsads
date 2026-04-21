"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  ExternalLink,
  ImageOff,
  Package,
  Sparkles,
} from "lucide-react";
import type { ProductDetail } from "@/lib/products/queries";

interface ProductHeroProps {
  product: ProductDetail;
  icpCount: number;
}

function formatPrice(amount: number | null, currency: string): string | null {
  if (amount === null) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

function getHostname(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function ProductHero({ product, icpCount }: ProductHeroProps) {
  const [imageError, setImageError] = useState(false);

  const importPriceText =
    typeof (product.attributes as { import_price_text?: unknown })
      ?.import_price_text === "string"
      ? (product.attributes as { import_price_text: string }).import_price_text
      : null;

  const formattedPrice =
    formatPrice(product.price_amount, product.price_currency) ??
    importPriceText;

  const hostname = getHostname(product.product_url);
  const isImported = product.source === "website_import";

  return (
    <div className="space-y-4">
      <Link
        href="/products"
        className="inline-flex items-center gap-1.5 text-small text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Products
      </Link>

      <div className="panel overflow-hidden">
        <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-stretch sm:gap-8 sm:p-8">
          <div className="relative flex aspect-square w-full shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-secondary-soft sm:h-48 sm:w-48">
            {product.image_url && !imageError ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.image_url}
                alt={product.name}
                className="h-full w-full object-cover"
                onError={() => setImageError(true)}
              />
            ) : imageError ? (
              <ImageOff className="h-10 w-10 text-muted-foreground" />
            ) : (
              <Package className="h-10 w-10 text-muted-foreground" />
            )}
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              {isImported && (
                <span className="tag text-[11px] py-0.5 px-2">Imported</span>
              )}
              <span className="inline-flex items-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {icpCount} audience{icpCount === 1 ? "" : "s"}
              </span>
            </div>

            <div className="min-w-0 space-y-2">
              <h1 className="heading-xl break-words">{product.name}</h1>
              {product.short_description && (
                <p className="text-body text-muted-foreground line-clamp-3">
                  {product.short_description}
                </p>
              )}
            </div>

            <div className="mt-auto flex flex-wrap items-end justify-between gap-4">
              <div className="flex flex-wrap items-end gap-6">
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Price
                  </div>
                  <div className="mt-1 text-2xl font-semibold text-foreground">
                    {formattedPrice ?? (
                      <span className="text-base font-normal text-muted-foreground">
                        Not set
                      </span>
                    )}
                  </div>
                  {formattedPrice && product.price_amount === null && (
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      Imported from site
                    </div>
                  )}
                </div>

                {product.product_url && (
                  <a
                    href={product.product_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex max-w-[18rem] items-center gap-1.5 truncate text-sm text-muted-foreground transition-colors hover:text-primary"
                    title={product.product_url}
                  >
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">
                      {hostname ?? "View product"}
                    </span>
                  </a>
                )}
              </div>

              <Link
                href={`/studio?product=${product.id}`}
                className="btn-primary flex items-center gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Create ad for this product
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
