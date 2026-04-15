"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

type ThemeChoice = "light" | "dark" | "system";

const OPTIONS: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export function ThemeAppearance() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="panel p-6 space-y-4">
      <div>
        <h2 className="heading-md">Appearance</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose light, dark, or match your device setting.
        </p>
      </div>

      {!mounted ? (
        <div
          className="flex h-10 gap-2 rounded-xl bg-muted/50 animate-pulse"
          aria-hidden
        />
      ) : (
        <div
          className="inline-flex rounded-xl border border-border bg-muted/40 p-1"
          role="group"
          aria-label="Theme"
        >
          {OPTIONS.map(({ value, label, icon: Icon }) => {
            const selected = theme === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setTheme(value)}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  selected
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
                aria-pressed={selected}
                aria-label={`${label} theme`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </button>
            );
          })}
        </div>
      )}

      {mounted && theme === "system" && resolvedTheme && (
        <p className="text-xs text-muted-foreground">
          Using {resolvedTheme === "dark" ? "dark" : "light"} (from your system).
        </p>
      )}
    </div>
  );
}
