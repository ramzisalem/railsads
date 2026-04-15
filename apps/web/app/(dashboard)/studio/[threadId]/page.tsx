import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getCurrentBrand } from "@/lib/auth/get-current-brand";
import {
  getThreadDetail,
  getThreadMessages,
  getThreadsList,
  getStudioContext,
} from "@/lib/studio/queries";
import { PageHeader } from "@/components/layout/page-header";
import { ThreadList } from "@/components/studio/thread-list";
import { NewThreadForm } from "@/components/studio/new-thread-form";
import { Conversation } from "@/components/studio/conversation";
import { ContextPanel } from "@/components/studio/context-panel";
import { ThreadHeader } from "@/components/studio/thread-header";

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

  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)] md:h-[calc(100vh-4rem)]">
      <PageHeader
        title="Creative Studio"
        actions={
          <div className="flex items-center gap-3">
            <ThreadList threads={threads} activeThreadId={threadId} />
            <NewThreadForm brandId={brand.id} context={context} />
          </div>
        }
      />

      <ThreadHeader thread={thread} />

      <div className="mt-4 flex-1 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px] min-h-0">
        <div className="min-h-0 flex flex-col rounded-2xl border bg-card overflow-hidden">
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
            }}
            angle={thread.angle}
            awareness={thread.awareness}
          />
        </div>

        <div className="lg:sticky lg:top-0 self-start">
          <ContextPanel thread={thread} context={context} />
        </div>
      </div>
    </div>
  );
}
