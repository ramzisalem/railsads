"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Check,
  ChevronDown,
  ImageIcon,
  LayoutTemplate,
  Maximize2,
  Package,
  Palette,
  Sparkles,
  Star,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { updateThreadContext } from "@/lib/studio/actions";
import {
  ANGLE_PRESETS,
  AWARENESS_LEVELS,
  type ThreadDetail,
  type StudioContext,
  type IcpOption,
  type ProductOption,
  type CompetitorAdOption,
} from "@/lib/studio/types";
import {
  IMAGE_GEN_RATIO_OPTIONS,
  type ImageGenSize,
} from "@/lib/studio/image-gen-sizes";
import {
  VISUAL_STYLE_PRESETS,
  getVisualStylePreset,
} from "@/lib/studio/visual-styles";
import { cn } from "@/lib/utils";
import { IcpDetailsDialog } from "./icp-details-dialog";
import { IcpForm } from "@/components/products/icp-form";
import { AspectRatioGlyph } from "./aspect-ratio-glyph";
import { TemplateSection } from "./template-section";

type SectionId =
  | "product"
  | "audience"
  | "angle"
  | "awareness"
  | "template"
  | "reference"
  | "visual_style"
  | "ratio";

interface ContextPanelProps {
  thread: ThreadDetail;
  context: StudioContext;
  imageSize: ImageGenSize;
  onImageSizeChange: (size: ImageGenSize) => void;
}

/**
 * Single source of truth for thread context. Replaces both the old tabbed
 * context panel and the dropdown strip above the chat composer. Each row
 * shows the current pick at a glance; clicking expands the picker inline.
 * Only one section is open at a time so the panel stays scannable.
 */
