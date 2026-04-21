"use client";

import Image from "next/image";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, X } from "lucide-react";
import { updateThreadContext } from "@/lib/studio/actions";
import {
  AWARENESS_LEVELS,
  ANGLE_PRESETS,
  type ProductOption,
  type IcpOption,
  type CompetitorAdOption,
} from "@/lib/studio/types";
import { FieldSelect } from "@/components/ui/field-select";
import {
  IMAGE_GEN_RATIO_OPTIONS,
  type ImageGenSize,
} from "@/lib/studio/image-gen-sizes";
import { AspectRatioGlyph } from "./aspect-ratio-glyph";

interface ChatContextStripProps {
  threadId: string;
  productId: string;
  icpId: string | null;
  angle: string | null;
  awareness: string | null;
  referenceCompetitorAdId: string | null;
  products: ProductOption[];
  icps: IcpOption[];
  competitorAds: CompetitorAdOption[];
  // Optional ratio selector — only rendered when both props are provided
  // (e.g. inside the image-edit modal). The chat-level strip omits it because
  // ratio is picked per-generation in the composer there.
  imageSize?: ImageGenSize;
  onImageSizeChange?: (size: ImageGenSize) => void;
}

export function ChatContextStrip({
  threadId,
  productId,
  icpId,
  angle,
  awareness,
  referenceCompetitorAdId,
  products,
  icps,
  competitorAds,
  imageSize,
  onImageSizeChange,
}: ChatContextStripProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function patch(data: Parameters<typeof updateThreadContext>[1]) {
    startTransition(async () => {
      await updateThreadContext(threadId, data);
      router.refresh();
    });
  }

  const icpsForProduct = icps.filter((i) => i.product_id === productId);
  const referenceAd = referenceCompetitorAdId
    ? competitorAds.find((a) => a.id === referenceCompetitorAdId) ?? null
    : null;

  return (
    <div className="border-0 bg-transparent px-4 pb-1.5 pt-2 sm:px-6">
      <h2 className="sr-only">Chat context</h2>
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2.5">
        <Field label="Product">
          <FieldSelect
            value={productId}
            onChange={(v) => {
              if (!v || v === productId) return;
              patch({ product_id: v, icp_id: null });
            }}
            allowUnset={false}
            disabled={isPending || products.length === 0}
            aria-label="Product"
            size="compact"
            width="hug"
            options={products.map((p) => ({ value: p.id, label: p.name }))}
          />
        </Field>
        <Field label="Audience">
          <FieldSelect
            value={icpId}
            onChange={(v) => patch({ icp_id: v })}
            allowUnset
            unsetLabel="None"
            disabled={isPending}
            aria-label="Audience (optional)"
            size="compact"
            width="hug"
            options={icpsForProduct.map((i) => ({
              value: i.id,
              label: i.title,
            }))}
          />
        </Field>
        <Field label="Angle">
          <FieldSelect
            value={angle}
            onChange={(v) => patch({ angle: v })}
            allowUnset
            unsetLabel="None"
            disabled={isPending}
            aria-label="Creative angle"
            size="compact"
            width="hug"
            options={ANGLE_PRESETS.map((a) => ({ value: a, label: a }))}
          />
        </Field>
        <Field label="Awareness">
          <FieldSelect
            value={awareness}
            onChange={(v) => patch({ awareness: v })}
            allowUnset
            unsetLabel="None"
            disabled={isPending}
            aria-label="Audience awareness level"
            size="compact"
            width="hug"
            options={AWARENESS_LEVELS.map((l) => ({
              value: l.value,
              label: l.label,
            }))}
          />
        </Field>
        {referenceAd && (
          <Field label="Reference">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary-soft py-1 pl-1 pr-2 text-xs">
              {referenceAd.image_url ? (
                <span className="relative h-5 w-5 overflow-hidden rounded-full bg-card">
                  <Image
                    src={referenceAd.image_url}
                    alt=""
                    fill
                    sizes="20px"
                    className="object-cover"
                    unoptimized
                  />
                </span>
              ) : (
                <Sparkles className="h-3.5 w-3.5 text-primary" />
              )}
              <span className="max-w-[160px] truncate font-medium">
                {referenceAd.title ||
                  referenceAd.competitor_name ||
                  "Competitor ad"}
              </span>
              <button
                type="button"
                onClick={() =>
                  patch({ reference_competitor_ad_id: null })
                }
                disabled={isPending}
                aria-label="Remove reference"
                className="rounded-full p-0.5 text-primary/70 hover:bg-primary/10 hover:text-primary transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </Field>
        )}
        {imageSize && onImageSizeChange ? (
          <Field label="Ratio">
            <FieldSelect
              value={imageSize}
              onChange={(v) => {
                if (v) onImageSizeChange(v as ImageGenSize);
              }}
              allowUnset={false}
              aria-label="Output aspect ratio"
              size="compact"
              width="hug"
              options={IMAGE_GEN_RATIO_OPTIONS.map((o) => ({
                value: o.size,
                label: o.label,
                icon: <AspectRatioGlyph ratio={o.ratioGlyph} />,
              }))}
            />
          </Field>
        ) : null}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex max-w-full flex-col gap-1">
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}
