import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getCurrentBrand } from "@/lib/auth/get-current-brand";
import { getBrandPageData } from "@/lib/brand/queries";
import { PageHeader } from "@/components/layout/page-header";
import { BrandOverview } from "@/components/brand/brand-overview";
import { BrandPositioning } from "@/components/brand/brand-positioning";
import { BrandVisual } from "@/components/brand/brand-visual";
import { BrandPersonality } from "@/components/brand/brand-personality";
import { BrandSource } from "@/components/brand/brand-source";
import { ReimportButton } from "@/components/brand/reimport-button";
import { DeleteBrandSection } from "@/components/brand/delete-brand-section";

export default async function BrandPage() {
  const user = await getCurrentUser();
  const activeBrand = await getCurrentBrand(user.id);
  const data = await getBrandPageData(activeBrand.id, user.id);

  if (!data) {
    return (
      <div className="space-y-8">
        <PageHeader title="Brand" />
        <div className="panel p-8 text-center">
          <p className="text-body text-muted-foreground">
            Could not load brand data. Please try refreshing.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Brand"
        description="Your brand DNA — identity, messaging, and visual style."
        actions={
          <ReimportButton
            brandId={data.brand.id}
            websiteUrl={data.brand.website_url}
          />
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <BrandOverview brand={data.brand} profile={data.profile} />
        <BrandPositioning brandId={data.brand.id} profile={data.profile} />
        <BrandVisual brandId={data.brand.id} visual={data.visual} />
        <BrandPersonality brandId={data.brand.id} profile={data.profile} />
      </div>

      <BrandSource
        profile={data.profile}
        visual={data.visual}
        lastImport={data.lastImport}
      />

      {data.membershipRole === "owner" && (
        <DeleteBrandSection brandId={data.brand.id} brandName={data.brand.name} />
      )}
    </div>
  );
}
