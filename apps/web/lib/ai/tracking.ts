import type { SupabaseClient } from "@supabase/supabase-js";

type AiServiceType =
  | "brand_import"
  | "icp_generation"
  | "competitor_analysis"
  | "creative_generation"
  | "creative_revision"
  | "image_generation"
  | "image_edit"
  | "thread_title";

export interface CreateRunParams {
  /**
   * When omitted (e.g. during onboarding before the brand row exists), tracking
   * is skipped entirely and `createAiRun` returns `null`. The corresponding
   * `complete`/`fail` calls are no-ops in that case because `runId` will be `null`.
   */
  brandId?: string;
  threadId?: string;
  messageId?: string;
  serviceType: AiServiceType;
  model: string;
  promptVersion: string;
  userId: string;
}

export interface CompleteRunParams {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  estimatedCostUsd?: number;
  responsePayload?: unknown;
}

/**
 * Creates an ai_run record in "running" state and returns its ID.
 */
export async function createAiRun(
  supabase: SupabaseClient,
  params: CreateRunParams
): Promise<string | null> {
  // No brand yet (e.g. mid-onboarding) — `ai_runs.brand_id` is NOT NULL, so we
  // cannot persist the run. Usage will be tracked at finalize time instead.
  if (!params.brandId) return null;

  const { data, error } = await supabase
    .from("ai_runs")
    .insert({
      brand_id: params.brandId,
      thread_id: params.threadId ?? null,
      message_id: params.messageId ?? null,
      service_type: params.serviceType,
      status: "running",
      model: params.model,
      prompt_version: params.promptVersion,
      created_by: params.userId,
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    console.error("Failed to create ai_run:", error.message);
    return null;
  }

  return data.id;
}

/**
 * Marks an ai_run as completed with token usage and latency.
 */
export async function completeAiRun(
  supabase: SupabaseClient,
  runId: string,
  params: CompleteRunParams
): Promise<void> {
  const now = new Date();

  const { data: run } = await supabase
    .from("ai_runs")
    .select("started_at")
    .eq("id", runId)
    .single();

  const latencyMs =
    run?.started_at
      ? Math.round(now.getTime() - new Date(run.started_at).getTime())
      : null;

  const { error } = await supabase
    .from("ai_runs")
    .update({
      status: "completed",
      input_tokens: params.inputTokens ?? null,
      output_tokens: params.outputTokens ?? null,
      total_tokens: params.totalTokens ?? null,
      estimated_cost_usd: params.estimatedCostUsd ?? null,
      response_payload: params.responsePayload ?? null,
      latency_ms: latencyMs,
      completed_at: now.toISOString(),
    })
    .eq("id", runId);

  if (error) {
    console.error("Failed to complete ai_run:", error.message);
  }
}

/**
 * Marks an ai_run as failed with an error message.
 */
export async function failAiRun(
  supabase: SupabaseClient,
  runId: string,
  errorMessage: string
): Promise<void> {
  const { error } = await supabase
    .from("ai_runs")
    .update({
      status: "failed",
      error_message: errorMessage,
      completed_at: new Date().toISOString(),
    })
    .eq("id", runId);

  if (error) {
    console.error("Failed to fail ai_run:", error.message);
  }
}
