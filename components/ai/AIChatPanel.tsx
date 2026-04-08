"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Send,
  Loader2,
  Sparkles,
  RotateCcw,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const QUICK_PROMPTS = [
  { label: "What needs my attention?", text: "What needs my attention right now? Prioritize the most urgent items." },
  { label: "Pending decisions", text: "What decisions are waiting for me? Summarize each one." },
  { label: "Cash flow breakdown", text: "Break down my cash flow this month by category and asset." },
  { label: "Project summary", text: "Give me a full project summary with values by category." },
  { label: "Overdue items", text: "Are there any overdue bills or urgent messages I should know about?" },
  { label: "Upcoming 30 days", text: "What are the biggest expenses coming up in the next 30 days?" },
];

function renderMessageContent(content: string) {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const parts: (string | { text: string; href: string })[] = [];
  let lastIndex = 0;
  let match;

  while ((match = linkRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }
    parts.push({ text: match[1], href: match[2] });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  return parts.map((part, i) => {
    if (typeof part === "string") {
      return <span key={i}>{part}</span>;
    }
    return (
      <Link
        key={i}
        href={part.href}
        className="inline-flex items-center gap-0.5 rounded-md bg-white/10 px-1.5 py-0.5 text-white hover:bg-white/20 transition-colors"
      >
        {part.text}
        <ChevronRight className="h-3 w-3" />
      </Link>
    );
  });
}

interface AIChatPanelProps {
  /** Optional className for the root container */
  className?: string;
  /** Show the header bar */
  showHeader?: boolean;
}

export function AIChatPanel({ className = "", showHeader = true }: AIChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        role: "user",
        content: text.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInputValue("");
      setIsLoading(true);

      try {
        const conversationHistory = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const response = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [{ role: "user", content: text.trim() }],
            conversationHistory,
          }),
        });

        if (!response.ok) throw new Error("Failed to get response");

        const data = await response.json();

        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.message,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } catch {
        const errorMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "I'm having trouble connecting right now. Please try again in a moment.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, isLoading]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputValue);
  };

  const clearConversation = () => setMessages([]);

  return (
    <div className={`flex flex-col h-full min-h-0 ${className}`}>
      {showHeader && (
        <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-white/10">
              <Sparkles className="h-3.5 w-3.5 text-white" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-white">Fusion Cell AI</h3>
              <p className="text-[9px] text-white/40">Full project awareness</p>
            </div>
          </div>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={clearConversation}
              title="Clear conversation"
              className="rounded-md p-1 text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 min-h-0">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center">
            <Sparkles className="mb-2 h-6 w-6 text-white/30" />
            <p className="mb-1 text-xs font-medium text-white/80">How can I help?</p>
            <p className="mb-4 text-center text-[10px] text-white/40 px-2">
              I have full visibility into your projects, bills, messages, and budgets.
            </p>
            <div className="grid w-full grid-cols-1 gap-1.5">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt.label}
                  onClick={() => sendMessage(prompt.text)}
                  className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-left text-[10px] text-white/60 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white"
                >
                  {prompt.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[88%] rounded-xl px-2.5 py-1.5 text-[11px] ${
                    message.role === "user"
                      ? "bg-white/20 text-white"
                      : "bg-white/5 text-white/90 border border-white/10"
                  }`}
                >
                  {message.role === "assistant" ? (
                    <div className="whitespace-pre-wrap leading-relaxed">
                      {renderMessageContent(message.content)}
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  )}
                </div>
              </motion.div>
            ))}
            {isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-start"
              >
                <div className="flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-2.5 py-1.5">
                  <Loader2 className="h-3 w-3 animate-spin text-white/60" />
                  <span className="text-[10px] text-white/50">Analyzing your data...</span>
                </div>
              </motion.div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-white/10 px-3 py-2 shrink-0"
      >
        <div className="flex items-center gap-1.5">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask about your finances..."
            disabled={isLoading}
            className="flex-1 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-white/30 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/15 text-white hover:bg-white/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="h-3 w-3" />
          </button>
        </div>
      </form>
    </div>
  );
}
