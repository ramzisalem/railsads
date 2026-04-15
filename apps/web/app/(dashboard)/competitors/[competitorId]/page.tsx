import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getCurrentBrand } from "@/lib/auth/get-current-brand";
import { getCompetitorDetail } from "@/lib/competitors/queries";
import { PageHeader } from "@/components/layout/page-header";
import { CompetitorOverview } from "@/components/competitors/competitor-overview";
import { AdLibrary } from "@/components/competitors/ad-library";
import { InsightsDisplay } from "@/components/competitors/insights-display";
import { ProductMapping } from "@/components/competitors/product-mapping";
import { AnalyzeButton } from "@/components/competitors/analyze-button";

export default async function CompetitorDetailPage({
  params,
}: {
  params: Promise<{ competitorId: string }>;
}) {
  const { competitorId } = await params;
  const user = await getCurrentUser();
  const brand = await getCurrentBrand(user.id);
  const data = await getCompetitorDetail(competitorId, brand.id);

  if (!data) notFound();

  const { competitor, ads, insights, linkedProducts, allProducts } = data;

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/competitors"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to competitors
        </Link>
        <PageHeader
          title={competitor.name}
          description={competitor.website_url?.replace(/^https?:\/\//, "") ?? ""}
          actions={
            <AnalyzeButton
              brandId={brand.id}
              competitorId={competitor.id}
              hasAds={ads.length > 0}
            />
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1 space-y-6">
          <CompetitorOverview competitor={competitor} />
          <ProductMapping
            brandId={brand.id}
            competitorId={competitor.id}
            linkedProducts={linkedProducts}
            allProducts={allProducts}
          />
        </div>

        <div className="lg:col-span-2 space-y-6">
          <AdLibrary
            brandId={brand.id}
            competitorId={competitor.id}
            ads={ads}
            products={allProducts}
          />
          <InsightsDisplay insights={insights} />
        </div>
      </div>
    </div>
  );
}
