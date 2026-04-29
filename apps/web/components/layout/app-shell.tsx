import { Sidebar, type SidebarBillingSummary } from "./sidebar";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import {
  getCurrentBrand,
  getUserBrands,
} from "@/lib/auth/get-current-brand";
import { createAdminClient } from "@/lib/db/supabase-admin";
import { getCreditState } from "@/lib/billing/credits";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const brand = await getCurrentBrand(user.id);
  const brands = await getUserBrands(user.id);

  let billingSummary: SidebarBillingSummary;
  try {
    const admin = createAdminClient();
    const state = await getCreditState(admin, brand.id);
    billingSummary = {
      remaining: Math.max(state.remaining, 0),
      limit: state.limitPerPeriod,
      used: state.usedThisPeriod,
      hasSubscription: state.hasSubscription,
      hasTrial: state.hasTrial,
    };
  } catch (e) {
    console.error("[app-shell] failed to load billing summary", e);
    billingSummary = {
      remaining: 0,
      limit: 0,
      used: 0,
      hasSubscription: false,
      hasTrial: false,
    };
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        brands={brands}
        activeBrandId={brand.id}
        billing={billingSummary}
      />
      <main className="flex-1 pt-14 md:pt-0 md:pl-[270px]">
        <div className="mx-auto max-w-[1600px] px-4 py-4 sm:px-6 sm:py-6 md:px-8 md:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
