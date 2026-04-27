"use client";

import {
  Copy,
  Check,
  RefreshCw,
  ClipboardCopy,
  ImageIcon,
  Loader2,
  Download,
  Pencil,
  ChevronDown,
} from "lucide-react";
import { useState } from "react";
import type {
  GeneratedImage,
  MessageItem,
  StructuredPayload,
} from "@/lib/studio/types";
import { cn } from "@/lib/utils";

interface MessageBlockProps {
  message: MessageItem;
  /**
   * When the next assistant message in the timeline is a freshly-chained
   * `generated_image`, the parent <Conversation /> consumes that message and
   * forwards its payload here so we render ONE ad card instead of two.
   */
  groupedImage?: { messageId: string; image: GeneratedImage } | null;
  /**
   * True while the auto-chained image generation for this card is in-flight.
   * Renders a skeleton in the hero slot of the AdCard.
   */
  imageGenerating?: boolean;
  /**
   * Persist the user's pick for a given section (hook / headline / body) AND
   * regenerate the ad with that pick locked in. The wired handler in
   * <Conversation /> calls `saveCreativeVersion` and then sends a chat
   * message that triggers a creative revision + auto-chained image regen.
   */
  onRegenerateWith?: (
    messageId: string,
    field: "selectedHook" | "selectedHeadline" | "selectedPrimaryText",
    value: string,
    sectionLabel: "hook" | "headline" | "body"
  ) => void;
  /**
   * Manually trigger image generation for an existing creative card. Passed
   * the `image_prompt` and the parent message id so the in-flight skeleton
   * lands on the right card.
   */
  onGenerateImage?: (prompt: string, messageId?: string) => Promise<void>;
  /** Click an image to open the editor — wired from <Conversation />. */
  onOpenImageEditor?: (messageId: string) => void;
}

export function MessageBlock({
  message,
  groupedImage,
  imageGenerating,
  onRegenerateWith,
  onGenerateImage,
  onOpenImageEditor,
}: MessageBlockProps) {
  if (message.role === "system") {
    const errorPayload = message.structured_payload as
      | { error?: { kind?: string; message?: string } }
      | null;
    const isError = !!errorPayload?.error;
    if (isError) {
      return (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-[10px] font-bold">
            !
          </span>
          <span className="min-w-0 flex-1">{message.content}</span>
        </div>
      );
    }
    return (
      <div className="text-center text-xs text-muted-foreground py-2">
        {message.content}
      </div>
    );
  }

  if (message.role === "user") {
    const payload = message.structured_payload;
    const attachments =
      payload &&
      typeof payload === "object" &&
      Array.isArray((payload as { attachments?: unknown }).attachments)
        ? ((
            payload as {
              attachments: Array<{ type?: string; url?: string }>;
            }
          ).attachments.filter(
            (a) => a?.type === "image" && typeof a?.url === "string"
          ) as { type: "image"; url: string }[])
        : [];
    return (
      <UserMessage
        content={message.content ?? ""}
        attachments={attachments}
      />
    );
  }

  return (
    <AssistantMessage
      messageId={message.id}
      content={message.content}
      payload={message.structured_payload}
      groupedImage={groupedImage ?? null}
      imageGenerating={imageGenerating ?? false}
      onRegenerateWith={onRegenerateWith}
      onGenerateImage={onGenerateImage}
      onOpenImageEditor={onOpenImageEditor}
    />
  );
}

function UserMessage({
  content,
  attachments = [],
}: {
  content: string;
  attachments?: { type: "image"; url: string }[];
}) {
  return (
    <div className="rounded-2xl bg-muted px-5 py-4 sm:px-6 sm:py-5">
      {attachments.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {attachments.map((a, i) => (
            <a
              key={`${a.url}-${i}`}
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block overflow-hidden rounded-lg border border-border"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={a.url}
                alt="Attachment"
                className="max-h-40 max-w-[min(100%,280px)] object-cover"
                loading="lazy"
              />
            </a>
          ))}
        </div>
      )}
      {content ? (
        <p className="text-sm whitespace-pre-wrap">{content}</p>
      ) : attachments.length > 0 ? (
        <p className="text-xs text-muted-foreground">Image reference</p>
      ) : null}
    </div>
  );
}

