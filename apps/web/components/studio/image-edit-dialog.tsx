"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type SyntheticEvent,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  ArrowUp,
  Download,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";
import {
  DEFAULT_IMAGE_GEN_SIZE,
  type ImageGenSize,
} from "@/lib/studio/image-gen-sizes";
import type { GeneratedImage } from "@/lib/studio/types";
import { cn } from "@/lib/utils";
import {
  BillingError,
  fetchJson,
  isBillingError,
} from "@/lib/billing/client";
import { BillingErrorBanner } from "@/components/billing/billing-error-banner";

/**
 * A version of a generated image with the message metadata required to track
 * lineage. Each new edit becomes a new version pointing back at its parent.
 */
export interface ImageVersion {
  messageId: string;
  image: GeneratedImage;
  createdAt: string;
}

interface ImageEditDialogProps {
  open: boolean;
  onClose: () => void;
  brandId: string;
  threadId: string;
  /** The image the user clicked on (becomes the initially selected version). */
  initialMessageId: string;
  /** All generated images currently in the thread (for the versions rail). */
  versions: ImageVersion[];
}

/**
 * Map a loaded image's natural dimensions to one of the supported gpt-image-1
 * output sizes. We bucket by aspect ratio rather than exact pixels so an
 * arbitrary upload (or a slightly resized variant) still routes to the right
 * canvas, and the edited result preserves the source ratio without ever
 * asking the user to pick it.
 */
function inferSizeFromDimensions(
  width: number,
  height: number
): ImageGenSize {
  if (!width || !height) return DEFAULT_IMAGE_GEN_SIZE;
  const ratio = width / height;
  if (ratio > 1.2) return "1536x1024"; // landscape
  if (ratio < 0.85) return "1024x1536"; // portrait
  return "1024x1024"; // square / near-square
}

/**
 * Image editor modal — clicking any generated image in the thread opens this.
 * Mirrors the ChatGPT image editor:
 *   • Center stage: the active image, full bleed
 *   • Right rail: every version that's ever been generated for this thread
 *   • Bottom: a chat input ("Make the background darker") + Enter to send
 *
 * Each edit calls /api/image/edit which preserves the source image as a visual
 * reference, applies the user's instruction, then writes both a user message
 * (the instruction) and an assistant message (the new image) into the thread —
 * so the conversation log itself is the persistent edit history.
 */
