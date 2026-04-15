"use client";

interface QuickActionsProps {
  onAction: (prompt: string) => void;
  disabled?: boolean;
}

const ACTIONS = [
  { label: "Make it shorter", prompt: "Make it shorter and punchier" },
  { label: "More emotional", prompt: "Make it more emotional" },
  { label: "Add urgency", prompt: "Add urgency to the copy" },
  { label: "Try UGC style", prompt: "Rewrite in a UGC testimonial style" },
  { label: "Focus on benefits", prompt: "Focus more on the key benefits" },
];

export function QuickActions({ onAction, disabled }: QuickActionsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {ACTIONS.map((a) => (
        <button
          key={a.label}
          onClick={() => onAction(a.prompt)}
          disabled={disabled}
          className="btn-ghost rounded-xl border text-xs px-3 py-1.5 hover:bg-muted transition-colors disabled:opacity-50"
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}
