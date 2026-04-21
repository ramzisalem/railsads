import { createClient } from "@/lib/db/supabase-server";

export type CreateStudioThreadResult = { threadId: string } | { error: string };

/**
 * Inserts a thread row. Lives outside `"use server"` modules so it can run during
 * RSC render (e.g. /studio?product=…) without Next treating the file as a Server
 * Actions bundle that forbids cache APIs during render.
 */
export async function createStudioThread(
  brandId: string,
  productId: string,
  icpId?: string | null,
  templateId?: string | null,
  angle?: string | null,
  awareness?: string | null,
  referenceCompetitorAdId?: string | null
): Promise<CreateStudioThreadResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: product } = await supabase
    .from("products")
    .select("name")
    .eq("id", productId)
    .single();

  const title = product?.name ?? "New creative";

  const { data: thread, error } = await supabase
    .from("threads")
    .insert({
      brand_id: brandId,
      product_id: productId,
      icp_id: icpId || null,
      template_id: templateId || null,
      reference_competitor_ad_id: referenceCompetitorAdId || null,
      title,
      angle: angle || null,
      awareness: awareness || null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  return { threadId: thread.id };
}
