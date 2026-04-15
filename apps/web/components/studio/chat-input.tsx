"use client";

import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";

interface ChatInputProps {
  threadId: string;
  onSend: (message: string) => Promise<void>;
  disabled?: boolean;
}

export function ChatInput({ threadId, onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [threadId]);

  function autoResize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }

  async function handleSubmit() {
    const trimmed = value.trim();
    if (!trimmed || isSending || disabled) return;

    setValue("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    setIsSending(true);
    try {
      await onSend(trimmed);
    } finally {
      setIsSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  const isDisabled = isSending || disabled;

  return (
    <div className="border-t bg-card px-4 py-3 sm:px-6">
      <div className="flex items-end gap-3">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            autoResize();
          }}
          onKeyDown={handleKeyDown}
          placeholder="Ask for changes or improvements..."
          rows={1}
          disabled={isDisabled}
          className="flex-1 resize-none rounded-2xl border bg-background px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-primary"
        />
        <button
          onClick={handleSubmit}
          disabled={isDisabled || !value.trim()}
          className="shrink-0 rounded-xl bg-primary p-3 text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-40"
          aria-label="Send message"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
