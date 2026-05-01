"use server";

import { createClient } from "@/lib/db/supabase-server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createStudioThread,
  type CreateStudioThreadResult,
} from "@/lib/studio/create-thread";

async function getAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

// ---------------------------------------------------------------------------
// Thread CRUD
// ---------------------------------------------------------------------------

/** Server action for client forms; delegates to server-only `createStudioThread`. */
export async function createThread(
  brandId: string,
  productId: string,
  icpId?: string | null,
  templateId?: string | null,
  angle?: string | null,
  awareness?: string | null,
  referenceCompetitorAdId?: string | null,
  visualStyle?: string | null
): Promise<CreateStudioThreadResult> {
  return createStudioThread(
    brandId,
    productId,
    icpId,
    templateId,
    angle,
    awareness,
    referenceCompetitorAdId,
    visualStyle
  );
}

export async function archiveThread(threadId: string) {
  const { supabase, user } = await getAuth();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("threads")
    .update({ archived_at: new Date().toISOString(), status: "archived" })
    .eq("id", threadId);

  if (error) return { error: error.message };

  revalidatePath("/studio");
  redirect("/studio");
}

export async function updateThreadContext(
  threadId: string,
  data: {
    product_id?: string;
    icp_id?: string | null;
    template_id?: string | null;
    /** Full ordered selection of templates. When supplied, `template_id`
     *  is automatically synced to the first element (or null when empty)
     *  so legacy single-template flows keep functioning. */
    template_ids?: string[] | null;
    angle?: string | null;
    awareness?: string | null;
    reference_competitor_ad_id?: string | null;
    visual_style?: string | null;
  }
) {
  const { supabase, user } = await getAuth();
  if (!user) return { error: "Not authenticated" };

  const payload: Record<string, unknown> = { ...data };

  if ("template_ids" in data) {
    const ids = data.template_ids ?? [];
    payload.template_ids = ids;
    // Primary template mirrors the head of the array so downstream
    // single-template consumers (image generation fallback, exports)
    // stay coherent with the picker state.
    payload.template_id = ids[0] ?? null;
  }

  const { error } = await supabase
    .from("threads")
    .update(payload)
    .eq("id", threadId);

  if (error) return { error: error.message };

  revalidatePath(`/studio/${threadId}`);
  return { success: true };
}

export async function updateThreadTitle(threadId: string, title: string) {
  const { supabase, user } = await getAuth();
  if (!user) return { error: "Not authenticated" };

  if (!title.trim()) return { error: "Title cannot be empty" };

  const { error } = await supabase
    .from("threads")
    .update({ title: title.trim() })
    .eq("id", threadId);

  if (error) return { error: error.message };

  revalidatePath("/studio");
  revalidatePath(`/studio/${threadId}`);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Creative versioning
// ---------------------------------------------------------------------------

export async function saveCreativeVersion(
  brandId: string,
  threadId: string,
  messageId: string,
  selections: {
    selectedHook?: string;
    selectedHeadline?: string;
    selectedPrimaryText?: string;
    creativeDirection?: string;
  }
) {
  const { supabase, user } = await getAuth();
  if (!user) return { error: "Not authenticated" };

  const { data: latestVersion } = await supabase
    .from("creative_versions")
    .select("id, version_number")
    .eq("thread_id", threadId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextNumber = (latestVersion?.version_number ?? 0) + 1;

  await supabase
    .from("creative_versions")
    .update({ is_active: false })
    .eq("thread_id", threadId)
    .eq("is_active", true);

  const { data: version, error } = await supabase
    .from("creative_versions")
    .insert({
      brand_id: brandId,
      thread_id: threadId,
      parent_version_id: latestVersion?.id ?? null,
      source_message_id: messageId,
      version_number: nextNumber,
      is_active: true,
      selected_hook: selections.selectedHook ?? null,
      selected_headline: selections.selectedHeadline ?? null,
      selected_primary_text: selections.selectedPrimaryText ?? null,
      creative_direction: selections.creativeDirection
        ? { text: selections.creativeDirection }
        : null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  await supabase
    .from("threads")
    .update({ active_version_id: version.id })
    .eq("id", threadId);

  revalidatePath(`/studio/${threadId}`);
  return { versionId: version.id };
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export type ChatImageAttachment = { type: "image"; url: string };

export async function sendMessage(
  brandId: string,
  threadId: string,
  content: string,
  attachments?: ChatImageAttachment[]
) {
  const { supabase, user } = await getAuth();
  if (!user) return { error: "Not authenticated" };

  const trimmed = content.trim();
  const safeAttachments = (attachments ?? []).filter(
    (a) => a.type === "image" && typeof a.url === "string" && a.url.startsWith("http")
  );
  if (!trimmed && safeAttachments.length === 0) {
    return { error: "Message cannot be empty" };
  }

  const { data: msg, error } = await supabase
    .from("messages")
    .insert({
      brand_id: brandId,
      thread_id: threadId,
      role: "user",
      content: trimmed || null,
      structured_payload:
        safeAttachments.length > 0
          ? { attachments: safeAttachments }
          : null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  await supabase
    .from("threads")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", threadId);

  revalidatePath(`/studio/${threadId}`);
  return { messageId: msg.id };
}
