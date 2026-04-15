"use client";

import { Copy, Check, ThumbsUp, Wand2, ClipboardCopy, ImageIcon, Loader2, Download } from "lucide-react";
import { useState } from "react";
import type { MessageItem, StructuredPayload } from "@/lib/studio/types";

interface MessageBlockProps {
  message: MessageItem;
  onUseThis?: (messageId: string, field: string, value: string) => void;
  onImprove?: (section: string) => void;
  onGenerateImage?: (prompt: string) => Promise<void>;
}

export function MessageBlock({ message, onUseThis, onImprove, onGenerateImage }: MessageBlockProps) {
  if (message.role === "system") {
    return (
      <div className="text-center text-xs text-muted-foreground py-2">
        {message.content}
      </div>
    );
  }

  if (message.role === "user") {
    return <UserMessage content={message.content ?? ""} />;
  }

  return (
    <AssistantMessage
      messageId={message.id}
      content={message.content}
      payload={message.structured_payload}
      onUseThis={onUseThis}
      onImprove={onImprove}
      onGenerateImage={onGenerateImage}
    />
  );
}

function UserMessage({ content }: { content: string }) {
  return (
    <div className="rounded-2xl bg-muted px-5 py-4 sm:px-6 sm:py-5">
      <p className="text-sm whitespace-pre-wrap">{content}</p>
    </div>
  );
}

function AssistantMessage({
  messageId,
  content,
  payload,
  onUseThis,
  onImprove,
  onGenerateImage,
}: {
  messageId: string;
  content: string | null;
  payload: StructuredPayload | null;
  onUseThis?: (messageId: string, field: string, value: string) => void;
  onImprove?: (section: string) => void;
  onGenerateImage?: (prompt: string) => Promise<void>;
}) {
  if (!payload && content) {
    return (
      <div className="rounded-2xl bg-muted px-5 py-4 sm:px-6 sm:py-5">
        <p className="text-sm whitespace-pre-wrap">{content}</p>
      </div>
    );
  }

  if (!payload) return null;

  return (
    <div className="space-y-4">
      {payload.hooks && payload.hooks.length > 0 && (
        <StructuredSection
          title="Hooks"
          field="selectedHook"
          items={payload.hooks}
          messageId={messageId}
          onUseThis={onUseThis}
          onImprove={onImprove}
        />
      )}
      {payload.headlines && payload.headlines.length > 0 && (
        <StructuredSection
          title="Headlines"
          field="selectedHeadline"
          items={payload.headlines}
          messageId={messageId}
          onUseThis={onUseThis}
          onImprove={onImprove}
        />
      )}
      {payload.primary_texts && payload.primary_texts.length > 0 && (
        <StructuredSection
          title="Primary Text"
          field="selectedPrimaryText"
          items={payload.primary_texts}
          messageId={messageId}
          onUseThis={onUseThis}
          onImprove={onImprove}
        />
      )}
      {payload.creative_direction && (
        <StructuredTextBlock
          title="Creative Direction"
          text={payload.creative_direction}
          messageId={messageId}
          field="creativeDirection"
          onUseThis={onUseThis}
        />
      )}
      {payload.image_prompt && (
        <ImagePromptBlock
          prompt={payload.image_prompt}
          onGenerateImage={onGenerateImage}
        />
      )}
      {payload.generated_image && (
        <GeneratedImageBlock image={payload.generated_image} />
      )}
      {content && !payload.generated_image && (
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
          {content}
        </p>
      )}

      {!payload.generated_image && <CopyAllButton payload={payload} />}
    </div>
  );
}

function StructuredSection({
  title,
  field,
  items,
  messageId,
  onUseThis,
  onImprove,
}: {
  title: string;
  field: string;
  items: string[];
  messageId: string;
  onUseThis?: (messageId: string, field: string, value: string) => void;
  onImprove?: (section: string) => void;
}) {
  return (
    <div className="rounded-2xl border bg-card space-y-3 px-5 py-4 sm:px-7 sm:py-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="heading-md min-w-0 text-base">{title}</h3>
        {onImprove && (
          <button
            onClick={() => onImprove(title.toLowerCase())}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Wand2 className="h-3 w-3" />
            Improve
          </button>
        )}
      </div>
      <div className="space-y-2">
        {items.map((item, i) => (
          <StructuredItem
            key={i}
            index={i + 1}
            text={item}
            messageId={messageId}
            field={field}
            onUseThis={onUseThis}
          />
        ))}
      </div>
    </div>
  );
}

