"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import {
  Image as ImageIcon,
  Link2,
  Loader2,
  Plus,
  Sparkles,
  Type,
  Upload,
  X,
} from "lucide-react";
import { createCompetitorAdFromCapture } from "@/lib/competitors/actions";
import type { ProductOption } from "@/lib/competitors/queries";
import { FieldSelect } from "@/components/ui/field-select";

/**
 * Effortless competitor ad capture.
 *
 * Modes:
 *   - upload: drop or pick screenshots; vision auto-fills the draft.
 *   - link:   paste a URL (Meta Ad Library, TikTok, landing page); the server
 *             grabs og:image + page text and vision-extracts.
 *   - manual: fall back to the original text-only form.
 *
 * Either way we end up at the same review step (editable fields), and submit
 * via `createCompetitorAdFromCapture`, which inserts the row + links assets.
 */

interface CaptureAdDialogProps {
  brandId: string;
  competitorId: string;
  products: ProductOption[];
}

type Mode = "upload" | "link" | "manual";

interface UploadedAsset {
  assetId: string;
  storagePath: string;
  publicUrl: string;
}

interface DraftFields {
  title: string;
  ad_text: string;
  platform: string;
  notes: string;
  source_url: string;
  landing_page_url: string;
  mapped_product_id: string;
}

const EMPTY_DRAFT: DraftFields = {
  title: "",
  ad_text: "",
  platform: "",
  notes: "",
  source_url: "",
  landing_page_url: "",
  mapped_product_id: "",
};

