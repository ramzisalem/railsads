"use client";

import { InlineField } from "./inline-field";
import { TagEditor } from "./tag-editor";
import { updateBrandProfile } from "@/lib/brand/actions";
import type { BrandProfile } from "@/lib/brand/queries";

interface BrandPositioningProps {
  brandId: string;
  profile: BrandProfile | null;
}

export function BrandPositioning({ brandId, profile }: BrandPositioningProps) {
  if (!profile) {
    return (
      <div className="panel space-y-5 p-6">
        <h2 className="heading-md">Positioning & Messaging</h2>
        <p className="text-body text-muted-foreground">
          Import your website or add brand details to populate positioning data.
        </p>
      </div>
    );
  }

  return (
    <div className="panel space-y-5 p-6">
      <h2 className="heading-md">Positioning & Messaging</h2>

      <div className="space-y-4">
        <InlineField
          label="Category"
          value={profile.category}
          placeholder="e.g., Health & Wellness, Fashion, Electronics"
          onSave={async (v) =>
            updateBrandProfile(brandId, { category: v || null })
          }
        />

        <InlineField
          label="Positioning statement"
          value={profile.positioning}
          placeholder="What makes your brand different"
          multiline
          onSave={async (v) =>
            updateBrandProfile(brandId, { positioning: v || null })
          }
        />

        <InlineField
          label="Value proposition"
          value={profile.value_proposition}
          placeholder="The core value you deliver"
          multiline
          onSave={async (v) =>
            updateBrandProfile(brandId, { value_proposition: v || null })
          }
        />

        <InlineField
          label="Messaging notes"
          value={profile.messaging_notes}
          placeholder="Additional notes about messaging style"
          multiline
          onSave={async (v) =>
            updateBrandProfile(brandId, { messaging_notes: v || null })
          }
        />

        <TagEditor
          label="Tone of voice"
          tags={profile.tone_tags}
          onSave={async (tags) => updateBrandProfile(brandId, { tone_tags: tags })}
        />
      </div>
    </div>
  );
}
