"use client";

import { Package, Globe } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import type { CompetitorProductItem } from "@/lib/competitors/products-queries";
import type { ProductOption } from "@/lib/competitors/queries";
import { ImportCompetitorProductsDialog } from "./import-competitor-products-dialog";
import { CompetitorProductCard } from "./competitor-product-card";

interface CompetitorProductsTabProps {
  brandId: string;
  competitorId: string;
  competitorWebsiteUrl: string | null;
  competitorProducts: CompetitorProductItem[];
  brandProducts: ProductOption[];
}

export function CompetitorProductsTab({
  brandId,
  competitorId,
  competitorWebsiteUrl,
  competitorProducts,
  brandProducts,
}: CompetitorProductsTabProps) {
  if (competitorProducts.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title="No competitor products yet"
        description="Import their catalog from the website — same pipeline we use for your brand. Then link each one to the matching product of yours."
        action={
          <ImportCompetitorProductsDialog
            brandId={brandId}
            competitorId={competitorId}
            defaultWebsiteUrl={competitorWebsiteUrl}
          />
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {competitorProducts.length} product
          {competitorProducts.length === 1 ? "" : "s"} from this competitor.
          Link each one to the brand product it goes head-to-head with.
        </p>
        <ImportCompetitorProductsDialog
          brandId={brandId}
          competitorId={competitorId}
          defaultWebsiteUrl={competitorWebsiteUrl}
          trigger={
            <button className="btn-secondary inline-flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Import more
            </button>
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {competitorProducts.map((p) => (
          <CompetitorProductCard
            key={p.id}
            brandId={brandId}
            competitorId={competitorId}
            product={p}
            brandProducts={brandProducts}
          />
        ))}
      </div>
    </div>
  );
}
