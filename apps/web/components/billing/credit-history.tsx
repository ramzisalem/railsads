import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  Gift,
  History,
  Image as ImageIcon,
  RefreshCcw,
  Sparkles,
  Target,
  Telescope,
  Wand2,
  Globe,
  type LucideIcon,
} from "lucide-react";
import { creditsToCreatives } from "@/lib/billing/stripe";
import type {
  CreditHistoryEntry,
  CreditHistoryEventType,
  CreditHistoryReason,
} from "@/lib/billing/queries";

interface CreditHistoryProps {
  entries: CreditHistoryEntry[];
}

/**
 * Server-rendered credit history feed. Lists every grant and deduction in
 * reverse chronological order with a friendly label, the action link (when
 * the deduction came from a studio thread), and the signed delta.
 *
 * Entries are pre-fetched via `getCreditHistory()` and limited at the query
 * layer so this component stays purely presentational.
 */
export function CreditHistory({ entries }: CreditHistoryProps) {
  if (entries.length === 0) {
    return (
      <div className="panel space-y-3 p-6">
        <SectionHeading />
        <p className="text-sm text-muted-foreground">
          Nothing yet. As you generate creatives, ICPs and analyses,
          you&apos;ll see every credit movement here.
        </p>
      </div>
    );
  }

  return (
    <div className="panel space-y-1 p-6">
      <SectionHeading />
      <ul className="divide-y">
        {entries.map((entry) => (
          <CreditHistoryRow key={entry.id} entry={entry} />
        ))}
      </ul>
    </div>
  );
}

function SectionHeading() {
  return (
    <div className="flex items-center justify-between pb-2">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-muted-foreground" />
        <h2 className="heading-md">Credit history</h2>
      </div>
      <p className="text-xs text-muted-foreground">
        Most recent first
      </p>
    </div>
  );
}

interface RowDescriptor {
  Icon: LucideIcon;
  label: string;
  /** Optional short hint shown next to the date (e.g. plan name). */
  hint?: string | null;
}

function describeEntry(entry: CreditHistoryEntry): RowDescriptor {
  if (entry.reason === "usage_deduction" && entry.eventType) {
    return EVENT_DESCRIPTORS[entry.eventType];
  }

  switch (entry.reason) {
    case "monthly_grant":
      return {
        Icon: RefreshCcw,
        label: "Monthly credits granted",
        hint: entry.planCode ? capitalize(entry.planCode) + " plan" : null,
      };
    case "trial_grant":
      return { Icon: Gift, label: "Free trial credits", hint: "Welcome!" };
    case "bonus":
      return { Icon: Sparkles, label: "Bonus credits", hint: entry.note };
    case "refund":
      return {
        Icon: ArrowUpRight,
        label: "Credit refund",
        hint: entry.note,
      };
    case "manual_adjustment":
      return {
        Icon: ArrowDownRight,
        label: "Adjustment",
        hint: entry.note,
      };
    case "usage_deduction":
      return { Icon: ArrowDownRight, label: "Action", hint: null };
    default:
      return { Icon: ArrowDownRight, label: "Activity", hint: null };
  }
}

const EVENT_DESCRIPTORS: Record<CreditHistoryEventType, RowDescriptor> = {
  creative_generation: {
    Icon: Sparkles,
    label: "Generated creative",
  },
  creative_revision: {
    Icon: Wand2,
    label: "Revised creative",
  },
  image_generation: {
    Icon: ImageIcon,
    label: "Generated image",
  },
  icp_generation: {
    Icon: Target,
    label: "Generated ICP",
  },
  competitor_analysis: {
    Icon: Telescope,
    label: "Analyzed competitor ads",
  },
  website_import: {
    Icon: Globe,
    label: "Imported website",
  },
  export: {
    Icon: ArrowUpRight,
    label: "Exported assets",
  },
};

function CreditHistoryRow({ entry }: { entry: CreditHistoryEntry }) {
  const { Icon, label, hint } = describeEntry(entry);
  const isCredit = entry.delta > 0;
  const date = new Date(entry.createdAt);

  // Inline secondary line:
  //   "<hint> · <thread title>" — only show what we have.
  const subtitleParts: string[] = [];
  if (hint) subtitleParts.push(hint);
  if (entry.thread?.title) subtitleParts.push(`"${entry.thread.title}"`);

  const linkable = entry.thread?.id
    ? `/studio/${entry.thread.id}`
    : null;

  const content = (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="flex min-w-0 items-start gap-3">
        <span
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
            isCredit
              ? "bg-success/10 text-success"
              : "bg-muted text-muted-foreground"
          }`}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{label}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {formatDate(date)}
            {subtitleParts.length > 0 && ` · ${subtitleParts.join(" · ")}`}
          </p>
        </div>
      </div>
      <DeltaBadge delta={entry.delta} />
    </div>
  );

  return (
    <li>
      {linkable ? (
        <Link
          href={linkable}
          className="-mx-2 block rounded-lg px-2 transition-colors hover:bg-muted/40"
        >
          {content}
        </Link>
      ) : (
        content
      )}
    </li>
  );
}

function DeltaBadge({ delta }: { delta: number }) {
  const isCredit = delta > 0;
  const sign = isCredit ? "+" : "−";
  const creatives = creditsToCreatives(Math.abs(delta));
  const subline =
    creatives > 0 ? `${creatives} creative${creatives === 1 ? "" : "s"}` : null;

  return (
    <div className="text-right shrink-0">
      <p
        className={`text-sm font-semibold tabular-nums ${
          isCredit ? "text-success" : "text-foreground"
        }`}
      >
        {sign}
        {Math.abs(delta).toLocaleString()}
      </p>
      {subline && (
        <p className="text-[10px] text-muted-foreground">{subline}</p>
      )}
    </div>
  );
}

function formatDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year:
      date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

function capitalize(s: string): string {
  if (!s) return s;
  return s[0].toUpperCase() + s.slice(1);
}
