"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Globe,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Check,
  ChevronDown,
  Package,
  Users,
  Sparkles,
  Swords,
  Plus,
  X,
  ExternalLink,
  Heart,
  ShieldAlert,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { resolveSiteAbsoluteUrl } from "@/lib/onboarding/resolve-site-url";
import { BrandPaletteEditor } from "@/components/brand/brand-palette-editor";
import { TagEditor } from "@/components/brand/tag-editor";
import {
  paletteFromLegacyColors,
  type BrandPaletteColor,
} from "@/lib/brand/color-palette";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BrandData {
  name: string;
  description: string;
  category: string;
  positioning: string;
  value_proposition: string;
  tone_tags: string[];
  personality_tags: string[];
  /** Segmented colors for the brand (persisted as `color_palette` + legacy columns). */
  color_palette: BrandPaletteColor[];
  style_tags: string[];
}

interface ProductData {
  name: string;
  short_description: string;
  description?: string | null;
  price_text: string | null;
  price_currency?: string | null;
  product_url: string | null;
  key_features?: string[];
  product_category?: string | null;
  /** From import / LLM — saved as primary product image when persisting */
  image_url?: string | null;
  selected: boolean;
}

interface IcpData {
  title: string;
  summary: string;
  pains: string[];
  desires: string[];
  objections: string[];
  triggers: string[];
  productIndex: number;
}

interface CompetitorDraft {
  name: string;
  website_url: string;
}

type Step = "url" | "importing" | "brand" | "products" | "icps" | "competitors" | "finishing";

// ---------------------------------------------------------------------------
// Audience card section helper
// ---------------------------------------------------------------------------

/**
 * Mirrors the styling of `IcpCard` on the product page so the onboarding
 * preview and the persisted audience cards stay visually consistent.
 */
