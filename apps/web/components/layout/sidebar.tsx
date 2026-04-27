"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Sparkles,
  Package,
  Users,
  Palette,
  Settings,
  CreditCard,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandSwitcher } from "./brand-switcher";
import { signOut } from "@/lib/auth/actions";
import { creditsToCreatives } from "@/lib/billing/stripe";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Creative Studio", href: "/studio", icon: Sparkles },
  { label: "Products", href: "/products", icon: Package },
  { label: "Competitors", href: "/competitors", icon: Users },
  { label: "Brand", href: "/brand", icon: Palette },
] as const;

export interface SidebarBillingSummary {
  remaining: number;
  limit: number;
  used: number;
  hasSubscription: boolean;
  hasTrial: boolean;
}

interface SidebarProps {
  brands: { id: string; name: string; slug: string; role: string }[];
  activeBrandId: string;
  billing: SidebarBillingSummary;
}

export function Sidebar({ brands, activeBrandId, billing }: SidebarProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const closeMobile = useCallback(() => setOpen(false), []);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <>
      {/* Mobile header bar */}
      <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center border-b bg-sidebar px-4 md:hidden">
        <button
          onClick={() => setOpen(!open)}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        <span className="ml-3 text-sm font-medium">RailsAds</span>
      </div>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/20 md:hidden"
          onClick={closeMobile}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[270px] flex-col border-r bg-sidebar transition-transform duration-150 ease-in-out",
          "md:translate-x-0 md:top-0",
          open ? "translate-x-0 top-14" : "-translate-x-full top-14 md:top-0"
        )}
      >
        {/* Top — brand switcher */}
        <div className="p-4">
          <BrandSwitcher brands={brands} activeId={activeBrandId} />
        </div>

        {/* Middle — navigation */}
        <nav className="flex-1 space-y-1 px-3">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeMobile}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-primary-soft text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0",
                    active ? "text-primary" : "text-muted-foreground"
                  )}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Usage card — visible whenever we have a budget to show */}
        <div className="px-3 pb-2">
          <UsageCard
            billing={billing}
            isActive={isActive("/billing")}
            onClick={closeMobile}
          />
        </div>

        {/* Bottom — account settings + sign out */}
        <div className="border-t p-3 space-y-1">
          <Link
            href="/settings"
            onClick={closeMobile}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
              isActive("/settings")
                ? "bg-primary-soft text-primary font-medium"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Settings
              className={cn(
                "h-4 w-4 shrink-0",
                isActive("/settings")
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
            />
            Settings
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              Sign out
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}

function UsageCard({
  billing,
  isActive,
  onClick,
}: {
  billing: SidebarBillingSummary;
  isActive: boolean;
  onClick: () => void;
}) {
  const totalCreatives = creditsToCreatives(billing.limit);
  const usedCreatives = creditsToCreatives(billing.used);
  const percent =
    billing.limit > 0
      ? Math.min(Math.round((billing.used / billing.limit) * 100), 100)
      : 0;
  const isExhausted = billing.limit > 0 && billing.remaining <= 0;
  const label = billing.hasSubscription
    ? "Plan usage"
    : billing.hasTrial
      ? "Free trial"
      : "Plan";

  return (
    <Link
      href="/billing"
      onClick={onClick}
      className={cn(
        "block rounded-xl border bg-card p-3 transition-colors",
        isActive ? "border-primary/50" : "hover:border-primary/30"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">{label}</span>
        </div>
        {!billing.hasSubscription && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
            {billing.hasTrial ? "Trial" : "Subscribe"}
          </span>
        )}
      </div>

      {billing.limit > 0 ? (
        <>
          <p className="mt-2 text-xs text-muted-foreground">
            {isExhausted
              ? "Limit reached"
              : `${usedCreatives} / ${totalCreatives} creatives`}
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                isExhausted
                  ? "bg-destructive"
                  : percent >= 80
                    ? "bg-amber-500"
                    : "bg-primary"
              )}
              style={{ width: `${percent}%` }}
            />
          </div>
        </>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          Pick a plan to start creating
        </p>
      )}
    </Link>
  );
}
