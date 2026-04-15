import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getCurrentBrand } from "@/lib/auth/get-current-brand";
import { getCompetitorsList } from "@/lib/competitors/queries";
import { PageHeader } from "@/components/layout/page-header";
import { CompetitorCard } from "@/components/competitors/competitor-card";
import { AddCompetitorForm } from "@/components/competitors/add-competitor-form";
import { EmptyState } from "@/components/ui/empty-state";
import { Eye } from "lucide-react";

export default async function CompetitorsPage() {
  const user = await getCurrentUser();
  const brand = await getCurrentBrand(user.id);
  const competitors = await getCompetitorsList(brand.id);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Competitors"
        description="Market intelligence — track and learn from competitors."
        actions={<AddCompetitorForm brandId={brand.id} />}
      />

      {competitors.length === 0 ? (
        <EmptyState
          icon={Eye}
          title="No competitors yet"
          description="Add competitors and their ads to extract patterns and insights."
          action={<AddCompetitorForm brandId={brand.id} />}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {competitors.map((c) => (
            <CompetitorCard key={c.id} competitor={c} />
          ))}
        </div>
      )}
    </div>
  );
}
