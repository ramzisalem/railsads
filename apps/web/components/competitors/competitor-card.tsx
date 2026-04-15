import Link from "next/link";
import { Globe, Image as ImageIcon, Clock } from "lucide-react";
import type { CompetitorListItem } from "@/lib/competitors/queries";

interface CompetitorCardProps {
  competitor: CompetitorListItem;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function CompetitorCard({ competitor }: CompetitorCardProps) {
  return (
    <Link
      href={`/competitors/${competitor.id}`}
      className="panel group flex flex-col gap-3 p-5 transition-colors hover:bg-muted/50"
    >
      <div className="min-w-0">
        <h3 className="text-sm font-medium truncate group-hover:text-primary transition-colors">
          {competitor.name}
        </h3>
        {competitor.website_url && (
          <p className="mt-0.5 text-xs text-muted-foreground truncate">
            {competitor.website_url.replace(/^https?:\/\//, "")}
          </p>
        )}
      </div>

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <ImageIcon className="h-3 w-3" />
          {competitor.ad_count} ad{competitor.ad_count !== 1 ? "s" : ""}
        </span>
        {competitor.website_url && (
          <span className="flex items-center gap-1">
            <Globe className="h-3 w-3" />
            Website
          </span>
        )}
        {competitor.last_analyzed && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {timeAgo(competitor.last_analyzed)}
          </span>
        )}
      </div>
    </Link>
  );
}
