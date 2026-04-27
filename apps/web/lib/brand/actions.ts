"use server";

import { createClient } from "@/lib/db/supabase-server";
import { createAdminClient } from "@/lib/db/supabase-admin";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACTIVE_BRAND_COOKIE } from "@/lib/auth/get-current-brand";
import { getStripe } from "@/lib/billing/stripe";
import {
  paletteForDb,
  syncLegacyColorsFromPalette,
} from "@/lib/brand/color-palette";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

/**
 * Create a new brand.
 * Creates: brand → brand_member (owner) → brand_settings → brand_profiles → brand_visual_identity
 */
export async function createBrand(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const name = (formData.get("name") as string)?.trim();
  if (!name) return { error: "Brand name is required" };

  const websiteUrl = (formData.get("websiteUrl") as string)?.trim() || null;
  const baseSlug = slugify(name);

  // Use admin client for bootstrap inserts (bypasses RLS chicken-and-egg:
  // brand_members INSERT requires membership, but this is the first member)
  const admin = createAdminClient();

  // Ensure unique slug
  let slug = baseSlug;
  let attempt = 0;
  while (true) {
    const { data: existing } = await admin
      .from("brands")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!existing) break;
    attempt++;
    slug = `${baseSlug}-${attempt}`;
  }

  // Create brand
  const { data: brand, error: brandError } = await admin
    .from("brands")
    .insert({
      name,
      slug,
      website_url: websiteUrl,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (brandError || !brand) {
    return { error: brandError?.message ?? "Failed to create brand" };
  }

  // Create owner membership
  const { error: memberError } = await admin.from("brand_members").insert({
    brand_id: brand.id,
    user_id: user.id,
    role: "owner",
    status: "active",
    joined_at: new Date().toISOString(),
  });

  if (memberError) {
    await admin.from("brands").delete().eq("id", brand.id);
    return { error: "Failed to set up brand membership" };
  }

  // Create child records — non-critical, log but don't fail
  const { error: settingsError } = await admin
    .from("brand_settings")
    .insert({ brand_id: brand.id });

  const { error: profileError } = await admin
    .from("brand_profiles")
    .insert({ brand_id: brand.id, created_by: user.id });

  const { error: visualError } = await admin
    .from("brand_visual_identity")
    .insert({ brand_id: brand.id, created_by: user.id });

  if (settingsError || profileError || visualError) {
    console.error("Non-critical brand setup errors:", {
      settingsError,
      profileError,
      visualError,
    });
  }

  // Set as active brand
  const isProduction = process.env.NODE_ENV === "production";
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_BRAND_COOKIE, brand.id, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
  });

  revalidatePath("/", "layout");

  return { brandId: brand.id, slug };
}

const STORAGE_REMOVE_CHUNK = 100;

/**
 * Permanently delete a brand and all related DB rows (FK cascade).
 * Removes linked storage objects, cancels an active Stripe subscription when configured,
 * clears or switches the active-brand cookie, then redirects.
 *
 * Only the brand **owner** may delete. Requires typing the exact brand name.
 */
