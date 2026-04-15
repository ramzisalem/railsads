import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/db/supabase-server";
import { redirect } from "next/navigation";

export type CurrentBrand = {
  id: string;
  name: string;
  slug: string;
  websiteUrl: string | null;
  onboardingStep: string | null;
  onboardingCompletedAt: string | null;
  role: string;
};

const ACTIVE_BRAND_COOKIE = "railsads-active-brand";

/**
 * Load brand row after membership is confirmed. Kept separate from the embedded
 * `brand:brands(...)` select — that join often returns null under RLS even when
 * `brand_members` + `brands` each pass policy in isolation (same pattern as verifyBrandMembership).
 */
const navDebug = () => process.env.NODE_ENV === "development";

async function currentBrandFromMembership(
  supabase: SupabaseClient,
  membership: { role: string; brand_id: string }
): Promise<CurrentBrand | null> {
  const { data: brand, error } = await supabase
    .from("brands")
    .select("id, name, slug, website_url, onboarding_step, onboarding_completed_at")
    .eq("id", membership.brand_id)
    .maybeSingle();

  if (navDebug()) {
    console.info("[railsads:getCurrentBrand] brands row", {
      brand_id: membership.brand_id,
      found: !!brand,
      error: error?.message ?? null,
    });
  }

  if (!brand) return null;

  return {
    id: brand.id,
    name: brand.name,
    slug: brand.slug,
    websiteUrl: brand.website_url,
    onboardingStep: brand.onboarding_step,
    onboardingCompletedAt: brand.onboarding_completed_at,
    role: membership.role,
  };
}

async function pickMembershipRow(
  supabase: SupabaseClient,
  userId: string,
  preferredBrandId?: string | null
): Promise<{ role: string; brand_id: string } | null> {
  let q = supabase
    .from("brand_members")
    .select("role, brand_id")
    .eq("user_id", userId)
    .eq("status", "active");

  if (preferredBrandId) {
    q = q.eq("brand_id", preferredBrandId);
  } else {
    q = q.order("created_at", { ascending: true }).limit(1);
  }

  const { data, error } = await q.maybeSingle();
  if (navDebug()) {
    console.info("[railsads:getCurrentBrand] pickMembershipRow", {
      preferredBrandId: preferredBrandId ?? null,
      found: !!data,
      error: error?.message ?? null,
    });
  }
  return data ?? null;
}

/**
 * Get the active brand for the current user.
 * Reads from cookie, falls back to first brand the user belongs to.
 * Redirects to /onboarding if user has no brands.
 */
export async function getCurrentBrand(userId: string): Promise<CurrentBrand> {
  const supabase = await createClient();
  const cookieStore = await cookies();
  const activeBrandId = cookieStore.get(ACTIVE_BRAND_COOKIE)?.value;

  if (navDebug()) {
    console.info("[railsads:getCurrentBrand] start", {
      userId,
      cookieBrandId: activeBrandId ?? null,
    });
  }

  if (activeBrandId) {
    const mem = await pickMembershipRow(supabase, userId, activeBrandId);
    if (mem) {
      const resolved = await currentBrandFromMembership(supabase, mem);
      if (resolved) {
        if (navDebug()) {
          console.info("[railsads:getCurrentBrand] ok (cookie path)", { brandId: resolved.id });
        }
        return resolved;
      }
      if (navDebug()) {
        console.info("[railsads:getCurrentBrand] cookie path: membership ok but brand row missing");
      }
    } else if (navDebug()) {
      console.info("[railsads:getCurrentBrand] cookie path: no membership row for cookie brand");
    }
  }

  const firstMem = await pickMembershipRow(supabase, userId, null);
  if (firstMem) {
    const resolved = await currentBrandFromMembership(supabase, firstMem);
    if (resolved) {
      if (navDebug()) {
        console.info("[railsads:getCurrentBrand] ok (fallback first membership)", {
          brandId: resolved.id,
        });
      }
      return resolved;
    }
    if (navDebug()) {
      console.info("[railsads:getCurrentBrand] fallback: membership row but brand fetch failed");
    }
  } else if (navDebug()) {
    console.info("[railsads:getCurrentBrand] fallback: no membership rows for user");
  }

  console.warn("[railsads:getCurrentBrand] redirect → /onboarding", {
    userId,
    cookieBrandId: activeBrandId ?? null,
    reason: "no_resolvable_brand_after_membership_and_brand_queries",
  });

  redirect("/onboarding");
}

/**
 * Get all brands the user belongs to (for brand switcher).
 */
export async function getUserBrands(userId: string) {
  const supabase = await createClient();

  const { data: memberships } = await supabase
    .from("brand_members")
    .select("role, brand_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (!memberships?.length) return [];

  const ids = [...new Set(memberships.map((m) => m.brand_id))];
  const { data: brands } = await supabase.from("brands").select("id, name, slug").in("id", ids);

  const byId = new Map((brands ?? []).map((b) => [b.id, b]));

  return memberships.flatMap((m) => {
    const b = byId.get(m.brand_id);
    if (!b) return [];
    return [{ id: b.id, name: b.name, slug: b.slug, role: m.role }];
  });
}

export { ACTIVE_BRAND_COOKIE };
