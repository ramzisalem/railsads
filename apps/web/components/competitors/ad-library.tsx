import { Image as ImageIcon } from "lucide-react";
import { AdCard } from "@/components/competitors/ad-card";
import { AddAdForm } from "@/components/competitors/add-ad-form";
import type { CompetitorAd, ProductOption } from "@/lib/competitors/queries";

interface AdLibraryProps {
  brandId: string;
  competitorId: string;
  ads: CompetitorAd[];
  products: ProductOption[];
}

export function AdLibrary({
  brandId,
  competitorId,
  ads,
  products,
}: AdLibraryProps) {
  return (
    <div className="panel space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h2 className="heading-md">
          Ad Library{" "}
          <span className="text-xs font-normal text-muted-foreground">
            ({ads.length})
          </span>
        </h2>
        <AddAdForm
          brandId={brandId}
          competitorId={competitorId}
          products={products}
        />
      </div>

      {ads.length === 0 ? (
        <div className="flex min-h-[120px] items-center justify-center rounded-xl border border-dashed p-6">
          <div className="text-center">
            <ImageIcon className="mx-auto h-8 w-8 text-muted-foreground opacity-50" />
            <p className="mt-2 text-sm text-muted-foreground">
              No ads captured yet. Add competitor ads to start extracting
              patterns.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {ads.map((ad) => (
            <AdCard key={ad.id} ad={ad} products={products} />
          ))}
        </div>
      )}
    </div>
  );
}