export async function deleteBrand(formData: FormData) {
  const brandId = (formData.get("brandId") as string)?.trim();
  const confirmName = (formData.get("confirmName") as string)?.trim();
  if (!brandId) return { error: "Missing brand" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();

  const { data: brandRow, error: brandLookupError } = await admin
    .from("brands")
    .select("name")
    .eq("id", brandId)
    .maybeSingle();

  if (brandLookupError || !brandRow) {
    return { error: "Brand not found" };
  }
  if (confirmName !== brandRow.name) {
    return { error: "Type the exact brand name to confirm deletion." };
  }

  const { data: member } = await admin
    .from("brand_members")
    .select("role")
    .eq("brand_id", brandId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!member || member.role !== "owner") {
    return { error: "Only the brand owner can delete this brand." };
  }

  const { data: sub } = await admin
    .from("subscriptions")
    .select("stripe_subscription_id")
    .eq("brand_id", brandId)
    .maybeSingle();

  if (sub?.stripe_subscription_id && process.env.STRIPE_SECRET_KEY) {
    try {
      const stripe = getStripe();
      await stripe.subscriptions.cancel(sub.stripe_subscription_id);
    } catch (e) {
      console.error("Stripe cancel on brand delete:", e);
    }
  }

  const { data: assetRows } = await admin
    .from("assets")
    .select("bucket, storage_path")
    .eq("brand_id", brandId);

  const byBucket = new Map<string, Set<string>>();
  for (const row of assetRows ?? []) {
    const bucket = row.bucket?.trim();
    const path = row.storage_path?.trim();
    if (!bucket || !path) continue;
    if (!byBucket.has(bucket)) byBucket.set(bucket, new Set());
    byBucket.get(bucket)!.add(path);
  }

  for (const [bucket, paths] of byBucket) {
    const list = [...paths];
    for (let i = 0; i < list.length; i += STORAGE_REMOVE_CHUNK) {
      const chunk = list.slice(i, i + STORAGE_REMOVE_CHUNK);
      const { error: rmErr } = await admin.storage.from(bucket).remove(chunk);
      if (rmErr) {
        console.error("Storage remove on brand delete:", bucket, rmErr);
      }
    }
  }

  const { data: otherMemberships } = await admin
    .from("brand_members")
    .select("brand_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .neq("brand_id", brandId)
    .limit(1);

  const nextBrandId = otherMemberships?.[0]?.brand_id ?? null;

  const { error: deleteError } = await admin.from("brands").delete().eq("id", brandId);
  if (deleteError) {
    return { error: deleteError.message ?? "Failed to delete brand" };
  }

  const isProduction = process.env.NODE_ENV === "production";
  const cookieStore = await cookies();
  if (nextBrandId) {
    cookieStore.set(ACTIVE_BRAND_COOKIE, nextBrandId, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
    });
  } else {
    cookieStore.delete(ACTIVE_BRAND_COOKIE);
  }

  revalidatePath("/", "layout");
  redirect(nextBrandId ? "/dashboard" : "/onboarding");
}

/**
 * Switch active brand.
 */
export async function switchBrand(brandId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Verify membership
  const { data: membership } = await supabase
    .from("brand_members")
    .select("id")
    .eq("brand_id", brandId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (!membership) return { error: "Not a member of this brand" };

  const isProduction = process.env.NODE_ENV === "production";
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_BRAND_COOKIE, brandId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
  });

  revalidatePath("/", "layout");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Brand page inline-edit actions
// ---------------------------------------------------------------------------

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/**
 * Update brand overview fields (name, website_url).
 */
export async function updateBrandOverview(
  brandId: string,
  data: { name?: string; website_url?: string | null }
) {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated" };

  const updates: Record<string, unknown> = {};
  if (data.name !== undefined) updates.name = data.name.trim();
  if (data.website_url !== undefined) updates.website_url = data.website_url;

  if (Object.keys(updates).length === 0) return { error: "Nothing to update" };

  const { error } = await supabase
    .from("brands")
    .update(updates)
    .eq("id", brandId);

  if (error) return { error: error.message };

  revalidatePath("/brand");
  return { success: true };
}

/**
 * Update brand profile (positioning, messaging, tone, personality, do/don't rules).
 */
export async function updateBrandProfile(
  brandId: string,
  data: {
    description?: string | null;
    category?: string | null;
    positioning?: string | null;
    value_proposition?: string | null;
    messaging_notes?: string | null;
    tone_tags?: string[];
    personality_tags?: string[];
    do_rules?: string[];
    dont_rules?: string[];
  }
) {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("brand_profiles")
    .update(data)
    .eq("brand_id", brandId);

  if (error) return { error: error.message };

  revalidatePath("/brand");
  return { success: true };
}

/**
 * Update brand visual identity (colors, style tags, notes).
 */
export async function updateBrandVisual(
  brandId: string,
  data: {
    primary_color?: string | null;
    secondary_color?: string | null;
    accent_color?: string | null;
    color_palette?: { segment: string; hex: string }[];
    style_tags?: string[];
    visual_notes?: string | null;
  }
) {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) return { error: "Not authenticated" };

  let payload: Record<string, unknown> = { ...data };
  if (data.color_palette !== undefined) {
    const palette = paletteForDb(data.color_palette);
    const legacy = syncLegacyColorsFromPalette(palette);
    payload = {
      ...data,
      color_palette: palette,
      primary_color: legacy.primary_color,
      secondary_color: legacy.secondary_color,
      accent_color: legacy.accent_color,
    };
  }

  const { error } = await supabase
    .from("brand_visual_identity")
    .update(payload)
    .eq("brand_id", brandId);

  if (error) return { error: error.message };

  revalidatePath("/brand");
  return { success: true };
}
