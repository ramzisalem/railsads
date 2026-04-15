import { createClient } from "@/lib/db/supabase-server";
import type {
  ThreadListItem,
  ThreadDetail,
  MessageItem,
  StudioContext,
  TemplateOption,
  ProductOption,
  IcpOption,
} from "./types";

export async function getThreadsList(
  brandId: string
): Promise<ThreadListItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("threads")
    .select(
      `id, title, status, last_message_at, created_at,
       product:products!inner(name),
       icp:icps(title)`
    )
    .eq("brand_id", brandId)
    .is("archived_at", null)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false });

  if (error || !data) return [];

  return data.map((row) => {
    const product = row.product as unknown as { name: string } | null;
    const icp = row.icp as unknown as { title: string } | null;

    return {
      id: row.id,
      title: row.title,
      product_name: product?.name ?? "Unknown product",
      icp_title: icp?.title ?? null,
      status: row.status,
      last_message_at: row.last_message_at,
      created_at: row.created_at,
    };
  });
}

export async function getThreadDetail(
  threadId: string,
  brandId: string
): Promise<ThreadDetail | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("threads")
    .select("*")
    .eq("id", threadId)
    .eq("brand_id", brandId)
    .is("archived_at", null)
    .single();

  if (error || !data) return null;

  return data as ThreadDetail;
}

export async function getThreadMessages(
  threadId: string,
  brandId: string
): Promise<MessageItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("messages")
    .select("id, thread_id, role, content, structured_payload, created_at")
    .eq("thread_id", threadId)
    .eq("brand_id", brandId)
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  return data as MessageItem[];
}

export async function getStudioContext(
  brandId: string
): Promise<StudioContext> {
  const supabase = await createClient();

  const [productsResult, icpsResult, templatesResult] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, short_description")
      .eq("brand_id", brandId)
      .is("deleted_at", null)
      .order("name"),
    supabase
      .from("icps")
      .select("id, title, summary, product_id")
      .eq("brand_id", brandId)
      .is("archived_at", null)
      .order("title"),
    supabase
      .from("templates")
      .select("id, key, name, description, category")
      .or(`brand_id.eq.${brandId},brand_id.is.null`)
      .eq("is_active", true)
      .order("name"),
  ]);

  return {
    products: (productsResult.data ?? []) as ProductOption[],
    icps: (icpsResult.data ?? []) as IcpOption[],
    templates: (templatesResult.data ?? []) as TemplateOption[],
  };
}
