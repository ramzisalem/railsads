import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getCurrentBrand } from "@/lib/auth/get-current-brand";
import { getProductsList } from "@/lib/products/queries";
import { PageHeader } from "@/components/layout/page-header";
import { ProductCard } from "@/components/products/product-card";
import { AddProductForm } from "@/components/products/add-product-form";
import { EmptyState } from "@/components/ui/empty-state";
import { Package, Globe } from "lucide-react";

export default async function ProductsPage() {
  const user = await getCurrentUser();
  const brand = await getCurrentBrand(user.id);
  const products = await getProductsList(brand.id);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Products"
        description="Your product catalog — the hub for ad creation."
        actions={<AddProductForm brandId={brand.id} />}
      />

      {products.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No products yet"
          description="Import your website or add products manually to get started."
          action={
            <Link href="/onboarding" className="btn-primary gap-2">
              <Globe className="h-4 w-4" />
              Import website
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
