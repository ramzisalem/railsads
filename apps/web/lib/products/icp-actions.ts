"use server";

import { createClient } from "@/lib/db/supabase-server";
import { revalidatePath } from "next/cache";

async function getAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function createIcp(
  brandId: string,
  productId: string,
  data: {
    title: string;
    summary?: string | null;
    pains?: string[];
    desires?: string[];
    objections?: string[];
    triggers?: string[];
    is_primary?: boolean;
  }
) {
  const { supabase, user } = await getAuth();
  if (!user) return { error: "Not authenticated" };

  if (!data.title?.trim()) return { error: "ICP title is required" };

  const { data: icp, error } = await supabase
    .from("icps")
    .insert({
      brand_id: brandId,
      product_id: productId,
      title: data.title.trim(),
      summary: data.summary?.trim() || null,
      pains: data.pains ?? [],
      desires: data.desires ?? [],
      objections: data.objections ?? [],
      triggers: data.triggers ?? [],
      is_primary: data.is_primary ?? false,
      source: "manual",
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath(`/products/${productId}`);
  return { icpId: icp.id };
}

export async function updateIcp(
  icpId: string,
  productId: string,
  data: {
    title?: string;
    summary?: string | null;
    pains?: string[];
    desires?: string[];
    objections?: string[];
    triggers?: string[];
    is_primary?: boolean;
  }
) {
  const { supabase, user } = await getAuth();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("icps")
    .update(data)
    .eq("id", icpId);

  if (error) return { error: error.message };

  revalidatePath(`/products/${productId}`);
  return { success: true };
}

export async function deleteIcp(icpId: string, productId: string) {
  const { supabase, user } = await getAuth();
  if (!user) return { error: "Not authenticated" };

  // Soft delete via archive
  const { error } = await supabase
    .from("icps")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", icpId);

  if (error) return { error: error.message };

  revalidatePath(`/products/${productId}`);
  return { success: true };
}

export async function duplicateIcp(icpId: string, productId: string) {
  const { supabase, user } = await getAuth();
  if (!user) return { error: "Not authenticated" };

  const { data: original, error: fetchError } = await supabase
    .from("icps")
    .select("brand_id, product_id, title, summary, pains, desires, objections, triggers")
    .eq("id", icpId)
    .single();

  if (fetchError || !original) return { error: "ICP not found" };

  const { data: copy, error } = await supabase
    .from("icps")
    .insert({
      brand_id: original.brand_id,
      product_id: original.product_id,
      title: `${original.title} (copy)`,
      summary: original.summary,
      pains: original.pains,
      desires: original.desires,
      objections: original.objections,
      triggers: original.triggers,
      is_primary: false,
      source: "manual",
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath(`/products/${productId}`);
  return { icpId: copy.id };
}
