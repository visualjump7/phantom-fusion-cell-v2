"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Loader2, ArrowRight } from "lucide-react";
import { SearchResult } from "@/lib/search-types";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "How much am I spending on insurance across all projects?",
  "What decisions need my attention?",
  "Show me all pending bills over $100K",
  "Break down this month's largest expenses",
  "What's due in the next 30 days?",
  "Total value of all business projects",
];

interface SearchBarProps {
  organizationId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function SearchBar({ organizationId, isOpen, onClose }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto-focus & reset on open/close
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery("");
      setResult(null);
      setError(null);
      setDurationMs(null);
    }
  }, [isOpen]);

  // Scroll lock
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Global Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  const executeSearch = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim() || !organizationId) return;

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setIsLoading(true);
      setResult(null);
      setError(null);

      try {
        const res = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: searchQuery, organizationId }),
          signal: controller.signal,
        });

        const data = await res.json();

        if (data.success) {
          setResult(data.result);
          setDurationMs(data.durationMs);
        } else {
          setError(data.error || "Search failed.");
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        setError("Unable to search right now. Check your connection.");
      } finally {
        setIsLoading(false);
      }
    },
    [organizationId]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeSearch(query);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    executeSearch(suggestion);
  };

  const handleProjectClick = (assetId: string) => {
    onClose();
    router.push(`/assets/${assetId}`);
  };

  const handleFollowUp = (followUpQuery: string) => {
    setQuery(followUpQuery);
    executeSearch(followUpQuery);
  };

  if (!mounted || !isOpen) return null;

  const content = (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh]"
        role="dialog"
        aria-modal="true"
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/70" onClick={onClose} />

        {/* Panel */}
        <motion.div
          ref={panelRef}
          initial={{ opacity: 0, scale: 0.96, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -10 }}
          transition={{ type: "spring", duration: 0.3, bounce: 0.1 }}
          className="relative z-10 w-full max-w-2xl rounded-xl border border-border bg-card shadow-2xl"
        >
          {/* Search input */}
          <form onSubmit={handleSubmit} className="flex items-center border-b border-border px-4">
            <Search className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search across your projects..."
              aria-label="Search across your projects"
              className="flex-1 bg-transparent px-3 py-4 text-lg text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setResult(null);
                  setError(null);
                  inputRef.current?.focus();
                }}
                className="rounded p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </form>

          {/* Content area */}
          <div className="max-h-[60vh] overflow-y-auto">
            {/* Loading */}
            {isLoading && (
              <div className="px-4 py-8">
                <div className="mb-3 h-1 overflow-hidden rounded-full bg-muted">
                  <motion.div
                    className="h-full bg-primary"
                    initial={{ x: "-100%" }}
                    animate={{ x: "100%" }}
                    transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
                    style={{ width: "40%" }}
                  />
                </div>
                <p className="text-center text-sm text-muted-foreground">
                  Searching across all projects...
                </p>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="px-4 py-6">
                <p className="text-sm text-amber-400">{error}</p>
              </div>
            )}

            {/* Results */}
            {result && !isLoading && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="px-4 py-4"
                aria-live="polite"
              >
                {/* Total */}
                {result.formattedTotal && (
                  <p className="text-2xl font-medium text-primary">
                    {result.formattedTotal}
                  </p>
                )}

                {/* Answer */}
                <p className="mt-2 text-sm leading-relaxed text-foreground">
                  {result.answer}
                </p>

                {/* Breakdown */}
                {result.breakdown && result.breakdown.length > 0 && (
                  <div className="mt-4 space-y-1">
                    {result.breakdown.map((item, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded-lg px-3 py-2 transition-colors hover:bg-muted/30"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-foreground">
                              {item.label}
                            </span>
                            {item.assetId && item.assetName && (
                              <button
                                onClick={() => handleProjectClick(item.assetId!)}
                                className="text-xs text-primary hover:underline"
                              >
                                {item.assetName}
                              </button>
                            )}
                          </div>
                          {item.detail && (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {item.detail}
                            </p>
                          )}
                        </div>
                        {item.formattedValue && (
                          <span className="ml-3 flex-shrink-0 text-sm font-medium text-foreground">
                            {item.formattedValue}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Sources + Duration */}
                <div className="mt-4 flex items-center gap-2">
                  {result.sources &&
                    result.sources.map((source) => (
                      <span
                        key={source}
                        className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium capitalize text-muted-foreground"
                      >
                        {source}
                      </span>
                    ))}
                  {durationMs && (
                    <span className="text-[10px] text-muted-foreground">
                      Found in {(durationMs / 1000).toFixed(1)}s
                    </span>
                  )}
                </div>

                {/* Follow-up */}
                {result.followUp && (
                  <button
                    onClick={() => handleFollowUp(result.followUp!)}
                    className="mt-3 flex items-center gap-1.5 text-xs text-primary hover:underline"
                  >
                    <ArrowRight className="h-3 w-3" />
                    You might also ask: {result.followUp}
                  </button>
                )}
              </motion.div>
            )}

            {/* Suggestions (when empty) */}
            {!isLoading && !result && !error && (
              <div className="px-4 py-4">
                <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Try asking
                </p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleSuggestionClick(s)}
                      className="rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-border px-4 py-2">
            <span className="text-[10px] text-muted-foreground">
              Advanced Search
            </span>
            <kbd className="rounded border border-border/50 px-1.5 py-0.5 text-[10px] text-muted-foreground/60">
              ESC to close
            </kbd>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  return createPortal(content, document.body);
}

export function SearchTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-lg px-3 py-1.5",
        "text-sm text-muted-foreground",
        "border border-border/50",
        "hover:border-border hover:text-foreground",
        "transition-colors"
      )}
    >
      <Search className="h-3.5 w-3.5" />
      <span className="hidden lg:inline">Search...</span>
      <kbd
        className={cn(
          "hidden lg:inline-flex items-center gap-0.5",
          "rounded border border-border/50 px-1.5 py-0.5",
          "text-[10px] text-muted-foreground/60"
        )}
      >
        ⌘K
      </kbd>
    </button>
  );
}
