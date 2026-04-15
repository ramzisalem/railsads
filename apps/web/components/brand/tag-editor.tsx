"use client";

import { useState, useRef, useTransition } from "react";
import { Plus, X } from "lucide-react";

interface TagEditorProps {
  label: string;
  tags: string[];
  variant?: "default" | "primary";
  onSave: (tags: string[]) => Promise<{ error?: string }>;
}

export function TagEditor({
  label,
  tags,
  variant = "default",
  onSave,
}: TagEditorProps) {
  const [draft, setDraft] = useState("");
  const [isPending, startTransition] = useTransition();
  const [optimisticTags, setOptimisticTags] = useState<string[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const displayTags = optimisticTags ?? tags;

  function addTag() {
    const value = draft.trim();
    if (!value || displayTags.includes(value)) {
      setDraft("");
      return;
    }
    const next = [...displayTags, value];
    setDraft("");
    setOptimisticTags(next);
    startTransition(async () => {
      await onSave(next);
      setOptimisticTags(null);
    });
    inputRef.current?.focus();
  }

  function removeTag(tag: string) {
    const next = displayTags.filter((t) => t !== tag);
    setOptimisticTags(next);
    startTransition(async () => {
      await onSave(next);
      setOptimisticTags(null);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag();
    }
  }

  const tagClass =
    variant === "primary"
      ? "tag-primary flex items-center gap-1"
      : "tag flex items-center gap-1";

  return (
    <div className="space-y-2">
      {label && (
        <div className="text-xs text-muted-foreground">{label}</div>
      )}
      <div className="flex flex-wrap gap-2">
        {displayTags.map((tag) => (
          <span key={tag} className={tagClass}>
            {tag}
            <button
              onClick={() => removeTag(tag)}
              disabled={isPending}
              className="ml-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
              aria-label={`Remove ${tag}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <div className="flex items-center gap-1">
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add..."
            className="w-24 rounded-lg border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-primary transition"
            disabled={isPending}
          />
          <button
            onClick={addTag}
            disabled={isPending || !draft.trim()}
            className="rounded-lg p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40"
            aria-label="Add tag"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
