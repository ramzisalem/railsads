import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/db/supabase-server";
import { analyzeCompetitor } from "@/lib/ai/services";
import { MODELS } from "@/lib/ai/provider";
import { PROMPT_VERSIONS } from "@/lib/ai/prompts";
import { checkCreditGate, trackUsage } from "@/lib/billing/gate";
import { verifyBrandMembership } from "@/lib/auth/verify-membership";
import { parseBody, competitorAnalyzeSchema } from "@/lib/validation/schemas";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: body, error: validationError } = await parseBody(request, competitorAnalyzeSchema);
  if (validationError) return validationError;

  const { brandId, competitorId, productId } = body;

  const isMember = await verifyBrandMembership(supabase, user.id, brandId);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const gateResponse = await checkCreditGate(brandId, "competitor_analysis");
  if (gateResponse) return gateResponse;

  try {
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

    const { output, runId } = await analyzeCompetitor(supabase, {
      brandId,
      competitorId,
      userId: user.id,
    });

    if (analysisRun) {
      await supabase
        .from("competitor_analysis_runs")
        .update({
          status: "completed",
          model: MODELS.efficient,
          prompt_version: PROMPT_VERSIONS.competitor_analysis,
          summary: output.summary,
          raw_output: output,
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
      })
      .select("id")
      .single();

    await trackUsage({
      brandId,
      eventType: "competitor_analysis",
      userId: user.id,
      aiRunId: runId ?? undefined,
    });

    return NextResponse.json({
      insightId: insight?.id,
      output,
      runId,
    });
  } catch (error) {
    console.error("Competitor analysis failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Competitor analysis failed",
      },
      { status: 500 }
    );
  }
}
