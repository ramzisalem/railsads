"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { Check, Pencil, X } from "lucide-react";

interface ColorChipProps {
  label: string;
  color: string | null;
  onSave: (color: string) => Promise<{ error?: string }>;
}

export function ColorChip({ label, color, onSave }: ColorChipProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(color ?? "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const textRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) textRef.current?.focus();
  }, [editing]);

  function startEdit() {
    setDraft(color ?? "#000000");
    setError(null);
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
    setError(null);
  }

  function save() {
    if (draft === color) {
      setEditing(false);
      return;
    }
    startTransition(async () => {
      const result = await onSave(draft);
      if (result?.error) {
        setError(result.error);
      } else {
        setEditing(false);
      }
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") cancel();
    if (e.key === "Enter") {
      e.preventDefault();
      save();
    }
  }

  if (editing) {
    return (
      <div className="space-y-1.5">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="h-8 w-8 cursor-pointer rounded-lg border-0 p-0"
            disabled={isPending}
          />
          <input
            ref={textRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            className="input-field w-28 font-mono text-xs"
            placeholder="#FF6A00"
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
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="group">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className="mt-1 flex items-center gap-2.5 rounded-lg px-2 py-1.5 -mx-2 cursor-pointer hover:bg-muted transition-colors"
        onClick={startEdit}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && startEdit()}
      >
        {color ? (
          <>
            <div
              className="h-6 w-6 shrink-0 rounded-md border shadow-sm"
              style={{ backgroundColor: color }}
            />
            <span className="text-sm font-mono">{color}</span>
          </>
        ) : (
          <span className="text-sm text-muted-foreground italic">Not set</span>
        )}
        <Pencil className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
}
