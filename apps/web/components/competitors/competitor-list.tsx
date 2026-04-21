"use client";

import { useMemo, useState } from "react";
import type { CompetitorListItem } from "@/lib/competitors/queries";
import { CompetitorCard } from "./competitor-card";

type FilterMode = "active" | "archived" | "all";

interface CompetitorListProps {
  competitors: CompetitorListItem[];
}

const FILTER_LABEL: Record<FilterMode, string> = {
  active: "Active",
  archived: "Archived",
  all: "All",
};

export function CompetitorList({ competitors }: CompetitorListProps) {
  const [mode, setMode] = useState<FilterMode>("active");
  const [query, setQuery] = useState("");

  const counts = useMemo(() => {
    let active = 0;
    let archived = 0;
    for (const c of competitors) {
      if (c.status === "archived") archived++;
      else active++;
    }
    return { active, archived, all: competitors.length };
  }, [competitors]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return competitors.filter((c) => {
      if (mode === "active" && c.status === "archived") return false;
      if (mode === "archived" && c.status !== "archived") return false;
      if (q.length === 0) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.website_url ?? "").toLowerCase().includes(q)
      );
    });
  }, [competitors, mode, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1 rounded-lg bg-muted/40 p-1">
          {(Object.keys(FILTER_LABEL) as FilterMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors " +
                (mode === m
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              {FILTER_LABEL[m]}
              <span className="ml-1.5 text-[10px] text-muted-foreground">
                {counts[m]}
              </span>
            </button>
          ))}
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by name or domain"
          className="input-field text-xs sm:max-w-xs"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {mode === "archived"
            ? "No archived competitors."
            : "No competitors match those filters."}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <CompetitorCard key={c.id} competitor={c} />
          ))}
        </div>
      )}
    </div>
  );
}
