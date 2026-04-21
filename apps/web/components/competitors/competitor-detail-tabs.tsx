"use client";

import { useState } from "react";
import { Images, Lightbulb, Settings as SettingsIcon } from "lucide-react";
import type {
  CompetitorAd,
  CompetitorDetail,
  CompetitorInsight,
  LinkedProductOption,
  ProductOption,
} from "@/lib/competitors/queries";
import { AdLibrary } from "@/components/competitors/ad-library";
import { InsightsDisplay } from "@/components/competitors/insights-display";
import { CompetitorOverview } from "@/components/competitors/competitor-overview";
import { ProductMapping } from "@/components/competitors/product-mapping";

type TabKey = "ads" | "insights" | "settings";

interface CompetitorDetailTabsProps {
  brandId: string;
  competitor: CompetitorDetail;
  ads: CompetitorAd[];
  insights: CompetitorInsight[];
  linkedProducts: LinkedProductOption[];
  allProducts: ProductOption[];
}

export function CompetitorDetailTabs({
  brandId,
  competitor,
  ads,
  insights,
  linkedProducts,
  allProducts,
}: CompetitorDetailTabsProps) {
  const [tab, setTab] = useState<TabKey>("ads");

  const tabs: {
    key: TabKey;
    label: string;
    icon: typeof Images;
    count?: number;
  }[] = [
    { key: "ads", label: "Ads", icon: Images, count: ads.length },
    {
      key: "insights",
      label: "Insights",
      icon: Lightbulb,
      count: insights.length,
    },
    { key: "settings", label: "Settings", icon: SettingsIcon },
  ];

  return (
    <div className="space-y-5">
      <div className="border-b">
        <nav className="-mb-px flex gap-1 overflow-x-auto" role="tablist">
          {tabs.map(({ key, label, icon: Icon, count }) => {
            const active = tab === key;
            return (
              <button
                key={key}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(key)}
                className={
                  "inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors " +
                  (active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground")
                }
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
                {typeof count === "number" && (
                  <span
                    className={
                      "rounded-full px-1.5 text-[10px] font-semibold " +
                      (active
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground")
                    }
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {tab === "ads" && (
        <AdLibrary
          brandId={brandId}
          competitorId={competitor.id}
          ads={ads}
          products={allProducts}
        />
      )}
      {tab === "insights" && (
        <InsightsDisplay
          insights={insights}
          ads={ads}
          products={allProducts}
        />
      )}
      {tab === "settings" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <CompetitorOverview competitor={competitor} />
          <ProductMapping
            brandId={brandId}
            competitorId={competitor.id}
            linkedProducts={linkedProducts}
            allProducts={allProducts}
          />
        </div>
      )}
    </div>
  );
}
