import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/db/supabase-server";
import { analyzeCompetitor } from "@/lib/ai/services";
import { MODELS } from "@/lib/ai/provider";
import { PROMPT_VERSIONS } from "@/lib/ai/prompts";
import { checkCreditGate, safeTrackUsage } from "@/lib/billing/gate";
import { verifyBrandMembership } from "@/lib/auth/verify-membership";
import {
  parseBody,
  competitorAnalyzeSchema,
} from "@/lib/validation/schemas";
import { trackCompetitorEvent } from "@/lib/competitors/telemetry";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: body, error: validationError } = await parseBody(
    request,
    competitorAnalyzeSchema
  );
  if (validationError) return validationError;

  const { brandId, competitorId, productId, onlyNewAds } = body;

  const isMember = await verifyBrandMembership(supabase, user.id, brandId);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const gateResponse = await checkCreditGate(brandId, "competitor_analysis");
  if (gateResponse) return gateResponse;

  // Pre-create the analysis run row so it's visible in history even if the
  // model call dies. We mark it as 'failed' in the catch, so the user's run
  // log can show the error message instead of a phantom "running…" forever.
  const { data: analysisRun } = await supabase
    .from("competitor_analysis_runs")
    .insert({
      brand_id: brandId,
      competitor_id: competitorId,
      product_id: productId || null,
      status: "running",
      created_by: user.id,
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  try {
    const { output, evidence, runId, analyzedAdIds, incremental } =
      await analyzeCompetitor(supabase, {
        brandId,
        competitorId,
        userId: user.id,
        productId: productId || null,
        onlyNewAds: onlyNewAds !== false,
      });

    if (analysisRun) {
      await supabase
        .from("competitor_analysis_runs")
        .update({
          status: "completed",
          model: MODELS.efficient,
          prompt_version: PROMPT_VERSIONS.competitor_analysis,
          summary: output.summary,
          raw_output: { ...output, evidence_resolved: evidence },
          completed_at: new Date().toISOString(),
        })
        .eq("id", analysisRun.id);
    }

    const { data: insight } = await supabase
      .from("competitor_insights")
      .insert({
        brand_id: brandId,
        competitor_id: competitorId,
        product_id: productId || null,
        analysis_run_id: analysisRun?.id || null,
        summary: output.summary,
        hook_patterns: output.hook_patterns,
        angle_patterns: output.angle_patterns,
        emotional_triggers: output.emotional_triggers,
        visual_patterns: output.visual_patterns,
        offer_patterns: output.offer_patterns,
        cta_patterns: output.cta_patterns,
        confidence_score: output.confidence_score,
        evidence,
      })
      .select("id")
      .single();

    // Persist the run↔ad mapping so future incremental runs know which
    // ads have already been consumed at this scope.
    if (analysisRun && analyzedAdIds.length > 0) {
      await supabase.from("competitor_analysis_run_ads").insert(
        analyzedAdIds.map((adId) => ({
          run_id: analysisRun.id,
          ad_id: adId,
        }))
      );
    }

    await safeTrackUsage({
      brandId,
      eventType: "competitor_analysis",
      userId: user.id,
      aiRunId: runId ?? undefined,
    });

    await trackCompetitorEvent(supabase, "competitor_analysis_run", {
      brandId,
      actorId: user.id,
      entityId: competitorId,
      payload: {
        product_id: productId || null,
        run_id: analysisRun?.id ?? null,
        ai_run_id: runId ?? null,
        evidence_count: evidence?.length ?? 0,
        analyzed_ad_count: analyzedAdIds.length,
        incremental,
        outcome: "completed",
      },
    });

    return NextResponse.json({
      insightId: insight?.id,
      output,
      evidence,
      runId,
      analyzedAdCount: analyzedAdIds.length,
      incremental,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Competitor analysis failed";
    console.error("Competitor analysis failed:", error);

    if (analysisRun) {
      await supabase
        .from("competitor_analysis_runs")
        .update({
          status: "failed",
          error_message: message,
          completed_at: new Date().toISOString(),
        })
        .eq("id", analysisRun.id);
    }

    await trackCompetitorEvent(supabase, "competitor_analysis_run", {
      brandId,
      actorId: user.id,
      entityId: competitorId,
      payload: {
        product_id: productId || null,
        run_id: analysisRun?.id ?? null,
        outcome: "failed",
        error: message,
      },
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
