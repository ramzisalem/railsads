import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getCurrentBrand } from "@/lib/auth/get-current-brand";
import { getThreadsList, getStudioContext } from "@/lib/studio/queries";
import { createStudioThread } from "@/lib/studio/create-thread";
import { PageHeader } from "@/components/layout/page-header";
import { ThreadList } from "@/components/studio/thread-list";
import { NewThreadForm } from "@/components/studio/new-thread-form";
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

    const result = await createStudioThread(
      brand.id,
      productParam,
      icpParam,
      templateParam
    );
    if ("threadId" in result) {
      redirect(`/studio/${result.threadId}`);
    }
    // Thread creation failed — redirect to clean studio URL to prevent retry loops
    redirect("/studio");
  }

  const threads = await getThreadsList(brand.id);
  if (threads.length > 0) {
    redirect(`/studio/${threads[0].id}`);
  }

  const context = await getStudioContext(brand.id);
  const hasProducts = context.products.length > 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Creative Studio"
        subheader={<ThreadList threads={threads} />}
        actions={
          hasProducts ? (
            <NewThreadForm brandId={brand.id} context={context} />
          ) : undefined
        }
      />

      {hasProducts ? (
        <EmptyState
          icon={Sparkles}
          title="Ready to create"
          description="Click &ldquo;New creative&rdquo; to start a new ad, or open an existing thread from the dropdown."
        />
      ) : (
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
      )}
    </div>
  );
}
