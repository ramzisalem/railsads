import { createClient } from "@/lib/db/supabase-server";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RecentThread {
  id: string;
  title: string | null;
  product_name: string;
  icp_title: string | null;
  last_message_at: string | null;
  created_at: string;
  last_hook: string | null;
}

export interface DashboardStats {
  productCount: number;
  threadCount: number;
  competitorCount: number;
}

export interface SuggestionItem {
  label: string;
  productId: string;
  productName: string;
  icpId?: string;
  icpTitle?: string;
  templateKey?: string;
}

// ---------------------------------------------------------------------------
// Recent threads (last 6 with latest assistant message hook)
// ---------------------------------------------------------------------------

export async function getRecentThreads(
  brandId: string,
  limit = 6
): Promise<RecentThread[]> {
  const supabase = await createClient();

  const { data: threads, error } = await supabase
    .from("threads")
    .select(
      `id, title, last_message_at, created_at,
       product:products!inner(name),
       icp:icps(title)`
    )
    .eq("brand_id", brandId)
    .is("archived_at", null)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error || !threads || threads.length === 0) return [];

  const threadIds = threads.map((t) => t.id);
  const { data: messages } = await supabase
    .from("messages")
    .select("thread_id, structured_payload")
    .in("thread_id", threadIds)
    .eq("role", "assistant")
    .order("created_at", { ascending: false });

  const hookMap = new Map<string, string>();
  for (const msg of messages ?? []) {
    if (hookMap.has(msg.thread_id)) continue;
    const payload = msg.structured_payload as Record<string, unknown> | null;
    const hooks = payload?.hooks as string[] | undefined;
    if (hooks && hooks.length > 0) {
      hookMap.set(msg.thread_id, hooks[0]);
    }
  }

  return threads.map((row) => {
    const product = row.product as unknown as { name: string } | null;
    const icp = row.icp as unknown as { title: string } | null;

    return {
      id: row.id,
      title: row.title,
      product_name: product?.name ?? "Unknown product",
      icp_title: icp?.title ?? null,
      last_message_at: row.last_message_at,
      created_at: row.created_at,
      last_hook: hookMap.get(row.id) ?? null,
    };
  });
}

// ---------------------------------------------------------------------------
// Dashboard stats
// ---------------------------------------------------------------------------

export async function getDashboardStats(
  brandId: string
): Promise<DashboardStats> {
  const supabase = await createClient();

  const [productsResult, threadsResult, competitorsResult] = await Promise.all([
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", brandId)
      .is("deleted_at", null),
    supabase
      .from("threads")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", brandId)
      .is("archived_at", null),
    supabase
      .from("competitors")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", brandId)
      .is("deleted_at", null),
  ]);

  return {
    productCount: productsResult.count ?? 0,
    threadCount: threadsResult.count ?? 0,
    competitorCount: competitorsResult.count ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Today's suggestions — context-aware prompts based on user's data
// ---------------------------------------------------------------------------

export async function getSuggestions(
  brandId: string
): Promise<SuggestionItem[]> {
  const supabase = await createClient();

  const { data: products } = await supabase
    .from("products")
    .select("id, name")
    .eq("brand_id", brandId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(5);

  if (!products || products.length === 0) return [];

  const productIds = products.map((p) => p.id);
  const { data: icps } = await supabase
    .from("icps")
    .select("id, title, product_id")
    .in("product_id", productIds)
    .is("archived_at", null)
    .limit(10);

  const [{ data: templates }, { data: hiddenOverrides }] = await Promise.all([
    supabase
      .from("templates")
      .select("id, key, name")
      .or(`brand_id.eq.${brandId},brand_id.is.null`)
      .eq("is_active", true)
      .limit(10),
    supabase
      .from("brand_template_overrides")
      .select("template_id")
      .eq("brand_id", brandId)
      .eq("hidden", true),
  ]);

  const suggestions: SuggestionItem[] = [];

  const hidden = new Set((hiddenOverrides ?? []).map((r) => r.template_id));
  // Respect per-brand hides so a template the user explicitly removed from
  // their library doesn't re-surface as a dashboard suggestion.
  const templateList = (templates ?? [])
    .filter((t) => !hidden.has(t.id))
    .slice(0, 5);
  const templateNames = new Map(templateList.map((t) => [t.key, t.name]));

  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );

  for (let pi = 0; pi < products.length; pi++) {
    const product = products[pi];
    const productIcps = (icps ?? []).filter(
      (i) => i.product_id === product.id
    );

    if (productIcps.length > 0) {
      const icp = productIcps[(dayOfYear + pi) % productIcps.length];
      suggestions.push({
        label: `Create a problem-focused ad for ${product.name} targeting ${icp.title}`,
        productId: product.id,
        productName: product.name,
        icpId: icp.id,
        icpTitle: icp.title,
      });
    }

    if (templateList.length > 0) {
      const tmpl = templateList[(dayOfYear + pi) % templateList.length];
      suggestions.push({
        label: `Try ${templateNames.get(tmpl.key) ?? tmpl.key} template for ${product.name}`,
        productId: product.id,
        productName: product.name,
        templateKey: tmpl.key,
      });
    }

    if (suggestions.length >= 4) break;
  }

  return suggestions.slice(0, 4);
}
