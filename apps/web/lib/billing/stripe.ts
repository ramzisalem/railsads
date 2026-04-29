import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY environment variable is not set");
    }
    _stripe = new Stripe(key, { apiVersion: "2026-03-25.dahlia" });
  }
  return _stripe;
}

export const STRIPE_PRICES = {
  starter: process.env.STRIPE_PRICE_STARTER ?? "",
  pro: process.env.STRIPE_PRICE_PRO ?? "",
} as const;

export const CREDIT_COSTS: Record<string, number> = {
  creative_generation: 15,
  image_generation: 25,
  /** Same API cost as a new image — each edit/iteration uses gpt-image-1 again. */
  image_edit: 25,
  icp_generation: 5,
  competitor_analysis: 10,
  website_import: 20,
  creative_revision: 0,
  export: 0,
};

export const PLAN_CREDITS: Record<string, number> = {
  starter: 2500,
  pro: 5000,
  enterprise: 10000,
};

export function creditsToCreatives(credits: number): number {
  const costPerCreative = CREDIT_COSTS.creative_generation;
  if (costPerCreative === 0) return 0;
  return Math.floor(credits / costPerCreative);
}
