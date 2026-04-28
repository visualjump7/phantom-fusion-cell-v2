"use client";

/**
 * Comms → Chat tab (principal). Thread list + empty state.
 * Outer chrome (Navbar + Comms header + tabs) comes from app/comms/layout.tsx.
 *
 * Principals can read and reply but cannot create threads in Phase 1 —
 * directors open the conversation first.
 */

import { useEffect, useState } from "react";
import { useRole } from "@/lib/use-role";
import { fetchThreads, type ChatThread } from "@/lib/chat-service";
import { ThreadList } from "@/components/chat/ThreadList";

export default function PrincipalCommsChatPage() {
  const { userId } = useRole();
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="h-[calc(100dvh-14rem)] min-h-[400px] overflow-hidden rounded-xl border border-border bg-card/40">
      <ThreadList
        threads={threads}
        currentUserId={userId}
        baseHref="/comms/chat"
        isLoading={loading}
        emptyStateLabel="No conversations yet. Your team will start one when they need to reach you."
      />
    </div>
  );
}
