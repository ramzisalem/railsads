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
    <div className="shrink-0 border-b bg-muted/30 px-3 py-2.5 sm:px-4">
      <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        Chat context
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-4">
        <div className="min-w-0 flex-1 space-y-1">
          <span className="text-xs text-muted-foreground">Angle</span>
          <FieldSelect
            value={angle}
            onChange={(v) => patch({ angle: v })}
            allowUnset
            unsetLabel="None"
            disabled={isPending}
            aria-label="Creative angle"
            options={ANGLE_PRESETS.map((a) => ({ value: a, label: a }))}
          />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <span className="text-xs text-muted-foreground">Awareness</span>
          <FieldSelect
            value={awareness}
            onChange={(v) => patch({ awareness: v })}
            allowUnset
            unsetLabel="Not set"
            disabled={isPending}
            aria-label="Audience awareness level"
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
