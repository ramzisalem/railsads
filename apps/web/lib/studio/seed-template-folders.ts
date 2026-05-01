import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Human-readable labels for the system `templates.category` codes. Used to
 * name the default folders we seed for each brand on first studio load.
 * New codes default to a title-cased version of the raw key — they'll show
 * up as real folders the user can rename at will, so getting the casing
 * "wrong" is a cheap mistake.
 */
const CATEGORY_FOLDER_LABEL: Record<string, string> = {
  before_after: "Before & after",
  benefit_driven: "Benefits",
  comparison: "Comparison",
  education: "Education",
  engagement: "Engagement",
  feature_focus: "Feature focus",
  offer: "Offer",
  social_proof: "Social proof",
  story_hook: "Story hook",
  custom: "My uploads",
};

function labelForCategory(category: string | null | undefined): string {
  if (!category) return "General";
  return (
    CATEGORY_FOLDER_LABEL[category] ??
    category
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

/**
 * Seed the brand's default template folders and per-brand placement
 * overrides the first time the Studio is loaded. After this runs:
 *
 *   - One `template_folders` row exists per distinct `templates.category`
 *     the brand has access to (system rows + their own uploads). Stored as
 *     normal DB rows so the user can rename / delete / manage them.
 *   - Every visible template has a `brand_template_overrides` row with a
 *     non-null `folder_id`, so the Studio can guarantee the invariant
 *     "every template belongs to a folder" without any virtual-folder
 *     plumbing in the UI.
 *   - `brands.templates_initialized_at` is set so we never re-seed, even
 *     if the user deletes every folder afterwards.
 *
 * Idempotent: if the brand is already initialized, returns immediately.
 * Safe to call from a read path (e.g. `getStudioContext`) — the check is
 * a single indexed lookup.
 *
 * Race-wise: two concurrent calls will both see `templates_initialized_at
 * IS NULL` and both try to seed. The UNIQUE (brand_id, name) constraint
 * on `template_folders` makes the second folder insert fail, which makes
 * the whole second call abort cleanly. The first call wins.
 */
export async function ensureTemplateFoldersSeeded(
  supabase: SupabaseClient,
  brandId: string
): Promise<void> {
  const { data: brand } = await supabase
    .from("brands")
    .select("templates_initialized_at")
    .eq("id", brandId)
    .maybeSingle();

  if (!brand || brand.templates_initialized_at) return;

  const { data: templates } = await supabase
    .from("templates")
    .select("id, category")
    .or(`brand_id.eq.${brandId},brand_id.is.null`)
    .eq("is_active", true);

  if (!templates || templates.length === 0) {
    // Nothing to seed; still mark as initialized so we don't keep
    // re-checking forever.
    await supabase
      .from("brands")
      .update({ templates_initialized_at: new Date().toISOString() })
      .eq("id", brandId);
    return;
  }

  // Group templates by the category string we'll hang their folder off.
  // `null` categories collapse into the "General" label so every template
  // lands in a folder, even if its row has no category set.
  const byCategory = new Map<string, { id: string }[]>();
  for (const t of templates as Array<{ id: string; category: string | null }>) {
    const cat = t.category ?? "__general";
    const arr = byCategory.get(cat);
    if (arr) arr.push({ id: t.id });
    else byCategory.set(cat, [{ id: t.id }]);
  }

  // Preserve any pre-existing overrides so we don't (a) un-hide a template
  // or (b) yank a template out of a folder the user already placed it in
  // via the old model where folder_id could be a real UUID while we still
  // had virtual category folders.
  const { data: existingOverrides } = await supabase
    .from("brand_template_overrides")
    .select("template_id, folder_id, hidden")
    .eq("brand_id", brandId);

  const existingByTemplate = new Map<
    string,
    { folder_id: string | null; hidden: boolean }
  >();
  for (const row of existingOverrides ?? []) {
    existingByTemplate.set(row.template_id, {
      folder_id: row.folder_id ?? null,
      hidden: Boolean(row.hidden),
    });
  }

  // Insert one folder per category. Use a deterministic sort order keyed
  // off the label so the initial order reads alphabetically.
  const folderInserts = [...byCategory.keys()]
    .map((cat) => ({
      cat,
      name:
        cat === "__general" ? labelForCategory(null) : labelForCategory(cat),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry, i) => ({
      brand_id: brandId,
      name: entry.name,
      sort_order: i,
      _cat: entry.cat,
    }));

  const { data: createdFolders, error: foldersErr } = await supabase
    .from("template_folders")
    .insert(
      folderInserts.map(({ brand_id, name, sort_order }) => ({
        brand_id,
        name,
        sort_order,
      }))
    )
    .select("id, name");

  if (foldersErr || !createdFolders) {
    // Abort without marking as initialized — a retry next load is fine.
    console.error("Default template folder seed failed:", foldersErr);
    return;
  }

  const folderByName = new Map(createdFolders.map((f) => [f.name, f.id]));
  const folderIdByCategory = new Map<string, string>();
  for (const entry of folderInserts) {
    const folderId = folderByName.get(entry.name);
    if (folderId) folderIdByCategory.set(entry._cat, folderId);
  }

  const overrideRows = templates
    .map((t) => {
      const cat = (t as { category: string | null }).category ?? "__general";
      const existing = existingByTemplate.get(t.id);
      // Respect prior user placement — if they already moved this
      // template to a folder, don't reset it to the category folder.
      const fallbackFolderId = folderIdByCategory.get(cat);
      const folderId = existing?.folder_id ?? fallbackFolderId;
      if (!folderId) return null;
      return {
        brand_id: brandId,
        template_id: t.id,
        folder_id: folderId,
        hidden: existing?.hidden ?? false,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (overrideRows.length > 0) {
    const { error: upsertErr } = await supabase
      .from("brand_template_overrides")
      .upsert(overrideRows, { onConflict: "brand_id,template_id" });
    if (upsertErr) {
      console.error(
        "Default template folder seed (overrides) failed:",
        upsertErr
      );
      return;
    }
  }

  await supabase
    .from("brands")
    .update({ templates_initialized_at: new Date().toISOString() })
    .eq("id", brandId);
}
