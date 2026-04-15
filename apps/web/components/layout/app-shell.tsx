import { Sidebar } from "./sidebar";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import {
  getCurrentBrand,
  getUserBrands,
} from "@/lib/auth/get-current-brand";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const brand = await getCurrentBrand(user.id);
  const brands = await getUserBrands(user.id);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar brands={brands} activeBrandId={brand.id} />
      <main className="flex-1 pt-14 md:pt-0 md:pl-[270px]">
        <div className="mx-auto max-w-[1600px] px-4 py-4 sm:px-6 sm:py-6 md:px-8 md:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
