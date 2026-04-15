import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getCurrentBrand } from "@/lib/auth/get-current-brand";
import { getProductDetail } from "@/lib/products/queries";
import { PageHeader } from "@/components/layout/page-header";
import { ProductOverview } from "@/components/products/product-overview";
import { IcpsSection } from "@/components/products/icps-section";
import { CompetitorSignals } from "@/components/products/competitor-signals";
import { ArrowLeft, Sparkles } from "lucide-react";

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
      <div>
        <Link
          href="/products"
          className="mb-3 inline-flex items-center gap-1.5 text-small text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Products
        </Link>
        <PageHeader
          title={product.name}
          description={product.short_description ?? undefined}
          actions={
            <Link
              href={`/studio?product=${product.id}`}
              className="btn-primary flex items-center gap-2"
            >
              <Sparkles className="h-4 w-4" />
              Create ad for this product
            </Link>
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_1fr]">
        <ProductOverview product={product} />
        <IcpsSection brandId={brand.id} productId={product.id} icps={icps} />
      </div>

      <CompetitorSignals insights={competitorInsights} />
    </div>
  );
}
