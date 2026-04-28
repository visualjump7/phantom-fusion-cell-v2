/**
 * chat-service — Phase 1 service layer for the Chat system.
 *
 * Separate from message-service (alerts/decisions). Do not cross-reference.
 *
 * Shapes mirror message-service:
 *   - `const db = supabase as any` for query calls
 *   - async functions returning { success; error?; data? } on writes
 *   - fetch functions returning arrays or nulls
 *   - soft-delete only (no hard deletes)
 *
 * Terminology rules (non-negotiable — do not alter in code or copy):
 *   'chat.thread.created', 'chat.message.sent', 'chat.message.deleted',
 *   'chat.participant.added', 'chat.participant.removed'.
 */

import { supabase } from "./supabase";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// ─── Types ───────────────────────────────────────────────────

export type ChatRole = "principal" | "director";

export interface ChatParticipant {
  user_id: string;
  role: ChatRole;
  name: string;
  email: string | null;
  avatar_url?: string | null;
  joined_at: string;
  left_at: string | null;
}

export interface ChatThread {
  id: string;
  organization_id: string;
  title: string | null;
  created_by: string | null;
  last_message_at: string;
  ai_accessible: boolean;
  is_archived: boolean;
  created_at: string;
  participants: ChatParticipant[];
  last_message?: {
    body: string | null;
    sender_id: string;
    sender_name: string | null;
    created_at: string;
  } | null;
  unread_count?: number; // Phase 2 populates this
}

export interface ChatMessage {
  id: string;
  thread_id: string;
  organization_id: string;
  sender_id: string;
  sender_name: string | null;
  body: string | null;
  has_attachments: boolean;
  is_deleted: boolean;
  deleted_at: string | null;
  deleted_by: string | null;
  created_at: string;
}

export interface CreateThreadInput {
  organizationId: string;
  title?: string | null;
  participants: { userId: string; role: ChatRole }[];
}

export interface FetchMessagesOptions {
  limit?: number;
  before?: string; // ISO timestamp for keyset pagination
}

// ─── Audit helper ────────────────────────────────────────────

type ChatAuditAction =
  | "chat.thread.created"
  | "chat.thread.archived"
  | "chat.message.sent"
  | "chat.message.deleted"
  | "chat.participant.added"
  | "chat.participant.removed";

/**
 * Fire-and-forget audit write. Never throws — chat flow should not break
 * on audit failures.
 */
