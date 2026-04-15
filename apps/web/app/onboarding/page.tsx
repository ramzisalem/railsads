"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { activateBrandAndGoToStudio } from "./actions";
import {
  Globe,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Check,
  Package,
  Users,
  Sparkles,
  Swords,
  Plus,
  X,
  ExternalLink,
} from "lucide-react";
import { resolveSiteAbsoluteUrl } from "@/lib/onboarding/resolve-site-url";

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
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
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
  productIndex: number;
}

interface CompetitorDraft {
  name: string;
  website_url: string;
}

type Step = "url" | "importing" | "brand" | "products" | "icps" | "competitors" | "finishing";

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

function ProgressBar({ current }: { current: Step }) {
  const stepIndex = STEPS.findIndex(
    (s) => s.key === current || (current === "importing" && s.key === "url")
  );
  const activeIdx = current === "finishing" ? STEPS.length : Math.max(stepIndex, 0);

  return (
    <div className="flex items-center gap-2 mb-10">
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
  const [brandId, setBrandId] = useState<string | null>(null);
  const [brand, setBrand] = useState<BrandData | null>(null);
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
    router.push("/");
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
      setBrandId(data.brandId);
      setBrand(data.brand);
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

  // ---- Step 5: Generate ICPs for selected products ----
  const [savedProductIds, setSavedProductIds] = useState<
    { id: string; index: number }[]
  >([]);

  async function handleGenerateIcps() {
    if (!brandId) return;
    setStep("finishing");
    setError(null);

    const selectedProducts = products.filter((p) => p.selected);

    try {
      let insertedProducts = savedProductIds;

      if (insertedProducts.length === 0) {
        insertedProducts = [];
        for (let i = 0; i < selectedProducts.length; i++) {
          const p = selectedProducts[i];
          const origin = (() => {
            try {
              const u = websiteUrl.trim().startsWith("http")
                ? websiteUrl.trim()
                : `https://${websiteUrl.trim()}`;
              return new URL(u).origin;
            } catch {
              return undefined;
            }
          })();

          const res = await fetch("/api/onboarding/save-product", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              brandId,
              name: p.name,
              shortDescription: p.short_description,
              description: p.description ?? null,
              priceText: p.price_text,
              priceCurrency: p.price_currency ?? null,
              productUrl: resolveSiteAbsoluteUrl(p.product_url, websiteUrl),
              imageUrl: resolveSiteAbsoluteUrl(p.image_url, websiteUrl),
              siteOrigin: origin,
              keyFeatures: p.key_features ?? [],
              productCategory: p.product_category ?? null,
            }),
          });
          if (res.ok) {
            const { productId } = await res.json();
            insertedProducts.push({ id: productId, index: i });
          }
        }
        setSavedProductIds(insertedProducts);
      }

      const allIcps: IcpData[] = [];

      for (const prod of insertedProducts) {
        const res = await fetch("/api/icp/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ brandId, productId: prod.id }),
        });
        if (res.ok) {
          const data = await res.json();
          for (const icp of data.icps ?? []) {
            allIcps.push({
              title: icp.title,
              summary: "",
              pains: [],
              desires: [],
              productIndex: prod.index,
            });
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

  async function handleSaveCompetitors() {
    if (!brandId) {
      setError("Missing brand. Go back to the website step or refresh the page.");
      return;
    }
    const valid = competitorDrafts.filter((c) => c.name.trim());
    if (valid.length === 0) {
      await completeOnboarding();
      return;
    }

    setSavingCompetitors(true);
    setError(null);

    try {
      let failed = 0;
      for (const comp of valid) {
        const res = await fetch("/api/onboarding/save-competitor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brandId,
            name: comp.name.trim(),
            websiteUrl: comp.website_url.trim() || null,
          }),
        });
        if (!res.ok) failed++;
      }
      if (failed > 0 && failed === valid.length) {
        throw new Error("Failed to save competitors");
      }
      setSavingCompetitors(false);
      await completeOnboarding();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save competitors");
    } finally {
      setSavingCompetitors(false);
    }
  }

  /**
   * Server Action sets the cookie; full `location.assign` avoids Next refetching
   * `/onboarding` after a server-action `redirect()` (POST 303) racing the UI back to step 1.
   */
  async function completeOnboarding() {
    const firstProductId = savedProductIds[0]?.id;
    const redirectPath = firstProductId ? `/studio?product=${firstProductId}` : "/studio";

    console.info("[railsads:onboarding:client] Continue / completeOnboarding", {
      brandId,
      firstProductId,
      redirectPath,
      savedProductCount: savedProductIds.length,
      step,
    });

    if (!brandId) {
      console.warn("[railsads:onboarding:client] abort: missing brandId");
      setError("Missing brand. Please refresh or start again from the website URL step.");
      return;
    }
    setLeaving(true);
    setError(null);

    console.info("[railsads:onboarding:client] calling activateBrandAndGoToStudio …");
    const result = await activateBrandAndGoToStudio(brandId, redirectPath);

    console.info("[railsads:onboarding:client] activateBrandAndGoToStudio result", {
      ok: result.ok,
      path: result.ok ? result.path : undefined,
      error: result.ok ? undefined : result.error,
    });

    if (result.ok) {
      console.info("[railsads:onboarding:client] window.location.assign", { path: result.path });
      window.location.assign(result.path);
      return;
    }

    setError(
      result.error === "Forbidden"
        ? "Could not activate brand"
        : result.error === "Unauthorized"
          ? "Please sign in again."
          : "Could not continue. Try again."
    );
    setLeaving(false);
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-12">
      {fromNewBrandFlow && (
        <div className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6">
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

      <div className="w-full max-w-2xl">
        {step !== "importing" && step !== "finishing" && (
          <ProgressBar current={step} />
        )}

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
                <div className="flex flex-wrap gap-2 mt-2">
                  {brand.tone_tags.map((t) => (
                    <span key={t} className="tag">
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              {(brand.primary_color ||
                brand.secondary_color ||
                brand.accent_color) && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Colors
                  </label>
                  <div className="flex items-center gap-3 mt-2">
                    {(
                      [
                        { label: "Primary", value: brand.primary_color },
                        { label: "Secondary", value: brand.secondary_color },
                        { label: "Accent", value: brand.accent_color },
                      ] as const
                    )
                      .filter((c) => c.value)
                      .map((c) => (
                        <div key={c.label} className="flex items-center gap-2">
                          <div
                            className="w-8 h-8 rounded-lg border"
                            style={{ backgroundColor: c.value! }}
                          />
                          <span className="text-xs text-muted-foreground">
                            {c.value}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => {
                  updateBrandInDb();
                  setStep("products");
                }}
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
                      {p.short_description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {p.short_description}
                        </p>
                      )}
                      {p.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-3">
                          {p.description}
                        </p>
                      )}
                      {p.key_features && p.key_features.length > 0 && (
                        <ul className="mt-2 text-xs text-muted-foreground list-disc list-inside space-y-0.5">
                          {p.key_features.slice(0, 5).map((f, fi) => (
                            <li key={fi}>{f}</li>
                          ))}
                          {p.key_features.length > 5 && (
                            <li className="list-none text-muted-foreground/80">
                              +{p.key_features.length - 5} more
                            </li>
                          )}
                        </ul>
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
                We generated ideal customer profiles for your products
              </p>
            </div>

            <div className="space-y-3">
              {icps.map((icp, i) => {
                const productName =
                  products.filter((p) => p.selected)[icp.productIndex]?.name ??
                  "Product";
                return (
                  <div
                    key={i}
                    className="rounded-2xl border p-4 space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-medium">{icp.title}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      <Package className="inline h-3 w-3 mr-1" />
                      {productName}
                    </p>
                  </div>
                );
              })}
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

  // ---- Helper: persist brand edits ----
  async function updateBrandInDb() {
    if (!brandId || !brand) return;

    fetch("/api/onboarding/update-brand", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandId, brand }),
    }).catch(() => {});
  }
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
