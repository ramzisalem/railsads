import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/db/supabase-server";
import { generateIcpsInline } from "@/lib/ai/services";
import { parseBody } from "@/lib/validation/schemas";
import type { BrandContext, ProductContext } from "@/lib/ai/prompts";

/**
 * Generates ICPs for a single product using *inline* brand + product data.
 * No DB reads, no DB writes — used by onboarding to defer all persistence
 * until the final "Create" step (`/api/onboarding/finalize`).
 */

const brandPayloadSchema = z.object({
  name: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  positioning: z.string().max(5000).optional(),
  value_proposition: z.string().max(5000).optional(),
  tone_tags: z.array(z.string().max(50)).max(20).optional(),
  personality_tags: z.array(z.string().max(50)).max(20).optional(),
  primary_color: z.string().max(20).optional(),
  secondary_color: z.string().max(20).optional(),
  accent_color: z.string().max(20).optional(),
  color_palette: z
    .array(
      z.object({ segment: z.string().max(64), hex: z.string().max(32) })
    )
    .max(16)
    .optional(),
  style_tags: z.array(z.string().max(50)).max(20).optional(),
});

const productPayloadSchema = z.object({
  name: z.string().min(1).max(500),
  short_description: z.string().max(2000).optional(),
  description: z.string().max(10_000).optional(),
  price: z.string().max(200).optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
});

const generateOnboardingIcpsSchema = z.object({
  brand: brandPayloadSchema,
  product: productPayloadSchema,
  /** Already-generated ICPs across this onboarding session, for dedup. */
  existingTitles: z.array(z.string().max(500)).max(50).optional(),
});

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
    generateOnboardingIcpsSchema
  );
  if (validationError) return validationError;

  const brandCtx: BrandContext = {
    name: body.brand.name,
    description: body.brand.description,
    positioning: body.brand.positioning,
    value_proposition: body.brand.value_proposition,
    tone_tags: body.brand.tone_tags ?? [],
    personality_tags: body.brand.personality_tags ?? [],
    do_rules: [],
    dont_rules: [],
    primary_color: body.brand.primary_color,
    secondary_color: body.brand.secondary_color,
    accent_color: body.brand.accent_color,
    color_palette: body.brand.color_palette,
    style_tags: body.brand.style_tags ?? [],
  };

  const productCtx: ProductContext = {
    name: body.product.name,
    short_description: body.product.short_description,
    description: body.product.description,
    price: body.product.price,
    attributes: body.product.attributes,
  };

  try {
    const output = await generateIcpsInline({
      brand: brandCtx,
      product: productCtx,
      existingIcps: body.existingTitles?.map((title) => ({ title })),
    });

    return NextResponse.json({ icps: output.icps });
  } catch (error) {
    console.error("Onboarding ICP generation failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "ICP generation failed",
      },
      { status: 500 }
    );
  }
}
