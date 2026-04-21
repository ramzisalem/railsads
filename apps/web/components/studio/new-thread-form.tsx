"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { createThread } from "@/lib/studio/actions";
import type { StudioContext } from "@/lib/studio/types";

interface NewThreadFormProps {
  brandId: string;
  context: StudioContext;
  /**
   * Optional override for which product to seed the new thread with. When not
   * provided, the first product in the brand's catalog is used. ICP is always
   * omitted at creation time — the user can pick one later from the chat
   * context strip.
   */
  preselectedProductId?: string;
}

/**
 * "New creative" CTA. Single click → creates a thread on the default product
 * (preselected or first available) with no ICP, then routes into it. The
 * previous modal asked the user to pick product + ICP up-front, but every
 * thread is fully editable from the chat context strip so that step was pure
 * friction.
 */
export function NewThreadForm({
  brandId,
  context,
  preselectedProductId,
}: NewThreadFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const defaultProductId =
    preselectedProductId ?? context.products[0]?.id ?? null;
  const disabled = !defaultProductId || isPending;

  function handleClick() {
    if (!defaultProductId) {
      setError("Add a product before creating a creative");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await createThread(brandId, defaultProductId, null);
      if ("error" in result) {
        setError(result.error);
      } else {
        router.push(`/studio/${result.threadId}`);
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        title={
          !defaultProductId
            ? "Add a product before creating a creative"
            : undefined
        }
        className="btn-primary flex items-center gap-2 disabled:opacity-50"
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Plus className="h-4 w-4" />
        )}
        New creative
      </button>
      {error && (
        <span className="text-xs text-destructive" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
