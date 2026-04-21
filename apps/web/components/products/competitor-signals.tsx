import type { ProductCompetitorInsight } from "@/lib/products/queries";
import {
  CATEGORY_META,
  type CategoryMeta,
} from "@/lib/competitors/category-meta";
import type { CompetitorPatternCategory } from "@/lib/competitors/queries";

interface CompetitorSignalsProps {
  insights: ProductCompetitorInsight[];
}

const PATTERN_SECTIONS: {
  category: CompetitorPatternCategory;
  /** Override the shared label when we want a fuller name in this view
   *  (e.g. "Emotional Triggers" instead of just "Emotion"). */
  label?: string;
  pick: (i: ProductCompetitorInsight) => string[];
}[] = [
  { category: "hook", label: "Hook Patterns", pick: (i) => i.hook_patterns },
  { category: "angle", label: "Angle Patterns", pick: (i) => i.angle_patterns },
  {
    category: "emotional",
    label: "Emotional Triggers",
    pick: (i) => i.emotional_triggers,
  },
  {
    category: "visual",
    label: "Visual Patterns",
    pick: (i) => i.visual_patterns,
  },
  { category: "offer", label: "Offer Patterns", pick: (i) => i.offer_patterns },
  { category: "cta", label: "CTA Patterns", pick: (i) => i.cta_patterns },
];

export function CompetitorSignals({ insights }: CompetitorSignalsProps) {
  if (insights.length === 0) {
    return (
      <div className="panel-muted p-5">
        <h3 className="heading-md mb-2">Competitor Signals</h3>
        <p className="text-small text-muted-foreground">
          No competitor insights yet. Link competitors to this product and
          analyze their ads to see patterns here.
        </p>
      </div>
    );
  }

  const groups = PATTERN_SECTIONS.map((section) => ({
    category: section.category,
    label: section.label,
    items: [...new Set(insights.flatMap(section.pick))],
  })).filter((g) => g.items.length > 0);

  const hasPatterns = groups.length > 0;

  const summaries = insights
    .filter((i) => i.summary)
    .map((i) => ({ name: i.competitor_name, summary: i.summary! }));

  return (
    <div className="panel space-y-5 p-5">
      <div>
        <h3 className="heading-md">Competitor Signals</h3>
        <p className="text-small text-muted-foreground mt-1">
          Patterns from {insights.length} analysis
          {insights.length !== 1 ? "es" : ""} across linked competitors
        </p>
      </div>

      {summaries.length > 0 && (
        <div className="space-y-2">
          {summaries.map((s, i) => (
            <div
              key={i}
              className="rounded-xl border bg-card p-3 space-y-1"
            >
              <span className="text-xs font-medium text-muted-foreground">
                {s.name}
              </span>
              <p className="text-sm text-foreground">{s.summary}</p>
            </div>
          ))}
        </div>
      )}

      {hasPatterns ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {groups.map((g) => (
            <PatternGroup
              key={g.category}
              meta={CATEGORY_META[g.category]}
              label={g.label ?? CATEGORY_META[g.category].label}
              items={g.items}
            />
          ))}
        </div>
      ) : (
        !summaries.length && (
          <p className="text-sm text-muted-foreground">
            Insights exist but no specific patterns were extracted yet.
            Re-analyze competitor ads for more detail.
          </p>
        )
      )}
    </div>
  );
}

function PatternGroup({
  meta,
  label,
  items,
}: {
  meta: CategoryMeta;
  label: string;
  items: string[];
}) {
  const Icon = meta.icon;
  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex items-baseline gap-2">
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
          {label}
        </h4>
        <span className="text-[11px] text-muted-foreground/70">
          {items.length}
        </span>
      </div>
      <ul className="space-y-2.5">
        {items.slice(0, 5).map((item, i) => (
          <li
            key={i}
            className="flex items-start gap-2.5 text-[13px] leading-snug text-foreground/85"
          >
            <span
              className={
                "mt-[7px] h-1 w-1 shrink-0 rounded-full opacity-70 " + meta.dot
              }
            />
            <span className="flex-1">{item}</span>
          </li>
        ))}
        {items.length > 5 && (
          <li className="pl-[18px] text-[11px] text-muted-foreground">
            +{items.length - 5} more
          </li>
        )}
      </ul>
    </div>
  );
}
