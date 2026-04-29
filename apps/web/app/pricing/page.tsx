import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { createClient } from "@/lib/db/supabase-server";
import { getOptionalUser } from "@/lib/auth/get-current-user";
import { PricingPlans } from "@/components/billing/pricing-plans";
import type { PlanInfo } from "@/components/billing/plan-card";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Simple monthly plans. Put an AI ads creative strategist on your team and generate high-converting ad creatives in minutes.",
};

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const supabase = await createClient();
  const user = await getOptionalUser();

  const { data: planRows } = await supabase
    .from("plans")
    .select(
      "code, name, monthly_price_cents, monthly_credit_limit, max_brands, features"
    )
    .eq("is_active", true)
    .eq("is_public", true)
    .order("monthly_price_cents", { ascending: true });

  const plans: PlanInfo[] = (planRows ?? []).map((p) => ({
    code: p.code,
    name: p.name,
    monthlyPriceCents: p.monthly_price_cents,
    monthlyCreditLimit: p.monthly_credit_limit,
    maxBrands: p.max_brands,
    features: p.features as Record<string, boolean>,
  }));

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link
            href={user ? "/" : "/login"}
            className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {user ? "Back to dashboard" : "Back to sign in"}
          </Link>
          <Link
            href="/"
            className="flex items-center gap-2 font-serif text-lg tracking-tight"
          >
            <Sparkles className="h-4 w-4 text-primary" />
            RailsAds
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-16 md:py-24">
        <div className="text-center">
          <p className="text-sm font-medium uppercase tracking-wide text-primary">
            Pricing
          </p>
          <h1 className="heading-xl mt-3">Simple plans, real outcomes.</h1>
          <p className="mx-auto mt-4 max-w-xl text-body-lg text-muted-foreground">
            Generate ICPs, analyse competitors and ship ad creatives — all in
            one workspace. Cancel anytime.
          </p>
        </div>

        <div className="mt-12">
          <PricingPlans plans={plans} loggedIn={!!user} />
        </div>

        <div className="mt-16 rounded-2xl border bg-card p-8">
          <h2 className="heading-md">What counts as a creative?</h2>
          <p className="mt-2 text-body text-muted-foreground">
            Each plan ships with a monthly creative budget. You spend credits when
            the AI produces a new deliverable — refining <em>copy</em> in the studio
            is free, but each <em>image</em> generation or edit (including
            iterations in the image editor) costs 25 credits, same as a new image.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <UsageRow label="Generate a new creative" cost="≈ 1 creative" />
            <UsageRow label="Generate or edit an image" cost="≈ 1.5 creatives" />
            <UsageRow label="Generate ICPs for a product" cost="≈ ⅓ creative" />
            <UsageRow label="Analyse a competitor" cost="≈ ⅔ creative" />
            <UsageRow label="Import a website" cost="≈ 1 ⅓ creatives" />
            <UsageRow label="Revise creative copy in chat" cost="Free" />
          </div>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          <FaqCard
            title="Can I switch plans later?"
            body="Yes — upgrade instantly or downgrade at the next billing cycle from your billing page."
          />
          <FaqCard
            title="Do credits roll over?"
            body="No. Each plan resets monthly so the budget stays predictable."
          />
          <FaqCard
            title="Need more?"
            body="Enterprise plans include custom credit limits, unlimited brands, and dedicated support."
          />
        </div>
      </main>
    </div>
  );
}

function UsageRow({ label, cost }: { label: string; cost: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border bg-background px-4 py-3">
      <span className="text-sm text-foreground">{label}</span>
      <span className="text-xs text-muted-foreground">{cost}</span>
    </div>
  );
}

function FaqCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border bg-card p-6">
      <h3 className="text-sm font-medium">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
