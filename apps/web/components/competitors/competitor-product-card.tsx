"use client";

import { useState, useTransition } from "react";
import {
  Package,
  ExternalLink,
  Trash2,
  Link2,
  X,
  Plus,
  ChevronDown,
} from "lucide-react";
import {
  deleteCompetitorProduct,
  linkCompetitorProductToBrandProduct,
  unlinkCompetitorProductFromBrandProduct,
} from "@/lib/competitors/products-actions";
import type { CompetitorProductItem } from "@/lib/competitors/products-queries";
import type { ProductOption } from "@/lib/competitors/queries";

interface CompetitorProductCardProps {
  brandId: string;
  competitorId: string;
  product: CompetitorProductItem;
  /** All brand products (for the "Competes for" picker) */
  brandProducts: ProductOption[];
}

function formatPrice(amount: number | null, currency: string): string | null {
  if (amount === null) return null;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

export function CompetitorProductCard({
  brandId,
  competitorId,
  product,
  brandProducts,
}: CompetitorProductCardProps) {
  const [isPending, startTransition] = useTransition();
  const [showLinkPicker, setShowLinkPicker] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const linkedIds = new Set(product.brand_links.map((l) => l.product_id));
  const availableToLink = brandProducts.filter((bp) => !linkedIds.has(bp.id));

  const priceLabel =
    formatPrice(product.price_amount, product.price_currency) ??
    product.import_price_text;

  function handleLink(brandProductId: string) {
    startTransition(async () => {
      await linkCompetitorProductToBrandProduct(
        brandId,
        competitorId,
        product.id,
        brandProductId
      );
      setShowLinkPicker(false);
    });
  }

  function handleUnlink(brandProductId: string) {
    startTransition(async () => {
      await unlinkCompetitorProductFromBrandProduct(
        competitorId,
        product.id,
        brandProductId
      );
    });
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteCompetitorProduct(product.id, competitorId);
    });
  }

  return (
    <div className="panel space-y-4 p-5">
      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-secondary-soft">
          {product.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.image_url}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <Package className="h-5 w-5 text-muted-foreground" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold truncate">{product.name}</h3>
              {product.short_description && (
                <p className="mt-1 text-small text-muted-foreground line-clamp-2">
                  {product.short_description}
                </p>
              )}
            </div>
            {priceLabel && (
              <span className="shrink-0 text-sm font-medium">{priceLabel}</span>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {product.product_url && (
              <a
                href={product.product_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                Product page
              </a>
            )}
            {product.source === "website_import" && (
              <span className="tag text-[10px] py-0.5 px-2">Imported</span>
            )}
          </div>
        </div>
      </div>

      <div className="border-t pt-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
            <Link2 className="h-3 w-3" />
            Competes for
          </p>
          {availableToLink.length > 0 && (
            <button
              type="button"
              onClick={() => setShowLinkPicker((v) => !v)}
              disabled={isPending}
              className="text-xs text-primary inline-flex items-center gap-1 hover:underline disabled:opacity-50"
            >
              <Plus className="h-3 w-3" />
              Link product
              <ChevronDown
                className={`h-3 w-3 transition-transform ${showLinkPicker ? "rotate-180" : ""}`}
              />
            </button>
          )}
        </div>

        {product.brand_links.length === 0 && !showLinkPicker && (
          <p className="text-xs text-muted-foreground italic">
            Not yet linked to one of your products.
          </p>
        )}

        {product.brand_links.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {product.brand_links.map((link) => (
              <span
                key={link.product_id}
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-2 py-1 text-xs font-medium text-primary"
              >
                <Package className="h-3 w-3" />
                {link.product_name}
                <button
                  type="button"
                  onClick={() => handleUnlink(link.product_id)}
                  disabled={isPending}
                  aria-label={`Unlink ${link.product_name}`}
                  className="rounded-sm text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {showLinkPicker && (
          <div className="rounded-xl border bg-muted/30 p-3 space-y-2">
            {availableToLink.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                All your products are already linked.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {availableToLink.map((bp) => (
                  <button
                    key={bp.id}
                    onClick={() => handleLink(bp.id)}
                    disabled={isPending}
                    className="tag hover:bg-background transition-colors"
                  >
                    + {bp.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border-t pt-2">
        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors"
          >
            <Trash2 className="h-3 w-3" />
            Remove
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-xs text-destructive">
              Remove this competitor product?
            </span>
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="rounded-md bg-destructive px-2.5 py-1 text-xs font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
            >
              {isPending ? "Removing..." : "Confirm"}
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
    </div>
  );
}
