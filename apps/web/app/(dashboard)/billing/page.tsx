import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getCurrentBrand } from "@/lib/auth/get-current-brand";
import {
  getBillingOverview,
  getBillingInvoices,
  getCreditHistory,
} from "@/lib/billing/queries";
import { BillingPanel } from "@/components/billing/billing-panel";

export const metadata: Metadata = {
  title: "Plan & billing",
};

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const user = await getCurrentUser();
  const brand = await getCurrentBrand(user.id);

  const [billing, invoices, history] = await Promise.all([
    getBillingOverview(brand.id),
    getBillingInvoices(brand.id),
    getCreditHistory(brand.id),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Plan & billing"
        description={`Subscription and usage for ${brand.name}.`}
      />

      <div className="max-w-4xl">
        <BillingPanel
          billing={billing}
          invoices={invoices}
          history={history}
        />
      </div>
    </div>
  );
}
