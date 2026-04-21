import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getCurrentBrand } from "@/lib/auth/get-current-brand";
import { getProductDetail } from "@/lib/products/queries";
import { ProductHero } from "@/components/products/product-hero";
import { ProductDetailTabs } from "@/components/products/product-detail-tabs";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  const user = await getCurrentUser();
  const brand = await getCurrentBrand(user.id);
  const data = await getProductDetail(productId, brand.id);

  if (!data) notFound();

  const { product, icps, competitorInsights } = data;

  return (
    <div className="space-y-8">
      <ProductHero product={product} icpCount={icps.length} />

      <ProductDetailTabs
        brandId={brand.id}
        product={product}
        icps={icps}
        competitorInsights={competitorInsights}
      />
    </div>
  );
}
