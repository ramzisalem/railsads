"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateThreadContext } from "@/lib/studio/actions";
import type { ThreadDetail, StudioContext, IcpOption } from "@/lib/studio/types";
import { cn } from "@/lib/utils";

type ContextTab = "product" | "icp" | "templates";

interface ContextPanelProps {
  thread: ThreadDetail;
  context: StudioContext;
}

export function ContextPanel({ thread, context }: ContextPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [tab, setTab] = useState<ContextTab>("product");

  const icpsForProduct = context.icps.filter(
    (i) => i.product_id === thread.product_id
  );

  function update(data: Parameters<typeof updateThreadContext>[1]) {
    startTransition(async () => {
      await updateThreadContext(thread.id, data);
      router.refresh();
    });
  }

  const firstIcpId = icpsForProduct[0]?.id ?? null;

  /** Pick first ICP for this product when the thread has none (e.g. new thread). */
  useEffect(() => {
    if (thread.icp_id != null || !firstIcpId) return;
    startTransition(async () => {
      await updateThreadContext(thread.id, { icp_id: firstIcpId });
      router.refresh();
    });
  }, [thread.id, thread.product_id, thread.icp_id, firstIcpId, router]);

  const tabs: { id: ContextTab; label: string }[] = [
    { id: "product", label: "Product" },
    { id: "icp", label: "ICP" },
    { id: "templates", label: "Templates" },
  ];

  return (
    <div className="rounded-2xl bg-secondary-soft p-4 sm:p-5">
      <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Context
      </h3>

      <div
        className="mb-4 flex rounded-xl border border-border bg-card/80 p-1"
        role="tablist"
        aria-label="Context sections"
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex-1 rounded-lg px-2 py-2 text-center text-xs font-medium transition-colors sm:text-sm",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-1 focus-visible:ring-offset-card",
              tab === t.id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        className="max-h-[min(52vh,28rem)] overflow-y-auto overscroll-contain pr-0.5"
      >
        {tab === "product" && (
          <div className="grid gap-2">
            {context.products.map((p) => {
              const selected = p.id === thread.product_id;
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={isPending}
                  onClick={() =>
                    update({
                      product_id: p.id,
                      icp_id: null,
                    })
                  }
                  className={cn(
                    "rounded-xl border bg-card p-3 text-left transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                    selected
                      ? "border-primary bg-primary-soft"
                      : "border-border hover:border-primary/35 hover:bg-muted/40"
                  )}
                >
                  <div className="text-sm font-medium">{p.name}</div>
                  {p.short_description && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {p.short_description}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {tab === "icp" && (
          <div className="grid gap-2">
            {icpsForProduct.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                No ICPs for this product yet. Add audiences on the product page.
              </p>
            ) : (
              icpsForProduct.map((i: IcpOption) => {
                const selected = i.id === thread.icp_id;
                return (
                  <button
                    key={i.id}
                    type="button"
                    disabled={isPending}
                    onClick={() => update({ icp_id: i.id })}
                    className={cn(
                      "rounded-xl border bg-card p-3 text-left transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                      selected
                        ? "border-primary bg-primary-soft"
                        : "border-border hover:border-primary/35 hover:bg-muted/40"
                    )}
                  >
                    <div className="text-sm font-medium">{i.title}</div>
                    {i.summary && (
                      <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">
                        {i.summary}
                      </p>
                    )}
                  </button>
                );
              })
            )}
          </div>
        )}

        {tab === "templates" && (
          <div className="grid gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={() => update({ template_id: null })}
              className={cn(
                "rounded-xl border bg-card p-3 text-left transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                thread.template_id == null
                  ? "border-primary bg-primary-soft"
                  : "border-border hover:border-primary/35 hover:bg-muted/40"
              )}
            >
              <div className="text-sm font-medium">No template</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Free-form creative without a template structure.
              </p>
            </button>
            {context.templates.map((t) => {
              const selected = t.id === thread.template_id;
              return (
                <button
                  key={t.id}
                  type="button"
                  disabled={isPending}
                  onClick={() => update({ template_id: t.id })}
                  className={cn(
                    "rounded-xl border bg-card p-3 text-left transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                    selected
                      ? "border-primary bg-primary-soft"
                      : "border-border hover:border-primary/35 hover:bg-muted/40"
                  )}
                >
                  <div className="text-sm font-medium">{t.name}</div>
                  {t.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {t.description}
                    </p>
                  )}
                  {t.category && (
                    <p className="mt-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {t.category}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
