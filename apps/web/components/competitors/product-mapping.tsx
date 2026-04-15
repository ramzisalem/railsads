"use client";

import { useTransition } from "react";
import { Link2, X, Package } from "lucide-react";
import {
  linkProductToCompetitor,
  unlinkProductFromCompetitor,
} from "@/lib/competitors/actions";
import type { ProductOption } from "@/lib/competitors/queries";

interface ProductMappingProps {
  brandId: string;
  competitorId: string;
  linkedProducts: ProductOption[];
  allProducts: ProductOption[];
}

export function ProductMapping({
  brandId,
  competitorId,
  linkedProducts,
  allProducts,
}: ProductMappingProps) {
  const [isPending, startTransition] = useTransition();

  const linkedIds = new Set(linkedProducts.map((p) => p.id));
  const unlinked = allProducts.filter((p) => !linkedIds.has(p.id));

  function handleLink(productId: string) {
    startTransition(async () => {
      await linkProductToCompetitor(brandId, competitorId, productId);
    });
  }

  function handleUnlink(productId: string) {
    startTransition(async () => {
      await unlinkProductFromCompetitor(competitorId, productId);
    });
  }

  return (
    <div className="panel space-y-4 p-6">
      <h2 className="heading-md flex items-center gap-2">
        <Link2 className="h-4 w-4" />
        Linked Products
      </h2>

      {linkedProducts.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {linkedProducts.map((p) => (
            <span
              key={p.id}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary"
            >
              <Package className="h-3 w-3" />
              {p.name}
              <button
                onClick={() => handleUnlink(p.id)}
                disabled={isPending}
                className="rounded-sm p-0.5 hover:bg-primary/20 transition-colors"
                aria-label={`Unlink ${p.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No products linked. Link products to track competitive overlap.
        </p>
      )}

      {unlinked.length > 0 && (
        <div className="border-t pt-3">
          <p className="text-xs text-muted-foreground mb-2">
            Available products:
          </p>
          <div className="flex flex-wrap gap-2">
            {unlinked.map((p) => (
              <button
                key={p.id}
                onClick={() => handleLink(p.id)}
                disabled={isPending}
                className="tag hover:bg-muted transition-colors"
              >
                + {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {allProducts.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No products in your brand yet.
          Add products first to link them here.
        </p>
      )}
    </div>
  );
}
