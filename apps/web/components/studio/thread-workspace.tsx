"use client";

import { useState } from "react";
import { Conversation } from "./conversation";
import { ContextPanel } from "./context-panel";
import type {
  MessageItem,
  StudioContext,
  ThreadDetail,
} from "@/lib/studio/types";
import {
  DEFAULT_IMAGE_GEN_SIZE,
  type ImageGenSize,
} from "@/lib/studio/image-gen-sizes";

interface ThreadWorkspaceProps {
  brandId: string;
  thread: ThreadDetail;
  messages: MessageItem[];
  studioContext: StudioContext;
}

/**
 * Wraps the chat conversation and the context side panel as one client tree
 * so they can share state (currently the per-session image ratio). Replaces
 * the legacy split where ratio lived in `<ChatContextStrip>` above the
 * composer and product/audience/etc. lived in the side panel.
 */
export function ThreadWorkspace({
  brandId,
  thread,
  messages,
  studioContext,
}: ThreadWorkspaceProps) {
  const [imageSize, setImageSize] = useState<ImageGenSize>(
    DEFAULT_IMAGE_GEN_SIZE
  );

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 items-stretch gap-3 sm:gap-4 md:grid-cols-[minmax(0,1fr)_300px] lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card">
        <Conversation
          brandId={brandId}
          threadId={thread.id}
          messages={messages}
          threadContext={{
            productId: thread.product_id,
            icpId: thread.icp_id,
            templateId: thread.template_id,
            angle: thread.angle,
            awareness: thread.awareness,
            referenceCompetitorAdId: thread.reference_competitor_ad_id,
          }}
          imageSize={imageSize}
        />
      </div>

      {/* When the layout has to stack (e.g. narrow viewport, tablet portrait),
          constrain the panel to a card-width and center it so it still reads
          like a sidebar. From md upward it sits alongside the chat at a
          fixed width and these constraints become no-ops. */}
      <div className="mx-auto flex min-h-0 w-full max-w-md flex-col md:mx-0 md:max-w-none">
        <ContextPanel
          thread={thread}
          context={studioContext}
          imageSize={imageSize}
          onImageSizeChange={setImageSize}
        />
      </div>
    </div>
  );
}
