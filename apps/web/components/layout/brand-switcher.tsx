"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { switchBrand } from "@/lib/brand/actions";

interface BrandSwitcherItem {
  id: string;
  name: string;
  slug: string;
  role: string;
}

interface BrandSwitcherProps {
  brands: BrandSwitcherItem[];
  activeId: string;
}

export function BrandSwitcher({ brands, activeId }: BrandSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const active = brands.find((w) => w.id === activeId) ?? brands[0];

  function handleSwitch(brandId: string) {
    if (brandId === activeId) {
      setOpen(false);
      return;
    }
    startTransition(async () => {
      await switchBrand(brandId);
      setOpen(false);
      router.refresh();
    });
  }

  if (!active) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-[11px] font-semibold text-primary-foreground">
            {active.name.charAt(0).toUpperCase()}
          </div>
          <span className="truncate">{active.name}</span>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 right-0 top-full z-50 mt-1 flex max-h-[min(24rem,70vh)] flex-col overflow-hidden rounded-xl border bg-card shadow-panel">
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1">
              {brands.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => handleSwitch(b.id)}
                  disabled={isPending}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted",
                    b.id === activeId && "bg-muted"
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-secondary-soft text-[10px] font-semibold text-secondary-dark">
                      {b.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="truncate">{b.name}</span>
                  </div>
                  {b.id === activeId && (
                    <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                  )}
                </button>
              ))}
            </div>

            <div className="shrink-0 border-t border-border bg-card p-1">
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  setOpen(false);
                  router.push("/onboarding?newBrand=1");
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary-soft"
              >
                <Plus className="h-4 w-4 shrink-0" />
                New brand
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function BrandSwitcherSkeleton() {
  return (
    <div className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5">
      <div className="h-7 w-7 shrink-0 animate-pulse rounded-lg bg-muted" />
      <div className="h-4 w-24 animate-pulse rounded bg-muted" />
    </div>
  );
}
