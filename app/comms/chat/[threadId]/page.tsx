"use client";

/**
 * Comms → Chat → single thread (principal).
 * Outer chrome (Navbar + Comms header + tabs) comes from app/comms/layout.tsx.
 */

import { useParams } from "next/navigation";
import { ThreadView } from "@/components/chat/ThreadView";

export default function PrincipalCommsChatThreadPage() {
  const params = useParams();
  const threadId = params.threadId as string;

  return (
    <div className="h-[calc(100dvh-14rem)] min-h-[400px] overflow-hidden rounded-xl border border-border bg-card/40">
      <ThreadView threadId={threadId} backHref="/comms/chat" />
    </div>
  );
}
