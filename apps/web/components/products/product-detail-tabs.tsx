"use client";

import { useState } from "react";
import { Settings as SettingsIcon, Swords, Users } from "lucide-react";
import type { IcpItem, ProductCompetitorInsight, ProductDetail } from "@/lib/products/queries";
import { IcpsSection } from "./icps-section";
import { CompetitorSignals } from "./competitor-signals";
import { ProductOverview } from "./product-overview";

type TabKey = "audiences" | "competitors" | "details";

interface ProductDetailTabsProps {
  brandId: string;
  product: ProductDetail;
  icps: IcpItem[];
  competitorInsights: ProductCompetitorInsight[];
}

export function ProductDetailTabs({
  brandId,
  product,
  icps,
  competitorInsights,
}: ProductDetailTabsProps) {
  const [tab, setTab] = useState<TabKey>("audiences");

  const tabs: {
    key: TabKey;
    label: string;
    icon: typeof Users;
    count?: number;
  }[] = [
    { key: "audiences", label: "Audiences", icon: Users, count: icps.length },
    {
      key: "competitors",
      label: "Competitors",
      icon: Swords,
      count: competitorInsights.length,
    },
    { key: "details", label: "Details", icon: SettingsIcon },
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

      {tab === "audiences" && (
        <IcpsSection brandId={brandId} productId={product.id} icps={icps} />
      )}
      {tab === "competitors" && (
        <CompetitorSignals insights={competitorInsights} />
      )}
      {tab === "details" && <ProductOverview product={product} />}
    </div>
  );
}
