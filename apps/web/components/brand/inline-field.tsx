"use client";

import {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useTransition,
} from "react";
import { Check, Pencil, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface InlineFieldProps {
  label: string;
  value: string | null;
  placeholder?: string;
  multiline?: boolean;
  onSave: (value: string) => Promise<{ error?: string }>;
}

export function InlineField({
  label,
  value,
  placeholder = "Not set",
  multiline = false,
  onSave,
}: InlineFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  // Auto-grow the textarea to fit its content while editing.
  useLayoutEffect(() => {
    if (!editing) return;
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft, editing]);

  function startEdit() {
    setDraft(value ?? "");
    setError(null);
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
    setError(null);
  }

  function save() {
    const trimmed = draft.trim();
    if (trimmed === (value ?? "")) {
      setEditing(false);
      return;
    }
    startTransition(async () => {
      const result = await onSave(trimmed);
      if (result?.error) {
        setError(result.error);
      } else {
        setEditing(false);
      }
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") cancel();
    if (e.key === "Enter" && !multiline) {
      e.preventDefault();
      save();
    }
    if (e.key === "Enter" && e.metaKey && multiline) {
      e.preventDefault();
      save();
    }
  }

  if (editing) {
    return (
      <div className="space-y-1.5">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="flex items-start gap-2">
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={multiline ? 3 : 1}
            className="textarea-field flex-1 overflow-hidden [overflow-wrap:anywhere]"
            disabled={isPending}
          />
          <button
            onClick={save}
            disabled={isPending}
            className="mt-1 rounded-lg p-1.5 text-primary hover:bg-primary-soft transition-colors"
            aria-label="Save"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            onClick={cancel}
            disabled={isPending}
            className="mt-1 rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors"
            aria-label="Cancel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {error && (
          <p className="text-xs text-destructive">{error}</p>
        )}
      </div>
    );
  }

  return (
    <div className="group">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={cn(
          "mt-1 flex items-start justify-between gap-2 rounded-lg px-2 py-1.5 -mx-2 transition-colors cursor-pointer hover:bg-muted",
        )}
        onClick={startEdit}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && startEdit()}
      >
        <span
          className={cn(
            "min-w-0 flex-1 text-sm whitespace-pre-wrap [overflow-wrap:anywhere]",
            !value && "text-muted-foreground italic"
          )}
        >
          {value || placeholder}
        </span>
        <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-0.5" />
      </div>
    </div>
  );
}
