import {
  Clock,
  Globe,
  Image as ImageIcon,
  Lightbulb,
  Link2,
} from "lucide-react";

interface CompetitorStatStripProps {
  websiteUrl: string | null;
  status: string;
  adCount: number;
  insightCount: number;
  competesForCount: number;
  lastAnalyzedAt: string | null;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/**
 * At-a-glance facts row beneath the page title — lightweight, no card chrome.
 */
export function CompetitorStatStrip({
  websiteUrl,
  status,
  adCount,
  insightCount,
  competesForCount,
  lastAnalyzedAt,
}: CompetitorStatStripProps) {
  const items: { icon: typeof Clock; label: string; hint?: string }[] = [];

  if (websiteUrl) {
    items.push({
      icon: Globe,
      label: websiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, ""),
      hint: "Website",
    });
  }
  items.push({
    icon: ImageIcon,
    label: `${adCount} ad${adCount === 1 ? "" : "s"}`,
  });
  items.push({
    icon: Link2,
    label: `${competesForCount} product${competesForCount === 1 ? "" : "s"}`,
    hint: "Competes for",
  });
  items.push({
    icon: Lightbulb,
    label: `${insightCount} insight${insightCount === 1 ? "" : "s"}`,
  });
  items.push({
    icon: Clock,
    label: lastAnalyzedAt
      ? `Analyzed ${timeAgo(lastAnalyzedAt)}`
      : "Not analyzed yet",
  });

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
      {status === "archived" && (
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
          Archived
        </span>
      )}
      {items.map((item, i) => {
        const Icon = item.icon;
        return (
          <span
            key={i}
            className="inline-flex items-center gap-1.5"
            title={item.hint}
          >
            <Icon className="h-3 w-3 opacity-60" />
            <span>{item.label}</span>
          </span>
        );
      })}
    </div>
  );
}
