import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getCurrentBrand } from "@/lib/auth/get-current-brand";
import {
  getThreadDetail,
  getThreadMessages,
  getThreadsList,
  getStudioContext,
} from "@/lib/studio/queries";
import { Conversation } from "@/components/studio/conversation";
import { ContextPanel } from "@/components/studio/context-panel";
import { StudioHeader } from "@/components/studio/studio-header";

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;
  const user = await getCurrentUser();
  const brand = await getCurrentBrand(user.id);

  const [thread, messages, threads, context] = await Promise.all([
    getThreadDetail(threadId, brand.id),
    getThreadMessages(threadId, brand.id),
    getThreadsList(brand.id),
    getStudioContext(brand.id),
  ]);

  if (!thread) notFound();

  // Make the Studio thread look and feel like ChatGPT / Claude: the chat fills
  // the entire viewport (only the messages area scrolls; composer pinned at
  // the bottom). To do that we must escape the dashboard <AppShell> wrapper,
  // which adds `mx-auto max-w-[1600px] px-{4|6|8} py-{4|6|8}` around children.
  // We cancel that wrapping with negative margins (and re-add a small inner
  // padding) so the page truly reaches every edge of the viewport.
  const escapeShell =
    "-mx-4 -my-4 sm:-mx-6 sm:-my-6 md:-mx-8 md:-my-8";
  const fullHeight =
    "h-[calc(100dvh-3.5rem)] md:h-screen";

  return (
    <div
      className={`${escapeShell} ${fullHeight} flex flex-col gap-3 px-3 py-3 sm:gap-4 sm:px-4 sm:py-4 md:px-6 md:py-5`}
    >
      <StudioHeader
        brandId={brand.id}
        thread={thread}
        threads={threads}
        context={context}
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 items-stretch gap-3 sm:gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card">
          <Conversation
            brandId={brand.id}
            threadId={threadId}
            messages={messages}
            threadContext={{
              productId: thread.product_id,
              icpId: thread.icp_id,
              templateId: thread.template_id,
              angle: thread.angle,
              awareness: thread.awareness,
              referenceCompetitorAdId: thread.reference_competitor_ad_id,
            }}
            angle={thread.angle}
            awareness={thread.awareness}
            studioContext={context}
          />
        </div>

        <div className="flex min-h-0 flex-col">
          <ContextPanel thread={thread} context={context} />
        </div>
      </div>
    </div>
  );
}
