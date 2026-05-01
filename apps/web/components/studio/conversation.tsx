"use client";

import { useMemo, useRef, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Image as ImageIcon,
  Sparkles,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import { MessageBlock } from "./message-block";
import { QuickActions } from "./quick-actions";
import { ChatInput } from "./chat-input";
import { ImageEditDialog, type ImageVersion } from "./image-edit-dialog";
import { sendMessage, saveCreativeVersion } from "@/lib/studio/actions";
import type { GeneratedImage, MessageItem } from "@/lib/studio/types";
import {
  DEFAULT_IMAGE_GEN_SIZE,
  type ImageGenSize,
} from "@/lib/studio/image-gen-sizes";
import type { ComposerMode } from "@/lib/validation/schemas";
import {
  BillingError,
  fetchJson,
  isBillingError,
} from "@/lib/billing/client";
import { BillingErrorBanner } from "@/components/billing/billing-error-banner";

interface ThreadContext {
  productId: string;
  icpId?: string | null;
  /** Ordered list of selected templates. Length > 1 triggers a per-template
   *  fan-out on the next initial-generation turn (one creative per template,
   *  each with its own auto-chained image). Length 0 means "no template",
   *  equivalent to the legacy single-null case. */
  templateIds: string[];
  angle?: string | null;
  awareness?: string | null;
  referenceCompetitorAdId?: string | null;
}

/** Drives the in-thread loading skeleton copy — must match the actual API
 *  path (chat vs creative vs image) so users aren't told we're "crafting
 *  a creative" when we're only running a text brainstorm. */
type LoadingPhase = "chat" | "image" | "copy" | "full";

const LOADING_TITLE: Record<LoadingPhase, string> = {
  chat: "Working on your answer",
  image: "Generating your image",
  copy: "Writing your ad copy",
  full: "Crafting your creative",
};

interface ConversationProps {
  brandId: string;
  threadId: string;
  messages: MessageItem[];
  threadContext: ThreadContext;
  /**
   * Selected output ratios (multi). Owned by `ThreadWorkspace`; initial
   * creative/image runs fan out one job per size (× each template on first
   * generation).
   */
  imageSizes: ImageGenSize[];
}

export function Conversation({
  brandId,
  threadId,
  messages,
  threadContext,
  imageSizes,
}: ConversationProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [loadingPhase, setLoadingPhase] = useState<LoadingPhase | null>(null);
  const isGenerating = loadingPhase !== null;
  const [aiError, setAiError] = useState<string | null>(null);
  const [billingError, setBillingError] = useState<BillingError | null>(null);
  const [editorMessageId, setEditorMessageId] = useState<string | null>(null);
  // Composer mode: persisted within a session so toggling "Image only" sticks
  // for follow-ups until the user changes it.
  const [composerMode, setComposerMode] = useState<ComposerMode>("full");
  // When the auto-chain fires after a creative response, we record the
  // new creative message's id so the AdCard for THAT message can render
  // an image skeleton in its hero slot. Using a set lets the multi-template
  // fan-out paint skeletons on every pending card concurrently. Ids are
  // removed once their chained image lands (via `router.refresh()` bringing
  // the new generated_image message into `messages`).
  const [chainImageForMessageIds, setChainImageForMessageIds] = useState<
    Set<string>
  >(() => new Set());

  function markChainStart(messageId: string) {
    setChainImageForMessageIds((prev) => {
      if (prev.has(messageId)) return prev;
      const next = new Set(prev);
      next.add(messageId);
      return next;
    });
  }

  function markChainDone(messageId: string) {
    setChainImageForMessageIds((prev) => {
      if (!prev.has(messageId)) return prev;
      const next = new Set(prev);
      next.delete(messageId);
      return next;
    });
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, loadingPhase]);

  const hasMessages = messages.length > 0;
  const hasAssistantOutput = messages.some(
    (m) => m.role === "assistant" && m.structured_payload
  );

  // The image editor needs every generated image in this thread (for the
  // versions rail). We derive it from `messages` so it stays in sync after
  // every router.refresh() — no extra fetch required.
  const imageVersions = useMemo<ImageVersion[]>(() => {
    return messages
      .filter(
        (m) => m.role === "assistant" && m.structured_payload?.generated_image
      )
      .map((m) => ({
        messageId: m.id,
        image: m.structured_payload!.generated_image!,
        createdAt: m.created_at,
      }));
  }, [messages]);

  // Pre-merge consecutive (creative, generated_image) assistant messages so
  // the auto-chained image renders INSIDE the same ad card as the copy that
  // produced it. We only attach when:
  //   - the next message is assistant + has a generated_image
  //   - that generated_image has no parent_asset_id (so it's a fresh
  //     generation, not an edit version)
  //   - the creative message itself doesn't already carry a generated_image
  // Otherwise both messages render independently (legacy / edit lineage).
  const renderItems = useMemo(() => {
    type Item = {
      message: MessageItem;
      groupedImage?: { messageId: string; image: GeneratedImage } | null;
    };
    const items: Item[] = [];
    const consumed = new Set<string>();

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (consumed.has(msg.id)) continue;

      if (msg.role !== "assistant") {
        items.push({ message: msg });
        continue;
      }

      const payload = msg.structured_payload;
      const hasCreative =
        !!payload &&
        ((payload.hooks?.length ?? 0) > 0 ||
          (payload.headlines?.length ?? 0) > 0 ||
          (payload.primary_texts?.length ?? 0) > 0 ||
          !!payload.creative_direction ||
          !!payload.image_prompt);
      const alreadyHasImage = !!payload?.generated_image;

      if (hasCreative && !alreadyHasImage) {
        const next = messages[i + 1];
        const nextImage = next?.structured_payload?.generated_image;
        if (
          next?.role === "assistant" &&
          nextImage &&
          !nextImage.parent_asset_id
        ) {
          items.push({
            message: msg,
            groupedImage: { messageId: next.id, image: nextImage },
          });
          consumed.add(next.id);
          continue;
        }
      }

      items.push({ message: msg });
    }

    return items;
  }, [messages]);

  /**
   * Generate (or revise) the structured creative for the current thread.
   * Returns the new message id + the LLM-suggested `image_prompt` so callers
   * can auto-chain image generation when in `full` mode.
   *
   * `templateId` lets the multi-template fan-out run this once per selected
   * template. Revisions (follow-up turns) ignore it and fall back to the
   * DB-stored thread context instead.
   */
  async function callCreative(
    userMessage: string,
    attachmentUrls: string[],
    mode: ComposerMode,
    templateId: string | null
  ): Promise<{ messageId: string | null; imagePrompt: string | null }> {
    const endpoint = hasAssistantOutput
      ? "/api/creative/revise"
      : "/api/creative/generate";

    const attach = attachmentUrls.length > 0 ? { attachmentUrls } : {};

    const payload = hasAssistantOutput
      ? {
          brandId,
          threadId,
          productId: threadContext.productId,
          icpId: threadContext.icpId,
          userMessage,
          mode,
          ...attach,
        }
      : {
          brandId,
          threadId,
          productId: threadContext.productId,
          icpId: threadContext.icpId,
          templateId,
          angle: threadContext.angle,
          awareness: threadContext.awareness,
          mode,
          ...attach,
        };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await fetchJson<{
      messageId?: string;
      output?: { image_prompt?: string | null };
    }>(res);

    return {
      messageId: data.messageId ?? null,
      imagePrompt: data.output?.image_prompt ?? null,
    };
  }

  /**
   * Fire-and-await image generation off an existing prompt. Used both for
   * the auto-chain after creative generation and for explicit
   * "Generate image" clicks on a creative card. `templateIdOverride` lets
   * the multi-template fan-out pin each chained image to the template its
   * parent creative was generated from.
   */
  const effectiveImageSizes =
    imageSizes.length > 0 ? imageSizes : [DEFAULT_IMAGE_GEN_SIZE];

  async function generateImageForPrompt(
    prompt: string,
    templateIdOverride?: string | null,
    sizeOverride?: ImageGenSize
  ): Promise<void> {
    const size = sizeOverride ?? effectiveImageSizes[0];
    const res = await fetch("/api/image/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brandId,
        threadId,
        prompt,
        size,
        ...(templateIdOverride ? { templateId: templateIdOverride } : {}),
      }),
    });
    await fetchJson(res);
  }

  /**
   * Run a single (creative, optional-image) call for one template (or `null`
   * on revisions) and one output **aspect size** for the chained image.
   */
  async function runSingleCreative(
    userMessage: string,
    attachmentUrls: string[],
    mode: ComposerMode,
    templateId: string | null,
    imageSize: ImageGenSize
  ) {
    const { messageId, imagePrompt } = await callCreative(
      userMessage,
      attachmentUrls,
      mode,
      templateId
    );
    router.refresh();

    if (mode === "full" && imagePrompt && messageId) {
      markChainStart(messageId);
      try {
        await generateImageForPrompt(imagePrompt, templateId, imageSize);
        router.refresh();
      } catch (imgErr) {
        if (isBillingError(imgErr)) {
          setBillingError(imgErr);
        } else {
          setAiError((prev) =>
            prev
              ? prev
              : imgErr instanceof Error
                ? `Copy ready, but image failed: ${imgErr.message}`
                : "Copy ready, but image generation failed."
          );
        }
        router.refresh();
      } finally {
        markChainDone(messageId);
      }
    }
  }

  /**
   * Top-level "the user submitted something" handler. Dispatches by composer
   * mode:
   *   - `image` : skip text, send the prompt straight to the image endpoint
   *   - `copy`  : creative gen only
   *   - `full`  : creative gen, then auto-chain image gen using the LLM's
   *               returned `image_prompt` (skeleton lands on the new card)
   *
   * Initial `full` runs fan out one job per **(template × selected ratio)**;
   * image-only runs one job per **selected ratio**. `copy` mode fans by
   * template only (ratio does not apply). Revisions use `[null]` templates but
   * still fan across each selected ratio for `full`.
   */
  async function runTurn(
    userMessage: string,
    attachmentUrls: string[],
    mode: ComposerMode
  ) {
    setLoadingPhase(
      mode === "image" ? "image" : mode === "copy" ? "copy" : "full"
    );
    setAiError(null);
    setBillingError(null);
    setChainImageForMessageIds(new Set());

    try {
      if (mode === "image") {
        if (!userMessage.trim()) {
          throw new Error(
            "Type what you want to see in the image to use Image-only mode."
          );
        }
        const settledImg = await Promise.allSettled(
          effectiveImageSizes.map((size) =>
            generateImageForPrompt(userMessage, undefined, size)
          )
        );
        const firstImgFail = settledImg.find((r) => r.status === "rejected") as
          | PromiseRejectedResult
          | undefined;
        if (firstImgFail) {
          const err = firstImgFail.reason;
          if (isBillingError(err)) setBillingError(err);
          else
            setAiError(
              err instanceof Error ? err.message : "Image generation failed"
            );
        }
        router.refresh();
        return;
      }

      // Fan-out: every (template × ratio) on first generation; on revisions,
      // templateIds is `[null]` but we still fan out one revision+image per
      // selected ratio.
      const templateIds = hasAssistantOutput
        ? [null]
        : threadContext.templateIds.length > 0
          ? threadContext.templateIds
          : [null];

      // Copy-only mode ignores aspect ratio (no image) — one structured
      // creative per template, not one per ratio.
      const sizesForCreative =
        mode === "copy" ? [effectiveImageSizes[0]] : effectiveImageSizes;

      const jobs: { tid: string | null; size: ImageGenSize }[] = [];
      for (const tid of templateIds) {
        for (const size of sizesForCreative) {
          jobs.push({ tid, size });
        }
      }

      const settled = await Promise.allSettled(
        jobs.map(({ tid, size }) =>
          runSingleCreative(userMessage, attachmentUrls, mode, tid, size)
        )
      );

      // Surface the first hard failure so users see *something*, without
      // making one failed template block the others (successful ones still
      // wrote their messages through).
      const firstRejection = settled.find((r) => r.status === "rejected") as
        | PromiseRejectedResult
        | undefined;
      if (firstRejection) {
        const err = firstRejection.reason;
        if (isBillingError(err)) {
          setBillingError(err);
        } else {
          setAiError(
            err instanceof Error ? err.message : "Something went wrong"
          );
        }
        router.refresh();
      }
    } catch (err) {
      if (isBillingError(err)) {
        setBillingError(err);
      } else {
        setAiError(err instanceof Error ? err.message : "Something went wrong");
      }
      router.refresh();
    } finally {
      setLoadingPhase(null);
    }
  }

  async function handleSend(
    userMessage: string,
    attachmentUrls: string[] = [],
    mode: ComposerMode = composerMode
  ) {
    const attachments = attachmentUrls.map((url) => ({
      type: "image" as const,
      url,
    }));
    const result = await sendMessage(
      brandId,
      threadId,
      userMessage,
      attachments
    );
    if (result.error) return;

    router.refresh();
    await runTurn(userMessage, attachmentUrls, mode);
  }

  function handleQuickAction(prompt: string) {
    handleSend(prompt, [], composerMode);
  }

  /**
   * Starter prompts (empty-state buttons). Two intents:
   *
   *  - `creative`: kick off structured ad generation (hook/headline/body/
   *    image) using the composer mode. No user bubble — the starter IS the
   *    action and the resulting ad card is the deliverable.
   *  - `chat`: the user wants a brainstorm / text answer, not a finished
   *    ad card. We persist the prompt as a user message bubble (so the
   *    conversation reads as a natural Q&A) and call `/api/studio/chat`,
   *    which returns a plain-text assistant reply.
   *
   * Without this split, the "Brainstorm angles" and "Visual concept"
   * starters were being force-fit into the creative pipeline and came
   * back as structured ad cards — confusing because the user asked for
   * ideation, not a shipped ad.
   */
  function handleStarter(prompt: string, intent: StarterIntent) {
    if (intent === "chat") {
      void runChatTurn(prompt);
      return;
    }
    void runTurn(prompt, [], composerMode);
  }

  /**
   * Chat-intent turn: persist the starter prompt as a user message, hit
   * the chat endpoint, and let the new plain-text assistant message render
   * as a muted chat bubble in the timeline. Kept separate from `runTurn`
   * because it bypasses the creative/image pipeline entirely — no
   * composer mode, no template fan-out, no auto-chained image.
   */
  async function runChatTurn(userMessage: string) {
    setLoadingPhase("chat");
    setAiError(null);
    setBillingError(null);
    try {
      const sendResult = await sendMessage(brandId, threadId, userMessage, []);
      if (sendResult.error) throw new Error(sendResult.error);
      router.refresh();

      const res = await fetch("/api/studio/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId,
          threadId,
          productId: threadContext.productId,
          icpId: threadContext.icpId,
          userMessage,
        }),
      });
      await fetchJson(res);
      router.refresh();
    } catch (err) {
      if (isBillingError(err)) {
        setBillingError(err);
      } else {
        setAiError(err instanceof Error ? err.message : "Something went wrong");
      }
      router.refresh();
    } finally {
      setLoadingPhase(null);
    }
  }

  /**
   * The user picked a hook / headline / body variant on a previous ad and
   * asked to regenerate the ad with that pick locked in. We do two things:
   *   1. Persist the pick on the originating creative version so the
   *      thread keeps a record of which variant they chose.
   *   2. Send a chat message that triggers a creative revision and an
   *      auto-chained image regen, with the chosen variant baked in
   *      verbatim so the next ad shows it on the image.
   */
  async function handleRegenerateWith(
    messageId: string,
    field: "selectedHook" | "selectedHeadline" | "selectedPrimaryText",
    value: string,
    sectionLabel: "hook" | "headline" | "body"
  ) {
    // Persist the pick — non-blocking, we don't want a transient DB
    // hiccup to keep the user from regenerating.
    saveCreativeVersion(brandId, threadId, messageId, {
      [field]: value,
    }).catch((err) => {
      console.error("Failed to persist picked variant:", err);
    });

    const trimmed = value.trim();
    const articulated =
      sectionLabel === "body"
        ? "primary text"
        : sectionLabel;
    const message = `Use this ${articulated} verbatim and regenerate the ad: "${trimmed}". Keep this ${articulated} EXACTLY as written (no rewording) and bake it into the image as on-image copy.`;

    await handleSend(message, [], "full");
  }

  /**
   * Manual "Generate image" trigger from a creative card (e.g. the user chose
   * `copy` mode earlier and now wants to see what the visual looks like).
   * `messageId` lets us pin the skeleton to the originating card.
   */
  async function handleGenerateImage(prompt: string, messageId?: string) {
    setLoadingPhase("image");
    setAiError(null);
    setBillingError(null);
    if (messageId) markChainStart(messageId);
    try {
      await generateImageForPrompt(prompt);
      router.refresh();
    } catch (err) {
      if (isBillingError(err)) {
        setBillingError(err);
      } else {
        setAiError(
          err instanceof Error ? err.message : "Image generation failed"
        );
      }
      router.refresh();
    } finally {
      if (messageId) markChainDone(messageId);
      setLoadingPhase(null);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 sm:px-6">
        <div className="space-y-5 py-4 sm:py-5">
          {renderItems.map(({ message: msg, groupedImage }) => (
            <MessageBlock
              key={msg.id}
              message={msg}
              groupedImage={groupedImage ?? null}
              imageGenerating={chainImageForMessageIds.has(msg.id)}
              onRegenerateWith={handleRegenerateWith}
              onGenerateImage={handleGenerateImage}
              onOpenImageEditor={(messageId) => setEditorMessageId(messageId)}
            />
          ))}

          {/* Loading skeleton: copy matches the active pipeline (chat vs
              copy-only creative vs full creative vs image-only). Once a
              creative card lands and we're auto-chaining the image, the
              per-card skeleton in <AdHero /> takes over. */}
          {loadingPhase && chainImageForMessageIds.size === 0 && (
            <div className="flex items-start gap-3 rounded-2xl border border-border bg-secondary-soft/40 px-4 py-3.5">
              <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                <span className="absolute inset-0 animate-ping rounded-lg bg-primary/10" />
              </span>
              <div className="min-w-0 flex-1 pt-1">
                <div className="text-sm font-medium text-foreground">
                  {LOADING_TITLE[loadingPhase]}
                </div>
                <div className="mt-2 space-y-1.5">
                  <span className="block h-2 w-3/4 animate-pulse rounded-full bg-muted" />
                  <span className="block h-2 w-1/2 animate-pulse rounded-full bg-muted" />
                </div>
              </div>
            </div>
          )}

          {billingError && (
            <BillingErrorBanner
              error={billingError}
              onDismiss={() => setBillingError(null)}
            />
          )}

          {aiError && (
            <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {aiError}
            </div>
          )}

          {!hasMessages && !isGenerating && (
            <EmptyConversation onPick={handleStarter} />
          )}

          {hasAssistantOutput && !isGenerating && (
            // Suggestion chips trail the latest assistant message — they're
            // part of the conversation flow (not a fixed toolbar) so they
            // scroll away as new messages arrive, like ChatGPT's follow-up
            // suggestions.
            <div className="px-1 pt-1">
              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Suggested follow-ups
              </p>
              <QuickActions onAction={handleQuickAction} disabled={isGenerating} />
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      <div className="shrink-0 border-t border-border bg-card">
        <ChatInput
          brandId={brandId}
          threadId={threadId}
          onSend={handleSend}
          disabled={isGenerating}
          embedded
          mode={composerMode}
          onModeChange={setComposerMode}
        />
      </div>

      <ImageEditDialog
        open={editorMessageId !== null}
        onClose={() => setEditorMessageId(null)}
        brandId={brandId}
        threadId={threadId}
        initialMessageId={editorMessageId ?? ""}
        versions={imageVersions}
      />
    </div>
  );
}

/**
 * Each starter declares whether it kicks off a structured creative
 * generation or a plain chat turn. The two paths produce visibly different
 * output (ad card vs chat bubble) so picking the wrong intent here is the
 * kind of mismatch users notice immediately.
 */
type StarterIntent = "creative" | "chat";

const STARTER_PROMPTS: {
  label: string;
  description: string;
  prompt: string;
  icon: LucideIcon;
  intent: StarterIntent;
}[] = [
  {
    label: "Generate ad creative",
    description: "Hook, headline, and body for this product and audience.",
    prompt:
      "Generate an ad creative for this product targeting the selected audience.",
    icon: Sparkles,
    intent: "creative",
  },
  {
    label: "Brainstorm angles",
    description: "5 fresh angles I could test for this product.",
    prompt:
      "Brainstorm 5 fresh ad angles I could test for this product, with a one-line rationale for each.",
    icon: Wand2,
    intent: "chat",
  },
  {
    label: "Visual concept",
    description: "Describe a striking ad visual I could ship.",
    prompt:
      "Describe a striking visual concept for an ad for this product, with composition, mood, and key on-image text.",
    icon: ImageIcon,
    intent: "chat",
  },
];

function EmptyConversation({
  onPick,
}: {
  onPick: (prompt: string, intent: StarterIntent) => void;
}) {
  return (
    <div className="flex min-h-[min(20rem,55vw)] items-center justify-center px-2 py-6">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <h3 className="mt-4 heading-md">Start a creative</h3>
          <p className="mt-2 text-body text-muted-foreground">
            Pick a starter or type your own brief below. Tweak the product,
            audience, or template anytime from the right panel.
          </p>
        </div>

        <div className="space-y-2">
          {STARTER_PROMPTS.map(({ label, description, prompt, icon: Icon, intent }) => (
            <button
              key={label}
              type="button"
              onClick={() => onPick(prompt, intent)}
              className="group flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary-soft/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-card"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-card-foreground">
                  {label}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {description}
                </span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
