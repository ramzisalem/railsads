import Link from "next/link";
import { Plus } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getCurrentBrand } from "@/lib/auth/get-current-brand";
import { Greeting } from "@/components/dashboard/greeting";
import { ContinueCreative } from "@/components/dashboard/continue-creative";
import { RecentCreatives } from "@/components/dashboard/recent-creatives";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { Suggestions } from "@/components/dashboard/suggestions";
import {
  getRecentThreads,
  getDashboardStats,
  getSuggestions,
} from "@/lib/dashboard/queries";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const brand = await getCurrentBrand(user.id);

  const [recentThreads, stats, suggestions] = await Promise.all([
    getRecentThreads(brand.id),
    getDashboardStats(brand.id),
    getSuggestions(brand.id),
  ]);

  const firstName = user.fullName?.split(" ")[0] ?? null;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <Greeting firstName={firstName} brandName={brand.name} />
        <div className="flex items-center gap-3">
          <Link
            href="/studio"
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            New creative
          </Link>
        </div>
      </div>

      <ContinueCreative thread={recentThreads[0] ?? null} />

      <RecentCreatives threads={recentThreads.slice(1)} />

      <QuickActions stats={stats} />

      <Suggestions items={suggestions} />
    </div>
  );
}
