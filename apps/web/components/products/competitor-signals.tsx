import { Target, Zap, Eye, MessageSquare, Gift, MousePointerClick } from "lucide-react";
import type { ProductCompetitorInsight } from "@/lib/products/queries";

interface CompetitorSignalsProps {
  insights: ProductCompetitorInsight[];
}

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

  const allHooks = [...new Set(insights.flatMap((i) => i.hook_patterns))];
  const allAngles = [...new Set(insights.flatMap((i) => i.angle_patterns))];
  const allTriggers = [...new Set(insights.flatMap((i) => i.emotional_triggers))];
  const allVisual = [...new Set(insights.flatMap((i) => i.visual_patterns))];
  const allOffers = [...new Set(insights.flatMap((i) => i.offer_patterns))];
  const allCtas = [...new Set(insights.flatMap((i) => i.cta_patterns))];

  const hasPatterns =
    allHooks.length > 0 ||
    allAngles.length > 0 ||
    allTriggers.length > 0 ||
    allVisual.length > 0 ||
    allOffers.length > 0 ||
    allCtas.length > 0;

  const summaries = insights
    .filter((i) => i.summary)
    .map((i) => ({ name: i.competitor_name, summary: i.summary! }));

  return (
    <div className="panel space-y-5 p-5">
      <div>
        <h3 className="heading-md">Competitor Signals</h3>
        <p className="text-small text-muted-foreground mt-1">
          Patterns from {insights.length} analysis{insights.length !== 1 ? "es" : ""} across linked competitors
        </p>
      </div>

      {summaries.length > 0 && (
        <div className="space-y-2">
          {summaries.map((s, i) => (
            <div key={i} className="rounded-xl border bg-card p-3 space-y-1">
              <span className="text-xs font-medium text-muted-foreground">{s.name}</span>
              <p className="text-sm text-foreground">{s.summary}</p>
            </div>
          ))}
        </div>
      )}

      {hasPatterns ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {allHooks.length > 0 && (
            <PatternGroup
              icon={<MessageSquare className="h-3.5 w-3.5" />}
              title="Hook Patterns"
              items={allHooks}
            />
          )}
          {allAngles.length > 0 && (
            <PatternGroup
              icon={<Target className="h-3.5 w-3.5" />}
              title="Angle Patterns"
              items={allAngles}
            />
          )}
          {allTriggers.length > 0 && (
            <PatternGroup
              icon={<Zap className="h-3.5 w-3.5" />}
              title="Emotional Triggers"
              items={allTriggers}
            />
          )}
          {allVisual.length > 0 && (
            <PatternGroup
              icon={<Eye className="h-3.5 w-3.5" />}
              title="Visual Patterns"
              items={allVisual}
            />
          )}
          {allOffers.length > 0 && (
            <PatternGroup
              icon={<Gift className="h-3.5 w-3.5" />}
              title="Offer Patterns"
              items={allOffers}
            />
          )}
          {allCtas.length > 0 && (
            <PatternGroup
              icon={<MousePointerClick className="h-3.5 w-3.5" />}
              title="CTA Patterns"
              items={allCtas}
            />
          )}
        </div>
      ) : (
        !summaries.length && (
          <p className="text-sm text-muted-foreground">
            Insights exist but no specific patterns were extracted yet. Re-analyze competitor ads for more detail.
          </p>
        )
      )}
    </div>
  );
}

function PatternGroup({
  icon,
  title,
  items,
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
}) {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-2">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        {icon}
        {title}
      </div>
      <ul className="space-y-1">
        {items.slice(0, 5).map((item, i) => (
          <li key={i} className="text-sm">
            {item}
          </li>
        ))}
        {items.length > 5 && (
          <li className="text-xs text-muted-foreground">
            +{items.length - 5} more
          </li>
        )}
      </ul>
    </div>
  );
}
