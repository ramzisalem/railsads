"use client";

import { useRef, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { MessageBlock } from "./message-block";
import { QuickActions } from "./quick-actions";
import { ChatInput } from "./chat-input";
import { ChatContextStrip } from "./chat-context-strip";
import { sendMessage, saveCreativeVersion } from "@/lib/studio/actions";
import type { MessageItem } from "@/lib/studio/types";

interface ThreadContext {
  productId: string;
  icpId?: string | null;
  templateId?: string | null;
  angle?: string | null;
  awareness?: string | null;
}

interface ConversationProps {
  brandId: string;
  threadId: string;
  messages: MessageItem[];
  threadContext: ThreadContext;
  angle: string | null;
  awareness: string | null;
}

export function Conversation({
  brandId,
  threadId,
  messages,
  threadContext,
  angle,
  awareness,
}: ConversationProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const autoGenTriggered = useRef(false);
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isGenerating]);

  useEffect(() => {
    if (messages.length === 0 && !autoGenTriggered.current && !isGenerating) {
      autoGenTriggered.current = true;
      handleSend("Generate an ad creative for this product");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasMessages = messages.length > 0;
  const hasAssistantOutput = messages.some(
    (m) => m.role === "assistant" && m.structured_payload
  );

  async function callAI(userMessage: string) {
    setIsGenerating(true);
    setAiError(null);

    try {
      const endpoint = hasAssistantOutput
        ? "/api/creative/revise"
        : "/api/creative/generate";

      const payload = hasAssistantOutput
        ? {
            brandId,
            threadId,
            productId: threadContext.productId,
            icpId: threadContext.icpId,
            userMessage,
          }
        : {
            brandId,
            threadId,
            productId: threadContext.productId,
            icpId: threadContext.icpId,
            templateId: threadContext.templateId,
            angle: threadContext.angle,
            awareness: threadContext.awareness,
          };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `AI request failed (${res.status})`);
      }

      router.refresh();
    } catch (err) {
      setAiError(
        err instanceof Error ? err.message : "Something went wrong"
      );
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSend(userMessage: string) {
    const result = await sendMessage(brandId, threadId, userMessage);
    if (result.error) return;

    router.refresh();
    await callAI(userMessage);
  }

  function handleQuickAction(prompt: string) {
    handleSend(prompt);
  }

  async function handleUseThis(messageId: string, field: string, value: string) {
    await saveCreativeVersion(brandId, threadId, messageId, {
      [field]: value,
    });
  }

  function handleImprove(section: string) {
    handleSend(`Improve the ${section}`);
  }

  async function handleGenerateImage(prompt: string) {
    setIsGenerating(true);
    setAiError(null);

    try {
      const res = await fetch("/api/image/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId, threadId, prompt }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Image generation failed (${res.status})`);
      }

      router.refresh();
    } catch (err) {
      setAiError(
        err instanceof Error ? err.message : "Image generation failed"
      );
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <ChatContextStrip
        threadId={threadId}
        angle={angle}
        awareness={awareness}
      />
      <div className="flex-1 overflow-y-auto px-4 sm:px-6">
        <div className="space-y-5 py-4 sm:py-5">
          {messages.map((msg) => (
            <MessageBlock
              key={msg.id}
              message={msg}
              onUseThis={handleUseThis}
              onImprove={handleImprove}
              onGenerateImage={handleGenerateImage}
            />
          ))}

          {isGenerating && (
            <div className="flex items-center gap-3 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">
                Generating creative...
              </span>
            </div>
          )}

          {aiError && (
            <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {aiError}
            </div>
          )}

          {!hasMessages && !isGenerating && (
            <div className="flex min-h-[300px] items-center justify-center">
              <div className="text-center">
                <h3 className="heading-md">Start creating</h3>
                <p className="mt-2 text-body text-muted-foreground max-w-sm">
                  Type a message below to generate your first ad creative, or
                  use Product / ICP / Templates on the right and angle above to
                  refine targeting.
                </p>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {hasAssistantOutput && !isGenerating && (
        <div className="border-t px-4 py-2 sm:px-6">
          <QuickActions onAction={handleQuickAction} disabled={isGenerating} />
        </div>
      )}

      <ChatInput
        threadId={threadId}
        onSend={handleSend}
        disabled={isGenerating}
      />
    </div>
  );
}