function AssistantMessage({
  messageId,
  content,
  payload,
  groupedImage,
  imageGenerating,
  onRegenerateWith,
  onGenerateImage,
  onOpenImageEditor,
}: {
  messageId: string;
  content: string | null;
  payload: StructuredPayload | null;
  groupedImage: { messageId: string; image: GeneratedImage } | null;
  imageGenerating: boolean;
  onRegenerateWith?: MessageBlockProps["onRegenerateWith"];
  onGenerateImage?: (prompt: string, messageId?: string) => Promise<void>;
  onOpenImageEditor?: (messageId: string) => void;
}) {
  if (!payload && content) {
    return (
      <div className="rounded-2xl bg-muted px-5 py-4 sm:px-6 sm:py-5">
        <p className="text-sm whitespace-pre-wrap">{content}</p>
      </div>
    );
  }

  if (!payload) return null;

  const hasCreative =
    (payload.hooks?.length ?? 0) > 0 ||
    (payload.headlines?.length ?? 0) > 0 ||
    (payload.primary_texts?.length ?? 0) > 0 ||
    Boolean(payload.creative_direction) ||
    Boolean(payload.image_prompt);

  // A standalone generated_image message (image-only mode, or an explicit
  // edit). No copy attached — render just the image card on its own.
  if (!hasCreative && payload.generated_image) {
    return (
      <GeneratedImageBlock
        image={payload.generated_image}
        onEdit={
          onOpenImageEditor ? () => onOpenImageEditor(messageId) : undefined
        }
      />
    );
  }

  if (!hasCreative) {
    return content ? (
      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
        {content}
      </p>
    ) : null;
  }

  // Image source priority:
  //   1. Image stored directly on this creative payload (legacy)
  //   2. Sibling image grouped from the next message (auto-chain)
  const heroImage = payload.generated_image
    ? { messageId, image: payload.generated_image }
    : groupedImage;

  return (
    <AdCard
      messageId={messageId}
      payload={payload}
      heroImage={heroImage}
      imageGenerating={imageGenerating}
      onRegenerateWith={onRegenerateWith}
      onGenerateImage={onGenerateImage}
      onOpenImageEditor={onOpenImageEditor}
    />
  );
}

/* -----------------------------------------------------------------------
 * AdCard — the new "one assistant turn = one ad" hero card.
 *
 * Layout (top → bottom):
 *   1. Image hero (real / skeleton / "Generate image" CTA)
 *   2. Hooks: 1 best variant + "Show N more" disclosure
 *   3. Headlines: same pattern
 *   4. Primary text: same pattern
 *   5. "View brief" disclosure → creative direction + image prompt
 *   6. Footer: Copy all
 * --------------------------------------------------------------------- */

function AdCard({
  messageId,
  payload,
  heroImage,
  imageGenerating,
  onRegenerateWith,
  onGenerateImage,
  onOpenImageEditor,
}: {
  messageId: string;
  payload: StructuredPayload;
  heroImage: { messageId: string; image: GeneratedImage } | null;
  imageGenerating: boolean;
  onRegenerateWith?: MessageBlockProps["onRegenerateWith"];
  onGenerateImage?: (prompt: string, messageId?: string) => Promise<void>;
  onOpenImageEditor?: (messageId: string) => void;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <AdHero
        messageId={messageId}
        imagePrompt={payload.image_prompt}
        heroImage={heroImage}
        imageGenerating={imageGenerating}
        onGenerateImage={onGenerateImage}
        onOpenImageEditor={onOpenImageEditor}
      />

      <div className="space-y-1 px-5 py-4 sm:px-6 sm:py-5">
        {payload.hooks && payload.hooks.length > 0 && (
          <VariantSection
            title="Hook"
            field="selectedHook"
            sectionLabel="hook"
            items={payload.hooks}
            messageId={messageId}
            onRegenerateWith={onRegenerateWith}
          />
        )}
        {payload.headlines && payload.headlines.length > 0 && (
          <VariantSection
            title="Headline"
            field="selectedHeadline"
            sectionLabel="headline"
            items={payload.headlines}
            messageId={messageId}
            onRegenerateWith={onRegenerateWith}
          />
        )}
        {payload.primary_texts && payload.primary_texts.length > 0 && (
          <VariantSection
            title="Body"
            field="selectedPrimaryText"
            sectionLabel="body"
            items={payload.primary_texts}
            messageId={messageId}
            onRegenerateWith={onRegenerateWith}
          />
        )}

        {(payload.creative_direction || payload.image_prompt) && (
          <BriefDisclosure
            creativeDirection={payload.creative_direction ?? null}
            imagePrompt={payload.image_prompt ?? null}
          />
        )}
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-border bg-muted/20 px-3 py-2 sm:px-4">
        <CopyAllButton payload={payload} />
      </div>
    </article>
  );
}

