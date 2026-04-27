import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/db/supabase-admin";
import { getStripe, PLAN_CREDITS } from "@/lib/billing/stripe";
import { grantMonthlyCredits } from "@/lib/billing/credits";
import { mapStripeStatus } from "@/lib/billing/stripe-status";

type Admin = ReturnType<typeof createAdminClient>;

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

  // Idempotency — drop replayed events.
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
        await handleCheckoutCompleted(
          admin,
          event.data.object as Stripe.Checkout.Session
        );
        break;

      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionUpserted(
          admin,
          event.data.object as Stripe.Subscription
        );
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(
          admin,
          event.data.object as Stripe.Subscription
        );
        break;

      // Stripe emits both `invoice.paid` and `invoice.payment_succeeded`
      // for the same successful payment. Handle both for safety.
      case "invoice.paid":
      case "invoice.payment_succeeded":
        await handleInvoicePaid(admin, event.data.object as Stripe.Invoice);
        break;

      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(
          admin,
          event.data.object as Stripe.Invoice
        );
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
        error_message:
          error instanceof Error ? error.message : "Unknown error",
      })
      .eq("event_id", event.id);

    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
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

async function resolveBrandIdAndPlanCode(
  admin: Admin,
  subscription: Stripe.Subscription
): Promise<{ brandId: string | null; planCode: string | null }> {
  let brandId =
    (subscription.metadata?.brand_id as string | undefined) ?? null;
  let planCode =
    (subscription.metadata?.plan_code as string | undefined) ?? null;

  if (!brandId) {
    const customerId =
      typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer?.id;
    if (customerId) {
      const { data: bc } = await admin
        .from("billing_customers")
        .select("brand_id")
        .eq("stripe_customer_id", customerId)
        .single();
      brandId = bc?.brand_id ?? null;
    }
  }

  if (!planCode) {
    const priceId = subscription.items.data[0]?.price?.id;
    if (priceId) {
      planCode = inferPlanCodeFromPriceId(priceId);
    }
  }

  return { brandId, planCode };
}

function inferPlanCodeFromPriceId(priceId: string): string | null {
  if (priceId === process.env.STRIPE_PRICE_STARTER) return "starter";
  if (priceId === process.env.STRIPE_PRICE_PRO) return "pro";
  if (priceId === process.env.STRIPE_PRICE_ENTERPRISE) return "enterprise";
  return null;
}

async function handleCheckoutCompleted(
  admin: Admin,
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

  await upsertSubscription(admin, brandId, planCode, subscription);

  const { data: sub } = await admin
    .from("subscriptions")
    .select("id")
    .eq("brand_id", brandId)
    .single();

  if (sub) {
    const { periodStart, periodEnd } = getSubPeriod(subscription);
    await grantMonthlyCredits(
      admin,
      brandId,
      planCode,
      sub.id,
      new Date(periodStart * 1000),
      new Date(periodEnd * 1000)
    );

    await upsertRollupGranted(
      admin,
      brandId,
      getMonthKey(new Date()),
      PLAN_CREDITS[planCode] ?? 0
    );
  }
}

async function handleSubscriptionUpserted(
  admin: Admin,
  subscription: Stripe.Subscription
) {
  const { brandId, planCode } = await resolveBrandIdAndPlanCode(
    admin,
    subscription
  );

  if (!brandId) {
    console.warn(
      `[webhook] subscription ${subscription.id} has no resolvable brand_id`
    );
    return;
  }

  await upsertSubscription(admin, brandId, planCode, subscription);

  // For brand-new subscriptions that didn't go through our checkout endpoint,
  // make sure the first month of credits is granted.
  if (planCode) {
    const { data: sub } = await admin
      .from("subscriptions")
      .select("id")
      .eq("brand_id", brandId)
      .single();

    if (sub) {
      const { periodStart, periodEnd } = getSubPeriod(subscription);
      await grantMonthlyCredits(
        admin,
        brandId,
        planCode,
        sub.id,
        new Date(periodStart * 1000),
        new Date(periodEnd * 1000)
      );
    }
  }
}

async function handleSubscriptionDeleted(
  admin: Admin,
  subscription: Stripe.Subscription
) {
  await admin
    .from("subscriptions")
    .update({ status: "canceled", cancel_at_period_end: false })
    .eq("stripe_subscription_id", subscription.id);
}

async function upsertSubscription(
  admin: Admin,
  brandId: string,
  planCode: string | null,
  subscription: Stripe.Subscription
) {
  let planId: string | null = null;
  if (planCode) {
    const { data: plan } = await admin
      .from("plans")
      .select("id")
      .eq("code", planCode)
      .single();
    planId = plan?.id ?? null;
  }

  const priceId = subscription.items.data[0]?.price?.id ?? null;
  const { periodStart, periodEnd } = getSubPeriod(subscription);

  await admin.from("subscriptions").upsert(
    {
      brand_id: brandId,
      plan_id: planId,
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
}

async function handleInvoicePaid(admin: Admin, invoice: Stripe.Invoice) {
  const stripeSubId = extractStripeSubId(invoice);
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

      await upsertRollupGranted(
        admin,
        sub.brand_id,
        getMonthKey(new Date(periodStart * 1000)),
        PLAN_CREDITS[planCode] ?? 0
      );
    }
  }
}

async function handleInvoicePaymentFailed(
  admin: Admin,
  invoice: Stripe.Invoice
) {
  const stripeSubId = extractStripeSubId(invoice);
  if (!stripeSubId) return;

  const { data: sub } = await admin
    .from("subscriptions")
    .select("id, brand_id")
    .eq("stripe_subscription_id", stripeSubId)
    .single();

  if (!sub) return;

  // Stripe will eventually emit `customer.subscription.updated` with the new
  // status, but we proactively flag past_due so the gate kicks in immediately.
  await admin
    .from("subscriptions")
    .update({ status: "past_due" })
    .eq("id", sub.id);

  if (invoice.id) {
    await admin.from("billing_invoices").upsert(
      {
        brand_id: sub.brand_id,
        subscription_id: sub.id,
        stripe_invoice_id: invoice.id,
        amount_due_cents: invoice.amount_due,
        amount_paid_cents: invoice.amount_paid,
        currency: invoice.currency,
        status: invoice.status ?? "open",
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
  }
}

function extractStripeSubId(invoice: Stripe.Invoice): string | null {
  const subRef = invoice.parent?.subscription_details?.subscription;
  if (typeof subRef === "string") return subRef;
  if (subRef && typeof subRef === "object" && "id" in subRef) return subRef.id;
  return null;
}

async function upsertRollupGranted(
  admin: Admin,
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
