import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/db/supabase-server";
import { generateIcps } from "@/lib/ai/services";
import { checkCreditGate, trackUsage } from "@/lib/billing/gate";
import { verifyBrandMembership } from "@/lib/auth/verify-membership";
import { parseBody, icpGenerateSchema } from "@/lib/validation/schemas";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: body, error: validationError } = await parseBody(request, icpGenerateSchema);
  if (validationError) return validationError;

  const { brandId, productId } = body;

  const isMember = await verifyBrandMembership(supabase, user.id, brandId);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const gateResponse = await checkCreditGate(brandId, "icp_generation");
  if (gateResponse) return gateResponse;

  try {
    const { output, runId } = await generateIcps(supabase, {
      brandId,
      productId,
      userId: user.id,
    });

    const insertedIcps = [];
    for (const icp of output.icps) {
      const { data } = await supabase
        .from("icps")
        .insert({
          brand_id: brandId,
          product_id: productId,
          title: icp.title,
          summary: icp.summary,
          pains: icp.pains,
          desires: icp.desires,
          objections: icp.objections,
          triggers: icp.triggers,
          source: "ai_generated",
          source_ai_run_id: runId,
          raw_generation_payload: icp,
          created_by: user.id,
        })
        .select("id, title")
        .single();

      if (data) insertedIcps.push(data);
    }

    await trackUsage({
      brandId,
      eventType: "icp_generation",
      userId: user.id,
      aiRunId: runId ?? undefined,
    });

    return NextResponse.json({
      icps: insertedIcps,
      runId,
    });
  } catch (error) {
    console.error("ICP generation failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "ICP generation failed",
      },
      { status: 500 }
    );
  }
}
