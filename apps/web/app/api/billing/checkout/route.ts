import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/db/supabase-server";
import { createAdminClient } from "@/lib/db/supabase-admin";
import { getStripe, STRIPE_PRICES } from "@/lib/billing/stripe";
import { ACTIVE_BRAND_COOKIE } from "@/lib/auth/get-current-brand";
import { verifyBrandMembership } from "@/lib/auth/verify-membership";
import { parseBody, billingCheckoutSchema } from "@/lib/validation/schemas";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: body, error: validationError } = await parseBody(request, billingCheckoutSchema);
  if (validationError) return validationError;

  const { planCode } = body;

  const cookieStore = await cookies();
  const brandId = cookieStore.get(ACTIVE_BRAND_COOKIE)?.value;
  if (!brandId) {
    return NextResponse.json(
      { error: "No active brand selected" },
      { status: 400 }
    );
  }

  const isMember = await verifyBrandMembership(supabase, user.id, brandId);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const priceId = STRIPE_PRICES[planCode as keyof typeof STRIPE_PRICES];
  if (!priceId) {
    return NextResponse.json(
      { error: "Stripe price not configured for this plan" },
      { status: 500 }
    );
  }

  const admin = createAdminClient();
  const stripe = getStripe();

  try {
    let stripeCustomerId: string;

    const { data: existing } = await admin
      .from("billing_customers")
      .select("stripe_customer_id")
      .eq("brand_id", brandId)
      .single();

    if (existing?.stripe_customer_id) {
      stripeCustomerId = existing.stripe_customer_id;
    } else {
      const { data: brand } = await admin
        .from("brands")
        .select("name")
        .eq("id", brandId)
        .single();

      const customer = await stripe.customers.create({
        email: user.email,
        name: brand?.name ?? undefined,
        metadata: {
          brand_id: brandId,
          user_id: user.id,
        },
      });

      stripeCustomerId = customer.id;

      await admin.from("billing_customers").insert({
        brand_id: brandId,
        stripe_customer_id: customer.id,
        billing_email: user.email,
      });
    }

    const { data: activeSub } = await admin
      .from("subscriptions")
      .select("id, status")
      .eq("brand_id", brandId)
      .in("status", ["active", "trialing"])
      .single();

    if (activeSub) {
      return NextResponse.json(
        { error: "Brand already has an active subscription" },
        { status: 409 }
      );
    }

    const origin = request.headers.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/settings?billing=success`,
      cancel_url: `${origin}/settings?billing=canceled`,
      subscription_data: {
        metadata: {
          brand_id: brandId,
          plan_code: planCode,
        },
      },
      metadata: {
        brand_id: brandId,
        plan_code: planCode,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Checkout session creation failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create checkout session",
      },
      { status: 500 }
    );
  }
}
