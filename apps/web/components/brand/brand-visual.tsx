"use client";

import { useEffect, useRef, useState, useTransition, useMemo } from "react";
import { BrandPaletteEditor } from "./brand-palette-editor";
import { TagEditor } from "./tag-editor";
import { InlineField } from "./inline-field";
import { updateBrandVisual } from "@/lib/brand/actions";
import type { BrandVisualIdentity } from "@/lib/brand/queries";
import {
  effectiveColorPalette,
  paletteForDb,
  type BrandPaletteColor,
} from "@/lib/brand/color-palette";

const PALETTE_AUTOSAVE_DELAY_MS = 600;

interface BrandVisualProps {
  brandId: string;
  visual: BrandVisualIdentity | null;
}

function visualIdentitySnapshot(v: BrandVisualIdentity): string {
  return JSON.stringify({
    p: v.primary_color,
    s: v.secondary_color,
    a: v.accent_color,
    pl: v.color_palette ?? [],
  });
}

function BrandPaletteSection({
  brandId,
  visual,
}: {
  brandId: string;
  visual: BrandVisualIdentity;
}) {
  const [palette, setPalette] = useState<BrandPaletteColor[]>(() =>
    effectiveColorPalette(visual)
  );
  const [paletteError, setPaletteError] = useState<string | null>(null);
  const [, startPaletteTransition] = useTransition();
  const isInitialMount = useRef(true);
  const lastSavedSnapshot = useRef<string>(
    JSON.stringify(paletteForDb(palette))
  );

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const snapshot = JSON.stringify(paletteForDb(palette));
    if (snapshot === lastSavedSnapshot.current) return;

    const timer = setTimeout(() => {
      setPaletteError(null);
      startPaletteTransition(async () => {
        const result = await updateBrandVisual(brandId, {
          color_palette: paletteForDb(palette),
        });
        if (result?.error) setPaletteError(result.error);
        else lastSavedSnapshot.current = snapshot;
      });
    }, PALETTE_AUTOSAVE_DELAY_MS);

    return () => clearTimeout(timer);
  }, [palette, brandId]);

  return (
    <div>
      <h3 className="text-sm font-medium text-foreground mb-1">Brand colors</h3>
      <p className="text-xs text-muted-foreground mb-3">
        Set roles (primary, accent, etc.) so creative prompts match your palette.
      </p>
      <BrandPaletteEditor palette={palette} onChange={setPalette} />
      {paletteError && (
        <p className="mt-2 text-xs text-destructive">{paletteError}</p>
      )}
    </div>
  );
}

export function BrandVisual({ brandId, visual }: BrandVisualProps) {
  const paletteKey = useMemo(
    () => (visual ? visualIdentitySnapshot(visual) : ""),
    [visual]
  );

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
        <BrandPaletteSection key={paletteKey} brandId={brandId} visual={visual} />

        <TagEditor
          label="Style tags"
          tags={visual.style_tags}
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
