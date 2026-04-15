import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/db/supabase-admin";
import { getStripe, PLAN_CREDITS } from "@/lib/billing/stripe";
import { grantMonthlyCredits } from "@/lib/billing/credits";
import { mapStripeStatus } from "@/lib/billing/stripe-status";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not configured");
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  const { data: existingEvent } = await admin
    .from("webhook_events")
    .select("id")
    .eq("event_id", event.id)
    .single();

  if (existingEvent) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  await admin.from("webhook_events").insert({
    provider: "stripe",
    event_id: event.id,
    event_type: event.type,
    payload: event.data.object as unknown as Record<string, unknown>,
    status: "received",
  });

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(admin, event.data.object as Stripe.Checkout.Session);
        break;
      case "invoice.paid":
        await handleInvoicePaid(admin, event.data.object as Stripe.Invoice);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(admin, event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(admin, event.data.object as Stripe.Subscription);
        break;
      default:
        break;
    }

    await admin
      .from("webhook_events")
      .update({ status: "processed", processed_at: new Date().toISOString() })
      .eq("event_id", event.id);
  } catch (error) {
    console.error(`Webhook handler error for ${event.type}:`, error);
    await admin
      .from("webhook_events")
      .update({
        status: "failed",
        error_message: error instanceof Error ? error.message : "Unknown error",
      })
      .eq("event_id", event.id);

    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

function getSubPeriod(subscription: Stripe.Subscription): {
  periodStart: number;
  periodEnd: number;
} {
  const item = subscription.items.data[0];
  return {
    periodStart: item?.current_period_start ?? subscription.start_date,
    periodEnd: item?.current_period_end ?? subscription.start_date,
  };
}

async function handleCheckoutCompleted(
  admin: ReturnType<typeof createAdminClient>,
  session: Stripe.Checkout.Session
) {
  if (session.mode !== "subscription" || !session.subscription) return;

  const brandId = session.metadata?.brand_id;
  const planCode = session.metadata?.plan_code;
  if (!brandId || !planCode) {
    console.error("Checkout session missing brand_id or plan_code metadata");
    return;
  }

  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(
    session.subscription as string
  );

  const { data: plan } = await admin
    .from("plans")
    .select("id")
    .eq("code", planCode)
    .single();

  const priceId = subscription.items.data[0]?.price?.id ?? null;
  const { periodStart, periodEnd } = getSubPeriod(subscription);

  await admin.from("subscriptions").upsert(
    {
      brand_id: brandId,
      plan_id: plan?.id ?? null,
      stripe_subscription_id: subscription.id,
      stripe_price_id: priceId,
      status: mapStripeStatus(subscription.status),
      current_period_start: new Date(periodStart * 1000).toISOString(),
      current_period_end: new Date(periodEnd * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
      trial_end: subscription.trial_end
        ? new Date(subscription.trial_end * 1000).toISOString()
        : null,
    },
    { onConflict: "brand_id" }
  );

  const { data: sub } = await admin
    .from("subscriptions")
    .select("id")
    .eq("brand_id", brandId)
    .single();

  if (sub) {
    await grantMonthlyCredits(
      admin,
      brandId,
      planCode,
      sub.id,
      new Date(periodStart * 1000),
      new Date(periodEnd * 1000)
    );

    await upsertRollupGranted(admin, brandId, getMonthKey(new Date()), PLAN_CREDITS[planCode] ?? 0);
  }
}

async function handleInvoicePaid(
  admin: ReturnType<typeof createAdminClient>,
  invoice: Stripe.Invoice
) {
  const subRef = invoice.parent?.subscription_details?.subscription;
  const stripeSubId =
    typeof subRef === "string" ? subRef : subRef?.id ?? null;

  if (!stripeSubId) return;

  const { data: sub } = await admin
    .from("subscriptions")
    .select("id, brand_id, plan_id")
    .eq("stripe_subscription_id", stripeSubId)
    .single();

  if (!sub) return;

  await admin.from("billing_invoices").upsert(
    {
      brand_id: sub.brand_id,
      subscription_id: sub.id,
      stripe_invoice_id: invoice.id!,
      amount_due_cents: invoice.amount_due,
      amount_paid_cents: invoice.amount_paid,
      currency: invoice.currency,
      status: invoice.status,
      hosted_invoice_url: invoice.hosted_invoice_url,
      invoice_pdf_url: invoice.invoice_pdf,
      period_start: invoice.period_start
        ? new Date(invoice.period_start * 1000).toISOString()
        : null,
      period_end: invoice.period_end
        ? new Date(invoice.period_end * 1000).toISOString()
        : null,
    },
    { onConflict: "stripe_invoice_id" }
  );

  if (invoice.billing_reason === "subscription_cycle") {
    const stripe = getStripe();
    const subscription = await stripe.subscriptions.retrieve(stripeSubId);
    const planCode = subscription.metadata?.plan_code;
    const { periodStart, periodEnd } = getSubPeriod(subscription);

    if (planCode) {
      await admin
        .from("subscriptions")
        .update({
          current_period_start: new Date(periodStart * 1000).toISOString(),
          current_period_end: new Date(periodEnd * 1000).toISOString(),
        })
        .eq("id", sub.id);

      await grantMonthlyCredits(
        admin,
        sub.brand_id,
        planCode,
        sub.id,
        new Date(periodStart * 1000),
        new Date(periodEnd * 1000)
      );

      await upsertRollupGranted(admin, sub.brand_id, getMonthKey(new Date(periodStart * 1000)), PLAN_CREDITS[planCode] ?? 0);
    }
  }
}

async function handleSubscriptionUpdated(
  admin: ReturnType<typeof createAdminClient>,
  subscription: Stripe.Subscription
) {
  const { data: sub } = await admin
    .from("subscriptions")
    .select("id, brand_id")
    .eq("stripe_subscription_id", subscription.id)
    .single();

  if (!sub) return;

  const newPlanCode = subscription.metadata?.plan_code;

  let planId: string | null = null;
  if (newPlanCode) {
    const { data: plan } = await admin
      .from("plans")
      .select("id")
      .eq("code", newPlanCode)
      .single();
    planId = plan?.id ?? null;
  }

  const priceId = subscription.items.data[0]?.price?.id ?? null;
  const { periodStart, periodEnd } = getSubPeriod(subscription);

  await admin
    .from("subscriptions")
    .update({
      plan_id: planId,
      stripe_price_id: priceId,
      status: mapStripeStatus(subscription.status),
      current_period_start: new Date(periodStart * 1000).toISOString(),
      current_period_end: new Date(periodEnd * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
      trial_end: subscription.trial_end
        ? new Date(subscription.trial_end * 1000).toISOString()
        : null,
    })
    .eq("id", sub.id);
}

async function handleSubscriptionDeleted(
  admin: ReturnType<typeof createAdminClient>,
  subscription: Stripe.Subscription
) {
  await admin
    .from("subscriptions")
    .update({ status: "canceled", cancel_at_period_end: false })
    .eq("stripe_subscription_id", subscription.id);
}

async function upsertRollupGranted(
  admin: ReturnType<typeof createAdminClient>,
  brandId: string,
  month: string,
  creditsGranted: number
): Promise<void> {
  const { data: existing } = await admin
    .from("usage_monthly_rollups")
    .select("id")
    .eq("brand_id", brandId)
    .eq("month", month)
    .single();

  if (existing) {
    await admin
      .from("usage_monthly_rollups")
      .update({ credits_granted: creditsGranted })
      .eq("id", existing.id);
  } else {
    await admin.from("usage_monthly_rollups").insert({
      brand_id: brandId,
      month,
      credits_granted: creditsGranted,
      credits_used: 0,
    });
  }
}

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}
