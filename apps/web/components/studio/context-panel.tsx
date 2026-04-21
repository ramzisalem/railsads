"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Check,
  ImageIcon,
  LayoutTemplate,
  Maximize2,
  Package,
  Sparkles,
  Star,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { updateThreadContext } from "@/lib/studio/actions";
import type {
  ThreadDetail,
  StudioContext,
  IcpOption,
  ProductOption,
  TemplateOption,
  CompetitorAdOption,
} from "@/lib/studio/types";
import { cn } from "@/lib/utils";
import { IcpDetailsDialog } from "./icp-details-dialog";

type ContextTab = "product" | "icp" | "templates" | "reference";

interface ContextPanelProps {
  thread: ThreadDetail;
  context: StudioContext;
}

export function ContextPanel({ thread, context }: ContextPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [tab, setTab] = useState<ContextTab>("product");

  const icpsForProduct = context.icps.filter(
    (i) => i.product_id === thread.product_id
  );

  function update(data: Parameters<typeof updateThreadContext>[1]) {
    startTransition(async () => {
      await updateThreadContext(thread.id, data);
      router.refresh();
    });
  }

  const tabs: { id: ContextTab; label: string; icon: LucideIcon }[] = [
    { id: "product", label: "Product", icon: Package },
    { id: "icp", label: "Audience", icon: Users },
    { id: "templates", label: "Template", icon: LayoutTemplate },
    { id: "reference", label: "Reference", icon: ImageIcon },
  ];

  // Filter the competitor ad list to ones either mapped to the active product
  // or unmapped (i.e. could apply to any product). This keeps the picker
  // focused without hiding ads the user might still want.
  const referenceAds = context.competitorAds.filter(
    (a) =>
      a.mapped_product_id == null ||
      a.mapped_product_id === thread.product_id
  );

  return (
    <div className="flex h-full min-h-0 flex-col rounded-2xl border border-border bg-secondary-soft p-4 sm:p-5">
      <h3 className="mb-3 shrink-0 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Context
      </h3>

      <div
        className="mb-4 flex shrink-0 rounded-xl border border-border bg-card/80 p-1"
        role="tablist"
        aria-label="Context sections"
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-center text-xs font-medium transition-colors sm:text-sm",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-1 focus-visible:ring-offset-card",
              tab === t.id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
            )}
          >
            <t.icon className="h-3.5 w-3.5" />
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain pr-0.5"
      >
        {tab === "product" && (
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
        )}

        {tab === "icp" && (
          <div className="grid gap-2">
            {icpsForProduct.length === 0 ? (
              <EmptyHint
                icon={Users}
                text="No audiences for this product yet. Add them on the product page. You can still create without a specific audience."
              />
            ) : (
              <>
                <TemplateCard
                  selected={thread.icp_id == null}
                  disabled={isPending}
                  onSelect={() => update({ icp_id: null })}
                  name="None"
                  description="No specific audience — broader positioning or general copy."
                  category={null}
                  icon={UserRound}
                />
                {icpsForProduct.map((i: IcpOption) => (
                  <IcpCard
                    key={i.id}
                    icp={i}
                    selected={i.id === thread.icp_id}
                    disabled={isPending}
                    onSelect={() => update({ icp_id: i.id })}
                  />
                ))}
              </>
            )}
          </div>
        )}

        {tab === "templates" && (
          <div className="grid gap-2">
            <TemplateCard
              selected={thread.template_id == null}
              disabled={isPending}
              onSelect={() => update({ template_id: null })}
              name="No template"
              description="Free-form creative without a template structure."
              category={null}
              icon={Sparkles}
            />
            {context.templates.map((t) => (
              <TemplateCard
                key={t.id}
                selected={t.id === thread.template_id}
                disabled={isPending}
                onSelect={() => update({ template_id: t.id })}
                name={t.name}
                description={t.description}
                category={t.category}
                icon={LayoutTemplate}
              />
            ))}
          </div>
        )}

        {tab === "reference" && (
          <div className="grid gap-2">
            <TemplateCard
              selected={thread.reference_competitor_ad_id == null}
              disabled={isPending}
              onSelect={() =>
                update({ reference_competitor_ad_id: null })
              }
              name="No reference"
              description="Generate from brand + product + audience only."
              category={null}
              icon={Sparkles}
            />
            {referenceAds.length === 0 ? (
              <EmptyHint
                icon={ImageIcon}
                text="No competitor ads captured yet. Add some on the competitor page and pin one here as a visual / strategic reference."
              />
            ) : (
              referenceAds.map((ad) => (
                <ReferenceCard
                  key={ad.id}
                  ad={ad}
                  selected={ad.id === thread.reference_competitor_ad_id}
                  disabled={isPending}
                  onSelect={() =>
                    update({ reference_competitor_ad_id: ad.id })
                  }
                />
              ))
            )}
          </div>
        )}
      </div>
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
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-border bg-secondary-soft">
          {ad.image_url ? (
            <Image
              src={ad.image_url}
              alt=""
              fill
              sizes="48px"
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
          {ad.ad_text && (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground [overflow-wrap:anywhere]">
              {ad.ad_text}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

const baseCardClass = cn(
  "group relative w-full rounded-xl border bg-card p-3 text-left transition-colors",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-card"
);

function selectionClass(selected: boolean): string {
  return selected
    ? "border-primary bg-primary-soft"
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
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-secondary-soft">
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
  icp,
  selected,
  disabled,
  onSelect,
}: {
  icp: IcpOption;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);

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
        <IcpDetailsDialog icp={icp} onClose={() => setShowDetails(false)} />
      )}
    </>
  );
}

function TemplateCard({
  selected,
  disabled,
  onSelect,
  name,
  description,
  category,
  icon: Icon,
}: {
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
  name: string;
  description: TemplateOption["description"];
  category: TemplateOption["category"];
  icon: LucideIcon;
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
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary-soft text-foreground">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="text-sm font-medium text-card-foreground [overflow-wrap:anywhere]">
              {name}
            </span>
            {category && (
              <span className="shrink-0 rounded-full bg-secondary-soft px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                {category}
              </span>
            )}
          </div>
          {description && (
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground [overflow-wrap:anywhere]">
              {description}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

function EmptyHint({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card/50 px-4 py-6 text-center">
      <Icon className="h-5 w-5 text-muted-foreground" />
      <p className="text-xs text-muted-foreground">{text}</p>
    </div>
  );
}
