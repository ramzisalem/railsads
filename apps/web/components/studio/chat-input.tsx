"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useLayoutEffect,
} from "react";
import { ImagePlus, Send, X, Sparkles, Type, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ComposerMode } from "@/lib/validation/schemas";

const MAX_FILES = 4;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
/** Max textarea height before scroll (px) — ChatGPT-style multi-line growth. */
const TEXTAREA_MAX_HEIGHT = 280;

interface ChatInputProps {
  brandId: string;
  threadId: string;
  onSend: (
    message: string,
    attachmentUrls: string[],
    mode: ComposerMode
  ) => Promise<void>;
  disabled?: boolean;
  /** Parent supplies top border (e.g. with chat context strip above) */
  embedded?: boolean;
  /**
   * Composer mode controls what the assistant produces for this turn:
   *   - `full`  : structured copy + auto-chained image (default)
   *   - `copy`  : copy only, skip the image (saves credits, faster)
   *   - `image` : skip copy, generate the image directly from the prompt
   * Lifted to the parent so it persists across turns within a session.
   */
  mode: ComposerMode;
  onModeChange: (mode: ComposerMode) => void;
}

const MODE_OPTIONS: {
  value: ComposerMode;
  label: string;
  hint: string;
  icon: React.ReactNode;
}[] = [
  {
    value: "full",
    label: "Full ad",
    hint: "Copy + image",
    icon: <Sparkles className="h-3 w-3" />,
  },
  {
    value: "copy",
    label: "Copy only",
    hint: "Skip image",
    icon: <Type className="h-3 w-3" />,
  },
  {
    value: "image",
    label: "Image only",
    hint: "Skip copy",
    icon: <ImageIcon className="h-3 w-3" />,
  },
];

type PendingFile = {
  id: string;
  file: File;
  previewUrl: string;
};

export function ChatInput({
  brandId,
  threadId,
  onSend,
  disabled,
  embedded,
  mode,
  onModeChange,
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const revokePreviews = useCallback((items: PendingFile[]) => {
    for (const p of items) {
      URL.revokeObjectURL(p.previewUrl);
    }
  }, []);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [threadId]);

  const pendingRef = useRef(pending);
  pendingRef.current = pending;

  useEffect(() => {
    return () => {
      revokePreviews(pendingRef.current);
    };
  }, [revokePreviews]);

  useEffect(() => {
    setPending((prev) => {
      revokePreviews(prev);
      return [];
    });
    setUploadError(null);
  }, [threadId, revokePreviews]);

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, TEXTAREA_MAX_HEIGHT) + "px";
  }, []);

  useLayoutEffect(() => {
    autoResize();
  }, [value, threadId, autoResize]);

  function addFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    setUploadError(null);
    const next: PendingFile[] = [];
    for (const file of Array.from(fileList)) {
      if (pending.length + next.length >= MAX_FILES) break;
      if (!file.type.startsWith("image/")) {
        setUploadError("Only image files are supported.");
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        setUploadError("Each image must be 10MB or smaller.");
        continue;
      }
      next.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        previewUrl: URL.createObjectURL(file),
      });
    }
    if (next.length) setPending((p) => [...p, ...next]);
    if (fileRef.current) fileRef.current.value = "";
  }

  function removePending(id: string) {
    setPending((p) => {
      const item = p.find((x) => x.id === id);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return p.filter((x) => x.id !== id);
    });
  }

  async function handleSubmit() {
    const trimmed = value.trim();
    if ((!trimmed && pending.length === 0) || isSending || disabled) return;

    setUploadError(null);
    setIsSending(true);

    const uploadedUrls: string[] = [];
    const pendingSnapshot = [...pending];

    try {
      for (const p of pendingSnapshot) {
        const fd = new FormData();
        fd.append("file", p.file);
        fd.append("brandId", brandId);
        fd.append("threadId", threadId);
        const res = await fetch("/api/studio/chat-attachment", {
          method: "POST",
          body: fd,
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          url?: string;
        };
        if (!res.ok) {
          throw new Error(data.error || "Upload failed");
        }
        if (!data.url) throw new Error("No image URL returned");
        uploadedUrls.push(data.url);
      }

      setValue("");
      setPending([]);
      revokePreviews(pendingSnapshot);
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }

      await onSend(trimmed, uploadedUrls, mode);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setIsSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  const isDisabled = isSending || disabled;
  const canSend =
    (value.trim().length > 0 || pending.length > 0) && !isDisabled;

  return (
    <div
      className={cn(
        "bg-card px-4 py-3 sm:px-6",
        embedded ? "border-0 pt-2" : "border-t border-border"
      )}
    >
      {uploadError && (
        <p className="mb-2 text-xs text-destructive" role="alert">
          {uploadError}
        </p>
      )}
      {pending.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {pending.map((p) => (
            <div
              key={p.id}
              className="relative h-14 w-14 overflow-hidden rounded-lg border border-border bg-muted"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.previewUrl}
                alt=""
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => removePending(p.id)}
                disabled={isDisabled}
                className="absolute right-0.5 top-0.5 rounded bg-background/90 p-0.5 text-muted-foreground shadow hover:text-foreground"
                aria-label="Remove attachment"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-full bg-muted/40 p-0.5">
          {MODE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={isDisabled}
              onClick={() => onModeChange(opt.value)}
              title={opt.hint}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50",
                mode === opt.value
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>
        <span className="text-[10px] text-muted-foreground">
          {MODE_OPTIONS.find((o) => o.value === mode)?.hint}
        </span>
      </div>
      <div
        className={cn(
          "flex w-full items-end gap-1.5 rounded-[1.75rem] border border-border bg-muted/25 p-1.5 shadow-sm",
          "focus-within:border-primary/35 focus-within:bg-muted/35 focus-within:ring-2 focus-within:ring-primary/15"
        )}
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          multiple
          className="sr-only"
          aria-hidden
          tabIndex={-1}
          onChange={(e) => addFiles(e.target.files)}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={isDisabled || pending.length >= MAX_FILES}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground disabled:opacity-40"
          aria-label="Attach image"
          title="Attach image"
        >
          <ImagePlus className="h-[1.125rem] w-[1.125rem]" />
        </button>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask for changes or improvements..."
          rows={1}
          disabled={isDisabled}
          style={{ maxHeight: TEXTAREA_MAX_HEIGHT }}
          className={cn(
            "min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-5 outline-none",
            "placeholder:text-muted-foreground",
            "disabled:opacity-50",
            "overflow-y-auto"
          )}
        />
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={!canSend}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
          aria-label="Send message"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
