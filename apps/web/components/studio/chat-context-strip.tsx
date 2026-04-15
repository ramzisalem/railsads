"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateThreadContext } from "@/lib/studio/actions";
import { AWARENESS_LEVELS, ANGLE_PRESETS } from "@/lib/studio/types";
import { FieldSelect } from "@/components/ui/field-select";

interface ChatContextStripProps {
  threadId: string;
  angle: string | null;
  awareness: string | null;
}

export function ChatContextStrip({
  threadId,
  angle,
  awareness,
}: ChatContextStripProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function patch(data: Parameters<typeof updateThreadContext>[1]) {
    startTransition(async () => {
      await updateThreadContext(threadId, data);
      router.refresh();
    });
  }

  return (
    <div className="border-0 bg-transparent px-4 pb-1.5 pt-2 sm:px-6">
      <h2 className="sr-only">Chat context</h2>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <div className="flex max-w-full items-center gap-2">
          <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Angle
          </span>
          <FieldSelect
            value={angle}
            onChange={(v) => patch({ angle: v })}
            allowUnset
            unsetLabel="None"
            disabled={isPending}
            aria-label="Creative angle"
            size="compact"
            width="hug"
            options={ANGLE_PRESETS.map((a) => ({ value: a, label: a }))}
          />
        </div>
        <div className="flex max-w-full items-center gap-2">
          <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Awareness
          </span>
          <FieldSelect
            value={awareness}
            onChange={(v) => patch({ awareness: v })}
            allowUnset
            unsetLabel="Not set"
            disabled={isPending}
            aria-label="Audience awareness level"
            size="compact"
            width="hug"
            options={AWARENESS_LEVELS.map((l) => ({
              value: l.value,
              label: l.label,
            }))}
          />
        </div>
      </div>
    </div>
  );
}
