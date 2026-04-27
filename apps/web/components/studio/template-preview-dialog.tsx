"use client";

import { useEffect } from "react";
import Image from "next/image";
import { LayoutTemplate, X } from "lucide-react";
import type { TemplateOption } from "@/lib/studio/types";

interface TemplatePreviewDialogProps {
  template: TemplateOption;
  onClose: () => void;
}

/**
 * Read-only modal that shows a template thumbnail at full size alongside its
 * name + description. The grid tile is too small to judge a layout from, so
 * we surface this as an "expand" affordance on hover.
 */
export function TemplatePreviewDialog({
  template,
  onClose,
}: TemplatePreviewDialogProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-preview-title"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      >
        <div className="flex w-full max-w-3xl max-h-[min(92vh,48rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-panel">
          <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div className="min-w-0">
              <h2
                id="template-preview-title"
                className="truncate text-base font-semibold text-card-foreground"
              >
                {template.name}
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {template.category && (
                  <span className="inline-flex items-center rounded-full bg-secondary-soft px-2 py-0.5 font-medium uppercase tracking-wide text-foreground/80">
                    {template.category.replace(/_/g, " ")}
                  </span>
                )}
                <span className="inline-flex items-center rounded-full bg-secondary-soft px-2 py-0.5 font-medium uppercase tracking-wide text-foreground/80">
                  {template.is_system ? "System" : "Custom"}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto">
            <div className="relative flex aspect-square w-full items-center justify-center bg-secondary-soft">
              {template.thumbnail_url ? (
                <Image
                  src={template.thumbnail_url}
                  alt={template.name}
                  fill
                  sizes="(max-width: 768px) 100vw, 48rem"
                  className="object-contain"
                  unoptimized
                  priority
                />
              ) : (
                <LayoutTemplate className="h-12 w-12 text-muted-foreground" />
              )}
            </div>

            {template.description && (
              <div className="border-t border-border px-5 py-4">
                <p className="text-sm leading-relaxed text-foreground/90">
                  {template.description}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
