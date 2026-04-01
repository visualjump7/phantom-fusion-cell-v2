"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare, Plus, Send, Loader2, CheckCircle,
  ThumbsUp, ThumbsDown, Eye, Building2, ShieldCheck,
  Clock, X, AlertTriangle, HelpCircle, Bell,
  Search, Trash2, Archive, ArchiveRestore,
  Pencil, Calendar as CalendarIcon, Link as LinkIcon,
  ChevronDown, ChevronRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import {
  createMessage,
  updateMessage,
  deleteMessage,
  fetchMessages,
  confirmResponse,
  archiveMessage,
  unarchiveMessage,
  getMessageStatus,
  Message,
  CreateMessageInput,
} from "@/lib/message-service";
import { formatTimeAgo } from "@/lib/utils";
import { useClientContext } from "@/lib/use-client-context";
import { ConfirmDialog } from "@/components/admin/shared/ConfirmDialog";
import { useRole } from "@/lib/use-role";
import { hasPermission } from "@/lib/permissions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface AssetOption {
  id: string;
  name: string;
  category: string;
}

const MESSAGE_TYPES = [
  { value: "decision", label: "Decision", icon: HelpCircle, color: "text-blue-400", bgColor: "bg-blue-500/10 border-blue-500/30", description: "Requires the principal to approve or reject", hasDueDate: true, hasActionUrl: false },
  { value: "action_required", label: "Action Required", icon: CheckCircle, color: "text-orange-400", bgColor: "bg-orange-500/10 border-orange-500/30", description: "Something the principal needs to take action on", hasDueDate: true, hasActionUrl: true },
  { value: "alert", label: "Alert", icon: AlertTriangle, color: "text-amber-400", bgColor: "bg-amber-500/10 border-amber-500/30", description: "Urgent notification", hasDueDate: false, hasActionUrl: false },
  { value: "update", label: "Update", icon: Bell, color: "text-muted-foreground", bgColor: "bg-muted/50 border-border", description: "Informational — no response needed", hasDueDate: false, hasActionUrl: true },
  { value: "comment", label: "Reply", icon: MessageSquare, color: "text-primary", bgColor: "bg-primary/10 border-primary/30", description: "A follow-up message or response", hasDueDate: false, hasActionUrl: false },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low", color: "text-muted-foreground" },
  { value: "medium", label: "Medium", color: "text-blue-400" },
  { value: "high", label: "High", color: "text-amber-400" },
  { value: "urgent", label: "Urgent", color: "text-red-400" },
];