/* -----------------------------------------------------------------------
 * Hero slot — image, skeleton, or generate CTA.
 * --------------------------------------------------------------------- */

function AdHero({
  messageId,
  imagePrompt,
  heroImage,
  imageGenerating,
  onGenerateImage,
  onOpenImageEditor,
}: {
  messageId: string;
  imagePrompt: string | null | undefined;
  heroImage: { messageId: string; image: GeneratedImage } | null;
  imageGenerating: boolean;
  onGenerateImage?: (prompt: string, messageId?: string) => Promise<void>;
  onOpenImageEditor?: (messageId: string) => void;
}) {
  const [generating, setGenerating] = useState(false);
  const isLoading = imageGenerating || generating;

  async function handleGenerate() {
    if (!onGenerateImage || !imagePrompt) return;
    setGenerating(true);
    try {
      await onGenerateImage(imagePrompt, messageId);
    } finally {
      setGenerating(false);
    }
  }

  // Thumbnail height — tall enough to read the composition at a glance,
  // short enough that the card is scannable. The editor modal renders the
  // image at full resolution, so this is purely a preview.
  const THUMB_HEIGHT = "h-64 sm:h-72";

  if (heroImage) {
    const { image } = heroImage;
    const imageMessageId = heroImage.messageId;
    const caption = image.edit_prompt
      ? `Edit: ${image.edit_prompt}`
      : image.prompt;
    const editable = Boolean(onOpenImageEditor);

    return (
      <div className={cn("relative w-full bg-muted/40", THUMB_HEIGHT)}>
        <button
          type="button"
          onClick={
            onOpenImageEditor
              ? () => onOpenImageEditor(imageMessageId)
              : undefined
          }
          disabled={!editable}
          aria-label={editable ? "Open image editor" : undefined}
          className={cn(
            "group relative flex h-full w-full items-center justify-center overflow-hidden",
            editable && "cursor-zoom-in"
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.url}
            alt={caption}
            className="max-h-full max-w-full object-contain"
            loading="lazy"
          />
          {editable && (
            <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-end gap-2 bg-gradient-to-t from-foreground/40 to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-foreground/85 px-3 py-1.5 text-xs font-medium text-background shadow-sm backdrop-blur">
                <Pencil className="h-3 w-3" />
                Open
              </span>
            </span>
          )}
        </button>
        <div className="absolute right-2 top-2 flex items-center gap-1.5">
          <a
            href={image.url}
            target="_blank"
            rel="noopener noreferrer"
            download
            onClick={(e) => e.stopPropagation()}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-background/90 text-muted-foreground shadow-sm backdrop-blur transition-colors hover:text-foreground"
            aria-label="Download image"
            title="Download"
          >
            <Download className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        className={cn(
          "relative w-full animate-pulse bg-gradient-to-br from-muted via-muted/60 to-muted",
          THUMB_HEIGHT
        )}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex items-center gap-2 rounded-full bg-background/80 px-3 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Generating image…
          </div>
        </div>
      </div>
    );
  }

  if (imagePrompt && onGenerateImage) {
    return (
      <div
        className={cn(
          "flex w-full items-center justify-center bg-muted/30 px-6",
          THUMB_HEIGHT
        )}
      >
        <button
          type="button"
          onClick={() => void handleGenerate()}
          className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card px-6 py-6 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary-soft/30 hover:text-foreground"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft text-primary">
            <ImageIcon className="h-4 w-4" />
          </span>
          <span className="font-medium text-foreground">Generate image</span>
          <span className="text-xs">From the brief above</span>
        </button>
      </div>
    );
  }

  return null;
}

/* -----------------------------------------------------------------------
 * Variant section — pick a variant by clicking its row, then hit the
 * contextual "Regenerate ad with this" button that appears in the header.
 *
 * The old static "Regenerate" (which gave you more variants of the same
 * section) was removed because (a) the thumbs-up "Use this" was unclear
 * about whether picking a variant did anything, and (b) what users
 * actually want after picking a variant is to see THAT variant rendered
 * into the ad — not more variations to choose from. To get more variants
 * the user can simply ask in chat ("more hook variants").
 * --------------------------------------------------------------------- */

function VariantSection({
  title,
  field,
  sectionLabel,
  items,
  messageId,
  onRegenerateWith,
}: {
  title: string;
  field: "selectedHook" | "selectedHeadline" | "selectedPrimaryText";
  sectionLabel: "hook" | "headline" | "body";
  items: string[];
  messageId: string;
  onRegenerateWith?: MessageBlockProps["onRegenerateWith"];
}) {
  const [expanded, setExpanded] = useState(false);
  // null = nothing selected yet. Index is into the FULL items array
  // (not split into best/rest) so we don't need to translate later.
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [best, ...rest] = items;
  const extraCount = rest.length;

  function toggle(i: number) {
    setSelectedIdx((prev) => (prev === i ? null : i));
  }

  function handleRegenerate() {
    if (selectedIdx == null || !onRegenerateWith) return;
    const value = items[selectedIdx];
    if (!value) return;
    setSubmitting(true);
    onRegenerateWith(messageId, field, value, sectionLabel);
    // Clear local selection so the section returns to its neutral state.
    // The new ad will appear as a separate card in the timeline.
    setTimeout(() => {
      setSubmitting(false);
      setSelectedIdx(null);
    }, 600);
  }

  return (
    <section className="border-b border-border/60 py-3 last:border-b-0 last:pb-0 first:pt-0">
      <header className="mb-1.5 flex items-center justify-between gap-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
        {onRegenerateWith && selectedIdx != null && (
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={submitting}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            title={`Regenerate the ad with this ${sectionLabel}`}
          >
            <RefreshCw
              className={cn("h-3 w-3", submitting && "animate-spin")}
            />
            Regenerate ad with this {sectionLabel}
          </button>
        )}
      </header>

      <VariantRow
        text={best}
        index={1}
        emphasized
        selectable={Boolean(onRegenerateWith)}
        selected={selectedIdx === 0}
        onToggleSelect={() => toggle(0)}
      />

      {extraCount > 0 && (
        <div className={cn(expanded ? "mt-1 space-y-0.5" : "")}>
          {expanded &&
            rest.map((text, i) => (
              <VariantRow
                key={i}
                text={text}
                index={i + 2}
                selectable={Boolean(onRegenerateWith)}
                selected={selectedIdx === i + 1}
                onToggleSelect={() => toggle(i + 1)}
              />
            ))}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronDown
              className={cn(
                "h-3 w-3 transition-transform",
                expanded && "rotate-180"
              )}
            />
            {expanded ? "Show less" : `Show ${extraCount} more`}
          </button>
        </div>
      )}
    </section>
  );
}

function VariantRow({
  text,
  index,
  emphasized,
  selectable,
  selected,
  onToggleSelect,
}: {
  text: string;
  index: number;
  emphasized?: boolean;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}) {
  const [copied, setCopied] = useState(false);

  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function handleSelectKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!selectable || !onToggleSelect) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onToggleSelect();
    }
  }

  // The row itself can't be a <button> because it contains a nested copy
  // <button>, which is invalid HTML and triggers hydration mismatches when
  // the browser hoists the inner button out of the parent. Use a div with
  // ARIA button semantics when the row is selectable.
  return (
    <div
      role={selectable ? "button" : undefined}
      tabIndex={selectable ? 0 : undefined}
      onClick={selectable ? onToggleSelect : undefined}
      onKeyDown={selectable ? handleSelectKeyDown : undefined}
      aria-pressed={selectable ? Boolean(selected) : undefined}
      className={cn(
        "group flex w-full items-start justify-between gap-3 rounded-lg border px-2 py-1.5 text-left transition-colors",
        selected
          ? "border-primary/40 bg-primary-soft/40"
          : "border-transparent hover:bg-muted/50",
        selectable &&
          "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-1 focus-visible:ring-offset-card"
      )}
    >
      <div className="flex min-w-0 items-start gap-2">
        <span
          className={cn(
            "mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-medium transition-colors",
            selected
              ? "bg-primary text-primary-foreground"
              : emphasized
                ? "text-primary"
                : "text-muted-foreground/80"
          )}
        >
          {selected ? <Check className="h-3 w-3" /> : `${index}`}
        </span>
        <p
          className={cn(
            "min-w-0 flex-1 whitespace-pre-wrap text-sm leading-snug",
            emphasized || selected
              ? "font-medium text-foreground"
              : "text-foreground/80"
          )}
        >
          {text}
        </p>
      </div>
      <div
        className={cn(
          "flex shrink-0 items-center gap-0.5 transition-opacity",
          selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}
      >
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Copy"
          title="Copy"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-success" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}

/* -----------------------------------------------------------------------
 * Brief disclosure — collapses creative_direction + image_prompt out of
 * the way. Power users can still inspect / copy them.
 * --------------------------------------------------------------------- */

function BriefDisclosure({
  creativeDirection,
  imagePrompt,
}: {
  creativeDirection: string | null;
  imagePrompt: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <section className="pt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronDown
          className={cn(
            "h-3 w-3 transition-transform",
            open && "rotate-180"
          )}
        />
        {open ? "Hide brief" : "View brief"}
      </button>

      {open && (
        <div className="mt-2 space-y-3 rounded-xl border border-border/60 bg-muted/20 p-3">
          {creativeDirection && (
            <BriefField label="Creative direction" text={creativeDirection} />
          )}
          {imagePrompt && (
            <BriefField label="Image prompt" text={imagePrompt} />
          )}
        </div>
      )}
    </section>
  );
}

function BriefField({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label={`Copy ${label.toLowerCase()}`}
        >
          {copied ? (
            <Check className="h-3 w-3 text-success" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </button>
      </div>
      <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground/80">
        {text}
      </p>
    </div>
  );
}

function CopyAllButton({ payload }: { payload: StructuredPayload }) {
  const [copied, setCopied] = useState(false);

  function handleCopyAll() {
    const parts: string[] = [];

    if (payload.hooks?.length) {
      parts.push(
        "HOOKS\n" + payload.hooks.map((h, i) => `${i + 1}. ${h}`).join("\n")
      );
    }
    if (payload.headlines?.length) {
      parts.push(
        "HEADLINES\n" +
          payload.headlines.map((h, i) => `${i + 1}. ${h}`).join("\n")
      );
    }
    if (payload.primary_texts?.length) {
      parts.push(
        "PRIMARY TEXT\n" +
          payload.primary_texts.map((t, i) => `${i + 1}. ${t}`).join("\n")
      );
    }
    if (payload.creative_direction) {
      parts.push("CREATIVE DIRECTION\n" + payload.creative_direction);
    }
    if (payload.image_prompt) {
      parts.push("IMAGE PROMPT\n" + payload.image_prompt);
    }

    navigator.clipboard.writeText(parts.join("\n\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={handleCopyAll}
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {copied ? (
        <>
          <Check className="h-3 w-3 text-success" />
          Copied
        </>
      ) : (
        <>
          <ClipboardCopy className="h-3 w-3" />
          Copy all
        </>
      )}
    </button>
  );
}

/* -----------------------------------------------------------------------
 * Standalone generated image (image-only mode, or an explicit edit version).
 * Same look-and-feel as the AdCard hero, minus the surrounding ad shell.
 * --------------------------------------------------------------------- */

function GeneratedImageBlock({
  image,
  onEdit,
}: {
  image: GeneratedImage;
  onEdit?: () => void;
}) {
  const isEdit = Boolean(image.parent_asset_id);
  const caption = image.edit_prompt
    ? `Edit: ${image.edit_prompt}`
    : image.prompt;

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="relative h-64 w-full bg-muted/40 sm:h-72">
        <button
          type="button"
          onClick={onEdit}
          disabled={!onEdit}
          aria-label={onEdit ? "Open image editor" : undefined}
          className={cn(
            "group relative flex h-full w-full items-center justify-center overflow-hidden",
            onEdit && "cursor-zoom-in"
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.url}
            alt={caption}
            className="max-h-full max-w-full object-contain"
            loading="lazy"
          />
          {onEdit && (
            <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-end gap-2 bg-gradient-to-t from-foreground/40 to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-foreground/85 px-3 py-1.5 text-xs font-medium text-background shadow-sm backdrop-blur">
                <Pencil className="h-3 w-3" />
                Open
              </span>
            </span>
          )}
        </button>
        <div className="absolute right-2 top-2 flex items-center gap-1.5">
          <a
            href={image.url}
            target="_blank"
            rel="noopener noreferrer"
            download
            onClick={(e) => e.stopPropagation()}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-background/90 text-muted-foreground shadow-sm backdrop-blur transition-colors hover:text-foreground"
            aria-label="Download image"
            title="Download"
          >
            <Download className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-border bg-muted/20 px-4 py-2">
        <span className="truncate text-[11px] text-muted-foreground italic">
          {isEdit ? "Edited" : "Generated"} · {caption}
        </span>
      </div>
    </article>
  );
}
