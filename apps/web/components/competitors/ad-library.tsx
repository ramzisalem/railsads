"use client";

import { useMemo, useState } from "react";
import {
  Image as ImageIcon,
  LayoutGrid,
  Link2,
  List as ListIcon,
  Search,
  Upload,
} from "lucide-react";
import { AdCard } from "@/components/competitors/ad-card";
import { AdRow } from "@/components/competitors/ad-row";
import { AdDetailDialog } from "@/components/competitors/ad-detail-dialog";
import { CaptureAdDialog } from "@/components/competitors/capture-ad-dialog";
import { BulkPasteDialog } from "@/components/competitors/bulk-paste-dialog";
import { FieldSelect } from "@/components/ui/field-select";
import type { CompetitorAd, ProductOption } from "@/lib/competitors/queries";

interface AdLibraryProps {
  brandId: string;
  competitorId: string;
  ads: CompetitorAd[];
  products: ProductOption[];
}

type ViewMode = "grid" | "list";

export function AdLibrary({
  brandId,
  competitorId,
  ads,
  products,
}: AdLibraryProps) {
  const [view, setView] = useState<ViewMode>("grid");
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState<string | null>(null);
  const [productId, setProductId] = useState<string | null>(null);
  const [activeAd, setActiveAd] = useState<CompetitorAd | null>(null);

  // Build distinct dropdown options from the actual data so we never show
  // "TikTok" if no ad on this competitor came from TikTok yet.
  const platforms = useMemo(() => {
    const set = new Set<string>();
    for (const a of ads) if (a.platform) set.add(a.platform);
    return Array.from(set).sort();
  }, [ads]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ads.filter((a) => {
      if (platform && a.platform !== platform) return false;
      if (productId === "__none__" && a.mapped_product_id) return false;
      if (productId && productId !== "__none__" && a.mapped_product_id !== productId)
        return false;
      if (q.length === 0) return true;
      const hay = [a.title, a.ad_text, a.platform, a.notes]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [ads, query, platform, productId]);

  const showFilters = ads.length > 0;
  const filtersActive =
    query.trim().length > 0 || platform != null || productId != null;

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="heading-md">Ad library</h2>
          <p className="text-xs text-muted-foreground">
            Capture competitor ads to feed the analyzer and seed Studio
            inspiration.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <BulkPasteDialog
            brandId={brandId}
            competitorId={competitorId}
            products={products}
          />
          <CaptureAdDialog
            brandId={brandId}
            competitorId={competitorId}
            products={products}
          />
        </div>
      </header>

      {showFilters && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card/40 p-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, copy, notes…"
              className="input-field h-9 w-full pl-8 text-xs"
            />
          </div>

          {platforms.length > 0 && (
            <div className="w-44">
              <FieldSelect
                value={platform}
                onChange={(v) => setPlatform(v ?? null)}
                allowUnset
                unsetLabel="All platforms"
                options={platforms.map((p) => ({ value: p, label: p }))}
                triggerClassName="h-9 py-0 text-xs"
              />
            </div>
          )}

          {products.length > 0 && (
            <div className="w-52">
              <FieldSelect
                value={productId}
                onChange={(v) => setProductId(v ?? null)}
                allowUnset
                unsetLabel="Any product"
                options={[
                  { value: "__none__", label: "Not mapped to a product" },
                  ...products.map((p) => ({ value: p.id, label: p.name })),
                ]}
                triggerClassName="h-9 py-0 text-xs"
              />
            </div>
          )}

          <div className="ml-auto flex items-center gap-1">
            {filtersActive && (
              <button
                onClick={() => {
                  setQuery("");
                  setPlatform(null);
                  setProductId(null);
                }}
                className="rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear
              </button>
            )}
            <div className="flex items-center rounded-lg border bg-card p-0.5">
              <button
                aria-label="Grid view"
                onClick={() => setView("grid")}
                className={
                  "rounded-md p-1.5 transition-colors " +
                  (view === "grid"
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
              <button
                aria-label="List view"
                onClick={() => setView("list")}
                className={
                  "rounded-md p-1.5 transition-colors " +
                  (view === "list"
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                <ListIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {ads.length === 0 ? (
        <EmptyAdLibrary />
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          No ads match those filters.
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((ad) => (
            <AdCard
              key={ad.id}
              ad={ad}
              products={products}
              onOpen={() => setActiveAd(ad)}
            />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card/40">
          {filtered.map((ad, i) => (
            <AdRow
              key={ad.id}
              ad={ad}
              products={products}
              isLast={i === filtered.length - 1}
              onOpen={() => setActiveAd(ad)}
            />
          ))}
        </div>
      )}

      {activeAd && (
        <AdDetailDialog
          ad={activeAd}
          products={products}
          onClose={() => setActiveAd(null)}
        />
      )}

      {ads.length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          Showing {filtered.length} of {ads.length} ad{ads.length === 1 ? "" : "s"}.
        </p>
      )}
    </section>
  );
}

function EmptyAdLibrary() {
  return (
    <div className="rounded-xl border border-dashed p-10 text-center">
      <ImageIcon className="mx-auto h-8 w-8 text-muted-foreground opacity-50" />
      <p className="mt-3 text-sm font-medium">No ads captured yet</p>
      <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
        The fastest way to map a competitor&apos;s playbook is to feed it a
        handful of their ads — copy, hooks, offers, visuals.
      </p>
      <ul className="mx-auto mt-4 grid max-w-md gap-2 text-left text-xs text-muted-foreground">
        <li className="flex items-start gap-2">
          <Upload className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <span>
            <strong className="text-foreground">Drop screenshots</strong> from
            Meta Ad Library, TikTok, or anywhere — vision extracts copy,
            platform, and CTA automatically.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <Link2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <span>
            <strong className="text-foreground">Paste a URL</strong> — we pull
            the og:image and the page text and turn it into an ad record.
          </span>
        </li>
      </ul>
    </div>
  );
}
