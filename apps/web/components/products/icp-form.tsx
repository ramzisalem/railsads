"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  Heart,
  Plus,
  Sparkles,
  ShieldAlert,
  Trash2,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { createIcp, updateIcp } from "@/lib/products/icp-actions";
import type { IcpItem } from "@/lib/products/queries";

interface IcpFormProps {
  brandId: string;
  productId: string;
  icp?: IcpItem | null;
  onClose: () => void;
}

export function IcpForm({ brandId, productId, icp, onClose }: IcpFormProps) {
  const isEdit = !!icp;
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = useState(icp?.title ?? "");
  const [summary, setSummary] = useState(icp?.summary ?? "");
  const [pains, setPains] = useState<string[]>(icp?.pains ?? []);
  const [desires, setDesires] = useState<string[]>(icp?.desires ?? []);
  const [objections, setObjections] = useState<string[]>(icp?.objections ?? []);
  const [triggers, setTriggers] = useState<string[]>(icp?.triggers ?? []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !isPending) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isPending, onClose]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError("Title is required");
      return;
    }

    startTransition(async () => {
      const data = {
        title: cleanTitle,
        summary: summary.trim() || null,
        pains: pains.map((p) => p.trim()).filter(Boolean),
        desires: desires.map((p) => p.trim()).filter(Boolean),
        objections: objections.map((p) => p.trim()).filter(Boolean),
        triggers: triggers.map((p) => p.trim()).filter(Boolean),
      };
      const result = isEdit
        ? await updateIcp(icp.id, productId, data)
        : await createIcp(brandId, productId, data);

      if (result.error) {
        setError(result.error);
      } else {
        onClose();
      }
    });
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-foreground/30 backdrop-blur-sm"
        onClick={() => !isPending && onClose()}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-panel">
          <header className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
            <div>
              <h2 className="heading-md">
                {isEdit ? "Edit audience" : "Add audience"}
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Describe who they are and what drives their decision.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          <form
            id="icp-form"
            onSubmit={handleSubmit}
            className="flex-1 space-y-6 overflow-y-auto px-6 py-5"
          >
            {error && (
              <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <section className="space-y-4">
              <div>
                <label
                  htmlFor="icp-title"
                  className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  Title
                </label>
                <input
                  id="icp-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="input-field mt-1.5 text-base font-medium"
                  placeholder="e.g., Parents of picky eaters"
                  required
                  disabled={isPending}
                />
              </div>

              <div>
                <label
                  htmlFor="icp-summary"
                  className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  Summary
                </label>
                <textarea
                  id="icp-summary"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  className="textarea-field mt-1.5"
                  rows={3}
                  placeholder="One or two sentences describing this audience."
                  disabled={isPending}
                />
              </div>
            </section>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <ListEditor
                label="Pains"
                icon={Heart}
                accent="text-rose-500 bg-rose-500/10"
                items={pains}
                setItems={setPains}
                placeholder="What frustrates them?"
                disabled={isPending}
              />
              <ListEditor
                label="Desires"
                icon={Sparkles}
                accent="text-primary bg-primary-soft"
                items={desires}
                setItems={setDesires}
                placeholder="What outcome do they want?"
                disabled={isPending}
              />
              <ListEditor
                label="Objections"
                icon={ShieldAlert}
                accent="text-amber-600 bg-amber-500/10"
                items={objections}
                setItems={setObjections}
                placeholder="What might hold them back?"
                disabled={isPending}
              />
              <ListEditor
                label="Triggers"
                icon={Zap}
                accent="text-violet-600 bg-violet-500/10"
                items={triggers}
                setItems={setTriggers}
                placeholder="What makes them buy now?"
                disabled={isPending}
              />
            </div>
          </form>

          <footer className="flex items-center justify-end gap-3 border-t border-border bg-card/60 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="icp-form"
              disabled={isPending}
              className="btn-primary"
            >
              {isPending
                ? isEdit
                  ? "Saving..."
                  : "Creating..."
                : isEdit
                  ? "Save changes"
                  : "Create audience"}
            </button>
          </footer>
        </div>
      </div>
    </>
  );
}

interface ListEditorProps {
  label: string;
  icon: LucideIcon;
  /** Tailwind classes for the icon chip background + text color. */
  accent: string;
  items: string[];
  setItems: (next: string[]) => void;
  placeholder: string;
  disabled?: boolean;
}

function ListEditor({
  label,
  icon: Icon,
  accent,
  items,
  setItems,
  placeholder,
  disabled,
}: ListEditorProps) {
  const [draft, setDraft] = useState("");
  const draftRef = useRef<HTMLTextAreaElement>(null);

  function updateAt(index: number, value: string) {
    const next = items.slice();
    next[index] = value;
    setItems(next);
  }

  function removeAt(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  function commitDraft() {
    const value = draft.trim();
    if (!value) return;
    setItems([...items, value]);
    setDraft("");
    requestAnimationFrame(() => draftRef.current?.focus());
  }

  function handleDraftKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      commitDraft();
    }
  }

  function handleItemKey(
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    index: number
  ) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      draftRef.current?.focus();
    } else if (
      e.key === "Backspace" &&
      (e.currentTarget.value ?? "").length === 0
    ) {
      e.preventDefault();
      removeAt(index);
      requestAnimationFrame(() => draftRef.current?.focus());
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-secondary-soft/40 p-4">
      <div className="flex items-center gap-2">
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-md ${accent}`}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        {items.length > 0 && (
          <span className="ml-auto text-[11px] text-muted-foreground">
            {items.length}
          </span>
        )}
      </div>

      <ul className="mt-3 space-y-1.5">
        {items.map((value, index) => (
          <li key={index} className="group flex items-start gap-2">
            <span className="mt-3 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" />
            <AutoGrowTextarea
              value={value}
              onChange={(v) => updateAt(index, v)}
              onKeyDown={(e) => handleItemKey(e, index)}
              disabled={disabled}
              placeholder={placeholder}
            />
            <button
              type="button"
              onClick={() => removeAt(index)}
              disabled={disabled}
              className="mt-1 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-destructive group-hover:opacity-100 focus:opacity-100"
              aria-label={`Remove ${label} item`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-2 flex items-start gap-2">
        <Plus className="mt-3 h-3 w-3 shrink-0 text-muted-foreground/60" />
        <AutoGrowTextarea
          ref={draftRef}
          value={draft}
          onChange={setDraft}
          onKeyDown={handleDraftKey}
          onBlur={commitDraft}
          disabled={disabled}
          placeholder={items.length === 0 ? placeholder : "Add another..."}
        />
      </div>
    </div>
  );
}

interface AutoGrowTextareaProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
}

const AutoGrowTextarea = forwardRef<HTMLTextAreaElement, AutoGrowTextareaProps>(
  function AutoGrowTextarea(
    { value, onChange, onKeyDown, onBlur, placeholder, disabled },
    ref
  ) {
    const innerRef = useRef<HTMLTextAreaElement>(null);
    useImperativeHandle(ref, () => innerRef.current as HTMLTextAreaElement);

    useLayoutEffect(() => {
      const el = innerRef.current;
      if (!el) return;
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }, [value]);

    return (
      <textarea
        ref={innerRef}
        rows={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        disabled={disabled}
        placeholder={placeholder}
        className="flex-1 resize-none overflow-hidden rounded-md border border-transparent bg-transparent px-2 py-1 text-sm leading-relaxed text-card-foreground outline-none transition placeholder:text-muted-foreground hover:border-border focus:border-border focus:bg-card focus:ring-1 focus:ring-primary"
      />
    );
  }
);
