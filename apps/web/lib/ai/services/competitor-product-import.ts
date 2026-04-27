import type { SupabaseClient } from "@supabase/supabase-js";
import { importBrand } from "./brand-import";
import { enrichProductImages } from "./enrich-product-images";
import type { BrandImport } from "../schemas";

export type CompetitorProductImportItem = BrandImport["products"][number];

export interface ImportCompetitorProductsParams {
  supabase: SupabaseClient;
  websiteUrl: string;
  brandId: string;
  userId: string;
}

export interface ImportCompetitorProductsResult {
  products: CompetitorProductImportItem[];
  /** Resolved absolute URL we actually crawled (e.g. https://… added) */
  websiteUrl: string;
  /** Origin used for resolving relative product / image URLs downstream */
  siteOrigin: string | null;
}

/**
 * Re-uses the brand import pipeline (`importBrand` + `enrichProductImages`)
 * to extract products from a competitor's website. We don't care about the
 * brand-level signals here (positioning, palette, etc.) — only the products.
 *
 * Returning the raw {@link BrandImport.products} shape keeps downstream
 * persistence parallel to onboarding's product-save logic so callers don't
 * have to map between two slightly-different shapes.
 */
export async function importCompetitorProducts(
  params: ImportCompetitorProductsParams
): Promise<ImportCompetitorProductsResult> {
  const { supabase, websiteUrl, brandId, userId } = params;

  const normalizedWebsiteUrl = websiteUrl.startsWith("http")
    ? websiteUrl
    : `https://${websiteUrl}`;

  let siteOrigin: string | null = null;
  try {
    siteOrigin = new URL(normalizedWebsiteUrl).origin;
  } catch {
    siteOrigin = null;
  }

  const {
    output: rawOutput,
    homepageHtml,
    jsonLdProducts,
  } = await importBrand(supabase, {
    websiteUrl: normalizedWebsiteUrl,
    brandId,
    userId,
  });

  let output = rawOutput;
  try {
    output = await enrichProductImages(rawOutput, normalizedWebsiteUrl, {
      homepageHtml,
      jsonLdProducts,
    });
  } catch (e) {
    console.error("enrichProductImages (competitor import) failed:", e);
  }

  return {
    products: output.products ?? [],
    websiteUrl: normalizedWebsiteUrl,
    siteOrigin,
  };
}