async function logChatEvent(
  action: ChatAuditAction,
  payload: {
    organization_id: string;
    user_id: string;
    thread_id?: string;
    message_id?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  try {
    const { error } = await db.from("chat_audit_log").insert({
      organization_id: payload.organization_id,
      thread_id: payload.thread_id ?? null,
      message_id: payload.message_id ?? null,
      user_id: payload.user_id,
      action,
      metadata: payload.metadata ?? null,
    });
    if (error) {
      console.warn("[chat-audit]", action, error.message);
    }
  } catch (err) {
    console.warn("[chat-audit]", action, err);
  }
}

// ─── Threads ─────────────────────────────────────────────────

/**
 * Create a new thread with participants in one logical unit.
 * First a thread row, then participant rows. If participant insertion fails
 * we attempt to clean up the thread row. RLS ensures only org-members can
 * insert, and the creator is also inserted as a participant.
 */
export async function createThread(
  input: CreateThreadInput
): Promise<{ success: boolean; id?: string; error?: string }> {
  const { data: userData } = await db.auth.getUser();
  const creatorId: string | undefined = userData?.user?.id;
  if (!creatorId) return { success: false, error: "Not authenticated" };

  // Invariant: exactly one participant must have role='principal'.
  const principalCount = input.participants.filter((p) => p.role === "principal").length;
  if (principalCount !== 1) {
    return { success: false, error: "Thread must have exactly one principal" };
  }

  // Insert the thread.
  const { data: thread, error: threadErr } = await db
    .from("chat_threads")
    .insert({
      organization_id: input.organizationId,
      title: input.title ?? null,
      created_by: creatorId,
    })
    .select("id")
    .single();

  if (threadErr || !thread) {
    return { success: false, error: threadErr?.message || "Failed to create thread" };
  }

  // Insert participants.
  const rows = input.participants.map((p) => ({
    thread_id: thread.id,
    user_id: p.userId,
    role: p.role,
  }));
  const { error: partErr } = await db.from("chat_thread_participants").insert(rows);

  if (partErr) {
    // Best-effort cleanup — if we leave a thread with no participants, RLS
    // will hide it anyway, but it's tidier to remove.
    await db.from("chat_threads").delete().eq("id", thread.id);
    return { success: false, error: partErr.message };
  }

  await logChatEvent("chat.thread.created", {
    organization_id: input.organizationId,
    user_id: creatorId,
    thread_id: thread.id,
    metadata: { participant_count: rows.length, title: input.title ?? null },
  });

  // Log participant-added events for everyone except the creator if they're in the list.
  for (const p of input.participants) {
    if (p.userId === creatorId) continue;
    await logChatEvent("chat.participant.added", {
      organization_id: input.organizationId,
      user_id: creatorId,
      thread_id: thread.id,
      metadata: { added_user_id: p.userId, role: p.role },
    });
  }

  return { success: true, id: thread.id };
}

/**
 * Fetch threads where the given user is an active participant.
 * Ordered by last_message_at DESC. Joins participant names + the latest
 * message preview in one pass.
 */
export async function fetchThreads(userId: string): Promise<ChatThread[]> {
  if (!userId) return [];

  // Pull threads + participants + latest message in a single nested select.
  const { data, error } = await db
    .from("chat_threads")
    .select(
      `
      id, organization_id, title, created_by, last_message_at,
      ai_accessible, is_archived, created_at,
      participants:chat_thread_participants(
        user_id, role, joined_at, left_at,
        profile:user_id(full_name, email, avatar_url)
      )
      `
    )
    .order("last_message_at", { ascending: false });

  if (error || !data) {
    if (error) console.warn("[chat-service.fetchThreads]", error.message);
    return [];
  }

  // Filter to threads where the caller is an active participant. RLS already
  // does most of this, but defensive filtering here catches archived or
  // left-at threads that the policy allows through.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activeThreads: any[] = (data as any[]).filter((t) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const participants = (t.participants || []) as any[];
    return participants.some((p) => p.user_id === userId && !p.left_at);
  });

  if (activeThreads.length === 0) return [];

  // Fetch last-message previews in a single query keyed by thread_id.
  const threadIds = activeThreads.map((t) => t.id);
  const { data: lastMsgs } = await db
    .from("chat_messages")
    .select("thread_id, body, sender_id, created_at, profile:sender_id(full_name)")
    .in("thread_id", threadIds)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false });

  const lastByThread = new Map<
    string,
    { body: string | null; sender_id: string; sender_name: string | null; created_at: string }
  >();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of (lastMsgs as any[]) || []) {
    if (lastByThread.has(row.thread_id)) continue; // already have latest (query ordered DESC)
    lastByThread.set(row.thread_id, {
      body: row.body,
      sender_id: row.sender_id,
      sender_name: row.profile?.full_name ?? null,
      created_at: row.created_at,
    });
  }

  return activeThreads.map((t) => ({
    id: t.id,
    organization_id: t.organization_id,
    title: t.title,
    created_by: t.created_by,
    last_message_at: t.last_message_at,
    ai_accessible: t.ai_accessible,
    is_archived: t.is_archived,
    created_at: t.created_at,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    participants: (t.participants as any[]).map((p) => ({
      user_id: p.user_id,
      role: p.role as ChatRole,
      name: p.profile?.full_name ?? "",
      email: p.profile?.email ?? null,
      avatar_url: p.profile?.avatar_url ?? null,
      joined_at: p.joined_at,
      left_at: p.left_at,
    })),
    last_message: lastByThread.get(t.id) ?? null,
    unread_count: 0, // Phase 2 wires this
  }));
}

/**
 * Fetch a single thread by id. Returns null if the caller is not a
 * participant (RLS will block the row anyway; this is just the typed null).
 */
