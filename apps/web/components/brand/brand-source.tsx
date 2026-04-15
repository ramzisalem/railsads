import { Globe, Clock } from "lucide-react";
import type { BrandImportInfo, BrandProfile, BrandVisualIdentity } from "@/lib/brand/queries";

interface BrandSourceProps {
  profile: BrandProfile | null;
  visual: BrandVisualIdentity | null;
  lastImport: BrandImportInfo | null;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function BrandSource({ profile, visual, lastImport }: BrandSourceProps) {
  const profileSource = profile?.source ?? "manual";
  const visualSource = visual?.source ?? "manual";
  const hasImport = !!lastImport;

  return (
    <div className="panel-muted space-y-4 p-5">
      <h3 className="text-ui font-medium">Source & Sync</h3>

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-small text-muted-foreground">
          <Globe className="h-3.5 w-3.5" />
          <span>
            Profile:{" "}
            <span className="text-foreground">
              {profileSource === "website_import"
                ? "Imported from website"
                : "Added manually"}
            </span>
          </span>
        </div>

        <div className="flex items-center gap-2 text-small text-muted-foreground">
          <Globe className="h-3.5 w-3.5" />
          <span>
            Visual identity:{" "}
            <span className="text-foreground">
              {visualSource === "website_import"
                ? "Imported from website"
                : "Added manually"}
            </span>
          </span>
        </div>

        {hasImport && lastImport.completed_at && (
          <div className="flex items-center gap-2 text-small text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>
              Last import:{" "}
              <span className="text-foreground">
                {formatDate(lastImport.completed_at)}
              </span>
            </span>
          </div>
        )}

        {hasImport && lastImport.source_url && (
          <div className="flex items-center gap-2 text-small text-muted-foreground">
            <Globe className="h-3.5 w-3.5" />
            <span>
              Source:{" "}
              <a
                href={lastImport.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                {lastImport.source_url.replace(/^https?:\/\//, "")}
              </a>
            </span>
          </div>
        )}

        {!hasImport && (
          <p className="text-small text-muted-foreground italic">
            No website import yet
          </p>
        )}
      </div>
    </div>
  );
}
