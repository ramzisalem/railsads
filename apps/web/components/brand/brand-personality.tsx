"use client";

import { TagEditor } from "./tag-editor";
import { updateBrandProfile } from "@/lib/brand/actions";
import type { BrandProfile } from "@/lib/brand/queries";

interface BrandPersonalityProps {
  brandId: string;
  profile: BrandProfile | null;
}

export function BrandPersonality({
  brandId,
  profile,
}: BrandPersonalityProps) {
  if (!profile) {
    return (
      <div className="panel space-y-5 p-6">
        <h2 className="heading-md">Personality</h2>
        <p className="text-body text-muted-foreground">
          Import your website or define your brand personality traits.
        </p>
      </div>
    );
  }

  return (
    <div className="panel space-y-5 p-6">
      <h2 className="heading-md">Personality</h2>

      <div className="space-y-4">
        <TagEditor
          label="Personality traits"
          tags={profile.personality_tags}
          variant="primary"
          onSave={async (tags) =>
            updateBrandProfile(brandId, { personality_tags: tags })
          }
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border bg-card p-4 space-y-2">
            <div className="text-xs font-medium text-muted-foreground">
              Do&apos;s
            </div>
            <TagEditor
              label=""
              tags={profile.do_rules}
              onSave={async (tags) =>
                updateBrandProfile(brandId, { do_rules: tags })
              }
            />
          </div>

          <div className="rounded-xl border bg-card p-4 space-y-2">
            <div className="text-xs font-medium text-muted-foreground">
              Don&apos;ts
            </div>
            <TagEditor
              label=""
              tags={profile.dont_rules}
              onSave={async (tags) =>
                updateBrandProfile(brandId, { dont_rules: tags })
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
