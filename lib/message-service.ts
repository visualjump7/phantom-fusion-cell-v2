import { supabase } from "./supabase";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface Message {
  id: string;
  organization_id: string;
  asset_id: string | null;
  asset_name: string | null;
  sender_id: string | null;
  sender_email: string | null;
  type: "alert" | "action_required" | "decision" | "update" | "comment";
  priority: "low" | "medium" | "high" | "urgent";
  title: string;
  body: string | null;
  action_url: string | null;
  due_date: string | null;
  is_archived: boolean;
  is_deleted: boolean;
  created_at: string;
  response: MessageResponse | null;
}

export interface MessageResponse {
  id: string;
  message_id: string;
  user_id: string;
  response_type: "approved" | "rejected" | "acknowledged" | "comment";
  comment: string | null;
  created_at: string;
  user_email?: string;
  confirmed_at: string | null;
  confirmed_by: string | null;
  confirmed_by_email?: string | null;
  confirmation_note: string | null;
}

export type MessageStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "acknowledged"
  | "confirmed"
  | "comment";

export function getMessageStatus(msg: Message): MessageStatus {
  if (!msg.response) return "pending";
  if (msg.response.confirmed_at) return "confirmed";
  return msg.response.response_type;
}

export interface CreateMessageInput {
  title: string;
  body?: string;
  type: string;
  priority: string;
  asset_id?: string | null;
  due_date?: string | null;
  action_url?: string | null;
  organization_id: string;
}

export interface FetchMessagesOptions {
  type?: string;
  priority?: string;
  status?: string; // "pending" | "responded" | "confirmed" | "all"
  includeArchived?: boolean;
  includeDeleted?: boolean;
  search?: string;
  asset_id?: string;
}

// ─── FETCH ───

export async function fetchMessages(options?: FetchMessagesOptions): Promise<Message[]> {
  let query = db
    .from("messages")
    .select("*, assets:asset_id(name), sender:sender_id(email)")
    .order("created_at", { ascending: false });

  if (!options?.includeDeleted) query = query.eq("is_deleted", false);
  if (!options?.includeArchived) query = query.eq("is_archived", false);
  if (options?.type && options.type !== "all") query = query.eq("type", options.type);
  if (options?.priority && options.priority !== "all") query = query.eq("priority", options.priority);
  if (options?.asset_id) query = query.eq("asset_id", options.asset_id);

  const { data: messages, error } = await query;
  if (error || !messages) return [];

  const messageIds = messages.map((m: any) => m.id);
  if (messageIds.length === 0) {
    return messages.map((m: any) => ({
      ...m,
      asset_name: m.assets?.name || null,
      sender_email: m.sender?.email || null,
      response: null,
    }));
  }

  // Fetch responses
  const { data: responses } = await db
    .from("message_responses")
    .select("*, profiles:user_id(email)")
    .in("message_id", messageIds)
    .order("created_at", { ascending: false });

  const responseLookup = new Map<string, MessageResponse>();
  (responses || []).forEach((r: any) => {
    if (!responseLookup.has(r.message_id)) {
      responseLookup.set(r.message_id, {
        id: r.id,
        message_id: r.message_id,
        user_id: r.user_id,
        response_type: r.response_type,
        comment: r.comment,
        created_at: r.created_at,
        user_email: r.profiles?.email || null,
        confirmed_at: r.confirmed_at || null,
        confirmed_by: r.confirmed_by || null,
        confirmed_by_email: null,
        confirmation_note: r.confirmation_note || null,
      });
    }
  });

  // Fetch confirmer emails
  const confirmedByIds = Array.from(responseLookup.values())
    .filter((r) => r.confirmed_by)
    .map((r) => r.confirmed_by!);

  if (confirmedByIds.length > 0) {
    const { data: profiles } = await db.from("profiles").select("id, email").in("id", confirmedByIds);
    const emailMap = new Map<string, string>(
      (profiles || []).map((p: { id: string; email?: string }) => [p.id, typeof p.email === "string" ? p.email : ""])
    );
    responseLookup.forEach((r) => {
      if (r.confirmed_by) r.confirmed_by_email = emailMap.get(r.confirmed_by) || null;
    });
  }

  let result = messages.map((m: any) => ({
    ...m,
    asset_name: m.assets?.name || null,
    sender_email: m.sender?.email || null,
    response: responseLookup.get(m.id) || null,
  }));

  // Client-side status filter
  if (options?.status && options.status !== "all") {
    result = result.filter((m: Message) => {
      const s = getMessageStatus(m);
      if (options.status === "pending") return s === "pending";
      if (options.status === "responded") return s === "approved" || s === "rejected" || s === "acknowledged";
      if (options.status === "confirmed") return s === "confirmed";
      if (options.status === "needs_confirmation") return (s === "approved" || s === "rejected") && !m.response?.confirmed_at;
      return true;
    });
  }

  // Client-side search
  if (options?.search) {
    const q = options.search.toLowerCase();
    result = result.filter((m: Message) =>
      m.title.toLowerCase().includes(q) ||
      (m.body && m.body.toLowerCase().includes(q)) ||
      (m.asset_name && m.asset_name.toLowerCase().includes(q))
    );
  }

  return result;
}

