import Link from "next/link";
import {
  Sparkles,
  Package,
  Users,
  Palette,
  ArrowRight,
} from "lucide-react";
import type { DashboardStats } from "@/lib/dashboard/queries";

interface QuickActionsProps {
  stats: DashboardStats;
}

const actions = [
  {
    href: "/studio",
    icon: Sparkles,
    title: "Creative Studio",
    description: "Generate and iterate on ad creatives",
    stat: (s: DashboardStats) =>
      s.threadCount > 0 ? `${s.threadCount} threads` : null,
    primary: true,
  },
  {
    href: "/products",
    icon: Package,
    title: "Products",
    description: "Manage your product catalog",
    stat: (s: DashboardStats) =>
      s.productCount > 0 ? `${s.productCount} products` : null,
    primary: false,
  },
  {
    href: "/competitors",
    icon: Users,
    title: "Competitors",
    description: "Track market intelligence",
    stat: (s: DashboardStats) =>
      s.competitorCount > 0 ? `${s.competitorCount} competitors` : null,
    primary: false,
  },
  {
    href: "/brand",
    icon: Palette,
    title: "Brand",
    description: "Your brand identity & DNA",
    stat: () => null,
    primary: false,
  },
] as const;

export function QuickActions({ stats }: QuickActionsProps) {
  return (
    <section className="space-y-4">
      <h2 className="heading-md">Quick actions</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {actions.map((action) => {
          const Icon = action.icon;
          const statLabel = action.stat(stats);
          return (
            <Link
              key={action.href}
              href={action.href}
              className={`group rounded-2xl border p-5 transition-colors ${
                action.primary
                  ? "border-primary/30 bg-primary-soft/20 hover:bg-primary-soft/40"
                  : "bg-card shadow-soft hover:bg-muted/50"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    action.primary
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground group-hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <h3 className="text-sm font-medium">{action.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {action.description}
              </p>
              {statLabel && (
                <p className="mt-2 text-xs font-medium text-muted-foreground">
                  {statLabel}
                </p>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
