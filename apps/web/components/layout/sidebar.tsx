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
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandSwitcher } from "./brand-switcher";
import { signOut } from "@/lib/auth/actions";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Creative Studio", href: "/studio", icon: Sparkles },
  { label: "Products", href: "/products", icon: Package },
  { label: "Competitors", href: "/competitors", icon: Users },
  { label: "Brand", href: "/brand", icon: Palette },
] as const;

interface SidebarProps {
  brands: { id: string; name: string; slug: string; role: string }[];
  activeBrandId: string;
}

export function Sidebar({ brands, activeBrandId }: SidebarProps) {
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
