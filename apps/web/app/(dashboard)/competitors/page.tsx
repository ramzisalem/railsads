import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getCurrentBrand } from "@/lib/auth/get-current-brand";
import { getCompetitorsList } from "@/lib/competitors/queries";
import { PageHeader } from "@/components/layout/page-header";
import { CompetitorList } from "@/components/competitors/competitor-list";
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
        actions={
          competitors.length > 0 ? (
            <AddCompetitorForm brandId={brand.id} />
          ) : undefined
        }
      />

      {competitors.length === 0 ? (
        <EmptyState
          icon={Eye}
          title="No competitors yet"
          description="Add competitors and their ads to extract patterns and insights."
          action={<AddCompetitorForm brandId={brand.id} />}
        />
      ) : (
        <CompetitorList competitors={competitors} />
      )}
    </div>
  );
}
