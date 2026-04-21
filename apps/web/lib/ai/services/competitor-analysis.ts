import type { SupabaseClient } from "@supabase/supabase-js";
import { zodTextFormat } from "openai/helpers/zod";
import type { ResponseInput } from "openai/resources/responses/responses";
import { getOpenAIClient, getModel } from "../provider";
import {
  CompetitorAnalysisSchema,
  type CompetitorAnalysis,
  type CompetitorEvidenceItem,
} from "../schemas";
import {
  buildCompetitorAnalysisPrompt,
  PROMPT_VERSIONS,
  type CompetitorAdContext,
  type PreviousCompetitorInsight,
} from "../prompts";
import {
  fetchBrandContext,
  fetchCompetitorAds,
  fetchProductContext,
} from "../context";
import { createAiRun, completeAiRun, failAiRun } from "../tracking";
import { getAnalyzedAdIds } from "@/lib/competitors/analyzed-ads";

export interface AnalyzeCompetitorParams {
  brandId: string;
  competitorId: string;
  userId: string;
  /** When provided, scopes the analysis to ads mapped to this product. */
  productId?: string | null;
  /** When true (default), only ads that haven't been analyzed for this
   *  scope are sent to the model and the result is merged with the prior
   *  insight. When false, every ad in scope is re-analyzed from scratch. */
  onlyNewAds?: boolean;
}

/**
 * The persisted shape of `competitor_insights.evidence` — same as model
 * output but with `evidence_ad_ids` rewritten from prompt refs ("ad-1") to
 * actual `competitor_ads.id` UUIDs. The UI joins this back to the ad list.
 */
export interface PersistedEvidenceItem {
  category: CompetitorEvidenceItem["category"];
  pattern: string;
  evidence_ad_ids: string[];
}

export interface AnalyzeCompetitorResult {
  output: CompetitorAnalysis;
  /** Evidence with prompt refs resolved to real ad UUIDs. */
  evidence: PersistedEvidenceItem[];
  runId: string | null;
  /** Ad ids actually sent to the model in this run — persisted to the
   *  run-ads join table by the caller so future runs can skip them. */
  analyzedAdIds: string[];
  /** True when this run extended an existing insight instead of starting
   *  from scratch. The route uses this to know it should merge evidence
   *  arrays and copy forward `prior_insight_id`. */
  incremental: boolean;
}

