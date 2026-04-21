import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Analytics events emitted by the Competitors + Studio bridge feature.
 *
 * Persisted to `public.audit_logs` so we can answer simple usage questions
 * (how many ads are being captured, how often analyzers run, how often a
 * Studio thread actually consumes a competitor reference) without spinning up
 * a third-party analytics SDK. Failures are swallowed: telemetry must never
 * surface as a user-visible error.
 */
export type CompetitorTelemetryAction =
  | "competitor_ad_added"
  | "competitor_analysis_run"
  | "studio_used_competitor_reference";

export interface CompetitorTelemetryParams {
  brandId: string;
  actorId?: string | null;
  entityId?: string | null;
  payload?: Record<string, unknown>;
}

export async function trackCompetitorEvent(
  supabase: SupabaseClient,
  action: CompetitorTelemetryAction,
  params: CompetitorTelemetryParams
): Promise<void> {
  try {
    await supabase.from("audit_logs").insert({
      brand_id: params.brandId,
      actor_id: params.actorId ?? null,
      entity_type: "competitor",
      entity_id: params.entityId ?? null,
      action,
      payload: params.payload ?? {},
    });
  } catch (err) {
    console.warn("[competitor telemetry] insert failed", {
      action,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
