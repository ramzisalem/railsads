"use client";

import { useState, useRef, useTransition } from "react";
import { Plus, X } from "lucide-react";

interface TagEditorProps {
  label: string;
  tags: string[];
  variant?: "default" | "primary";
  /** Async server-action save; when present, edits are debounced via a transition. */
  onSave?: (tags: string[]) => Promise<{ error?: string }>;
  /** Controlled local edits; use instead of `onSave` when persisting later (e.g. wizards). */
  onChange?: (tags: string[]) => void;
  placeholder?: string;
  /** Tailwind class for the input width (default: `w-40`). */
  inputWidthClassName?: string;
}

export function TagEditor({
  label,
  tags,
  variant = "default",
  onSave,
  onChange,
  placeholder = "Add...",
  inputWidthClassName = "w-40",
}: TagEditorProps) {
  const [draft, setDraft] = useState("");
  const [isPending, startTransition] = useTransition();
  const [optimisticTags, setOptimisticTags] = useState<string[] | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const displayTags = optimisticTags ?? tags;

  function commit(next: string[]) {
    if (onChange) {
      onChange(next);
      return;
    }
    if (onSave) {
      setOptimisticTags(next);
      startTransition(async () => {
        await onSave(next);
        setOptimisticTags(null);
      });
    }
  }

  function addTag() {
    const value = draft.trim();
    if (!value || displayTags.includes(value)) {
      setDraft("");
      return;
    }
    const next = [...displayTags, value];
    setDraft("");
    commit(next);
    inputRef.current?.focus();
  }

  function openAdder() {
    setIsAdding(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function closeAdder() {
    setIsAdding(false);
    setDraft("");
  }

  function removeTag(tag: string) {
    const next = displayTags.filter((t) => t !== tag);
    commit(next);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag();
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeAdder();
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
              className="ml-0.5 rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
              aria-label={`Remove ${tag}`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
        {isAdding ? (
          <div className="flex items-center gap-1">
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={() => {
                if (!draft.trim()) closeAdder();
              }}
              placeholder={placeholder}
              className={`${inputWidthClassName} rounded-full border border-border bg-card px-3.5 py-1.5 text-sm text-card-foreground outline-none transition placeholder:text-muted-foreground focus:ring-1 focus:ring-primary`}
              disabled={isPending}
            />
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={addTag}
              disabled={isPending || !draft.trim()}
              className="rounded-full p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40"
              aria-label="Add tag"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={openAdder}
            disabled={isPending}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground hover:border-foreground/40 hover:text-foreground transition-colors disabled:opacity-40"
            aria-label={placeholder}
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
        )}
      </div>
    </div>
  );
}
