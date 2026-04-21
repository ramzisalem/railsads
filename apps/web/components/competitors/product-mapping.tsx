"use client";

import { useState, useTransition } from "react";
import { Link2, X, Package, StickyNote, Check } from "lucide-react";
import {
  linkProductToCompetitor,
  unlinkProductFromCompetitor,
  updateProductCompetitorLinkNotes,
} from "@/lib/competitors/actions";
import type {
  LinkedProductOption,
  ProductOption,
} from "@/lib/competitors/queries";

interface ProductMappingProps {
  brandId: string;
  competitorId: string;
  linkedProducts: LinkedProductOption[];
  allProducts: ProductOption[];
}

export function ProductMapping({
  brandId,
  competitorId,
  linkedProducts,
  allProducts,
}: ProductMappingProps) {
  const [isPending, startTransition] = useTransition();
  const [editingNoteFor, setEditingNoteFor] = useState<string | null>(null);

  const linkedIds = new Set(linkedProducts.map((p) => p.id));
  const unlinked = allProducts.filter((p) => !linkedIds.has(p.id));

  function handleLink(productId: string) {
    startTransition(async () => {
      await linkProductToCompetitor(brandId, competitorId, productId);
    });
  }

  function handleUnlink(productId: string) {
    startTransition(async () => {
      await unlinkProductFromCompetitor(competitorId, productId);
    });
  }

  return (
    <div className="panel space-y-4 p-6">
      <div>
        <h2 className="heading-md flex items-center gap-2">
          <Link2 className="h-4 w-4" />
          Competes for
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Which of OUR products this competitor sells against. Drives the
          per-product analyzer scope and Studio insight injection.
        </p>
      </div>

      {linkedProducts.length > 0 ? (
        <div className="space-y-2">
          {linkedProducts.map((p) => {
            const isEditing = editingNoteFor === p.id;
            return (
              <div
                key={p.id}
                className="rounded-lg border border-primary/20 bg-primary/5 p-3"
              >
                <div className="flex items-center gap-2">
                  <Package className="h-3.5 w-3.5 text-primary" />
                  <span className="flex-1 text-sm font-medium text-primary">
                    {p.name}
                  </span>
                  <button
                    onClick={() => setEditingNoteFor(isEditing ? null : p.id)}
                    className="rounded-sm p-1 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                    aria-label={p.link_notes ? "Edit overlap note" : "Add overlap note"}
                    title={p.link_notes ? "Edit overlap note" : "Add overlap note"}
                  >
                    <StickyNote className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => handleUnlink(p.id)}
                    disabled={isPending}
                    className="rounded-sm p-1 text-muted-foreground hover:bg-primary/10 hover:text-destructive transition-colors"
                    aria-label={`Unlink ${p.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
                {!isEditing && p.link_notes && (
                  <p className="mt-1 text-xs text-muted-foreground italic">
                    {p.link_notes}
                  </p>
                )}
                {isEditing && (
                  <NoteEditor
                    initial={p.link_notes ?? ""}
                    disabled={isPending}
                    onCancel={() => setEditingNoteFor(null)}
                    onSave={(value) => {
                      startTransition(async () => {
                        await updateProductCompetitorLinkNotes(
                          competitorId,
                          p.id,
                          value
                        );
                        setEditingNoteFor(null);
                      });
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No overlap declared yet. Pick the products this competitor goes
          head-to-head with.
        </p>
      )}

      {unlinked.length > 0 && (
        <div className="border-t pt-3">
          <p className="text-xs text-muted-foreground mb-2">
            Available products:
          </p>
          <div className="flex flex-wrap gap-2">
            {unlinked.map((p) => (
              <button
                key={p.id}
                onClick={() => handleLink(p.id)}
                disabled={isPending}
                className="tag hover:bg-muted transition-colors"
              >
                + {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {allProducts.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No products in your brand yet.
          Add products first to link them here.
        </p>
      )}
    </div>
  );
}

function NoteEditor({
  initial,
  disabled,
  onCancel,
  onSave,
}: {
  initial: string;
  disabled: boolean;
  onCancel: () => void;
  onSave: (value: string) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <div className="mt-2 space-y-2">
      <textarea
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={2}
        placeholder="Why they compete (positioning, price band, audience overlap, …)"
        className="input-field w-full text-xs"
        disabled={disabled}
      />
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={onCancel}
          disabled={disabled}
          className="text-[11px] text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
        <button
          onClick={() => onSave(value)}
          disabled={disabled}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          <Check className="h-3 w-3" />
          Save
        </button>
      </div>
    </div>
  );
}