function StructuredItem({
  index,
  text,
  messageId,
  field,
  onUseThis,
}: {
  index: number;
  text: string;
  messageId: string;
  field: string;
  onUseThis?: (messageId: string, field: string, value: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [used, setUsed] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function handleUse() {
    onUseThis?.(messageId, field, text);
    setUsed(true);
    setTimeout(() => setUsed(false), 2000);
  }

  return (
    <div className="group flex items-start justify-between gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted sm:px-4">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 w-5 shrink-0 text-right text-xs font-medium text-muted-foreground">
          {index}.
        </span>
        <p className="min-w-0 flex-1 text-sm whitespace-pre-wrap pr-1">{text}</p>
      </div>
      <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
        {onUseThis && (
          <button
            onClick={handleUse}
            className="rounded-lg p-1.5 text-muted-foreground hover:text-primary transition-colors"
            aria-label="Use this"
            title="Use this"
          >
            {used ? (
              <Check className="h-3.5 w-3.5 text-success" />
            ) : (
              <ThumbsUp className="h-3.5 w-3.5" />
            )}
          </button>
        )}
        <button
          onClick={handleCopy}
          className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Copy"
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

function StructuredTextBlock({
  title,
  text,
  messageId,
  field,
  onUseThis,
}: {
  title: string;
  text: string;
  messageId?: string;
  field?: string;
  onUseThis?: (messageId: string, field: string, value: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [used, setUsed] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function handleUse() {
    if (messageId && field) {
      onUseThis?.(messageId, field, text);
      setUsed(true);
      setTimeout(() => setUsed(false), 2000);
    }
  }

  return (
    <div className="rounded-2xl border bg-card space-y-3 px-5 py-4 sm:px-7 sm:py-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="heading-md min-w-0 text-base">{title}</h3>
        <div className="flex shrink-0 items-center gap-1">
          {onUseThis && messageId && field && (
            <button
              onClick={handleUse}
              className="rounded-lg p-1.5 text-muted-foreground hover:text-primary transition-colors"
              aria-label="Use this"
              title="Use this"
            >
              {used ? (
                <Check className="h-3.5 w-3.5 text-success" />
              ) : (
                <ThumbsUp className="h-3.5 w-3.5" />
              )}
            </button>
          )}
          <button
            onClick={handleCopy}
            className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={`Copy ${title.toLowerCase()}`}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-success" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>
      <p className="text-sm leading-relaxed whitespace-pre-wrap pr-0.5 sm:pr-1">
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
      parts.push("HOOKS\n" + payload.hooks.map((h, i) => `${i + 1}. ${h}`).join("\n"));
    }
    if (payload.headlines?.length) {
      parts.push("HEADLINES\n" + payload.headlines.map((h, i) => `${i + 1}. ${h}`).join("\n"));
    }
    if (payload.primary_texts?.length) {
      parts.push("PRIMARY TEXT\n" + payload.primary_texts.map((t, i) => `${i + 1}. ${t}`).join("\n"));
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
    <div className="flex justify-end">
      <button
        onClick={handleCopyAll}
        className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5 text-success" />
            Copied!
          </>
        ) : (
          <>
            <ClipboardCopy className="h-3.5 w-3.5" />
            Copy all
          </>
        )}
      </button>
    </div>
  );
}

function ImagePromptBlock({
  prompt,
  onGenerateImage,
}: {
  prompt: string;
  onGenerateImage?: (prompt: string) => Promise<void>;
}) {
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function handleGenerate() {
    if (!onGenerateImage) return;
    setGenerating(true);
    try {
      await onGenerateImage(prompt);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="rounded-2xl border bg-card space-y-3 px-5 py-4 sm:px-7 sm:py-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="heading-md min-w-0 text-base">Image Prompt</h3>
        <div className="flex items-center gap-1">
          {onGenerateImage && (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {generating ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <ImageIcon className="h-3 w-3" />
              )}
              {generating ? "Generating…" : "Generate image"}
            </button>
          )}
          <button
            onClick={handleCopy}
            className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Copy image prompt"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-success" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>
      <p className="text-sm leading-relaxed whitespace-pre-wrap pr-0.5 sm:pr-1">
        {prompt}
      </p>
    </div>
  );
}

function GeneratedImageBlock({
  image,
}: {
  image: { url: string; prompt: string };
}) {
  return (
    <div className="rounded-2xl border bg-card space-y-3 px-5 py-4 sm:px-7 sm:py-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="heading-md min-w-0 text-base">Generated Image</h3>
        <a
          href={image.url}
          target="_blank"
          rel="noopener noreferrer"
          download
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <Download className="h-3 w-3" />
          Download
        </a>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image.url}
        alt={image.prompt}
        className="w-full rounded-xl border"
        loading="lazy"
      />
      <p className="text-xs text-muted-foreground italic">{image.prompt}</p>
    </div>
  );
}
