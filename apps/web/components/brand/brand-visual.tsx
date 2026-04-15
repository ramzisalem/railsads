"use client";

import { ColorChip } from "./color-chip";
import { TagEditor } from "./tag-editor";
import { InlineField } from "./inline-field";
import { updateBrandVisual } from "@/lib/brand/actions";
import type { BrandVisualIdentity } from "@/lib/brand/queries";

interface BrandVisualProps {
  brandId: string;
  visual: BrandVisualIdentity | null;
}

export function BrandVisual({ brandId, visual }: BrandVisualProps) {
  if (!visual) {
    return (
      <div className="panel space-y-5 p-6">
        <h2 className="heading-md">Visual Identity</h2>
        <p className="text-body text-muted-foreground">
          Import your website or add brand colors and style tags.
        </p>
      </div>
    );
  }

  return (
    <div className="panel space-y-5 p-6">
      <h2 className="heading-md">Visual Identity</h2>

      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <ColorChip
            label="Primary color"
            color={visual.primary_color}
            onSave={async (c) =>
              updateBrandVisual(brandId, { primary_color: c })
            }
          />
          <ColorChip
            label="Secondary color"
            color={visual.secondary_color}
            onSave={async (c) =>
              updateBrandVisual(brandId, { secondary_color: c })
            }
          />
          <ColorChip
            label="Accent color"
            color={visual.accent_color}
            onSave={async (c) =>
              updateBrandVisual(brandId, { accent_color: c })
            }
          />
        </div>

        <TagEditor
          label="Style tags"
          tags={visual.style_tags}
          variant="primary"
          onSave={async (tags) =>
            updateBrandVisual(brandId, { style_tags: tags })
          }
        />

        <InlineField
          label="Visual notes"
          value={visual.visual_notes}
          placeholder="Notes about visual direction, mood, or references"
          multiline
          onSave={async (v) =>
            updateBrandVisual(brandId, { visual_notes: v || null })
          }
        />
      </div>
    </div>
  );
}
