"use client";

/**
 * BriefingPrompt — Phase-2 placeholder input + static suggestion chips.
 *
 * Pure typing today (voice can layer on later). Submit / send is intentionally
 * a no-op until the Advanced Search wiring lands; keeping the input visible
 * with realistic chips fills the layout out and shows the executive what kinds
 * of questions will work once it's hooked up.
 *
 * Suggestion chips fill the input on click — no auto-submit. That keeps the
 * affordance honest until we have somewhere for the input to actually go.
 */

import { useState } from "react";

const SUGGESTIONS = [
  "Show me what's overdue",
  "Brief me on today",
  "What needs my approval?",
  "What's on my calendar this week?",
] as const;

export interface BriefingPromptProps {
  /** ⌘K shortcut hint shown on the right of the input. */
  shortcutHint?: string;
}

export function BriefingPrompt({ shortcutHint = "⌘K" }: BriefingPromptProps) {
  const [value, setValue] = useState("");

  return (
    <div className="w-full max-w-md">
      {/* Input — visual only, no submit handler. The dot on the left mirrors
          the orb's mint accent so the input feels tied to the central UI. */}
      <div
        className="flex items-center gap-2 rounded-full border border-border bg-card/40 px-4 py-2.5 transition focus-within:border-emerald-400/50 focus-within:ring-2 focus-within:ring-emerald-400/20"
      >
        <span
          aria-hidden
          className="h-2 w-2 shrink-0 rounded-full bg-emerald-400"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Type your question…"
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          aria-label="Ask Advanced Search"
        />
        {shortcutHint && (
          <kbd className="hidden shrink-0 rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-block">
            {shortcutHint}
          </kbd>
        )}
      </div>

      {/* Static suggestion chips — clicking fills the input above. */}
      <div className="mt-3 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setValue(s)}
            className="rounded-full border border-border bg-card/40 px-3 py-1 text-xs text-muted-foreground transition hover:border-emerald-400/40 hover:text-foreground"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
