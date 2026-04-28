"use client";

/**
 * CommsModule — embedded Comms surface for the command overlay.
 *
 * Two tabs: Secure Chat (default) + Alerts.
 * Chat uses in-frame navigation (ThreadList/ThreadView's callback mode) so
 * opening a thread doesn't tear down the overlay. Alerts dynamically loads
 * the /comms/alerts page content — same code path as the standalone route.
 */

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { MessageCircle, MessageSquare, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRole } from "@/lib/use-role";
import { fetchThreads, type ChatThread } from "@/lib/chat-service";
import { ThreadList } from "@/components/chat/ThreadList";
import { ThreadView } from "@/components/chat/ThreadView";

// Alerts tab loads the same page the /comms/alerts route renders.
const AlertsView = dynamic(
  () => import("@/app/comms/alerts/page").then((m) => m.default),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-40 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-400/40 border-t-emerald-400" />
      </div>
    ),
  }
);

type CommsTab = "chat" | "alerts";

export function CommsModule() {
  const [activeTab, setActiveTab] = useState<CommsTab>("chat");

  return (
    <div className="flex h-full w-full flex-col">
      {/* Tab pills — mirror the /comms layout pattern. */}
      <div className="shrink-0 border-b border-white/10 px-4 py-3">
        <div className="flex gap-2">
          <TabPill
            active={activeTab === "chat"}
            icon={MessageCircle}
            onClick={() => setActiveTab("chat")}
          >
            Secure Chat
          </TabPill>
          <TabPill
            active={activeTab === "alerts"}
            icon={MessageSquare}
            onClick={() => setActiveTab("alerts")}
          >
            Alerts
          </TabPill>
        </div>
      </div>

      {/* Tab content */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {activeTab === "chat" ? (
          <ChatSurface />
        ) : (
          <div className="h-full overflow-y-auto px-4 py-4 sm:px-6">
            <AlertsView />
          </div>
        )}
      </div>
    </div>
  );
}

function TabPill({
  active,
  icon: Icon,
  onClick,
  children,
}: {
  active: boolean;
  icon: LucideIcon;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
      )}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}

/**
 * ChatSurface — embedded thread list → thread view, driven by internal state
 * so selection stays inside the overlay rather than route-navigating out.
 */
function ChatSurface() {
  const { userId } = useRole();
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoading(true);
    fetchThreads(userId).then((rows) => {
      if (cancelled) return;
      setThreads(rows);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (activeThreadId) {
    return (
      <ThreadView
        threadId={activeThreadId}
        backHref="/comms/chat"
        onBack={() => setActiveThreadId(null)}
      />
    );
  }

  return (
    <ThreadList
      threads={threads}
      currentUserId={userId}
      baseHref="/comms/chat"
      onThreadClick={(id) => setActiveThreadId(id)}
      activeThreadId={activeThreadId}
      isLoading={loading}
      emptyStateLabel="No conversations yet. Your team will start one when they need to reach you."
    />
  );
}

export default CommsModule;