function IcpSection({
  label,
  icon: Icon,
  accent,
  items,
}: {
  label: string;
  icon: LucideIcon;
  accent: string;
  items: string[];
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="flex items-center gap-1.5">
        <span
          className={`flex h-5 w-5 items-center justify-center rounded-md ${accent}`}
        >
          <Icon className="h-3 w-3" />
        </span>
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      </div>
      <ul className="mt-2 space-y-1.5">
        {items.slice(0, 4).map((item, i) => (
          <li
            key={i}
            className="flex items-start gap-2 text-xs leading-relaxed text-card-foreground"
          >
            <span
              aria-hidden
              className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50"
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Audience preview card with expand/collapse behaviour. The 4 detail sections
 * (Pains, Desires, Objections, Triggers) are hidden by default to keep the
 * generated list scannable; users can drill in per audience.
 */
function IcpPreviewCard({
  title,
  summary,
  pains,
  desires,
  objections,
  triggers,
}: {
  title: string;
  summary: string;
  pains: string[];
  desires: string[];
  objections: string[];
  triggers: string[];
}) {
  const [expanded, setExpanded] = useState(false);
  const totalItems =
    pains.length + desires.length + objections.length + triggers.length;
  const hasDetails = totalItems > 0;

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex w-full items-start gap-3 p-5">
        <div className="min-w-0 flex-1 space-y-1.5">
          <h3 className="text-base font-semibold text-card-foreground">
            {title}
          </h3>
          {summary && (
            <p className="text-small leading-relaxed text-muted-foreground">
              {summary}
            </p>
          )}
        </div>
        {hasDetails && (
          <div className="flex shrink-0 items-center gap-2 pt-0.5">
            <span className="text-[11px] text-muted-foreground">
              {totalItems} item{totalItems === 1 ? "" : "s"}
            </span>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              aria-label={expanded ? "Collapse details" : "Expand details"}
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-card"
            >
              <ChevronDown
                className={`h-4 w-4 transition-transform ${
                  expanded ? "rotate-180" : ""
                }`}
              />
            </button>
          </div>
        )}
      </div>

      {expanded && hasDetails && (
        <div className="grid grid-cols-1 gap-x-6 gap-y-5 border-t border-border bg-secondary-soft/20 px-5 py-5 sm:grid-cols-2">
          <IcpSection
            label="Pains"
            icon={Heart}
            accent="text-rose-500 bg-rose-500/10"
            items={pains}
          />
          <IcpSection
            label="Desires"
            icon={Sparkles}
            accent="text-primary bg-primary-soft"
            items={desires}
          />
          <IcpSection
            label="Objections"
            icon={ShieldAlert}
            accent="text-amber-600 bg-amber-500/10"
            items={objections}
          />
          <IcpSection
            label="Triggers"
            icon={Zap}
            accent="text-violet-600 bg-violet-500/10"
            items={triggers}
          />
        </div>
      )}
    </article>
  );
}

// ---------------------------------------------------------------------------
// Progress bar
// ---------------------------------------------------------------------------

const STEPS: { key: Step; label: string }[] = [
  { key: "url", label: "Website" },
  { key: "brand", label: "Brand" },
  { key: "products", label: "Products" },
  { key: "icps", label: "Audiences" },
  { key: "competitors", label: "Competitors" },
];

function ProgressBar({
  current,
  className,
}: {
  current: Step;
  className?: string;
}) {
  const stepIndex = STEPS.findIndex(
    (s) => s.key === current || (current === "importing" && s.key === "url")
  );
  const activeIdx = current === "finishing" ? STEPS.length : Math.max(stepIndex, 0);

  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      {STEPS.map((s, i) => {
        const done = i < activeIdx;
        const active =
          i === activeIdx &&
          current !== "importing" &&
          current !== "finishing";
        return (
          <div key={s.key} className="flex items-center gap-2 flex-1">
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-medium shrink-0 transition-colors ${
                done
                  ? "bg-primary text-primary-foreground"
                  : active
                    ? "border-2 border-primary text-primary"
                    : "border border-border text-muted-foreground"
              }`}
            >
              {done ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span
              className={`text-sm hidden sm:block ${active ? "font-medium text-foreground" : "text-muted-foreground"}`}
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <div
                className={`flex-1 h-px ${done ? "bg-primary" : "bg-border"}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export default function OnboardingPage() {
  const router = useRouter();
  const [fromNewBrandFlow, setFromNewBrandFlow] = useState(false);
  const [step, setStep] = useState<Step>("url");

  const [websiteUrl, setWebsiteUrl] = useState("");
  const [brand, setBrand] = useState<BrandData | null>(null);
  const [detectedPalette, setDetectedPalette] = useState<string[]>([]);
  const [products, setProducts] = useState<ProductData[]>([]);
  const [icps, setIcps] = useState<IcpData[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState("");
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setFromNewBrandFlow(q.get("newBrand") === "1");
  }, []);

  function handleExitNewBrandFlow() {
    router.push("/dashboard");
  }

  // ---- Step 1: Import website ----
  async function handleImport() {
    if (!websiteUrl.trim()) return;
    setStep("importing");
    setError(null);

    const messages = [
      "Fetching your website...",
      "Analyzing brand identity...",
      "Detecting colors & style...",
      "Finding products...",
      "Understanding positioning...",
      "Almost done...",
    ];

    let msgIdx = 0;
    setImportProgress(messages[0]);
    const interval = setInterval(() => {
      msgIdx++;
      if (msgIdx < messages.length) {
        setImportProgress(messages[msgIdx]);
      }
    }, 3000);

    try {
      const res = await fetch("/api/brand/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteUrl: websiteUrl.trim() }),
      });

      clearInterval(interval);

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Import failed");
      }

      const data = await res.json();
      const b = data.brand as Record<string, unknown>;
      const importedPalette = Array.isArray(b.color_palette)
        ? (b.color_palette as BrandPaletteColor[])
        : [];
      const detected = Array.isArray(b.detected_palette)
        ? (b.detected_palette as string[]).filter(
            (h): h is string => typeof h === "string"
          )
        : [];
      setDetectedPalette(detected);
      setBrand({
        name: String(b.name ?? ""),
        description: String(b.description ?? ""),
        category: String(b.category ?? ""),
        positioning: String(b.positioning ?? ""),
        value_proposition: String(b.value_proposition ?? ""),
        tone_tags: Array.isArray(b.tone_tags) ? (b.tone_tags as string[]) : [],
        personality_tags: Array.isArray(b.personality_tags)
          ? (b.personality_tags as string[])
          : [],
        color_palette:
          importedPalette.length > 0
            ? importedPalette
            : paletteFromLegacyColors({
                primary_color:
                  typeof b.primary_color === "string" ? b.primary_color : null,
                secondary_color:
                  typeof b.secondary_color === "string"
                    ? b.secondary_color
                    : null,
                accent_color:
                  typeof b.accent_color === "string" ? b.accent_color : null,
              }),
        style_tags: Array.isArray(b.style_tags) ? (b.style_tags as string[]) : [],
      });
      setProducts(
        (data.products ?? []).map(
          (
            p: Omit<ProductData, "selected"> & {
              image_url?: string | null;
              key_features?: string[];
            }
          ) => ({
            ...p,
            image_url: p.image_url ?? null,
            key_features: p.key_features ?? [],
            selected: true,
          })
        )
      );
      setStep("brand");
    } catch (err) {
      clearInterval(interval);
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStep("url");
    }
  }

  // ---- Step 5: Generate ICPs for selected products (inline, no DB writes) ----
  /**
   * Generates ICPs for every selected product against the inline brand data.
   * Nothing is persisted — the ICPs live in client state until `completeOnboarding`
   * sends them to `/api/onboarding/finalize`.
   */
  async function handleGenerateIcps() {
    if (!brand) return;
    setStep("finishing");
    setError(null);

    const selectedProducts = products.filter((p) => p.selected);

    try {
      const allIcps: IcpData[] = [];
      const existingTitles: string[] = [];

      // Slim brand payload sent with each request — keeps the prompt focused.
      const brandPayload = {
        name: brand.name,
        description: brand.description || undefined,
        positioning: brand.positioning || undefined,
        value_proposition: brand.value_proposition || undefined,
        tone_tags: brand.tone_tags,
        personality_tags: brand.personality_tags,
        color_palette: brand.color_palette,
        style_tags: brand.style_tags,
      };

      for (let i = 0; i < selectedProducts.length; i++) {
        const p = selectedProducts[i];
        const productPayload = {
          name: p.name,
          short_description: p.short_description || undefined,
          description: p.description || undefined,
          price: p.price_text || undefined,
          attributes: {
            ...(p.key_features?.length
              ? { benefits: p.key_features }
              : {}),
            ...(p.product_category
              ? { import_category: p.product_category }
              : {}),
          },
        };

        const res = await fetch("/api/onboarding/generate-icps", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brand: brandPayload,
            product: productPayload,
            existingTitles,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          for (const icp of data.icps ?? []) {
            allIcps.push({
              title: icp.title,
              summary: icp.summary ?? "",
              pains: Array.isArray(icp.pains) ? icp.pains : [],
              desires: Array.isArray(icp.desires) ? icp.desires : [],
              objections: Array.isArray(icp.objections) ? icp.objections : [],
              triggers: Array.isArray(icp.triggers) ? icp.triggers : [],
              productIndex: i,
            });
            existingTitles.push(icp.title);
          }
        }
      }

      setIcps(allIcps);
      setStep("icps");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStep("products");
    }
  }

  // ---- Step 6: Competitors (optional) ----
  const [competitorDrafts, setCompetitorDrafts] = useState<CompetitorDraft[]>(
    []
  );
  const [savingCompetitors, setSavingCompetitors] = useState(false);

  function addCompetitorDraft() {
    setCompetitorDrafts([...competitorDrafts, { name: "", website_url: "" }]);
  }

  function updateCompetitorDraft(
    i: number,
    field: keyof CompetitorDraft,
    value: string
  ) {
    const updated = [...competitorDrafts];
    updated[i] = { ...updated[i], [field]: value };
    setCompetitorDrafts(updated);
  }

  function removeCompetitorDraft(i: number) {
    setCompetitorDrafts(competitorDrafts.filter((_, idx) => idx !== i));
  }

  /**
   * "Save competitors" is now just "go to the final create step": we no longer
   * persist competitors mid-flow because the brand row doesn't exist yet.
   * `completeOnboarding` sends everything (brand + products + ICPs + competitors)
   * to `/api/onboarding/finalize` in one shot.
   */
  async function handleSaveCompetitors() {
    setSavingCompetitors(true);
    setError(null);
    try {
      await completeOnboarding();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to finalize");
    } finally {
      setSavingCompetitors(false);
    }
  }

  /**
   * Calls `/api/onboarding/finalize` to create the brand and all its children
   * (members, settings, profile, visual identity, products, ICPs, competitors)
   * in one go. The route also sets the active-brand cookie, so we just need to
   * navigate to the studio after a successful response.
   *
   * Full `location.assign` (not `router.push`) avoids App Router refetching
   * `/onboarding` mid-transition.
   */
  async function completeOnboarding() {
    if (!brand) {
      setError("Missing brand data. Please go back to the website step.");
      return;
    }

    console.info("[railsads:onboarding:client] completeOnboarding -> finalize", {
      step,
      productCount: products.filter((p) => p.selected).length,
      icpCount: icps.length,
      competitorCount: competitorDrafts.filter((c) => c.name.trim()).length,
    });

    setLeaving(true);
    setError(null);

    try {
      const selectedProducts = products.filter((p) => p.selected);
      const productsPayload = selectedProducts.map((p, idx) => ({
        name: p.name,
        short_description: p.short_description,
        description: p.description ?? null,
        price_text: p.price_text,
        price_currency: p.price_currency ?? null,
        product_url: resolveSiteAbsoluteUrl(p.product_url, websiteUrl),
        image_url: resolveSiteAbsoluteUrl(p.image_url, websiteUrl),
        key_features: p.key_features ?? [],
        product_category: p.product_category ?? null,
        icps: icps
          .filter((i) => i.productIndex === idx)
          .map((i) => ({
            title: i.title,
            summary: i.summary || undefined,
            pains: i.pains,
            desires: i.desires,
            objections: i.objections,
            triggers: i.triggers,
          })),
      }));

      const competitorsPayload = competitorDrafts
        .filter((c) => c.name.trim())
        .map((c) => ({
          name: c.name.trim(),
          website_url: c.website_url.trim() || null,
        }));

      const res = await fetch("/api/onboarding/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteUrl,
          brand,
          products: productsPayload,
          competitors: competitorsPayload,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create brand");
      }

      const { firstProductId } = (await res.json()) as {
        brandId: string;
        firstProductId: string | null;
      };

      const redirectPath = firstProductId
        ? `/studio?product=${firstProductId}`
        : "/studio";

      console.info("[railsads:onboarding:client] finalize success", {
        firstProductId,
        redirectPath,
      });

      window.location.assign(redirectPath);
    } catch (err) {
      console.error("[railsads:onboarding:client] finalize failed", err);
      setError(
        err instanceof Error
          ? err.message
          : "Could not create the brand. Please try again."
      );
      setLeaving(false);
    }
  }

  const showStepper = step !== "importing" && step !== "finishing";

  return (
    <div className="relative min-h-screen bg-background">
      {showStepper && (
        <header className="fixed top-0 left-0 right-0 z-40 border-b border-border bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
          {fromNewBrandFlow && (
            <button
              type="button"
              onClick={handleExitNewBrandFlow}
              className="absolute left-4 top-1/2 z-10 -translate-y-1/2 sm:left-6 btn-secondary inline-flex shrink-0 items-center gap-2 py-2 text-xs sm:text-sm"
              aria-label="Close and return to the app"
            >
              <X className="h-4 w-4 shrink-0" />
              <span className="sm:hidden">Close</span>
              <span className="hidden sm:inline">Back to app</span>
            </button>
          )}
          <div className="mx-auto flex max-w-5xl items-center px-4 py-3 sm:px-6">
            <div className="min-w-0 flex-1">
              <ProgressBar current={step} />
            </div>
          </div>
        </header>
      )}

      {fromNewBrandFlow && !showStepper && (
        <div className="fixed left-4 top-4 z-50 sm:left-6 sm:top-6">
          <button
            type="button"
            onClick={handleExitNewBrandFlow}
            className="btn-secondary inline-flex items-center gap-2 text-sm"
            aria-label="Close and return to the app"
          >
            <X className="h-4 w-4 shrink-0" />
            Back to app
          </button>
        </div>
      )}

      <div
        className={`mx-auto w-full px-4 pb-16 ${step === "icps" ? "max-w-4xl" : "max-w-2xl"} ${showStepper ? "pt-24 sm:pt-28" : "flex min-h-screen flex-col justify-center py-12"}`}
      >
        {/* Step 1: URL Input */}
        {step === "url" && (
          <div className="space-y-8">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-primary-soft flex items-center justify-center mb-6">
                <Globe className="h-8 w-8 text-primary" />
              </div>
              <h1 className="heading-xl">
                {fromNewBrandFlow ? "Add a new brand" : "Welcome to RailsAds"}
              </h1>
              <p className="mt-3 text-body text-muted-foreground max-w-md mx-auto">
                {fromNewBrandFlow
                  ? "Paste a website URL — we’ll import this brand the same way as your first one. You can leave anytime with Back to app."
                  : "Paste your website and we&apos;ll extract your brand identity, products, and messaging automatically"}
              </p>
            </div>

            <div className="space-y-4">
              <label htmlFor="website-url" className="sr-only">
                Website URL
              </label>
              <input
                id="website-url"
                className="input-field text-center"
                placeholder="https://yourbrand.com"
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleImport()}
                autoFocus
              />
              {error && (
                <p className="text-sm text-destructive text-center">{error}</p>
              )}
              <button
                onClick={handleImport}
                disabled={!websiteUrl.trim()}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                Import brand <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Importing Animation */}
        {step === "importing" && (
          <div className="flex flex-col items-center justify-center py-20 space-y-8">
            <div className="relative">
              <div className="w-20 h-20 rounded-full border-4 border-primary/20 flex items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
              </div>
            </div>
            <div className="text-center space-y-2">
              <h2 className="heading-lg">Analyzing your website</h2>
              <p className="text-body text-muted-foreground animate-pulse">
                {importProgress}
              </p>
            </div>
          </div>
        )}

        {/* Step 3: Review Brand */}
        {step === "brand" && brand && (
          <div className="space-y-8">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-primary-soft flex items-center justify-center mb-6">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <h1 className="heading-xl">We found your brand</h1>
              <p className="mt-2 text-body text-muted-foreground">
                Review what we extracted — you can edit anything
              </p>
            </div>

            <div className="space-y-5">
              <Field
                label="Brand name"
                value={brand.name}
                onChange={(v) => setBrand({ ...brand, name: v })}
              />
              <Field
                label="Description"
                value={brand.description}
                onChange={(v) => setBrand({ ...brand, description: v })}
                multiline
              />
              <Field
                label="Positioning"
                value={brand.positioning}
                onChange={(v) => setBrand({ ...brand, positioning: v })}
                multiline
              />
              <Field
                label="Value proposition"
                value={brand.value_proposition}
                onChange={(v) => setBrand({ ...brand, value_proposition: v })}
                multiline
              />

              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Tone
                </label>
                <p className="text-xs text-muted-foreground mt-1 mb-2">
                  Add or remove descriptors — these guide the voice in every prompt.
                </p>
                <TagEditor
                  label=""
                  tags={brand.tone_tags}
                  placeholder="Add tone..."
                  onChange={(tone_tags) => setBrand({ ...brand, tone_tags })}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Colors
                </label>
                <p className="text-xs text-muted-foreground mt-1 mb-2">
                  Edit hex values, assign roles, or add swatches — creatives use these labels in prompts.
                </p>
                <BrandPaletteEditor
                  palette={brand.color_palette}
                  suggestions={detectedPalette}
                  onChange={(color_palette) =>
                    setBrand({ ...brand, color_palette })
                  }
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <button
                onClick={() => setStep("url")}
                className="btn-ghost flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              <button
                onClick={() => setStep("products")}
                className="btn-primary flex items-center gap-2"
              >
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Review Products */}
        {step === "products" && (
          <div className="space-y-8">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-primary-soft flex items-center justify-center mb-6">
                <Package className="h-8 w-8 text-primary" />
              </div>
              <h1 className="heading-xl">Your products</h1>
              <p className="mt-2 text-body text-muted-foreground">
                {products.length > 0
                  ? "Select the products you want to work with"
                  : "No products were found — you can add them later"}
              </p>
            </div>

            {products.length > 0 && (
              <div className="space-y-3">
                {products.map((p, i) => {
                  const previewSrc = resolveSiteAbsoluteUrl(
                    p.image_url,
                    websiteUrl
                  );
                  const resolvedProductUrl = resolveSiteAbsoluteUrl(
                    p.product_url,
                    websiteUrl
                  );
                  return (
                  <div
                    key={i}
                    onClick={() => {
                      const updated = [...products];
                      updated[i] = { ...p, selected: !p.selected };
                      setProducts(updated);
                    }}
                    className={`flex items-start gap-4 p-4 rounded-2xl border cursor-pointer transition-colors ${
                      p.selected
                        ? "border-primary bg-primary-soft/30"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <div
                      className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                        p.selected
                          ? "bg-primary border-primary"
                          : "border-border"
                      }`}
                    >
                      {p.selected && (
                        <Check className="h-3 w-3 text-primary-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 flex items-start gap-3">
                      {previewSrc ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={previewSrc}
                          alt=""
                          className="h-14 w-14 shrink-0 rounded-lg border border-border object-cover bg-muted"
                        />
                      ) : null}
                      <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{p.name}</p>
                      {p.product_category && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {p.product_category}
                        </p>
                      )}
                      {(p.short_description || p.description) && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {p.short_description || p.description}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                        {p.price_text && (
                          <span className="text-xs font-medium text-foreground">
                            {p.price_text}
                          </span>
                        )}
                        {resolvedProductUrl && (
                          <a
                            href={resolvedProductUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary inline-flex items-center gap-1 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Product page
                            <ExternalLink className="h-3 w-3 shrink-0" />
                          </a>
                        )}
                      </div>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}

            <div className="flex items-center justify-between">
              <button
                onClick={() => setStep("brand")}
                className="btn-ghost flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              {products.filter((p) => p.selected).length > 0 ? (
                <button
                  onClick={handleGenerateIcps}
                  className="btn-primary flex items-center gap-2"
                >
                  Generate audiences <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={() => void completeOnboarding()}
                  disabled={leaving}
                  className="btn-primary flex items-center gap-2"
                >
                  {leaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Skip to studio <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Step: Generating ICPs (loading state) */}
        {step === "finishing" && icps.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 space-y-8">
            <div className="w-20 h-20 rounded-full border-4 border-primary/20 flex items-center justify-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
            <div className="text-center space-y-2">
              <h2 className="heading-lg">Generating audiences</h2>
              <p className="text-body text-muted-foreground">
                Creating ideal customer profiles for your products...
              </p>
            </div>
          </div>
        )}

        {/* Step 5: Review ICPs */}
        {step === "icps" && (
          <div className="space-y-8">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-primary-soft flex items-center justify-center mb-6">
                <Users className="h-8 w-8 text-primary" />
              </div>
              <h1 className="heading-xl">Your audiences</h1>
              <p className="mt-2 text-body text-muted-foreground">
                Ideal customer profiles, grouped by product
              </p>
            </div>

            <div className="space-y-8">
              {(() => {
                const selectedProducts = products.filter((p) => p.selected);
                const groups = selectedProducts.map((product, idx) => ({
                  product,
                  productIndex: idx,
                  icps: icps.filter((i) => i.productIndex === idx),
                }));
                return groups
                  .filter((g) => g.icps.length > 0)
                  .map((group) => (
                    <section key={group.productIndex} className="space-y-4">
                      {/* Product header */}
                      <div className="flex items-center gap-3">
                        {group.product.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={group.product.image_url}
                            alt={group.product.name}
                            className="h-10 w-10 rounded-lg border border-border bg-card object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-secondary-soft">
                            <Package className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h2 className="text-base font-semibold text-foreground truncate">
                            {group.product.name}
                          </h2>
                          <p className="text-xs text-muted-foreground">
                            {group.icps.length} audience
                            {group.icps.length === 1 ? "" : "s"}
                          </p>
                        </div>
                      </div>

                      {/* Audience rows */}
                      <div className="space-y-3">
                        {group.icps.map((icp, i) => (
                          <IcpPreviewCard
                            key={`${group.productIndex}-${i}`}
                            title={icp.title}
                            summary={icp.summary}
                            pains={icp.pains}
                            desires={icp.desires}
                            objections={icp.objections}
                            triggers={icp.triggers}
                          />
                        ))}
                      </div>
                    </section>
                  ));
              })()}

              {icps.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-8">
                  No audiences were generated. You can add them later from the
                  product pages.
                </p>
              )}
            </div>

            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}

            <div className="flex items-center justify-between">
              <button
                onClick={() => setStep("products")}
                className="btn-ghost flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              <button
                onClick={() => setStep("competitors")}
                className="btn-primary flex items-center gap-2"
              >
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 6: Optional Competitors */}
        {step === "competitors" && (
          <div className="space-y-8">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-primary-soft flex items-center justify-center mb-6">
                <Swords className="h-8 w-8 text-primary" />
              </div>
              <h1 className="heading-xl">Know your competitors</h1>
              <p className="mt-2 text-body text-muted-foreground">
                Add competitors to get smarter ad suggestions — or skip for now
              </p>
            </div>

            <div className="space-y-3">
              {competitorDrafts.map((comp, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-2xl border p-4"
                >
                  <div className="flex-1 space-y-3">
                    <input
                      className="input-field"
                      placeholder="Competitor name"
                      aria-label={`Competitor ${i + 1} name`}
                      value={comp.name}
                      onChange={(e) =>
                        updateCompetitorDraft(i, "name", e.target.value)
                      }
                      disabled={savingCompetitors}
                    />
                    <input
                      className="input-field"
                      placeholder="Website URL (optional)"
                      aria-label={`Competitor ${i + 1} website URL`}
                      type="url"
                      value={comp.website_url}
                      onChange={(e) =>
                        updateCompetitorDraft(i, "website_url", e.target.value)
                      }
                      disabled={savingCompetitors}
                    />
                  </div>
                  <button
                    onClick={() => removeCompetitorDraft(i)}
                    disabled={savingCompetitors}
                    aria-label={`Remove competitor ${comp.name || i + 1}`}
                    className="rounded-lg p-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}

              <button
                onClick={addCompetitorDraft}
                disabled={savingCompetitors}
                className="w-full rounded-2xl border-2 border-dashed p-4 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add a competitor
              </button>
            </div>

            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}

            <div className="flex items-center justify-between">
              <button
                onClick={() => setStep("icps")}
                disabled={savingCompetitors || leaving}
                className="btn-ghost flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              <button
                type="button"
                onClick={() => void handleSaveCompetitors()}
                disabled={savingCompetitors || leaving}
                className="btn-primary flex items-center gap-2"
              >
                {savingCompetitors || leaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {savingCompetitors ? "Saving..." : "Opening studio..."}
                  </>
                ) : competitorDrafts.some((c) => c.name.trim()) ? (
                  <>
                    Save & continue <ArrowRight className="h-4 w-4" />
                  </>
                ) : (
                  <>
                    Continue to studio <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

}

// ---------------------------------------------------------------------------
// Field component
// ---------------------------------------------------------------------------

function Field({
  label,
  value,
  onChange,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  const id = `field-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-muted-foreground">
        {label}
      </label>
      {multiline ? (
        <textarea
          id={id}
          className="input-field mt-1.5 min-h-[80px]"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          id={id}
          className="input-field mt-1.5"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}
