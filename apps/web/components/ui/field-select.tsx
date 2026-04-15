"use client";

import * as React from "react";
import { Select } from "@base-ui/react/select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const UNSET = "__field_select_unset__";

export type FieldSelectOption = { value: string; label: string };

export interface FieldSelectProps {
  id?: string;
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  options: FieldSelectOption[];
  /** When true, first option is an empty value labeled `unsetLabel`. */
  allowUnset?: boolean;
  unsetLabel?: string;
  disabled?: boolean;
  "aria-label"?: string;
  className?: string;
  triggerClassName?: string;
  /** Tighter trigger for toolbars / chat chrome */
  size?: "default" | "compact";
  /** `hug` sizes the trigger to the label; `full` stretches in flex layouts (default). */
  width?: "full" | "hug";
}

export function FieldSelect({
  id,
  value,
  onChange,
  options,
  allowUnset = true,
  unsetLabel = "None",
  disabled,
  "aria-label": ariaLabel,
  className,
  triggerClassName,
  size = "default",
  width = "full",
}: FieldSelectProps) {
  const allOptions = React.useMemo<FieldSelectOption[]>(() => {
    if (allowUnset) {
      return [{ value: UNSET, label: unsetLabel }, ...options];
    }
    return options;
  }, [allowUnset, unsetLabel, options]);

  const resolvedValue = React.useMemo(() => {
    if (!allowUnset) {
      if (value && options.some((o) => o.value === value)) return value;
      return options[0]?.value ?? UNSET;
    }
    if (value && options.some((o) => o.value === value)) return value;
    return UNSET;
  }, [allowUnset, value, options]);

  return (
    <Select.Root
      value={resolvedValue}
      onValueChange={(v) => {
        const s = String(v);
        if (s === UNSET) onChange(null);
        else onChange(s);
      }}
      disabled={disabled || (!allowUnset && options.length === 0)}
      modal={false}
    >
      <Select.Trigger
        id={id}
        aria-label={ariaLabel}
        className={cn(
          "group min-h-0 items-center justify-between text-left font-medium text-foreground transition-colors",
          width === "hug"
            ? "inline-flex w-max max-w-[min(100%,18rem)]"
            : "flex w-full",
          "rounded-xl border border-border bg-card hover:bg-muted",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "disabled:pointer-events-none disabled:opacity-50",
          size === "compact"
            ? "gap-1.5 px-2.5 py-1.5 text-xs"
            : "gap-2 px-3 py-2 text-sm",
          triggerClassName,
          className
        )}
      >
        <Select.Value
          className={cn(
            "min-w-0 truncate",
            width === "hug" ? "max-w-[14rem] shrink" : "flex-1",
            size === "compact" && "text-xs"
          )}
        >
          {(v: string) =>
            allOptions.find((o) => o.value === v)?.label ?? unsetLabel
          }
        </Select.Value>
        <Select.Icon
          className={cn(
            "shrink-0 text-muted-foreground transition-transform duration-200 group-data-[popup-open]:rotate-180",
            size === "compact" ? "[&_svg]:size-3.5" : "[&_svg]:size-4"
          )}
        >
          <ChevronDown />
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Positioner
          className="z-[200] outline-none"
          sideOffset={6}
          align="start"
          alignItemWithTrigger
        >
          <Select.Popup
            className={cn(
              "max-h-[min(280px,var(--available-height))] min-w-[var(--anchor-width)] overflow-hidden rounded-xl border border-border bg-card text-foreground shadow-panel outline-none"
            )}
          >
            <Select.List className="max-h-[inherit] overflow-y-auto overscroll-contain p-1 outline-none">
              {allOptions.map((opt) => (
                <Select.Item
                  key={opt.value}
                  value={opt.value}
                  label={opt.label}
                  className={cn(
                    "flex w-full cursor-default select-none items-center justify-between gap-2 rounded-lg px-3 py-2 outline-none transition-colors",
                    size === "compact" ? "text-xs py-1.5" : "text-sm",
                    "data-highlighted:bg-muted data-highlighted:text-foreground",
                    "data-[selected]:bg-muted"
                  )}
                >
                  <Select.ItemText className="min-w-0 flex-1 truncate text-left">
                    {opt.label}
                  </Select.ItemText>
                  <Select.ItemIndicator className="shrink-0 text-primary">
                    <Check className="size-3.5" aria-hidden />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