// ─── CREATE ───

export async function createMessage(msg: CreateMessageInput): Promise<{ success: boolean; id?: string; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await db
    .from("messages")
    .insert({
      title: msg.title,
      body: msg.body || null,
      type: msg.type,
      priority: msg.priority,
      asset_id: msg.asset_id || null,
      due_date: msg.due_date || null,
      action_url: msg.action_url || null,
      organization_id: msg.organization_id,
      sender_id: user?.id,
    })
    .select("id")
    .single();
  if (error) return { success: false, error: error.message };
  return { success: true, id: data.id };
}

// ─── UPDATE ───

export async function updateMessage(
  messageId: string,
  updates: Partial<Pick<Message, "title" | "body" | "type" | "priority" | "asset_id" | "due_date" | "action_url">>
): Promise<{ success: boolean; error?: string }> {
  const { error } = await db.from("messages").update(updates).eq("id", messageId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ─── SOFT DELETE ───

export async function deleteMessage(messageId: string): Promise<boolean> {
  const { error } = await db
    .from("messages")
    .update({ is_deleted: true })
    .eq("id", messageId);
  return !error;
}

// ─── ARCHIVE / UNARCHIVE ───

export async function archiveMessage(messageId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await db
    .from("messages")
    .update({ is_archived: true, archived_at: new Date().toISOString(), archived_by: user?.id })
    .eq("id", messageId);
  return !error;
}

export async function unarchiveMessage(messageId: string): Promise<boolean> {
  const { error } = await db
    .from("messages")
    .update({ is_archived: false, archived_at: null, archived_by: null })
    .eq("id", messageId);
  return !error;
}

// ─── RESPOND (executive) ───

export async function respondToMessage(
  messageId: string,
  responseType: "approved" | "rejected" | "acknowledged" | "comment",
  comment?: string
): Promise<{ success: boolean; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const { data: existing } = await db
    .from("message_responses")
    .select("id")
    .eq("message_id", messageId)
    .eq("user_id", user.id)
    .single();

  if (existing) {
    const { error } = await db
      .from("message_responses")
      .update({
        response_type: responseType,
        comment: comment || null,
        created_at: new Date().toISOString(),
        confirmed_at: null,
        confirmed_by: null,
        confirmation_note: null,
      })
      .eq("id", existing.id);
    if (error) return { success: false, error: error.message };
  } else {
    const { error } = await db.from("message_responses").insert({
      message_id: messageId,
      user_id: user.id,
      response_type: responseType,
      comment: comment || null,
    });
    if (error) return { success: false, error: error.message };
  }

  return { success: true };
}

// ─── CONFIRM (admin) ───

export async function confirmResponse(
  responseId: string,
  note?: string
): Promise<{ success: boolean; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const { error } = await db
    .from("message_responses")
    .update({
      confirmed_at: new Date().toISOString(),
      confirmed_by: user.id,
      confirmation_note: note || null,
    })
    .eq("id", responseId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}
