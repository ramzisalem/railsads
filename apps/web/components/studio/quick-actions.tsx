"use client";

import {
  Flame,
  Heart,
  Scissors,
  Sparkles,
  Zap,
  type LucideIcon,
} from "lucide-react";

interface QuickActionsProps {
  onAction: (prompt: string) => void;
  disabled?: boolean;
}

const ACTIONS: { label: string; prompt: string; icon: LucideIcon }[] = [
  {
    label: "Make it shorter",
    prompt: "Make it shorter and punchier",
    icon: Scissors,
  },
  { label: "More emotional", prompt: "Make it more emotional", icon: Heart },
  { label: "Add urgency", prompt: "Add urgency to the copy", icon: Zap },
  {
    label: "UGC style",
    prompt: "Rewrite in a UGC testimonial style",
    icon: Sparkles,
  },
  {
    label: "Focus on benefits",
    prompt: "Focus more on the key benefits",
    icon: Flame,
  },
];

export function QuickActions({ onAction, disabled }: QuickActionsProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {ACTIONS.map(({ label, prompt, icon: Icon }) => (
        <button
          key={label}
          type="button"
          onClick={() => onAction(prompt)}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary-soft hover:text-primary disabled:opacity-50"
        >
          <Icon className="h-3 w-3 text-muted-foreground transition-colors group-hover:text-primary" />
          {label}
        </button>
      ))}
    </div>
  );
}
