"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import {
  ExternalLink,
  Image as ImageIcon,
  Images,
  Layers,
  Lightbulb,
} from "lucide-react";
import type {
  CompetitorAd,
  CompetitorInsight,
  CompetitorPatternCategory,
  ProductOption,
} from "@/lib/competitors/queries";
import { CATEGORY_META } from "@/lib/competitors/category-meta";

interface InsightsDisplayProps {
  insights: CompetitorInsight[];
  ads?: CompetitorAd[];
  products?: ProductOption[];
}

type SectionKey =
  | "hook_patterns"
  | "angle_patterns"
  | "emotional_triggers"
  | "visual_patterns"
  | "offer_patterns"
  | "cta_patterns";

const PATTERN_SECTIONS: {
  key: SectionKey;
  category: CompetitorPatternCategory;
}[] = [
  { key: "hook_patterns", category: "hook" },
  { key: "angle_patterns", category: "angle" },
  { key: "emotional_triggers", category: "emotional" },
  { key: "visual_patterns", category: "visual" },
  { key: "offer_patterns", category: "offer" },
  { key: "cta_patterns", category: "cta" },
];

type ViewMode = "by_ad" | "by_category";

export function InsightsDisplay({
  insights,
  ads = [],
  products = [],
}: InsightsDisplayProps) {
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("by_ad");

  const adById = useMemo(() => new Map(ads.map((a) => [a.id, a])), [ads]);

  if (insights.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center">
        <Lightbulb className="mx-auto h-8 w-8 text-muted-foreground opacity-50" />
        <p className="mt-2 text-sm font-medium">No insights yet</p>
        <p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground">
          Capture a few ads then click <strong>Analyze ads</strong> — we&apos;ll
          extract hook, angle, offer, and visual patterns and cite the ads that
          back each one.
        </p>
      </div>
    );
  }

  const current = insights.find((i) => i.id === activeRunId) ?? insights[0];

  const productLabel = current.product_id
    ? products.find((p) => p.id === current.product_id)?.name
    : null;

  const totalPatterns = PATTERN_SECTIONS.reduce(
    (sum, s) => sum + (current[s.key]?.length ?? 0),
    0
  );

  // Build adId → list of (category, pattern) — preserves the order they
  // were emitted by the model so each ad reads as a coherent narrative.
  const patternsByAd = new Map<
    string,
    { category: CompetitorPatternCategory; pattern: string }[]
  >();
  // Patterns that the model emitted but didn't cite any ad for. We surface
  // these at the bottom so they aren't silently dropped.
  const unattributed: {
    category: CompetitorPatternCategory;
    pattern: string;
  }[] = [];

  for (const section of PATTERN_SECTIONS) {
    const items = current[section.key] ?? [];
    for (const pattern of items) {
      const evidence = (current.evidence ?? []).find(
        (e) => e.category === section.category && e.pattern === pattern
      );
      const adIds = evidence?.evidence_ad_ids ?? [];
      if (adIds.length === 0) {
        unattributed.push({ category: section.category, pattern });
        continue;
      }
      for (const adId of adIds) {
        if (!adById.has(adId)) continue;
        const list = patternsByAd.get(adId) ?? [];
        list.push({ category: section.category, pattern });
        patternsByAd.set(adId, list);
      }
    }
  }

  // Render ads in their original library order so the insights view feels
  // anchored to the library rather than appearing in random order.
  const adsWithPatterns = ads.filter((a) => patternsByAd.has(a.id));

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="heading-md">Insights</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {totalPatterns} pattern{totalPatterns === 1 ? "" : "s"} from{" "}
            {adsWithPatterns.length} ad
            {adsWithPatterns.length === 1 ? "" : "s"}
            {productLabel && (
              <>
                {" · scoped to "}
                <span className="text-foreground">{productLabel}</span>
              </>
            )}
            {current.confidence_score != null && (
              <> · {Number(current.confidence_score).toFixed(0)}% confidence</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ViewToggle value={view} onChange={setView} />
          {insights.length > 1 && (
            <select
              value={current.id}
              onChange={(e) => setActiveRunId(e.target.value)}
              className="input-field h-8 px-2 text-xs"
            >
              {insights.map((i) => (
                <option key={i.id} value={i.id}>
                  {new Date(i.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                  {i.product_id
                    ? ` · ${products.find((p) => p.id === i.product_id)?.name ?? "scoped"}`
                    : " · whole library"}
                </option>
              ))}
            </select>
          )}
        </div>
      </header>

      {current.summary && (
        <p className="max-w-3xl whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
          {current.summary}
        </p>
      )}

      {view === "by_ad" ? (
        <ByAdView
          adsWithPatterns={adsWithPatterns}
          patternsByAd={patternsByAd}
          unattributed={unattributed}
        />
      ) : (
        <ByCategoryView current={current} adById={adById} />
      )}
    </section>
  );
}

/* ──────────────────────────── by-ad view ──────────────────────────── */

function ByAdView({
  adsWithPatterns,
  patternsByAd,
  unattributed,
}: {
  adsWithPatterns: CompetitorAd[];
  patternsByAd: Map<
    string,
    { category: CompetitorPatternCategory; pattern: string }[]
  >;
  unattributed: { category: CompetitorPatternCategory; pattern: string }[];
}) {
  if (adsWithPatterns.length === 0 && unattributed.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No patterns to display.</p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {adsWithPatterns.map((ad) => (
          <AdInsightCard
            key={ad.id}
            ad={ad}
            patterns={patternsByAd.get(ad.id) ?? []}
          />
        ))}
      </div>

      {unattributed.length > 0 && (
        <details className="rounded-xl border bg-card/30 px-4 py-3 text-sm">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
            {unattributed.length} pattern
            {unattributed.length === 1 ? "" : "s"} not tied to a specific ad
          </summary>
          <ul className="mt-3 space-y-1.5">
            {unattributed.map((u, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm leading-snug"
              >
                <CategoryBadge category={u.category} />
                <span className="flex-1">{u.pattern}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function AdInsightCard({
  ad,
  patterns,
}: {
  ad: CompetitorAd;
  patterns: { category: CompetitorPatternCategory; pattern: string }[];
}) {
  // Group patterns by category so the card reads as one block per category
  // ("here are the hooks this ad uses, here are the angles…") instead of
  // a noisy badge-per-line list.
  const grouped = new Map<CompetitorPatternCategory, string[]>();
  for (const p of patterns) {
    const list = grouped.get(p.category) ?? [];
    list.push(p.pattern);
    grouped.set(p.category, list);
  }

  const hero = ad.images[0];
  const title = ad.title?.trim() || ad.ad_text?.slice(0, 60) || "Untitled ad";
  const link = ad.source_url || ad.landing_page_url;
  const totalPatterns = patterns.length;

  return (
    <article className="overflow-hidden rounded-2xl border bg-card transition-shadow hover:shadow-panel">
      <header className="flex gap-3 border-b bg-muted/20 p-3">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted/40 ring-1 ring-border">
          {hero ? (
            <Image
              src={hero.public_url}
              alt={title}
              fill
              sizes="64px"
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground/40">
              <ImageIcon className="h-5 w-5" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="truncate text-sm font-semibold">{title}</h4>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
            {ad.platform && <span>{ad.platform}</span>}
            {ad.platform && <span aria-hidden>·</span>}
            <span>
              {totalPatterns} pattern{totalPatterns === 1 ? "" : "s"}
            </span>
          </div>
        </div>
        {link && (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="self-start rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="View source"
            title={link}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </header>

      <div className="divide-y">
        {PATTERN_SECTIONS.map(({ category }) => {
          const list = grouped.get(category);
          if (!list || list.length === 0) return null;
          const meta = CATEGORY_META[category];
          const Icon = meta.icon;
          return (
            <section key={category} className="px-3 py-2.5">
              <div className="mb-1.5 flex items-center gap-1.5">
                <span
                  className={
                    "inline-flex h-5 w-5 items-center justify-center rounded-md " +
                    meta.bg +
                    " " +
                    meta.fg
                  }
                >
                  <Icon className="h-3 w-3" />
                </span>
                <span
                  className={
                    "text-[10px] font-semibold uppercase tracking-wider " +
                    meta.fg
                  }
                >
                  {meta.label}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  · {list.length}
                </span>
              </div>
              <ul className="space-y-1 pl-[26px]">
                {list.map((pattern, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-[13px] leading-snug text-foreground/85"
                  >
                    <span
                      className={
                        "mt-[7px] h-1 w-1 shrink-0 rounded-full opacity-70 " +
                        meta.dot
                      }
                    />
                    <span className="flex-1">{pattern}</span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </article>
  );
}

/** Compact icon+label pill — used in the unattributed-patterns accordion
 *  where a per-row label is still the right call (no grouping context). */
function CategoryBadge({
  category,
}: {
  category: CompetitorPatternCategory;
}) {
  const meta = CATEGORY_META[category];
  const Icon = meta.icon;
  return (
    <span
      className={
        "mt-[1px] inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider " +
        meta.bg +
        " " +
        meta.fg
      }
      title={meta.label}
    >
      <Icon className="h-2.5 w-2.5" />
      {meta.label}
    </span>
  );
}

/* ──────────────────────────── by-category view ──────────────────────────── */

function ByCategoryView({
  current,
  adById,
}: {
  current: CompetitorInsight;
  adById: Map<string, CompetitorAd>;
}) {
  const evidenceByPattern = new Map<string, string[]>();
  for (const ev of current.evidence ?? []) {
    evidenceByPattern.set(`${ev.category}::${ev.pattern}`, ev.evidence_ad_ids);
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {PATTERN_SECTIONS.map(({ key, category }) => {
        const items = current[key];
        if (!items || items.length === 0) return null;
        const meta = CATEGORY_META[category];
        const Icon = meta.icon;
        return (
          <section
            key={key}
            className="space-y-3 rounded-xl border bg-card p-4"
          >
            <header className="flex items-baseline gap-2">
              <span
                className={
                  "inline-flex h-5 w-5 items-center justify-center rounded-md " +
                  meta.bg +
                  " " +
                  meta.fg
                }
              >
                <Icon className="h-3 w-3" />
              </span>
              <h4
                className={
                  "font-sans text-xs font-semibold uppercase tracking-wider " +
                  meta.fg
                }
              >
                {meta.label}
              </h4>
              <span className="text-[11px] text-muted-foreground/70">
                {items.length}
              </span>
            </header>

            <ul className="space-y-2.5">
              {items.map((item, i) => {
                const adIds =
                  evidenceByPattern.get(`${category}::${item}`) ?? [];
                const cited = adIds
                  .map((id) => adById.get(id))
                  .filter((a): a is CompetitorAd => !!a);
                return (
                  <li
                    key={i}
                    className="flex items-start gap-2.5 text-[13px] leading-snug text-foreground/85"
                  >
                    <span
                      className={
                        "mt-[7px] h-1 w-1 shrink-0 rounded-full opacity-70 " +
                        meta.dot
                      }
                    />
                    <span className="flex-1">
                      {item}
                      {cited.length > 0 && (
                        <span className="ml-1.5 inline-flex items-center gap-0.5 align-middle">
                          {cited.map((ad) => (
                            <EvidenceDot key={ad.id} ad={ad} />
                          ))}
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/** Minimal image-only dot used to attribute a pattern to the ad it came
 *  from. Hovering reveals a richer popover with the ad's thumbnail,
 *  title, platform and a copy snippet so users can verify the citation
 *  without leaving the page. Clicking opens the source. */
function EvidenceDot({ ad }: { ad: CompetitorAd }) {
  const hero = ad.images[0];
  const title = ad.title?.trim() || ad.ad_text?.slice(0, 60) || "Untitled ad";
  const link = ad.source_url || ad.landing_page_url;
  const snippet = ad.ad_text?.trim();
  const truncatedSnippet =
    snippet && snippet.length > 140 ? `${snippet.slice(0, 140).trim()}…` : snippet;

  const dot = (
    <span className="relative inline-block h-3.5 w-3.5 overflow-hidden rounded-full bg-muted ring-1 ring-border transition-transform group-hover:scale-110">
      {hero ? (
        <Image
          src={hero.public_url}
          alt=""
          fill
          sizes="14px"
          className="object-cover"
          unoptimized
        />
      ) : (
        <span className="flex h-full items-center justify-center text-muted-foreground/60">
          <ImageIcon className="h-2 w-2" />
        </span>
      )}
    </span>
  );

  // Pure-CSS hover popover: avoids pulling in a tooltip dep and keeps
  // the dot itself zero-weight when not interacting.
  const popover = (
    <span
      role="tooltip"
      className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-60 -translate-x-1/2 origin-bottom scale-95 rounded-lg border bg-popover p-2.5 text-left text-popover-foreground opacity-0 shadow-lg transition-all duration-100 group-hover:pointer-events-auto group-hover:scale-100 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:scale-100 group-focus-within:opacity-100"
    >
      <span className="flex gap-2.5">
        <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted ring-1 ring-border">
          {hero ? (
            <Image
              src={hero.public_url}
              alt=""
              fill
              sizes="48px"
              className="object-cover"
              unoptimized
            />
          ) : (
            <span className="flex h-full items-center justify-center text-muted-foreground/60">
              <ImageIcon className="h-4 w-4" />
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12px] font-semibold leading-snug">
            {title}
          </span>
          {ad.platform && (
            <span className="mt-0.5 block text-[10px] uppercase tracking-wider text-muted-foreground">
              {ad.platform}
            </span>
          )}
        </span>
      </span>
      {truncatedSnippet && (
        <span className="mt-2 block text-[11px] leading-snug text-muted-foreground line-clamp-3">
          {truncatedSnippet}
        </span>
      )}
      {link && (
        <span className="mt-2 flex items-center gap-1 text-[10px] font-medium text-primary">
          <ExternalLink className="h-2.5 w-2.5" />
          View source
        </span>
      )}
    </span>
  );

  const wrapperClass = "group relative inline-flex";

  return link ? (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      className={wrapperClass}
      aria-label={title}
    >
      {dot}
      {popover}
    </a>
  ) : (
    <span className={wrapperClass} tabIndex={0} aria-label={title}>
      {dot}
      {popover}
    </span>
  );
}

/* ──────────────────────────── view toggle ──────────────────────────── */

function ViewToggle({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  const options = [
    { id: "by_ad" as const, label: "By ad", icon: Images },
    { id: "by_category" as const, label: "By category", icon: Layers },
  ];
  return (
    <div className="flex items-center rounded-lg border bg-card p-0.5 text-xs">
      {options.map(({ id, label, icon: Icon }) => {
        const active = value === id;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 transition-colors " +
              (active
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground")
            }
          >
            <Icon className="h-3 w-3" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
