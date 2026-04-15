"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { InlineField } from "./inline-field";
import { updateBrandOverview, updateBrandProfile } from "@/lib/brand/actions";
import type { BrandOverview as BrandOverviewData, BrandProfile } from "@/lib/brand/queries";
import { Check, Globe, Pencil, X } from "lucide-react";

interface BrandOverviewProps {
  brand: BrandOverviewData;
  profile: BrandProfile | null;
}

function WebsiteField({
  brandId,
  url,
}: {
  brandId: string;
  url: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(url ?? "");
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function startEdit() {
    setDraft(url ?? "");
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
  }

  function save() {
    const trimmed = draft.trim();
    if (trimmed === (url ?? "")) {
      setEditing(false);
      return;
    }
    startTransition(async () => {
      const result = await updateBrandOverview(brandId, {
        website_url: trimmed || null,
      });
      if (!result?.error) setEditing(false);
    });
  }

  if (editing) {
    return (
      <div className="space-y-1.5">
        <div className="text-xs text-muted-foreground">Website</div>
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") cancel();
              if (e.key === "Enter") {
                e.preventDefault();
                save();
              }
            }}
            className="input-field flex-1"
            placeholder="https://example.com"
            disabled={isPending}
          />
          <button
            onClick={save}
            disabled={isPending}
            className="rounded-lg p-1.5 text-primary hover:bg-primary-soft transition-colors"
            aria-label="Save"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            onClick={cancel}
            disabled={isPending}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors"
            aria-label="Cancel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group">
      <div className="text-xs text-muted-foreground">Website</div>
      <div
        className="mt-1 flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 -mx-2 cursor-pointer hover:bg-muted transition-colors"
        onClick={startEdit}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && startEdit()}
      >
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            <Globe className="h-3.5 w-3.5" />
            {url.replace(/^https?:\/\//, "")}
          </a>
        ) : (
          <span className="text-sm text-muted-foreground italic">
            No website set
          </span>
        )}
        <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
}

export function BrandOverview({ brand, profile }: BrandOverviewProps) {
  return (
    <div className="panel space-y-5 p-6">
      <h2 className="heading-md">Overview</h2>

      <div className="space-y-4">
        <InlineField
          label="Brand name"
          value={brand.name}
          onSave={async (name) => updateBrandOverview(brand.id, { name })}
        />

        <WebsiteField brandId={brand.id} url={brand.website_url} />

        {profile && (
          <InlineField
            label="Short description"
            value={profile.description}
            placeholder="A brief description of your brand"
            multiline
            onSave={async (v) =>
              updateBrandProfile(brand.id, { description: v || null })
            }
          />
        )}
      </div>
    </div>
  );
}