export async function analyzeCompetitor(
  supabase: SupabaseClient,
  params: AnalyzeCompetitorParams
): Promise<AnalyzeCompetitorResult> {
  const model = getModel("efficient");

  const runId = await createAiRun(supabase, {
    brandId: params.brandId,
    serviceType: "competitor_analysis",
    model,
    promptVersion: PROMPT_VERSIONS.competitor_analysis,
    userId: params.userId,
  });

  try {
    const onlyNewAds = params.onlyNewAds !== false;

    const [brand, { competitorName, ads: allAds }, product] = await Promise.all([
      fetchBrandContext(supabase, params.brandId),
      fetchCompetitorAds(supabase, params.competitorId, {
        productId: params.productId ?? null,
      }),
      params.productId
        ? fetchProductContext(supabase, params.productId)
        : Promise.resolve(undefined),
    ]);

    if (allAds.length === 0) {
      throw new Error(
        params.productId
          ? "No ads mapped to this product yet. Map a few competitor ads to the product, or analyze the full library."
          : "No ads found for this competitor. Add some ads before running analysis."
      );
    }

    // Decide which ads to actually send to the model.
    let adsToAnalyze = allAds;
    let previous: PreviousCompetitorInsight | undefined;
    let priorInsight: PriorInsightRow | null = null;
    let incremental = false;

    if (onlyNewAds) {
      const analyzedSet = await getAnalyzedAdIds(
        supabase,
        params.competitorId,
        params.productId ?? null
      );
      const newAds = allAds.filter((a) => !analyzedSet.has(a.id));

      if (newAds.length === 0) {
        throw new Error(
          "All ads have already been analyzed for this scope. Add more ads, or use \"Re-analyze all\" to start over."
        );
      }

      // Reassign refs so the model sees ad-1..ad-N for the new batch only.
      adsToAnalyze = newAds.map((a, i) => ({ ...a, ref: `ad-${i + 1}` }));

      // Pull the most recent insight for the same scope to extend.
      priorInsight = await fetchLatestInsight(
        supabase,
        params.competitorId,
        params.productId ?? null
      );

      if (priorInsight) {
        incremental = true;
        previous = {
          summary: priorInsight.summary,
          hook_patterns: priorInsight.hook_patterns ?? [],
          angle_patterns: priorInsight.angle_patterns ?? [],
          emotional_triggers: priorInsight.emotional_triggers ?? [],
          visual_patterns: priorInsight.visual_patterns ?? [],
          offer_patterns: priorInsight.offer_patterns ?? [],
          cta_patterns: priorInsight.cta_patterns ?? [],
        };
      }
    }

    const { system, user } = buildCompetitorAnalysisPrompt({
      brand,
      competitorName,
      ads: adsToAnalyze,
      product,
      previous,
    });

    const input = buildMultimodalInput(user, adsToAnalyze);

    const client = getOpenAIClient();
    const response = await client.responses.parse({
      model,
      instructions: system,
      input,
      text: {
        format: zodTextFormat(
          CompetitorAnalysisSchema,
          "competitor_analysis"
        ),
      },
    });

    const output = response.output_parsed;
    if (!output) {
      throw new Error("No structured output returned from OpenAI");
    }

    let evidence = remapEvidenceRefs(output.evidence ?? [], adsToAnalyze);

    // If this is an incremental run, merge the prior evidence into the new
    // evidence so unchanged patterns keep their historical citations and
    // newly-extended patterns gain the new ad refs.
    if (incremental && priorInsight) {
      evidence = mergeEvidence(priorInsight.evidence ?? [], evidence);
    }

    if (runId) {
      await completeAiRun(supabase, runId, {
        inputTokens: response.usage?.input_tokens,
        outputTokens: response.usage?.output_tokens,
        totalTokens: response.usage?.total_tokens,
        responsePayload: { ...output, evidence_resolved: evidence },
      });
    }

    return {
      output,
      evidence,
      runId,
      analyzedAdIds: adsToAnalyze.map((a) => a.id),
      incremental,
    };
  } catch (error) {
    if (runId) {
      await failAiRun(
        supabase,
        runId,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
    throw error;
  }
}

/**
 * If any ad has an attached image, send a multimodal Responses input so the
 * model can ground visual_patterns in pixels (not just `visual_summary`
 * notes from the upload step). Cap the number of images we send to keep
 * prompt cost bounded — ads beyond the cap still appear in the text block.
 */
const MAX_IMAGES_FOR_ANALYSIS = 8;

function buildMultimodalInput(
  userText: string,
  ads: CompetitorAdContext[]
): ResponseInput {
  const imagedAds = ads
    .filter((a) => !!a.image_url)
    .slice(0, MAX_IMAGES_FOR_ANALYSIS);

  if (imagedAds.length === 0) {
    return [
      {
        role: "user",
        type: "message",
        content: [{ type: "input_text", text: userText }],
      },
    ];
  }

  const content: Array<
    | { type: "input_text"; text: string }
    | { type: "input_image"; image_url: string; detail: "auto" }
  > = [{ type: "input_text", text: userText }];

  for (const ad of imagedAds) {
    content.push({ type: "input_text", text: `Image for ${ad.ref}:` });
    content.push({
      type: "input_image",
      image_url: ad.image_url!,
      detail: "auto",
    });
  }

  return [{ role: "user", type: "message", content }];
}

/**
 * Rewrites the model's `evidence_ad_ids` from prompt refs ("ad-1") to real
 * UUIDs. Drops any reference the model invented that isn't in the input.
 */
interface PriorInsightRow {
  summary: string | null;
  hook_patterns: string[] | null;
  angle_patterns: string[] | null;
  emotional_triggers: string[] | null;
  visual_patterns: string[] | null;
  offer_patterns: string[] | null;
  cta_patterns: string[] | null;
  evidence: PersistedEvidenceItem[] | null;
}

async function fetchLatestInsight(
  supabase: SupabaseClient,
  competitorId: string,
  productId: string | null
): Promise<PriorInsightRow | null> {
  let query = supabase
    .from("competitor_insights")
    .select(
      "summary, hook_patterns, angle_patterns, emotional_triggers, visual_patterns, offer_patterns, cta_patterns, evidence"
    )
    .eq("competitor_id", competitorId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (productId === null) {
    query = query.is("product_id", null);
  } else {
    query = query.eq("product_id", productId);
  }

  const { data } = await query.maybeSingle();
  if (!data) return null;
  return {
    ...data,
    evidence: Array.isArray(data.evidence)
      ? (data.evidence as PersistedEvidenceItem[])
      : null,
  } as PriorInsightRow;
}

/**
 * Merges previous run's evidence with the new run's evidence.
 *
 * Strategy: for each (category, pattern) in the NEW evidence, look up the
 * matching prior entry. If found, union the ad id sets so a recurring
 * pattern keeps its historical citations and gains the new supporting ads.
 * Patterns that disappear from the new output are dropped — the model has
 * decided they are no longer supported.
 */
function mergeEvidence(
  prior: PersistedEvidenceItem[],
  next: PersistedEvidenceItem[]
): PersistedEvidenceItem[] {
  const priorMap = new Map<string, Set<string>>();
  for (const ev of prior) {
    priorMap.set(`${ev.category}::${ev.pattern}`, new Set(ev.evidence_ad_ids));
  }
  return next.map((ev) => {
    const key = `${ev.category}::${ev.pattern}`;
    const priorIds = priorMap.get(key);
    if (!priorIds) return ev;
    const merged = new Set<string>(priorIds);
    for (const id of ev.evidence_ad_ids) merged.add(id);
    return { ...ev, evidence_ad_ids: Array.from(merged) };
  });
}

function remapEvidenceRefs(
  evidence: CompetitorEvidenceItem[],
  ads: CompetitorAdContext[]
): PersistedEvidenceItem[] {
  const refToId = new Map(ads.map((a) => [a.ref.toLowerCase(), a.id]));
  const validIds = new Set(ads.map((a) => a.id));

  return evidence.map((item) => {
    const ids: string[] = [];
    for (const raw of item.evidence_ad_ids ?? []) {
      const trimmed = raw.trim();
      const direct = trimmed.toLowerCase();
      const mapped = refToId.get(direct);
      if (mapped) {
        ids.push(mapped);
        continue;
      }
      // Tolerate the model citing the bare UUID (older prompt versions).
      if (validIds.has(trimmed)) ids.push(trimmed);
    }
    return {
      category: item.category,
      pattern: item.pattern,
      evidence_ad_ids: Array.from(new Set(ids)),
    };
  });
}
