"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Globe,
  Loader2,
  Check,
  X,
  Package,
  ExternalLink,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import { resolveSiteAbsoluteUrl } from "@/lib/onboarding/resolve-site-url";

interface ImportedDraft {
  name: string;
  short_description?: string | null;
  description?: string | null;
  price_text?: string | null;
  price_currency?: string | null;
  product_url?: string | null;
  image_url?: string | null;
  key_features?: string[] | null;
  product_category?: string | null;
  selected: boolean;
}

interface ImportCompetitorProductsDialogProps {
  brandId: string;
  competitorId: string;
  /** Pre-fill the URL field with the competitor's website if known */
  defaultWebsiteUrl?: string | null;
  trigger?: React.ReactNode;
}

type Step = "url" | "importing" | "review";

export function ImportCompetitorProductsDialog({
  brandId,
  competitorId,
  defaultWebsiteUrl,
  trigger,
}: ImportCompetitorProductsDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("url");
  const [websiteUrl, setWebsiteUrl] = useState(defaultWebsiteUrl ?? "");
  const [normalizedUrl, setNormalizedUrl] = useState<string>("");
  const [drafts, setDrafts] = useState<ImportedDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function reset() {
    setStep("url");
    setDrafts([]);
    setError(null);
    setImportMessage("");
  }

  function close() {
    if (isPending) return;
    setOpen(false);
    setTimeout(reset, 150);
  }

  async function runImport() {
    const trimmed = websiteUrl.trim();
    if (!trimmed) return;
    setStep("importing");
    setError(null);

    const messages = [
      "Fetching competitor site...",
      "Finding their products...",
      "Pulling images & prices...",
      "Almost done...",
    ];
    let i = 0;
    setImportMessage(messages[0]);
    const interval = setInterval(() => {
      i++;
      if (i < messages.length) setImportMessage(messages[i]);
    }, 3000);

    try {
      const res = await fetch(
        `/api/competitors/${competitorId}/products/import`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ brandId, websiteUrl: trimmed }),
        }
      );
      clearInterval(interval);

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Import failed");
      }

      const data = (await res.json()) as {
        products: Omit<ImportedDraft, "selected">[];
        websiteUrl: string;
      };

      setNormalizedUrl(data.websiteUrl);
      setDrafts(
        (data.products ?? []).map((p) => ({
          ...p,
          selected: true,
        }))
      );
      setStep("review");
    } catch (err) {
      clearInterval(interval);
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStep("url");
    }
  }

  async function saveSelected() {
    const selected = drafts.filter((d) => d.selected);
    if (selected.length === 0) {
      setError("Pick at least one product to import");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/competitors/${competitorId}/products/save`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              brandId,
              websiteUrl: normalizedUrl || websiteUrl.trim(),
              products: selected.map((d) => ({
                name: d.name,
                short_description: d.short_description ?? null,
                description: d.description ?? null,
                price_text: d.price_text ?? null,
                price_currency: d.price_currency ?? null,
                product_url: d.product_url ?? null,
                image_url: d.image_url ?? null,
                key_features: d.key_features ?? [],
                product_category: d.product_category ?? null,
              })),
            }),
          }
        );

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to save");
        }

        setOpen(false);
        setTimeout(reset, 150);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save");
      }
    });
  }

  return (
    <>
      {trigger ? (
        <span onClick={() => setOpen(true)}>{trigger}</span>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Globe className="h-4 w-4" />
          Import from website
        </button>
      )}

      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30"
            onClick={close}
            aria-hidden
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 text-left">
            <div className="w-full max-w-2xl rounded-2xl border bg-card shadow-panel max-h-[85vh] flex flex-col text-left">
              <div className="flex items-center justify-between border-b px-6 py-4">
                <h2 className="heading-md flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Import competitor products
                </h2>
                <button
                  onClick={close}
                  disabled={isPending}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-5">
                {step === "url" && (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Paste the competitor&apos;s website. We&apos;ll extract their
                      products with the same pipeline used for your brand.
                    </p>
                    <div>
                      <label className="text-xs text-muted-foreground">
                        Website URL
                      </label>
                      <input
                        className="input-field mt-1"
                        type="url"
                        placeholder="https://competitor.com"
                        value={websiteUrl}
                        onChange={(e) => setWebsiteUrl(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void runImport();
                          }
                        }}
                        autoFocus
                      />
                    </div>
                    {error && (
                      <p className="text-sm text-destructive">{error}</p>
                    )}
                  </div>
                )}

                {step === "importing" && (
                  <div className="flex flex-col items-center justify-center py-16 space-y-6">
                    <div className="w-16 h-16 rounded-full border-4 border-primary/20 flex items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                    <div className="text-center space-y-1">
                      <h3 className="heading-md">Analyzing their site</h3>
                      <p className="text-sm text-muted-foreground animate-pulse">
                        {importMessage}
                      </p>
                    </div>
                  </div>
                )}

                {step === "review" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-sm">
                      <p className="text-muted-foreground">
                        Found{" "}
                        <span className="font-medium text-foreground">
                          {drafts.length}
                        </span>{" "}
                        product{drafts.length === 1 ? "" : "s"}. Pick the ones
                        you want to track.
                      </p>
                      {drafts.length > 0 && (
                        <button
                          onClick={() => {
                            const allOn = drafts.every((d) => d.selected);
                            setDrafts(
                              drafts.map((d) => ({ ...d, selected: !allOn }))
                            );
                          }}
                          className="text-xs text-primary hover:underline"
                        >
                          {drafts.every((d) => d.selected)
                            ? "Deselect all"
                            : "Select all"}
                        </button>
                      )}
                    </div>

                    {drafts.length === 0 && (
                      <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                        No products were found on this site.
                      </div>
                    )}

                    <div className="space-y-3">
                      {drafts.map((p, i) => {
                        const previewSrc = resolveSiteAbsoluteUrl(
                          p.image_url ?? null,
                          normalizedUrl || websiteUrl.trim()
                        );
                        const resolvedProductUrl = resolveSiteAbsoluteUrl(
                          p.product_url ?? null,
                          normalizedUrl || websiteUrl.trim()
                        );
                        return (
                          <div
                            key={i}
                            onClick={() => {
                              const next = [...drafts];
                              next[i] = { ...p, selected: !p.selected };
                              setDrafts(next);
                            }}
                            className={`flex items-start gap-4 p-3 rounded-2xl border cursor-pointer transition-colors ${
                              p.selected
                                ? "border-primary bg-primary-soft/30"
                                : "border-border hover:bg-muted/50"
                            }`}
                          >
                            <div
                              className={`mt-0.5 h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
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
                                  className="h-12 w-12 shrink-0 rounded-lg border border-border object-cover bg-muted"
                                />
                              ) : (
                                <div className="h-12 w-12 shrink-0 rounded-lg border border-border bg-secondary-soft flex items-center justify-center">
                                  <Package className="h-4 w-4 text-muted-foreground" />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium truncate">
                                  {p.name}
                                </p>
                                {p.short_description && (
                                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                    {p.short_description}
                                  </p>
                                )}
                                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                                  {p.price_text && (
                                    <span className="text-xs font-medium">
                                      {p.price_text}
                                    </span>
                                  )}
                                  {resolvedProductUrl && (
                                    <a
                                      href={resolvedProductUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="text-xs text-primary inline-flex items-center gap-1 hover:underline"
                                    >
                                      Source
                                      <ExternalLink className="h-3 w-3" />
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {error && (
                      <p className="text-sm text-destructive">{error}</p>
                    )}
                  </div>
                )}
              </div>

              {(step === "url" || step === "review") && (
                <div className="flex items-center justify-between border-t px-6 py-3">
                  {step === "review" ? (
                    <button
                      onClick={() => setStep("url")}
                      disabled={isPending}
                      className="btn-ghost flex items-center gap-2"
                    >
                      <ArrowLeft className="h-4 w-4" /> Back
                    </button>
                  ) : (
                    <span />
                  )}
                  {step === "url" && (
                    <button
                      onClick={() => void runImport()}
                      disabled={!websiteUrl.trim()}
                      className="btn-primary flex items-center gap-2"
                    >
                      Import <ArrowRight className="h-4 w-4" />
                    </button>
                  )}
                  {step === "review" && (
                    <button
                      onClick={() => void saveSelected()}
                      disabled={
                        isPending || drafts.every((d) => !d.selected)
                      }
                      className="btn-primary flex items-center gap-2"
                    >
                      {isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          Add{" "}
                          {drafts.filter((d) => d.selected).length} product
                          {drafts.filter((d) => d.selected).length === 1
                            ? ""
                            : "s"}
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
