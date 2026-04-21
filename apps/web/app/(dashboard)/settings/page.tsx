import { PageHeader } from "@/components/layout/page-header";
import { ProfileForm } from "@/components/settings/profile-form";
import { ThemeAppearance } from "@/components/settings/theme-appearance";
import { BillingSection } from "@/components/billing/billing-section";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getCurrentBrand } from "@/lib/auth/get-current-brand";
import { getBillingOverview } from "@/lib/billing/queries";
import { signOut } from "@/lib/auth/actions";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  const activeBrand = await getCurrentBrand(user.id);
  const billing = await getBillingOverview(activeBrand.id);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        description="Your account, plan, and preferences. Brand identity lives under Brand."
      />

      <div className="max-w-2xl space-y-6">
        <ProfileForm fullName={user.fullName} email={user.email} />

        <BillingSection billing={billing} />

        <ThemeAppearance />

        <div className="panel border-destructive/20 p-6 space-y-4">
          <h2 className="heading-md">Account</h2>
          <form action={signOut}>
            <button type="submit" className="btn-secondary text-destructive">
              Log out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