export function ContextPanel({
  thread,
  context,
  imageSize,
  onImageSizeChange,
}: ContextPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [openSection, setOpenSection] = useState<SectionId | null>("product");

  const icpsForProduct = context.icps.filter(
    (i) => i.product_id === thread.product_id
  );

  const referenceAds = context.competitorAds.filter(
    (a) =>
      a.mapped_product_id == null ||
      a.mapped_product_id === thread.product_id
  );

  function update(data: Parameters<typeof updateThreadContext>[1]) {
    startTransition(async () => {
      await updateThreadContext(thread.id, data);
      router.refresh();
    });
  }

  function toggle(id: SectionId) {
    setOpenSection((prev) => (prev === id ? null : id));
  }

  const selectedProduct = context.products.find(
    (p) => p.id === thread.product_id
  );
  const selectedIcp = icpsForProduct.find((i) => i.id === thread.icp_id);
  const selectedTemplateIds = thread.template_ids ?? [];
  // Preserve the selection order so the picker and the downstream
  // fan-out reflect the order the user added templates in.
  const selectedTemplates = selectedTemplateIds
    .map((id) => context.templates.find((t) => t.id === id) ?? null)
    .filter((t): t is NonNullable<typeof t> => t !== null);
  const primaryTemplate = selectedTemplates[0] ?? null;
  const extraTemplatesCount = Math.max(0, selectedTemplates.length - 1);
  const selectedReference = referenceAds.find(
    (a) => a.id === thread.reference_competitor_ad_id
  );
  const selectedAwareness = AWARENESS_LEVELS.find(
    (l) => l.value === thread.awareness
  );
  const selectedRatio = IMAGE_GEN_RATIO_OPTIONS.find(
    (o) => o.size === imageSize
  );
  const selectedVisualStyle = getVisualStylePreset(thread.visual_style);

  return (
    <div className="flex h-full min-h-0 flex-col rounded-2xl border border-border bg-secondary-soft/60 p-4 sm:p-5">
      <div className="mb-4 flex shrink-0 items-baseline justify-between px-1">
        <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Context
        </h3>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overflow-x-hidden overscroll-contain pr-0.5">
        <SectionGroup label="Brief">
          <Section
            id="product"
            label="Product"
            icon={Package}
            open={openSection === "product"}
            onToggle={() => toggle("product")}
            modified={false}
            summary={
              selectedProduct ? (
                <ThumbSummary
                  imageUrl={selectedProduct.image_url}
                  fallbackIcon={Package}
                  text={selectedProduct.name}
                />
              ) : (
                <MutedSummary text="Select a product" />
              )
            }
          >
            <div className="grid gap-2">
              {context.products.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  selected={p.id === thread.product_id}
                  disabled={isPending}
                  onSelect={() => update({ product_id: p.id, icp_id: null })}
                />
              ))}
            </div>
          </Section>

          <Section
            id="audience"
            label="Audience"
            icon={Users}
            open={openSection === "audience"}
            onToggle={() => toggle("audience")}
            modified={!!selectedIcp}
            summary={
              selectedIcp ? (
                <ChipSummary
                  iconNode={<Users />}
                  text={selectedIcp.title}
                  primary={selectedIcp.is_primary}
                />
              ) : (
                <MutedSummary text="None" />
              )
            }
            onClear={
              thread.icp_id ? () => update({ icp_id: null }) : undefined
            }
          >
            {icpsForProduct.length === 0 ? (
              <EmptyHint
                icon={Users}
                text="No audiences for this product yet. Add them on the product page."
              />
            ) : (
              <div className="grid gap-2">
                {icpsForProduct.map((i) => (
                  <IcpCard
                    key={i.id}
                    brandId={thread.brand_id}
                    icp={i}
                    selected={i.id === thread.icp_id}
                    disabled={isPending}
                    onSelect={() => update({ icp_id: i.id })}
                    onDeleted={(deletedId) => {
                      // The audience is gone from the picker now; if it
                      // was the thread's selection, drop the anchor so
                      // the next generation doesn't try to use a
                      // soft-deleted row.
                      if (thread.icp_id === deletedId) {
                        update({ icp_id: null });
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </Section>

          <Section
            id="angle"
            label="Angle"
            icon={Sparkles}
            open={openSection === "angle"}
            onToggle={() => toggle("angle")}
            modified={!!thread.angle}
            summary={
              thread.angle ? (
                <ChipSummary text={thread.angle} />
              ) : (
                <MutedSummary text="None" />
              )
            }
            onClear={
              thread.angle ? () => update({ angle: null }) : undefined
            }
          >
            <ChipPicker
              options={[
                { value: null, label: "None" },
                ...ANGLE_PRESETS.map((a) => ({ value: a, label: a })),
              ]}
              selectedValue={thread.angle}
              disabled={isPending}
              onSelect={(v) => update({ angle: v })}
            />
          </Section>

          <Section
            id="awareness"
            label="Awareness"
            icon={UserRound}
            open={openSection === "awareness"}
            onToggle={() => toggle("awareness")}
            modified={!!thread.awareness}
            summary={
              selectedAwareness ? (
                <ChipSummary text={selectedAwareness.label} />
              ) : (
                <MutedSummary text="None" />
              )
            }
            onClear={
              thread.awareness
                ? () => update({ awareness: null })
                : undefined
            }
          >
            <ChipPicker
              options={[
                { value: null, label: "None" },
                ...AWARENESS_LEVELS.map((l) => ({
                  value: l.value,
                  label: l.label,
                })),
              ]}
              selectedValue={thread.awareness}
              disabled={isPending}
              onSelect={(v) => update({ awareness: v })}
            />
          </Section>

          <Section
            id="template"
            label={
              selectedTemplates.length > 1
                ? `Templates · ${selectedTemplates.length}`
                : "Template"
            }
            icon={LayoutTemplate}
            open={openSection === "template"}
            onToggle={() => toggle("template")}
            modified={selectedTemplates.length > 0}
            summary={
              primaryTemplate ? (
                <ThumbSummary
                  imageUrl={primaryTemplate.thumbnail_url}
                  fallbackIcon={LayoutTemplate}
                  text={
                    extraTemplatesCount > 0
                      ? `${primaryTemplate.name} +${extraTemplatesCount} more`
                      : primaryTemplate.name
                  }
                />
              ) : (
                <MutedSummary text="None" />
              )
            }
            onClear={
              selectedTemplates.length > 0
                ? () => update({ template_ids: [] })
                : undefined
            }
          >
            {selectedTemplates.length > 1 && (
              <p className="mb-3 rounded-lg border border-primary/30 bg-primary-soft/40 px-3 py-2 text-xs text-primary">
                {selectedTemplates.length} templates selected — one creative
                will be generated for each.
              </p>
            )}
            <TemplateSection
              brandId={thread.brand_id}
              templates={context.templates}
              folders={context.templateFolders}
              selectedIds={selectedTemplateIds}
              disabled={isPending}
              onToggle={(t) =>
                update({
                  template_ids: toggleTemplate(selectedTemplateIds, t.id),
                })
              }
              onSelectedTemplateRemoved={(removedId) =>
                update({
                  template_ids: selectedTemplateIds.filter(
                    (id) => id !== removedId
                  ),
                })
              }
            />
          </Section>

          <Section
            id="reference"
            label="Reference"
            icon={ImageIcon}
            open={openSection === "reference"}
            onToggle={() => toggle("reference")}
            modified={!!selectedReference}
            summary={
              selectedReference ? (
                <ThumbSummary
                  imageUrl={selectedReference.image_url}
                  fallbackIcon={ImageIcon}
                  text={
                    selectedReference.title ||
                    selectedReference.competitor_name ||
                    "Competitor ad"
                  }
                />
              ) : (
                <MutedSummary text="None" />
              )
            }
            onClear={
              thread.reference_competitor_ad_id
                ? () => update({ reference_competitor_ad_id: null })
                : undefined
            }
          >
            {referenceAds.length === 0 ? (
              <EmptyHint
                icon={ImageIcon}
                text="No competitor ads captured yet. Add some on the competitor page and pin one here as a visual / strategic reference."
              />
            ) : (
              <div className="grid gap-2">
                {referenceAds.map((ad) => (
                  <ReferenceCard
                    key={ad.id}
                    ad={ad}
                    selected={ad.id === thread.reference_competitor_ad_id}
                    disabled={isPending}
                    onSelect={() =>
                      update({ reference_competitor_ad_id: ad.id })
                    }
                  />
                ))}
              </div>
            )}
          </Section>
        </SectionGroup>

        <SectionGroup label="Output">
          <Section
            id="visual_style"
            label="Visual style"
            icon={Palette}
            open={openSection === "visual_style"}
            onToggle={() => toggle("visual_style")}
            modified={!!selectedVisualStyle}
            summary={
              selectedVisualStyle ? (
                <ChipSummary
                  iconNode={<Palette />}
                  text={selectedVisualStyle.label}
                />
              ) : (
                <MutedSummary text="Brand default" />
              )
            }
            onClear={
              thread.visual_style
                ? () => update({ visual_style: null })
                : undefined
            }
          >
            <VisualStylePicker
              selectedValue={thread.visual_style}
              disabled={isPending}
              onSelect={(v) => update({ visual_style: v })}
            />
          </Section>

          <Section
            id="ratio"
            label="Ratio"
            icon={Maximize2}
            open={openSection === "ratio"}
            onToggle={() => toggle("ratio")}
            modified={false}
            summary={
              selectedRatio ? (
                <ChipSummary
                  iconNode={
                    <AspectRatioGlyph ratio={selectedRatio.ratioGlyph} />
                  }
                  text={selectedRatio.label}
                />
              ) : (
                <MutedSummary text="—" />
              )
            }
          >
            <div className="grid grid-cols-3 gap-2.5">
              {IMAGE_GEN_RATIO_OPTIONS.map((opt) => {
                const isSel = opt.size === imageSize;
                return (
                  <button
                    key={opt.size}
                    type="button"
                    onClick={() => onImageSizeChange(opt.size)}
                    className={cn(
                      "flex flex-col items-center justify-center gap-2 rounded-xl border p-4 text-sm font-medium transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                      isSel
                        ? "border-primary/50 bg-primary-soft/40 text-primary"
                        : "border-border bg-card text-muted-foreground hover:border-primary/35 hover:text-foreground"
                    )}
                    aria-pressed={isSel}
                    title={opt.hint}
                  >
                    <AspectRatioGlyph ratio={opt.ratioGlyph} />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </Section>
        </SectionGroup>
      </div>
    </div>
  );
}

function SectionGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
        {label}
      </div>
      <div className="overflow-hidden rounded-xl border border-border/70 bg-card divide-y divide-border/50">
        {children}
      </div>
    </div>
  );
}

function Section({
  id,
  label,
  icon: Icon,
  open,
  onToggle,
  modified,
  summary,
  onClear,
  children,
}: {
  id: SectionId;
  label: string;
  icon: LucideIcon;
  open: boolean;
  onToggle: () => void;
  modified: boolean;
  summary: React.ReactNode;
  onClear?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={cn(open && "bg-muted/20")}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`section-${id}-panel`}
        className={cn(
          "group flex w-full flex-col gap-1.5 px-4 py-3 text-left transition-colors",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring/60",
          !open && "hover:bg-muted/15"
        )}
      >
        <div className="flex w-full items-center gap-2.5">
          <Icon
            className={cn(
              "h-4 w-4 shrink-0 transition-colors",
              open
                ? "text-primary"
                : modified
                ? "text-foreground/70"
                : "text-muted-foreground/70 group-hover:text-foreground/70"
            )}
          />
          <span
            className={cn(
              "text-[11px] font-semibold uppercase tracking-[0.1em]",
              open || modified
                ? "text-foreground/80"
                : "text-muted-foreground/80"
            )}
          >
            {label}
          </span>
          <span className="ml-auto flex shrink-0 items-center gap-1">
            {onClear ? (
              <span
                role="button"
                tabIndex={0}
                aria-label={`Clear ${label.toLowerCase()}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onClear();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    onClear();
                  }
                }}
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground/60 transition-opacity hover:bg-muted hover:text-foreground focus:opacity-100",
                  open
                    ? "opacity-100"
                    : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
                )}
              >
                <X className="h-3.5 w-3.5" />
              </span>
            ) : null}
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground/60 transition-transform",
                open && "rotate-180 text-muted-foreground"
              )}
            />
          </span>
        </div>
        <div className="flex min-w-0 items-center pl-[26px] text-sm text-foreground">
          {summary}
        </div>
      </button>
      {open && (
        <div
          id={`section-${id}-panel`}
          className="border-t border-border/40 bg-card px-4 py-4"
        >
          {children}
        </div>
      )}
    </div>
  );
}

function toggleTemplate(current: string[], templateId: string): string[] {
  // Preserves selection order so the fan-out in Conversation matches the
  // order the user added templates in (visible as numeric badges on the
  // tiles). Duplicate clicks remove the id.
  return current.includes(templateId)
    ? current.filter((id) => id !== templateId)
    : [...current, templateId];
}

function MutedSummary({ text }: { text: string }) {
  return (
    <span className="truncate text-sm text-muted-foreground/60">{text}</span>
  );
}

function ChipSummary({
  iconNode,
  text,
  primary,
}: {
  iconNode?: React.ReactNode;
  text: string;
  primary?: boolean;
}) {
  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-2">
      {iconNode ? (
        <span className="flex shrink-0 items-center text-muted-foreground/80 [&_svg]:size-4">
          {iconNode}
        </span>
      ) : null}
      <span className="min-w-0 truncate text-sm font-medium text-foreground">
        {text}
      </span>
      {primary && (
        <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-primary-soft px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
          <Star className="h-2.5 w-2.5 fill-primary text-primary" />
          Primary
        </span>
      )}
    </span>
  );
}

function ThumbSummary({
  imageUrl,
  fallbackIcon: FallbackIcon,
  text,
}: {
  imageUrl: string | null;
  fallbackIcon: LucideIcon;
  text: string;
}) {
  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-2.5">
      <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded-md border border-border/70 bg-secondary-soft">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt=""
            fill
            sizes="28px"
            className="object-cover"
            unoptimized
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-muted-foreground">
            <FallbackIcon className="h-3.5 w-3.5" />
          </span>
        )}
      </span>
      <span className="min-w-0 truncate text-sm font-medium text-foreground">
        {text}
      </span>
    </span>
  );
}

function ChipPicker({
  options,
  selectedValue,
  disabled,
  onSelect,
}: {
  options: { value: string | null; label: string }[];
  selectedValue: string | null;
  disabled?: boolean;
  onSelect: (value: string | null) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const isSel = (opt.value ?? null) === (selectedValue ?? null);
        return (
          <button
            key={opt.value ?? "__none__"}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(opt.value)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-1 focus-visible:ring-offset-card",
              "disabled:pointer-events-none disabled:opacity-50",
              isSel
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:border-primary/35 hover:text-foreground"
            )}
            aria-pressed={isSel}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function VisualStylePicker({
  selectedValue,
  disabled,
  onSelect,
}: {
  selectedValue: string | null;
  disabled?: boolean;
  onSelect: (value: string | null) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSelect(null)}
        aria-pressed={!selectedValue}
        title="Use the brand's default visual identity (no style override)."
        className={cn(
          "flex flex-col items-start gap-1 rounded-lg border px-3 py-2.5 text-left transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-card",
          "disabled:pointer-events-none disabled:opacity-50",
          !selectedValue
            ? "border-primary/50 bg-primary-soft/40 text-foreground"
            : "border-border bg-card text-muted-foreground hover:border-primary/35 hover:text-foreground"
        )}
      >
        <span className="text-sm font-medium">Brand default</span>
        <span className="text-[11px] text-muted-foreground">
          Use the brand&apos;s own visual identity
        </span>
      </button>
      {VISUAL_STYLE_PRESETS.map((opt) => {
        const isSel = opt.value === selectedValue;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(opt.value)}
            aria-pressed={isSel}
            title={opt.description}
            className={cn(
              "flex flex-col items-start gap-1 rounded-lg border px-3 py-2.5 text-left transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-card",
              "disabled:pointer-events-none disabled:opacity-50",
              isSel
                ? "border-primary/50 bg-primary-soft/40 text-foreground"
                : "border-border bg-card text-muted-foreground hover:border-primary/35 hover:text-foreground"
            )}
          >
            <span className="text-sm font-medium">{opt.label}</span>
            <span className="line-clamp-2 text-[11px] text-muted-foreground">
              {opt.description}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ReferenceCard({
  ad,
  selected,
  disabled,
  onSelect,
}: {
  ad: CompetitorAdOption;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={cn(baseCardClass, selectionClass(selected))}
    >
      <SelectedDot visible={selected} />
      <div className="flex min-w-0 items-start gap-3 pr-7">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border bg-secondary-soft">
          {ad.image_url ? (
            <Image
              src={ad.image_url}
              alt=""
              fill
              sizes="56px"
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <ImageIcon className="h-4 w-4" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-card-foreground [overflow-wrap:anywhere]">
            {ad.title || ad.competitor_name || "Competitor ad"}
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            {ad.competitor_name}
            {ad.platform ? ` · ${ad.platform}` : ""}
          </div>
        </div>
      </div>
    </button>
  );
}

const baseCardClass = cn(
  "group relative w-full rounded-xl border bg-card p-3.5 text-left transition-colors",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-card"
);

function selectionClass(selected: boolean): string {
  return selected
    ? "border-primary/50 bg-primary-soft/40"
    : "border-border hover:border-primary/35 hover:bg-muted/40";
}

function SelectedDot({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
      <Check className="h-3 w-3" />
    </span>
  );
}

function ProductCard({
  product,
  selected,
  disabled,
  onSelect,
}: {
  product: ProductOption;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={cn(baseCardClass, selectionClass(selected))}
    >
      <SelectedDot visible={selected} />
      <div className="flex min-w-0 items-start gap-3 pr-7">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-secondary-soft">
          {product.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.image_url}
              alt={product.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <Package className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-card-foreground [overflow-wrap:anywhere]">
            {product.name}
          </div>
          {product.short_description && (
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground [overflow-wrap:anywhere]">
              {product.short_description}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

function IcpCard({
  brandId,
  icp,
  selected,
  disabled,
  onSelect,
  onDeleted,
}: {
  brandId: string;
  icp: IcpOption;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
  onDeleted?: (icpId: string) => void;
}) {
  const router = useRouter();
  const [showDetails, setShowDetails] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  function handleSelect() {
    if (!disabled) onSelect();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (disabled) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect();
    }
  }

  return (
    <>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-pressed={selected}
        aria-disabled={disabled || undefined}
        onClick={handleSelect}
        onKeyDown={handleKeyDown}
        className={cn(
          baseCardClass,
          selectionClass(selected),
          "cursor-pointer disabled:cursor-default"
        )}
      >
        <SelectedDot visible={selected} />
        <div className="flex min-w-0 items-start gap-3 pr-7">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <Users className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <span className="text-sm font-medium text-card-foreground [overflow-wrap:anywhere]">
                {icp.title}
              </span>
              {icp.is_primary && (
                <span
                  className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-primary-soft px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-primary"
                  title="Primary audience"
                >
                  <Star className="h-2.5 w-2.5 fill-primary text-primary" />
                  Primary
                </span>
              )}
            </div>
            {icp.summary && (
              <p className="mt-0.5 line-clamp-3 text-xs text-muted-foreground [overflow-wrap:anywhere]">
                {icp.summary}
              </p>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowDetails(true);
              }}
              className="mt-2 -ml-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-primary transition-colors hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-card"
            >
              <Maximize2 className="h-3 w-3" />
              View details
            </button>
          </div>
        </div>
      </div>
      {showDetails && (
        <IcpDetailsDialog
          icp={icp}
          onClose={() => setShowDetails(false)}
          onEdit={() => {
            setShowDetails(false);
            setShowEdit(true);
          }}
          onDeleted={onDeleted}
        />
      )}
      {showEdit && (
        <IcpForm
          brandId={brandId}
          productId={icp.product_id}
          // Adapt the lighter `IcpOption` shape to the form's full
          // `IcpItem` signature — source/created_at/updated_at aren't
          // read by the form but satisfy the type.
          icp={{
            id: icp.id,
            product_id: icp.product_id,
            title: icp.title,
            summary: icp.summary,
            pains: icp.pains,
            desires: icp.desires,
            objections: icp.objections,
            triggers: icp.triggers,
            is_primary: icp.is_primary,
            source: "manual",
            created_at: "",
            updated_at: "",
          }}
          onClose={() => {
            setShowEdit(false);
            // The form's server action only revalidates `/products/:id`,
            // so the Studio RSC still holds the pre-edit copy. Refresh
            // defensively on close (harmless when the user cancels).
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function EmptyHint({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2.5 rounded-xl border border-dashed border-border bg-card/50 px-5 py-8 text-center">
      <Icon className="h-6 w-6 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
