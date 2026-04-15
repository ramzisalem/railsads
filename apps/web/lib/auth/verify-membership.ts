import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Verify that a user is a member of the given brand.
 * Returns true if membership exists, false otherwise.
 */
export async function verifyBrandMembership(
  supabase: SupabaseClient,
  userId: string,
  brandId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("brand_members")
    .select("id")
    .eq("brand_id", brandId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  return !!data;
}
