import Link from "next/link";
import { Lightbulb, ArrowRight } from "lucide-react";
import type { SuggestionItem } from "@/lib/dashboard/queries";

interface SuggestionsProps {
  items: SuggestionItem[];
}

function buildSuggestionHref(item: SuggestionItem): string {
  const params = new URLSearchParams();
  params.set("productId", item.productId);
  if (item.icpId) params.set("icpId", item.icpId);
  if (item.templateKey) params.set("template", item.templateKey);
  return `/studio?${params.toString()}`;
}

export function Suggestions({ items }: SuggestionsProps) {
  if (items.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-primary" />
        <h2 className="heading-md">Today&apos;s suggestions</h2>
      </div>
      <div className="space-y-2">
        {items.map((item, i) => (
          <Link
            key={i}
            href={buildSuggestionHref(item)}
            className="group flex items-center justify-between rounded-xl border bg-card p-4 transition-colors hover:bg-muted/50"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm text-foreground">{item.label}</p>
            </div>
            <ArrowRight className="ml-3 h-4 w-4 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
        ))}
      </div>
    </section>
  );
}