export function CaptureAdDialog({
  brandId,
  competitorId,
  products,
}: CaptureAdDialogProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("upload");
  const [draft, setDraft] = useState<DraftFields>(EMPTY_DRAFT);
  const [assets, setAssets] = useState<UploadedAsset[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hasExtracted, setHasExtracted] = useState(false);
  const [isSaving, startSaving] = useTransition();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) {
      setMode("upload");
      setDraft(EMPTY_DRAFT);
      setAssets([]);
      setLinkUrl("");
      setError(null);
      setHasExtracted(false);
      setExtracting(false);
    }
  }, [open]);

  function patchDraft(patch: Partial<DraftFields>) {
    setDraft((prev) => ({ ...prev, ...patch }));
  }

  async function handleFiles(files: FileList | File[]) {
    const list = Array.from(files).slice(0, 4);
    if (list.length === 0) return;
    setError(null);
    setExtracting(true);
    try {
      const form = new FormData();
      form.append("brandId", brandId);
      form.append("competitorId", competitorId);
      for (const file of list) form.append("files", file);

      const res = await fetch("/api/competitors/ads/extract", {
        method: "POST",
        body: form,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Couldn't extract ad");

      setAssets((prev) => [...prev, ...(json.assets ?? [])]);
      mergeDraftFromExtract(json.draft);
      setHasExtracted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setExtracting(false);
    }
  }

  async function handleLinkExtract() {
    const trimmed = linkUrl.trim();
    if (!trimmed) {
      setError("Paste a URL first");
      return;
    }
    setError(null);
    setExtracting(true);
    try {
      const res = await fetch("/api/competitors/ads/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ brandId, competitorId, url: trimmed }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Couldn't extract ad");

      setAssets((prev) => [...prev, ...(json.assets ?? [])]);
      mergeDraftFromExtract(json.draft, {
        source_url: json.sourceUrl ?? trimmed,
        landing_page_url: json.landingPageUrl ?? trimmed,
      });
      setHasExtracted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load URL");
    } finally {
      setExtracting(false);
    }
  }

  function mergeDraftFromExtract(
    extract: Partial<{
      title: string | null;
      ad_text: string | null;
      platform: string | null;
      notes: string | null;
    }> | null,
    overrides: Partial<DraftFields> = {}
  ) {
    setDraft((prev) => ({
      ...prev,
      title: prev.title || extract?.title || "",
      ad_text: prev.ad_text || extract?.ad_text || "",
      platform: prev.platform || extract?.platform || "",
      notes: prev.notes || extract?.notes || "",
      ...overrides,
    }));
  }

  function removeAsset(assetId: string) {
    setAssets((prev) => prev.filter((a) => a.assetId !== assetId));
  }

  function handleSubmit() {
    setError(null);
    const source: "upload" | "link" | "manual" =
      mode === "upload" ? "upload" : mode === "link" ? "link" : "manual";

    startSaving(async () => {
      const result = await createCompetitorAdFromCapture({
        brandId,
        competitorId,
        source,
        assetIds: assets.map((a) => a.assetId),
        draft: {
          title: draft.title || null,
          ad_text: draft.ad_text || null,
          platform: draft.platform || null,
          notes: draft.notes || null,
          source_url: draft.source_url || null,
          landing_page_url: draft.landing_page_url || null,
          mapped_product_id: draft.mapped_product_id || null,
        },
      });
      if (result.error) setError(result.error);
      else setOpen(false);
    });
  }

  const canSave =
    !isSaving &&
    !extracting &&
    (assets.length > 0 ||
      draft.ad_text.trim().length > 0 ||
      draft.title.trim().length > 0 ||
      draft.source_url.trim().length > 0);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="btn-secondary flex items-center gap-2 text-xs"
      >
        <Plus className="h-3.5 w-3.5" />
        Add ad
      </button>
    );
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        onClick={() => !isSaving && !extracting && setOpen(false)}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl rounded-2xl border bg-card shadow-panel max-h-[90vh] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between border-b px-6 py-4">
            <div>
              <h2 className="heading-md">Capture competitor ad</h2>
              <p className="text-xs text-muted-foreground">
                Drop a screenshot, paste a URL, or type it in. We&apos;ll fill
                in the rest.
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              disabled={isSaving || extracting}
              aria-label="Close dialog"
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex border-b px-6">
            <ModeTab
              active={mode === "upload"}
              onClick={() => setMode("upload")}
              icon={<Upload className="h-3.5 w-3.5" />}
              label="Image"
            />
            <ModeTab
              active={mode === "link"}
              onClick={() => setMode("link")}
              icon={<Link2 className="h-3.5 w-3.5" />}
              label="URL"
            />
            <ModeTab
              active={mode === "manual"}
              onClick={() => setMode("manual")}
              icon={<Type className="h-3.5 w-3.5" />}
              label="Text"
            />
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {error && (
              <div className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {mode === "upload" && (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  multiple
                  hidden
                  onChange={(e) => {
                    if (e.target.files) handleFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
                <DropZone
                  disabled={extracting}
                  onFiles={handleFiles}
                  onClick={() => fileInputRef.current?.click()}
                  extracting={extracting}
                />
              </div>
            )}

            {mode === "link" && (
              <div className="flex items-stretch gap-2">
                <input
                  className="input-field flex-1"
                  placeholder="https://www.facebook.com/ads/library/?id=..."
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !extracting) {
                      e.preventDefault();
                      void handleLinkExtract();
                    }
                  }}
                  disabled={extracting}
                />
                <button
                  type="button"
                  onClick={handleLinkExtract}
                  disabled={extracting || !linkUrl.trim()}
                  className="btn-primary flex items-center gap-2"
                >
                  {extracting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  Extract
                </button>
              </div>
            )}

            {assets.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {assets.map((asset) => (
                  <div
                    key={asset.assetId}
                    className="group relative aspect-square overflow-hidden rounded-xl border bg-muted/30"
                  >
                    <Image
                      src={asset.publicUrl}
                      alt="Captured ad"
                      fill
                      sizes="200px"
                      className="object-cover"
                      unoptimized
                    />
                    <button
                      type="button"
                      onClick={() => removeAsset(asset.assetId)}
                      className="absolute right-1.5 top-1.5 rounded-full bg-background/90 p-1 text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="Remove image"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {(mode === "manual" || hasExtracted || assets.length > 0) && (
              <div className="space-y-4 border-t pt-5">
                {hasExtracted && (
                  <div className="flex items-center gap-2 rounded-lg bg-primary/5 px-3 py-2 text-xs text-primary">
                    <Sparkles className="h-3.5 w-3.5" />
                    Auto-filled from your {mode === "link" ? "URL" : "image"}.
                    Edit anything that&apos;s off.
                  </div>
                )}

                <Field label="Title">
                  <input
                    className="input-field"
                    placeholder="e.g., Summer 50% off — bottle hero"
                    value={draft.title}
                    onChange={(e) => patchDraft({ title: e.target.value })}
                    disabled={isSaving}
                  />
                </Field>

                <Field label="Ad copy">
                  <textarea
                    className="textarea-field"
                    rows={4}
                    placeholder="Headline + body + on-image text"
                    value={draft.ad_text}
                    onChange={(e) => patchDraft({ ad_text: e.target.value })}
                    disabled={isSaving}
                  />
                </Field>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Platform">
                    <input
                      className="input-field"
                      placeholder="Facebook, TikTok, …"
                      value={draft.platform}
                      onChange={(e) => patchDraft({ platform: e.target.value })}
                      disabled={isSaving}
                    />
                  </Field>
                  {products.length > 0 && (
                    <Field
                      label="About product"
                      hint="Which of OUR products this specific ad is most relevant to. Used to scope the analyzer and the Studio reference picker."
                    >
                      <FieldSelect
                        value={draft.mapped_product_id || null}
                        onChange={(v) => patchDraft({ mapped_product_id: v ?? "" })}
                        allowUnset
                        unsetLabel="Not specific"
                        disabled={isSaving}
                        options={products.map((p) => ({
                          value: p.id,
                          label: p.name,
                        }))}
                        triggerClassName="py-3"
                      />
                    </Field>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Source URL">
                    <input
                      className="input-field"
                      type="url"
                      placeholder="https://…"
                      value={draft.source_url}
                      onChange={(e) =>
                        patchDraft({ source_url: e.target.value })
                      }
                      disabled={isSaving}
                    />
                  </Field>
                  <Field label="Landing page URL">
                    <input
                      className="input-field"
                      type="url"
                      placeholder="https://…"
                      value={draft.landing_page_url}
                      onChange={(e) =>
                        patchDraft({ landing_page_url: e.target.value })
                      }
                      disabled={isSaving}
                    />
                  </Field>
                </div>

                <Field label="Notes">
                  <textarea
                    className="textarea-field"
                    rows={2}
                    placeholder="Hook style, angle, social proof…"
                    value={draft.notes}
                    onChange={(e) => patchDraft({ notes: e.target.value })}
                    disabled={isSaving}
                  />
                </Field>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 border-t px-6 py-4">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={isSaving || extracting}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSave}
              className="btn-primary"
            >
              {isSaving ? "Saving…" : "Save ad"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function ModeTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-medium transition-colors " +
        (active
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground")
      }
    >
      {icon}
      {label}
    </button>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground">{label}</span>
      {hint && (
        <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground/80">
          {hint}
        </span>
      )}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function DropZone({
  disabled,
  extracting,
  onFiles,
  onClick,
}: {
  disabled: boolean;
  extracting: boolean;
  onFiles: (files: FileList) => void;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setHover(true);
      }}
      onDragLeave={() => setHover(false)}
      onDrop={(e) => {
        e.preventDefault();
        setHover(false);
        if (disabled) return;
        if (e.dataTransfer.files?.length) onFiles(e.dataTransfer.files);
      }}
      className={
        "flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-8 text-center transition-colors cursor-pointer " +
        (disabled ? "opacity-50 cursor-wait " : "") +
        (hover
          ? "border-primary bg-primary/5 "
          : "border-border hover:border-primary/40 hover:bg-muted/40")
      }
    >
      {extracting ? (
        <>
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm font-medium">Reading the ad…</p>
          <p className="text-xs text-muted-foreground">
            Vision is extracting copy, platform, and CTA.
          </p>
        </>
      ) : (
        <>
          <ImageIcon className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm font-medium">Drop screenshots here</p>
          <p className="text-xs text-muted-foreground">
            PNG, JPEG, WebP up to 10MB · paste up to 4 at once
          </p>
        </>
      )}
    </div>
  );
}
