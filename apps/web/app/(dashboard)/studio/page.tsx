import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getCurrentBrand } from "@/lib/auth/get-current-brand";
import { getThreadsList, getStudioContext } from "@/lib/studio/queries";
import { createStudioThread } from "@/lib/studio/create-thread";
import { NewThreadForm } from "@/components/studio/new-thread-form";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Sparkles, Package } from "lucide-react";

export default async function StudioPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await getCurrentUser();
  const brand = await getCurrentBrand(user.id);
  const params = await searchParams;

  const productParam =
    (params.productId as string) ?? (params.product as string) ?? null;

  if (productParam) {
    const icpParam = (params.icpId as string) ?? null;
    const templateParam = (params.template as string) ?? null;
    const competitorAdParam =
      (params.competitorAdId as string) ??
      (params.referenceAdId as string) ??
      null;

    const result = await createStudioThread(
      brand.id,
      productParam,
      icpParam,
      templateParam,
      null,
      null,
      competitorAdParam
    );
    if ("threadId" in result) {
      redirect(`/studio/${result.threadId}`);
    }
    redirect("/studio");
  }

  const threads = await getThreadsList(brand.id);
  if (threads.length > 0) {
    redirect(`/studio/${threads[0].id}`);
  }

  const context = await getStudioContext(brand.id);
  const hasProducts = context.products.length > 0;

  if (!hasProducts) {
    return (
      <div className="space-y-8">
        <EmptyState
          icon={Package}
          title="Add a product first"
          description="You need at least one product before you can start creating ads."
          action={
            <Link href="/products" className="btn-primary gap-2">
              <Package className="h-4 w-4" />
              Go to Products
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Creative Studio"
        description="Brief the AI to generate hooks, headlines, and ad visuals you can ship."
        actions={<NewThreadForm brandId={brand.id} context={context} />}
      />

      <EmptyState
        icon={Sparkles}
        title="Start your first creative"
        description="Pick a product, target an audience, and brief the AI to get hooks, headlines, and visuals."
        action={
          <Link
            href="/products"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Or open a product to brief from there
          </Link>
        }
      />
    </div>
  );
}