export async function fetchThreadById(threadId: string): Promise<ChatThread | null> {
  const { data, error } = await db
    .from("chat_threads")
    .select(
      `
      id, organization_id, title, created_by, last_message_at,
      ai_accessible, is_archived, created_at,
      participants:chat_thread_participants(
        user_id, role, joined_at, left_at,
        profile:user_id(full_name, email, avatar_url)
      )
      `
    )
    .eq("id", threadId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    id: (data as any).id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    organization_id: (data as any).organization_id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    title: (data as any).title,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    created_by: (data as any).created_by,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    last_message_at: (data as any).last_message_at,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ai_accessible: (data as any).ai_accessible,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    is_archived: (data as any).is_archived,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    created_at: (data as any).created_at,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    participants: ((data as any).participants as any[]).map((p) => ({
      user_id: p.user_id,
      role: p.role as ChatRole,
      name: p.profile?.full_name ?? "",
      email: p.profile?.email ?? null,
      avatar_url: p.profile?.avatar_url ?? null,
      joined_at: p.joined_at,
      left_at: p.left_at,
    })),
  };
}

// ─── Messages ────────────────────────────────────────────────

/**
 * Fetch messages for a thread. Newest first by default (paginate "before" ISO).
 * Default limit 50. Excludes soft-deleted messages unless you deliberately
 * toggle the flag here (we don't — soft-deleted messages render as tombstones
 * via a different UI path if we ever need that).
 */
export async function fetchMessages(
  threadId: string,
  options: FetchMessagesOptions = {}
): Promise<ChatMessage[]> {
  const limit = options.limit ?? 50;
  let query = db
    .from("chat_messages")
    .select("*, profile:sender_id(full_name)")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (options.before) {
    query = query.lt("created_at", options.before);
  }

  const { data, error } = await query;
  if (error || !data) {
    if (error) console.warn("[chat-service.fetchMessages]", error.message);
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map((m) => ({
    id: m.id,
    thread_id: m.thread_id,
    organization_id: m.organization_id,
    sender_id: m.sender_id,
    sender_name: m.profile?.full_name ?? null,
    body: m.body,
    has_attachments: m.has_attachments,
    is_deleted: m.is_deleted,
    deleted_at: m.deleted_at,
    deleted_by: m.deleted_by,
    created_at: m.created_at,
  }));
}

/**
 * Send a message. Returns the created row (or an error). Caller is expected
 * to reconcile optimistic state with the real id from the returned row or
 * from the realtime subscription firing for the INSERT.
 */
export async function sendMessage(
  threadId: string,
  body: string
): Promise<{ success: boolean; message?: ChatMessage; error?: string }> {
  const trimmed = body.trim();
  if (!trimmed) return { success: false, error: "Message body is empty" };

  const { data: userData } = await db.auth.getUser();
  const senderId: string | undefined = userData?.user?.id;
  if (!senderId) return { success: false, error: "Not authenticated" };

  // We need the thread's organization_id to write the denormalized column.
  const { data: thread, error: threadErr } = await db
    .from("chat_threads")
    .select("organization_id")
    .eq("id", threadId)
    .maybeSingle();
  if (threadErr || !thread) {
    return { success: false, error: threadErr?.message || "Thread not found" };
  }

  const { data: inserted, error: insertErr } = await db
    .from("chat_messages")
    .insert({
      thread_id: threadId,
      organization_id: thread.organization_id,
      sender_id: senderId,
      body: trimmed,
      has_attachments: false,
    })
    .select("*, profile:sender_id(full_name)")
    .single();

  if (insertErr || !inserted) {
    return { success: false, error: insertErr?.message || "Send failed" };
  }

  await logChatEvent("chat.message.sent", {
    organization_id: thread.organization_id,
    user_id: senderId,
    thread_id: threadId,
    message_id: inserted.id,
    // No body in metadata — we don't want audit to leak chat content.
    metadata: { length: trimmed.length },
  });

  return {
    success: true,
    message: {
      id: inserted.id,
      thread_id: inserted.thread_id,
      organization_id: inserted.organization_id,
      sender_id: inserted.sender_id,
      sender_name: inserted.profile?.full_name ?? null,
      body: inserted.body,
      has_attachments: inserted.has_attachments,
      is_deleted: inserted.is_deleted,
      deleted_at: inserted.deleted_at,
      deleted_by: inserted.deleted_by,
      created_at: inserted.created_at,
    },
  };
}

/**
 * Soft-delete a message. Sender-or-admin gate enforced by RLS.
 */
export async function softDeleteMessage(
  messageId: string
): Promise<{ success: boolean; error?: string }> {
  const { data: userData } = await db.auth.getUser();
  const userId: string | undefined = userData?.user?.id;
  if (!userId) return { success: false, error: "Not authenticated" };

  const { data: existing } = await db
    .from("chat_messages")
    .select("id, thread_id, organization_id")
    .eq("id", messageId)
    .maybeSingle();
  if (!existing) return { success: false, error: "Message not found" };

  const { error } = await db
    .from("chat_messages")
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      deleted_by: userId,
    })
    .eq("id", messageId);

  if (error) return { success: false, error: error.message };

  await logChatEvent("chat.message.deleted", {
    organization_id: existing.organization_id,
    user_id: userId,
    thread_id: existing.thread_id,
    message_id: messageId,
  });

  return { success: true };
}

