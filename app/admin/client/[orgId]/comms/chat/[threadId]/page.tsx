"use client";

/**
 * Director-side single-thread view, scoped to a client workspace.
 */

import { useParams } from "next/navigation";
import { ThreadView } from "@/components/chat/ThreadView";

export default function AdminClientChatThreadPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const threadId = params.threadId as string;

  return (
    <div className="h-[calc(100dvh-12rem)] min-h-[400px] overflow-hidden rounded-xl border border-border bg-card/40">
      <ThreadView threadId={threadId} backHref={`/admin/client/${orgId}/comms/chat`} />
    </div>
  );
}