export default function WorkspaceMessagesPage() {
  const { orgId, clientName } = useClientContext();
  const { role } = useRole();
  const canCompose = hasPermission(role, "composeMessages");

  const [messages, setMessages] = useState<Message[]>([]);
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  // Compose
  const [showCompose, setShowCompose] = useState(false);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [composeType, setComposeType] = useState("decision");
  const [composePriority, setComposePriority] = useState("medium");
  const [composeTitle, setComposeTitle] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composeAssetId, setComposeAssetId] = useState("");
  const [composeDueDate, setComposeDueDate] = useState("");
  const [composeActionUrl, setComposeActionUrl] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // Confirm
  const [confirmingResponse, setConfirmingResponse] = useState<{ responseId: string; messageTitle: string } | null>(null);
  const [confirmNote, setConfirmNote] = useState("");
  const [isConfirming, setIsConfirming] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Message | null>(null);

  async function loadData() {
    const [msgData, assetData] = await Promise.all([
      fetchMessages({ includeArchived: showArchived, organization_id: orgId }),
      db.from("assets").select("id, name, category").eq("organization_id", orgId).eq("is_deleted", false).order("name"),
    ]);
    setMessages(msgData);
    setAssets(assetData.data || []);
    setIsLoading(false);
  }

  useEffect(() => { loadData(); }, [orgId, showArchived]);

  const filteredMessages = useMemo(() => {
    return messages.filter((m) => {
      if (typeFilter !== "all" && m.type !== typeFilter) return false;
      if (filter !== "all") {
        const status = getMessageStatus(m);
        if (filter === "pending" && status !== "pending") return false;
        if (filter === "responded" && !["approved", "rejected", "acknowledged"].includes(status)) return false;
        if (filter === "confirmed" && status !== "confirmed") return false;
      }
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!m.title.toLowerCase().includes(q) && !(m.body && m.body.toLowerCase().includes(q))) return false;
      }
      return true;
    });
  }, [messages, filter, typeFilter, searchQuery]);

  const openCompose = (msg?: Message) => {
    if (msg) {
      setEditingMessage(msg);
      setComposeType(msg.type); setComposePriority(msg.priority); setComposeTitle(msg.title); setComposeBody(msg.body || "");
      setComposeAssetId(msg.asset_id || ""); setComposeDueDate(msg.due_date || ""); setComposeActionUrl(msg.action_url || "");
    } else {
      setEditingMessage(null);
      setComposeType("decision"); setComposePriority("medium"); setComposeTitle(""); setComposeBody("");
      setComposeAssetId(""); setComposeDueDate(""); setComposeActionUrl("");
    }
    setSendError(null);
    setShowCompose(true);
  };

  const handleSend = async () => {
    if (!composeTitle.trim()) { setSendError("Title is required."); return; }
    setIsSending(true); setSendError(null);
    try {
      if (editingMessage) {
        const result = await updateMessage(editingMessage.id, {
          title: composeTitle.trim(), body: composeBody.trim() || null, type: composeType as Message["type"],
          priority: composePriority as Message["priority"], asset_id: composeAssetId || null,
          due_date: composeDueDate || null, action_url: composeActionUrl.trim() || null,
        });
        if (!result.success) throw new Error(result.error);
      } else {
        const result = await createMessage({
          title: composeTitle.trim(), body: composeBody.trim() || undefined, type: composeType,
          priority: composePriority, asset_id: composeAssetId || null,
          due_date: composeDueDate || null, action_url: composeActionUrl.trim() || null,
          organization_id: orgId,
        });
        if (!result.success) throw new Error(result.error);
      }
      setShowCompose(false);
      await loadData();
    } catch (err: any) {
      setSendError(err.message || "Failed to send.");
    } finally {
      setIsSending(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteMessage(deleteTarget.id);
    setDeleteTarget(null);
    await loadData();
  };

  const handleArchive = async (msg: Message) => {
    if (msg.is_archived) await unarchiveMessage(msg.id);
    else await archiveMessage(msg.id);
    await loadData();
  };

  const handleConfirm = async () => {
    if (!confirmingResponse) return;
    setIsConfirming(true);
    await confirmResponse(confirmingResponse.responseId, confirmNote || undefined);
    setConfirmingResponse(null); setConfirmNote("");
    setIsConfirming(false);
    await loadData();
  };

  if (isLoading) {
    return <div className="flex min-h-[40vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Alerts & Messages</h1>
          <p className="text-sm text-muted-foreground">Manage communications for {clientName}</p>
        </div>
        {canCompose && <Button onClick={() => openCompose()}><Plus className="mr-2 h-4 w-4" />New Message</Button>}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search messages..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground">
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="responded">Responded</option>
          <option value="confirmed">Confirmed</option>
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground">
          <option value="all">All Types</option>
          {MESSAGE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <Button variant="outline" size="sm" onClick={() => setShowArchived(!showArchived)}>
          {showArchived ? <ArchiveRestore className="mr-1 h-3 w-3" /> : <Archive className="mr-1 h-3 w-3" />}
          {showArchived ? "Hide Archived" : "Show Archived"}
        </Button>
      </div>

      {/* Messages list */}
      <div className="space-y-2">
        {filteredMessages.length === 0 ? (
          <Card className="border-border"><CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <MessageSquare className="h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">No messages match your filters.</p>
          </CardContent></Card>
        ) : (
          filteredMessages.map((msg) => {
            const typeConfig = MESSAGE_TYPES.find((t) => t.value === msg.type) || MESSAGE_TYPES[0];
            const status = getMessageStatus(msg);
            const TypeIcon = typeConfig.icon;
            return (
              <Card key={msg.id} className={`border-border ${msg.is_archived ? "opacity-60" : ""}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <TypeIcon className={`h-4 w-4 ${typeConfig.color}`} />
                        <p className="font-medium text-foreground truncate">{msg.title}</p>
                        <Badge variant={status === "pending" ? "outline" : status === "confirmed" ? "default" : "secondary"}>
                          {status}
                        </Badge>
                        <Badge variant="outline" className="text-xs">{msg.priority}</Badge>
                      </div>
                      {msg.body && <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{msg.body}</p>}
                      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{formatTimeAgo(msg.created_at)}</span>
                        {msg.asset_name && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{msg.asset_name}</span>}
                        {msg.due_date && <span className="flex items-center gap-1"><CalendarIcon className="h-3 w-3" />{msg.due_date}</span>}
                      </div>
                      {/* Response info */}
                      {msg.response && (
                        <div className="mt-2 rounded-lg bg-muted/30 px-3 py-2 text-xs">
                          <span className="font-medium">
                            {msg.response.response_type === "approved" && <span className="text-emerald-400">Approved</span>}
                            {msg.response.response_type === "rejected" && <span className="text-red-400">Rejected</span>}
                            {msg.response.response_type === "acknowledged" && <span className="text-blue-400">Acknowledged</span>}
                          </span>
                          {msg.response.comment && <span className="text-muted-foreground"> — {msg.response.comment}</span>}
                          {msg.response.confirmed_at && (
                            <span className="text-emerald-400/70"> (Confirmed by admin)</span>
                          )}
                          {msg.response && !msg.response.confirmed_at && (status === "approved" || status === "rejected") && (
                            <Button variant="ghost" size="sm" className="ml-2 h-6 text-xs" onClick={() => setConfirmingResponse({ responseId: msg.response!.id, messageTitle: msg.title })}>
                              <ShieldCheck className="mr-1 h-3 w-3" />Confirm
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                    {canCompose && (
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openCompose(msg)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => handleArchive(msg)}>
                          {msg.is_archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(msg)}><Trash2 className="h-4 w-4 text-red-400" /></Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Compose Modal */}
      <AnimatePresence>
        {showCompose && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60" onClick={() => setShowCompose(false)} />
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">{editingMessage ? "Edit Message" : "New Message"}</h2>
                <button onClick={() => setShowCompose(false)}><X className="h-5 w-5 text-muted-foreground" /></button>
              </div>
              {sendError && <p className="mb-3 text-sm text-red-400">{sendError}</p>}
              <div className="space-y-3">
                <div><label className="text-xs text-muted-foreground">Type</label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {MESSAGE_TYPES.map((t) => (
                      <button key={t.value} onClick={() => setComposeType(t.value)}
                        className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${composeType === t.value ? t.bgColor : "border-border hover:bg-muted/30"}`}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div><label className="text-xs text-muted-foreground">Priority</label>
                  <div className="flex gap-2">
                    {PRIORITY_OPTIONS.map((p) => (
                      <button key={p.value} onClick={() => setComposePriority(p.value)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${composePriority === p.value ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted/30"}`}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div><label className="text-xs text-muted-foreground">Title *</label><Input value={composeTitle} onChange={(e) => setComposeTitle(e.target.value)} placeholder="Message title" /></div>
                <div><label className="text-xs text-muted-foreground">Body</label><textarea value={composeBody} onChange={(e) => setComposeBody(e.target.value)} rows={3}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground resize-none" placeholder="Optional message body..." /></div>
                <div><label className="text-xs text-muted-foreground">Project</label>
                  <select value={composeAssetId} onChange={(e) => setComposeAssetId(e.target.value)} className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground">
                    <option value="">None</option>
                    {assets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                {MESSAGE_TYPES.find((t) => t.value === composeType)?.hasDueDate && (
                  <div><label className="text-xs text-muted-foreground">Due Date</label><Input type="date" value={composeDueDate} onChange={(e) => setComposeDueDate(e.target.value)} /></div>
                )}
                {MESSAGE_TYPES.find((t) => t.value === composeType)?.hasActionUrl && (
                  <div><label className="text-xs text-muted-foreground">Action URL</label><Input value={composeActionUrl} onChange={(e) => setComposeActionUrl(e.target.value)} placeholder="https://..." /></div>
                )}
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowCompose(false)}>Cancel</Button>
                <Button onClick={handleSend} disabled={isSending}>
                  {isSending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Send className="mr-2 h-4 w-4" />{editingMessage ? "Save" : "Send"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Message"
        description={`Are you sure you want to delete "${deleteTarget?.title}"?`}
        clientName={clientName}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Confirm Response Dialog */}
      <AnimatePresence>
        {confirmingResponse && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60" onClick={() => setConfirmingResponse(null)} />
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="relative w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl">
              <h3 className="text-base font-semibold">Confirm Response</h3>
              <p className="mt-1 text-sm text-muted-foreground">Confirm the response to &quot;{confirmingResponse.messageTitle}&quot;</p>
              <textarea value={confirmNote} onChange={(e) => setConfirmNote(e.target.value)} rows={2} placeholder="Optional note..."
                className="mt-3 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground resize-none" />
              <div className="mt-4 flex justify-end gap-3">
                <Button variant="outline" onClick={() => setConfirmingResponse(null)}>Cancel</Button>
                <Button onClick={handleConfirm} disabled={isConfirming}>
                  {isConfirming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <ShieldCheck className="mr-2 h-4 w-4" />Confirm
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