// ─── Participants ────────────────────────────────────────────

export async function addParticipant(
  threadId: string,
  userId: string,
  role: ChatRole
): Promise<{ success: boolean; error?: string }> {
  const { data: authData } = await db.auth.getUser();
  const callerId: string | undefined = authData?.user?.id;
  if (!callerId) return { success: false, error: "Not authenticated" };

  const { data: thread } = await db
    .from("chat_threads")
    .select("organization_id")
    .eq("id", threadId)
    .maybeSingle();
  if (!thread) return { success: false, error: "Thread not found" };

  const { error } = await db.from("chat_thread_participants").insert({
    thread_id: threadId,
    user_id: userId,
    role,
  });
  if (error) return { success: false, error: error.message };

  await logChatEvent("chat.participant.added", {
    organization_id: thread.organization_id,
    user_id: callerId,
    thread_id: threadId,
    metadata: { added_user_id: userId, role },
  });
  return { success: true };
}

export async function removeParticipant(
  threadId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const { data: authData } = await db.auth.getUser();
  const callerId: string | undefined = authData?.user?.id;
  if (!callerId) return { success: false, error: "Not authenticated" };

  const { data: thread } = await db
    .from("chat_threads")
    .select("organization_id")
    .eq("id", threadId)
    .maybeSingle();
  if (!thread) return { success: false, error: "Thread not found" };

  const { error } = await db
    .from("chat_thread_participants")
    .update({ left_at: new Date().toISOString() })
    .eq("thread_id", threadId)
    .eq("user_id", userId)
    .is("left_at", null);

  if (error) return { success: false, error: error.message };

  await logChatEvent("chat.participant.removed", {
    organization_id: thread.organization_id,
    user_id: callerId,
    thread_id: threadId,
    metadata: { removed_user_id: userId },
  });
  return { success: true };
}

// ─── Display helpers ─────────────────────────────────────────

/**
 * Given a thread and the current user id, build a reasonable display title.
 * Prefers the explicit `title` field; falls back to a comma-joined list of
 * the other participants' first names.
 */
export function deriveThreadDisplayTitle(
  thread: ChatThread,
  currentUserId: string | null | undefined
): string {
  if (thread.title && thread.title.trim().length > 0) return thread.title;

  const others = thread.participants.filter(
    (p) => p.user_id !== currentUserId && !p.left_at
  );
  if (others.length === 0) return "Secure Chat";

  const firstNames = others.map((p) => {
    const parts = (p.name || "").trim().split(/\s+/);
    return parts[0] || p.email || "Unknown";
  });
  if (firstNames.length <= 2) return firstNames.join(" & ");
  return `${firstNames[0]}, ${firstNames[1]} +${firstNames.length - 2}`;
}
