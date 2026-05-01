"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from "react";
import Image from "next/image";
import { Folder, ImagePlus, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TemplateFolder, TemplateOption } from "@/lib/studio/types";

interface TemplateUploadDialogProps {
  brandId: string;
  /** Folders available to place this template into. Must be non-empty —
   *  the picker refuses to open the dialog if the brand has no folders
   *  yet. */
  folders: TemplateFolder[];
  /** Pre-selected folder id (usually the folder the user is currently
   *  viewing in the picker). Falls back to the first folder. */
  initialFolderId?: string | null;
  onClose: () => void;
  onCreated: (template: TemplateOption) => void;
}

const ALLOWED = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);
const MAX_BYTES = 10 * 1024 * 1024;

export function TemplateUploadDialog({
  brandId,
  folders,
  initialFolderId,
  onClose,
  onCreated,
}: TemplateUploadDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Default to the folder the user is already looking at; failing that,
  // the first folder alphabetically. We never start with "no folder" —
  // the server requires one on submit.
  const [folderId, setFolderId] = useState<string>(() => {
    if (initialFolderId && folders.some((f) => f.id === initialFolderId)) {
      return initialFolderId;
    }
    return folders[0]?.id ?? "";
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const acceptFile = useCallback((next: File | null) => {
    setError(null);
    if (!next) {
      setFile(null);
      return;
    }
    if (!ALLOWED.has(next.type)) {
      setError("Use a PNG, JPEG, WebP, or GIF image.");
      return;
    }
    if (next.size > MAX_BYTES) {
      setError("Image must be 10 MB or smaller.");
      return;
    }
    setFile(next);
  }, []);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    acceptFile(e.target.files?.[0] ?? null);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    acceptFile(e.dataTransfer.files?.[0] ?? null);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Give the template a name.");
      return;
    }
    if (!file) {
      setError("Add a thumbnail image.");
      return;
    }
    if (!folderId) {
      setError("Pick a folder for this template.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("brandId", brandId);
      formData.append("name", trimmedName);
      formData.append("description", description.trim());
      formData.append("folderId", folderId);
      formData.append("file", file);

      const res = await fetch("/api/studio/templates", {
        method: "POST",
        body: formData,
      });

      const json = (await res.json().catch(() => ({}))) as {
        template?: TemplateOption;
        error?: string;
      };

      if (!res.ok || !json.template) {
        setError(json.error || "Upload failed");
        return;
      }

      onCreated(json.template);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-foreground/30 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-upload-title"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      >
        <form
          onSubmit={handleSubmit}
          className="flex w-full max-w-lg max-h-[min(90vh,40rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-panel"
        >
          <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div>
              <h2
                id="template-upload-title"
                className="text-base font-semibold text-card-foreground"
              >
                Add template
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Upload an ad layout you like — the AI will reuse its
                composition for new generations.
              </p>
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

          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={cn(
                "relative flex aspect-square w-full flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed text-center transition-colors",
                isDragging
                  ? "border-primary bg-primary-soft/30"
                  : preview
                    ? "border-border bg-secondary-soft"
                    : "border-border bg-secondary-soft hover:border-primary/40"
              )}
            >
              {preview ? (
                <>
                  <Image
                    src={preview}
                    alt="Template preview"
                    fill
                    sizes="(max-width: 640px) 100vw, 32rem"
                    className="object-contain"
                    unoptimized
                  />
                  <button
                    type="button"
                    onClick={() => acceptFile(null)}
                    className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-foreground/70 px-2 py-1 text-[11px] font-medium text-background shadow-sm transition-colors hover:bg-foreground"
                  >
                    <X className="h-3 w-3" />
                    Remove
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-full w-full flex-col items-center justify-center gap-2 px-6 py-10 text-sm text-muted-foreground"
                >
                  <ImagePlus className="h-8 w-8" />
                  <span className="font-medium text-foreground">
                    Drop an image here
                  </span>
                  <span className="text-xs text-muted-foreground">
                    or click to browse · PNG, JPG, WebP up to 10 MB
                  </span>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept={Array.from(ALLOWED).join(",")}
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            <div>
              <label
                htmlFor="template-name"
                className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                Name
              </label>
              <input
                id="template-name"
                ref={nameInputRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                placeholder="e.g. Side-by-side comparison"
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring/40"
              />
            </div>

            <div>
              <label
                htmlFor="template-folder"
                className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                Folder
              </label>
              <div className="relative">
                <Folder className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <select
                  id="template-folder"
                  value={folderId}
                  onChange={(e) => setFolderId(e.target.value)}
                  disabled={submitting}
                  className="w-full appearance-none rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm text-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring/40 disabled:opacity-50"
                >
                  {folders.map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="template-description"
                className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                Description (optional)
              </label>
              <textarea
                id="template-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="What makes this layout work?"
                className="w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring/40"
              />
            </div>

            {error && (
              <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
          </div>

          <footer className="flex items-center justify-end gap-2 border-t border-border bg-secondary-soft/40 px-5 py-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim() || !file || !folderId}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {submitting ? "Uploading…" : "Save template"}
            </button>
          </footer>
        </form>
      </div>
    </>
  );
}
