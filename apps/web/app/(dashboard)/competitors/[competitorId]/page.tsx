import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getCurrentBrand } from "@/lib/auth/get-current-brand";
import { getCompetitorDetail } from "@/lib/competitors/queries";
import { PageHeader } from "@/components/layout/page-header";
import { AnalyzeButton } from "@/components/competitors/analyze-button";
import { CompetitorStatStrip } from "@/components/competitors/competitor-stat-strip";
import { CompetitorDetailTabs } from "@/components/competitors/competitor-detail-tabs";

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

  const { competitor, ads, insights, linkedProducts, allProducts, newAdCounts } =
    data;
  const lastAnalyzedAt = insights[0]?.created_at ?? null;

  return (
    <div className="space-y-6">
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
          actions={
            <AnalyzeButton
              brandId={brand.id}
              competitorId={competitor.id}
              hasAds={ads.length > 0}
              linkedProducts={linkedProducts}
              newAdCounts={newAdCounts}
            />
          }
        />
      </div>

      <CompetitorStatStrip
        websiteUrl={competitor.website_url}
        status={competitor.status}
        adCount={ads.length}
        insightCount={insights.length}
        competesForCount={linkedProducts.length}
        lastAnalyzedAt={lastAnalyzedAt}
      />

      <CompetitorDetailTabs
        brandId={brand.id}
        competitor={competitor}
        ads={ads}
        insights={insights}
        linkedProducts={linkedProducts}
        allProducts={allProducts}
      />
    </div>
  );
}
