import { createClient } from "@/lib/db/supabase-server";

export interface BrandOverview {
  id: string;
  name: string;
  slug: string;
  website_url: string | null;
  status: string;
  onboarding_step: string | null;
  onboarding_completed_at: string | null;
  created_at: string;
}

export interface BrandProfile {
  id: string;
  brand_id: string;
  description: string | null;
  category: string | null;
  positioning: string | null;
  value_proposition: string | null;
  messaging_notes: string | null;
  tone_tags: string[];
  personality_tags: string[];
  do_rules: string[];
  dont_rules: string[];
  source: string;
  created_at: string;
  updated_at: string;
}

export interface BrandVisualIdentity {
  id: string;
  brand_id: string;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  style_tags: string[];
  visual_notes: string | null;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface BrandImportInfo {
  id: string;
  source_url: string | null;
  status: string;
  completed_at: string | null;
  created_at: string;
}

export interface FullBrandData {
  brand: BrandOverview;
  profile: BrandProfile | null;
  visual: BrandVisualIdentity | null;
  lastImport: BrandImportInfo | null;
  /** Current user's role in this brand, when `userId` was passed to the loader. */
  membershipRole: string | null;
}

export async function getBrandPageData(
  brandId: string,
  userId?: string
): Promise<FullBrandData | null> {
  const supabase = await createClient();

  const { data: brand, error: brandError } = await supabase
    .from("brands")
    .select("id, name, slug, website_url, status, onboarding_step, onboarding_completed_at, created_at")
    .eq("id", brandId)
    .single();

  if (brandError || !brand) return null;

  const [profileResult, visualResult, importResult] = await Promise.all([
    supabase
      .from("brand_profiles")
      .select("*")
      .eq("brand_id", brandId)
      .maybeSingle(),
    supabase
      .from("brand_visual_identity")
      .select("*")
      .eq("brand_id", brandId)
      .maybeSingle(),
    supabase
      .from("import_runs")
      .select("id, source_url, status, completed_at, created_at")
      .eq("brand_id", brandId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  let membershipRole: string | null = null;
  if (userId) {
    const { data: mem } = await supabase
      .from("brand_members")
      .select("role")
      .eq("brand_id", brandId)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();
    membershipRole = mem?.role ?? null;
  }

  return {
    brand: brand as BrandOverview,
    profile: (profileResult.data as BrandProfile) ?? null,
    visual: (visualResult.data as BrandVisualIdentity) ?? null,
    lastImport: (importResult.data as BrandImportInfo) ?? null,
    membershipRole,
  };
}
