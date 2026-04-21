import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import type { ResponseInput } from "openai/resources/responses/responses";
import { getModel, getOpenAIClient } from "../provider";
import type { ImageCandidate } from "@/lib/onboarding/product-image-candidates";

/**
 * Vision-driven selection of the cleanest pack-shot among PDP candidates.
 *
 * The picker is told to prefer studio-style product photos (single product,
 * neutral / white background, no people, no overlay copy) and to fall back
 * to the most product-centric option if no perfect pack-shot is available.
 */

const MAX_CANDIDATES = 8;

const PickerSchema = z.object({
  chosen_index: z
    .number()
    .int()
    .nullable()
    .describe(
      "0-based index of the chosen image inside the candidate list, or null if none of them clearly depicts the product"
    ),
  reason: z
    .string()
    .describe("Short justification — why this image was chosen (or rejected)"),
  confidence: z
    .number()
    .min(0)
    .max(100)
    .describe("0-100 confidence that the chosen image is a clean product hero"),
});

export type PickerOutput = z.infer<typeof PickerSchema>;

export interface PickBestProductImageParams {
  productName: string;
  productDescription?: string | null;
  candidates: ImageCandidate[];
}

export interface PickBestProductImageResult {
  url: string | null;
  reason: string;
  confidence: number;
  /** Index in the (clipped) candidate list — useful for logging */
  chosenIndex: number | null;
}

export async function pickBestProductImage(
  params: PickBestProductImageParams
): Promise<PickBestProductImageResult | null> {
  const candidates = params.candidates.slice(0, MAX_CANDIDATES);
  if (candidates.length === 0) return null;

  // Single candidate → trust the static heuristic; skip the vision call entirely.
  if (candidates.length === 1) {
    return {
      url: candidates[0].url,
      reason: "Single candidate, no disambiguation needed.",
      confidence: 70,
      chosenIndex: 0,
    };
  }

  const client = getOpenAIClient();
  const model = getModel("efficient");

  const instructionLines = [
    `Pick the SINGLE best product hero image for "${params.productName}".`,
    "",
    "Strongly prefer images that:",
    "- Show the product alone, centered, on a clean / neutral / white background",
    "- Look like studio packshot photography",
    "- Are sharp, well lit, and the product is the dominant subject",
    "",
    "Reject when possible:",
    "- Lifestyle / scene photos with people, models, hands, faces, or environments",
    "- Banners, hero collages, multi-product layouts",
    "- Logos, payment badges, social icons, review stars, decorative graphics",
    "- Images with heavy promotional overlay text or watermarks",
    "",
    "If none of the candidates is a clean pack-shot, choose the one most",
    "product-centric (largest, most centered depiction of the product) and",
    "lower the confidence accordingly. Use chosen_index = null only when none",
    "of the candidates depicts the product at all.",
  ];
  if (params.productDescription) {
    instructionLines.push("", `Product description: ${params.productDescription.slice(0, 600)}`);
  }
  instructionLines.push("", "Candidates (index → source/alt):");
  candidates.forEach((c, i) => {
    instructionLines.push(
      `  [${i}] source=${c.source}${c.alt ? ` alt="${c.alt.slice(0, 80)}"` : ""}`
    );
  });

  const text = instructionLines.join("\n");

  const messageContent: Array<
    | { type: "input_text"; text: string }
    | { type: "input_image"; image_url: string; detail: "auto" }
  > = [{ type: "input_text", text }];

  for (const c of candidates) {
    messageContent.push({
      type: "input_image",
      image_url: c.url,
      detail: "auto",
    });
  }

  const input: ResponseInput = [
    { role: "user", type: "message", content: messageContent },
  ];

  try {
    const response = await client.responses.parse({
      model,
      instructions:
        "You are an e-commerce art director. You select the cleanest product hero image from a list of candidates. Be strict: prefer pack-shots over lifestyle photos. Always return JSON.",
      input,
      text: { format: zodTextFormat(PickerSchema, "image_pick") },
    });

    const parsed = response.output_parsed;
    if (!parsed) return null;

    if (
      parsed.chosen_index == null ||
      parsed.chosen_index < 0 ||
      parsed.chosen_index >= candidates.length
    ) {
      return {
        url: null,
        reason: parsed.reason || "No candidate matched",
        confidence: parsed.confidence ?? 0,
        chosenIndex: null,
      };
    }

    return {
      url: candidates[parsed.chosen_index].url,
      reason: parsed.reason,
      confidence: parsed.confidence,
      chosenIndex: parsed.chosen_index,
    };
  } catch (err) {
    console.error("pickBestProductImage failed:", err);
    return null;
  }
}
