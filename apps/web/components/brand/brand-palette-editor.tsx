"use client";

import { useEffect, useRef, useState } from "react";
import { Pipette, Plus, X } from "lucide-react";
import { FieldSelect } from "@/components/ui/field-select";
import {
  PALETTE_SEGMENT_PRESETS,
  type BrandPaletteColor,
} from "@/lib/brand/color-palette";

const CUSTOM = "__custom__";

/** Value for `<input type="color">` (requires #rrggbb). */
function pickerHex(hex: string): string {
  const t = hex.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(t)) return t;
  if (/^#[0-9a-fA-F]{3}$/.test(t)) {
    return `#${t[1]}${t[1]}${t[2]}${t[2]}${t[3]}${t[3]}`;
  }
  return "#000000";
}

function presetSelectValue(segment: string): string {
  const s = segment.trim().toLowerCase();
  if (PALETTE_SEGMENT_PRESETS.some((p) => p.value === s)) return s;
  return CUSTOM;
}

const ROLE_OPTIONS = [
  ...PALETTE_SEGMENT_PRESETS.map((p) => ({ value: p.value, label: p.label })),
  { value: CUSTOM, label: "Custom…" },
];

/** Pick the next preset segment that's not yet used in the palette. */
function nextAvailableSegment(palette: BrandPaletteColor[]): string {
  const used = new Set(palette.map((c) => c.segment.trim().toLowerCase()));
  const next = PALETTE_SEGMENT_PRESETS.find((p) => !used.has(p.value));
  return next?.value ?? "highlight";
}

interface BrandPaletteEditorProps {
  palette: BrandPaletteColor[];
  onChange: (next: BrandPaletteColor[]) => void;
  /**
   * Hex codes detected mechanically from the brand's website (most-frequent
   * first). Surfaced in the "Add color" popover so users can pick from real
   * brand colors instead of typing hex codes manually.
   */
  suggestions?: string[];
}

export function BrandPaletteEditor({
  palette,
  onChange,
  suggestions = [],
}: BrandPaletteEditorProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close on click outside / Escape
  useEffect(() => {
    if (!pickerOpen) return;
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        pickerRef.current &&
        !pickerRef.current.contains(target) &&
        !triggerRef.current?.contains(target)
      ) {
        setPickerOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPickerOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [pickerOpen]);

  function updateRow(i: number, patch: Partial<BrandPaletteColor>) {
    const next = [...palette];
    next[i] = { ...next[i], ...patch };
    onChange(next);
  }

  function removeRow(i: number) {
    onChange(palette.filter((_, idx) => idx !== i));
  }

  function appendColor(hex: string) {
    onChange([
      ...palette,
      { segment: nextAvailableSegment(palette), hex },
    ]);
  }

  // Detected colors that aren't already in the palette (case-insensitive)
  const usedHex = new Set(palette.map((c) => c.hex.trim().toLowerCase()));
  const availableSuggestions = suggestions.filter(
    (h) => !usedHex.has(h.trim().toLowerCase())
  );

  function handleAddClick() {
    if (availableSuggestions.length > 0) {
      setPickerOpen((v) => !v);
      return;
    }
    appendColor("#64748b");
  }

  return (
    <div className="space-y-3">
      {palette.map((row, i) => {
        const sel = presetSelectValue(row.segment);
        const isCustom = sel === CUSTOM;
        return (
          <div
            key={i}
            className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-muted/20 p-3"
          >
            <div className="flex min-w-[160px] flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Role</span>
              <FieldSelect
                allowUnset={false}
                value={isCustom ? CUSTOM : sel}
                options={ROLE_OPTIONS}
                aria-label="Color role"
                triggerClassName="h-10 py-0"
                onChange={(v) => {
                  if (v === CUSTOM) updateRow(i, { segment: "" });
                  else if (v) updateRow(i, { segment: v });
                }}
              />
            </div>
            {isCustom && (
              <div className="flex min-w-[160px] flex-1 flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">
                  Custom role
                </span>
                <input
                  className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm text-card-foreground outline-none transition placeholder:text-muted-foreground focus:ring-2 focus:ring-primary"
                  value={row.segment}
                  onChange={(e) => updateRow(i, { segment: e.target.value })}
                  placeholder="e.g. Packaging"
                />
              </div>
            )}
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Color</span>
              <div className="flex items-center gap-2">
                <label
                  className="group/swatch relative inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-border bg-card transition hover:bg-muted/40 focus-within:ring-2 focus-within:ring-primary"
                  aria-label={`Color for ${row.segment || "swatch"}`}
                >
                  <span
                    className="block h-5 w-5 rounded-full border border-border/60 shadow-sm transition-opacity group-hover/swatch:opacity-0"
                    style={{ backgroundColor: pickerHex(row.hex) }}
                  />
                  <Pipette
                    aria-hidden
                    className="pointer-events-none absolute inset-0 m-auto h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover/swatch:opacity-100"
                  />
                  <input
                    type="color"
                    value={pickerHex(row.hex)}
                    onChange={(e) => updateRow(i, { hex: e.target.value })}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  />
                </label>
                <input
                  type="text"
                  className="h-10 w-32 rounded-xl border border-border bg-card px-3 font-mono text-xs text-card-foreground outline-none transition placeholder:text-muted-foreground focus:ring-2 focus:ring-primary"
                  value={row.hex}
                  onChange={(e) => updateRow(i, { hex: e.target.value })}
                  placeholder="#1a2b3c"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => removeRow(i)}
              className="ml-auto self-center rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Remove color"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}

      <div className="relative inline-block">
        <button
          ref={triggerRef}
          type="button"
          onClick={handleAddClick}
          aria-haspopup={availableSuggestions.length > 0 ? "menu" : undefined}
          aria-expanded={
            availableSuggestions.length > 0 ? pickerOpen : undefined
          }
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground hover:border-foreground/40 hover:text-foreground transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Add color
        </button>

        {pickerOpen && availableSuggestions.length > 0 && (
          <div
            ref={pickerRef}
            role="menu"
            className="absolute left-0 top-full z-30 mt-2 w-64 rounded-xl border border-border bg-card p-3 shadow-lg"
          >
            <div className="mb-2 text-xs font-medium text-muted-foreground">
              From your website
            </div>
            <div className="grid grid-cols-6 gap-2">
              {availableSuggestions.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    appendColor(hex);
                    setPickerOpen(false);
                  }}
                  className="group relative flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card transition hover:scale-105 hover:border-foreground/40"
                  title={hex}
                  aria-label={`Add ${hex}`}
                >
                  <span
                    className="block h-6 w-6 rounded-full border border-border/60 shadow-sm"
                    style={{ backgroundColor: pickerHex(hex) }}
                  />
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                appendColor("#64748b");
                setPickerOpen(false);
              }}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground transition hover:border-foreground/40 hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
              Add custom
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
