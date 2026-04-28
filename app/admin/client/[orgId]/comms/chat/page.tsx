"use client";

/**
 * Director-side chat thread list, scoped to a client workspace.
 * Matches the existing workspace pattern (layout already wraps us in
 * ClientContextProvider + ClientBanner).
 */

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useRole } from "@/lib/use-role";
import { fetchThreads, type ChatThread } from "@/lib/chat-service";
import { ThreadList } from "@/components/chat/ThreadList";
import { NewThreadModal } from "@/components/chat/NewThreadModal";

export default function AdminClientChatPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const { userId } = useRole();
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const all = await fetchThreads(userId);
    // Scope to this workspace's org.
    setThreads(all.filter((t) => t.organization_id === orgId));
    setLoading(false);
  }, [userId, orgId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="h-[calc(100dvh-12rem)] min-h-[400px] overflow-hidden rounded-xl border border-border bg-card/40">
      <ThreadList
        threads={threads}
        currentUserId={userId}
        baseHref={`/admin/client/${orgId}/comms/chat`}
        canCreate
        onCreateClick={() => setModalOpen(true)}
        isLoading={loading}
        emptyStateLabel="Start a conversation with this principal."
      />

      <NewThreadModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          // Refresh after a create (the modal routes to the new thread on
          // success, but if the admin cancels or routes back, refresh anyway).
          load();
        }}
        orgId={orgId}
        redirectBase={`/admin/client/${orgId}/comms/chat`}
      />
    </div>
  );
}