export function ImageEditDialog({
  open,
  onClose,
  brandId,
  threadId,
  initialMessageId,
  versions,
}: ImageEditDialogProps) {
  const router = useRouter();
  const [activeMessageId, setActiveMessageId] = useState(initialMessageId);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [billingError, setBillingError] = useState<BillingError | null>(null);
  const [mounted, setMounted] = useState(false);
  // Aspect ratio is auto-derived from the active image's natural dimensions
  // (see `handleImageLoad`) so an edit always preserves the source ratio.
  // Brief context (product / audience / angle / awareness) stays at the
  // thread level — the edit API restates it on every call from the DB.
  const [imageSize, setImageSize] = useState<ImageGenSize>(
    DEFAULT_IMAGE_GEN_SIZE
  );
  const inputRef = useRef<HTMLTextAreaElement>(null);

  function handleImageLoad(e: SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget;
    setImageSize(
      inferSizeFromDimensions(img.naturalWidth, img.naturalHeight)
    );
  }

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Reset selection / scrollback when the modal is reopened on a different
  // image so the editor always starts on what the user clicked.
  useEffect(() => {
    if (open) {
      setActiveMessageId(initialMessageId);
      setError(null);
      setBillingError(null);
      setDraft("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, initialMessageId]);

  // We intentionally do NOT auto-derive the ratio from the active version —
  // the storage path doesn't carry size info, and resetting on every click
  // would feel unpredictable. The user picks a ratio once per session; that
  // selection persists until they change it.

  useEffect(() => {
    if (!open) return;
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape" && !editing) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, editing, onClose]);

  // Sort versions newest-first for the rail; the chat-history view (left
  // column) reads newest-last so the conversation reads naturally.
  const orderedVersions = useMemo(
    () =>
      [...versions].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [versions]
  );

  const activeVersion =
    orderedVersions.find((v) => v.messageId === activeMessageId) ??
    orderedVersions[0];

  async function submitEdit(prompt: string) {
    if (!prompt.trim() || editing || !activeVersion) return;
    setEditing(true);
    setError(null);
    setBillingError(null);
    try {
      const res = await fetch("/api/image/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId,
          threadId,
          parentMessageId: activeVersion.messageId,
          prompt: prompt.trim(),
          size: imageSize,
        }),
      });
      const data = await fetchJson<{ messageId?: string }>(res);
      setDraft("");
      // Refresh the thread so the new versions show up in the rail. We also
      // optimistically pre-select the just-created version so the user sees
      // their result immediately when the refresh resolves.
      if (data.messageId) setActiveMessageId(data.messageId);
      router.refresh();
    } catch (err) {
      if (isBillingError(err)) {
        setBillingError(err);
      } else {
        setError(err instanceof Error ? err.message : "Edit failed");
      }
    } finally {
      setEditing(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    submitEdit(draft);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitEdit(draft);
    }
  }

  if (!mounted || !open || !activeVersion) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-stretch bg-background/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Edit image"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !editing) onClose();
      }}
    >
      <div className="relative m-3 flex flex-1 overflow-hidden rounded-2xl border border-border bg-card shadow-xl sm:m-6">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-card/80 text-muted-foreground backdrop-blur transition-colors hover:bg-card hover:text-foreground"
          aria-label="Close image editor"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 items-center justify-center bg-muted/30 p-4 sm:p-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeVersion.image.url}
              alt={activeVersion.image.prompt ?? "Generated image"}
              onLoad={handleImageLoad}
              className="max-h-full max-w-full rounded-xl border border-border object-contain shadow-sm"
            />
          </div>

          <div className="shrink-0 border-t border-border bg-card">
            {billingError && (
              <div className="border-b border-border/60 px-4 py-2 sm:px-6">
                <BillingErrorBanner
                  error={billingError}
                  onDismiss={() => setBillingError(null)}
                />
              </div>
            )}
            {error && (
              <div className="border-b border-border/60 bg-destructive/10 px-4 py-2 text-xs text-destructive sm:px-6">
                {error}
              </div>
            )}
            <div className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
              <p
                className="min-w-0 flex-1 truncate text-xs text-muted-foreground"
                title={activeVersion.image.prompt ?? undefined}
              >
                {activeVersion.image.edit_prompt
                  ? `Edit: ${activeVersion.image.edit_prompt}`
                  : activeVersion.image.prompt}
              </p>
              <a
                href={activeVersion.image.url}
                target="_blank"
                rel="noopener noreferrer"
                download
                className="flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Download className="h-3 w-3" />
                Download
              </a>
            </div>
            <form
              onSubmit={handleSubmit}
              className="border-t border-border/60 px-3 pb-3 pt-2 sm:px-4 sm:pb-4"
            >
              <div className="flex w-full items-end gap-2 rounded-2xl border border-border bg-background px-3 py-1.5 focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-ring/50">
                <span
                  className="flex h-10 shrink-0 items-center text-muted-foreground"
                  aria-hidden
                >
                  <Sparkles className="h-4 w-4" />
                </span>
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={editing}
                  placeholder="Describe a change… (e.g. make the background darker)"
                  className="min-h-10 flex-1 resize-none border-0 bg-transparent py-2 text-sm leading-snug text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={editing || !draft.trim()}
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors",
                    editing || !draft.trim()
                      ? "bg-muted text-muted-foreground"
                      : "bg-primary text-primary-foreground hover:bg-primary/90"
                  )}
                  aria-label="Send edit"
                >
                  {editing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowUp className="h-4 w-4" />
                  )}
                </button>
              </div>
              <p className="mt-1.5 text-[10px] text-muted-foreground">
                Each edit uses <span className="font-medium text-foreground">25 credits</span> (same as generating a new image). Enter to send ·
                Shift+Enter for newline · the source image stays as a visual reference.
              </p>
            </form>
          </div>
        </div>

        <aside className="hidden w-64 shrink-0 flex-col border-l border-border bg-muted/20 md:flex">
          <div className="shrink-0 border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">
              Versions
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {orderedVersions.length}{" "}
              {orderedVersions.length === 1 ? "image" : "images"} in this
              thread
            </p>
          </div>
          <ul className="flex-1 space-y-2 overflow-y-auto p-3">
            {orderedVersions.map((v, i) => {
              const isActive = v.messageId === activeMessageId;
              const versionNumber = orderedVersions.length - i; // newest = highest
              return (
                <li key={v.messageId}>
                  <button
                    type="button"
                    onClick={() => setActiveMessageId(v.messageId)}
                    className={cn(
                      "group flex w-full flex-col gap-1.5 rounded-xl border p-1.5 text-left transition-colors",
                      isActive
                        ? "border-primary bg-primary-soft/40"
                        : "border-border bg-card hover:border-primary/40 hover:bg-primary-soft/20"
                    )}
                  >
                    <div className="relative overflow-hidden rounded-lg">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={v.image.url}
                        alt={`Version ${versionNumber}`}
                        className="h-32 w-full object-cover"
                        loading="lazy"
                      />
                      <span
                        className={cn(
                          "absolute left-1.5 top-1.5 rounded-md px-1.5 py-0.5 text-[10px] font-medium",
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "bg-card/90 text-muted-foreground backdrop-blur"
                        )}
                      >
                        v{versionNumber}
                      </span>
                    </div>
                    <p className="line-clamp-2 px-1 text-[11px] leading-snug text-muted-foreground">
                      {v.image.edit_prompt ??
                        (v.image.parent_asset_id
                          ? "Edited version"
                          : "Original")}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>
      </div>
    </div>,
    document.body
  );
}
