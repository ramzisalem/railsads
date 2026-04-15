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
          "input-field flex w-full min-h-0 items-center justify-between gap-2 py-1.5 text-left text-sm",
          "data-popup-open:ring-2 data-popup-open:ring-primary",
          triggerClassName,
          className
        )}
      >
        <Select.Value className="min-w-0 flex-1 truncate">
          {(v: string) =>
            allOptions.find((o) => o.value === v)?.label ?? unsetLabel
          }
        </Select.Value>
        <Select.Icon className="shrink-0 text-muted-foreground [&_svg]:size-4">
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
              "max-h-[min(280px,var(--available-height))] min-w-[var(--anchor-width)] overflow-y-auto rounded-xl border border-border bg-popover py-1 text-popover-foreground shadow-lg outline-none"
            )}
          >
            <Select.List className="outline-none">
              {allOptions.map((opt) => (
                <Select.Item
                  key={opt.value}
                  value={opt.value}
                  label={opt.label}
                  className={cn(
                    "flex cursor-default items-center gap-2 px-3 py-2 text-sm outline-none select-none",
                    "data-highlighted:bg-muted data-highlighted:text-foreground",
                    "data-[selected]:bg-primary/10"
                  )}
                >
                  <Select.ItemText className="min-w-0 flex-1 truncate">
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
