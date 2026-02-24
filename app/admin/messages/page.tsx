"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare, Plus, Send, Loader2, CheckCircle,
  ThumbsUp, ThumbsDown, Eye, Building2, ShieldCheck,
  Clock, X, AlertTriangle, HelpCircle, Bell,
  Search, Filter, Trash2, Archive, ArchiveRestore,
  Pencil, Calendar as CalendarIcon, Link as LinkIcon,
  ChevronDown, ChevronRight, MoreHorizontal,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
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

const ORG_ID = "00000000-0000-0000-0000-000000000001";

interface AssetOption {
  id: string;
  name: string;
  category: string;
}

// ─── TYPE CONFIGS ───
const MESSAGE_TYPES = [
  {
    value: "decision",
    label: "Decision",
    icon: HelpCircle,
    color: "text-blue-400",
    bgColor: "bg-blue-500/10 border-blue-500/30",
    description: "Requires the principal to approve or reject",
    hasDueDate: true,
    hasActionUrl: false,
  },
  {
    value: "action_required",
    label: "Action Required",
    icon: CheckCircle,
    color: "text-orange-400",
    bgColor: "bg-orange-500/10 border-orange-500/30",
    description: "Something the principal needs to take action on",
    hasDueDate: true,
    hasActionUrl: true,
  },
  {
    value: "alert",
    label: "Alert",
    icon: AlertTriangle,
    color: "text-amber-400",
    bgColor: "bg-amber-500/10 border-amber-500/30",
    description: "Urgent notification — something the principal should know immediately",
    hasDueDate: false,
    hasActionUrl: false,
  },
  {
    value: "update",
    label: "Update",
    icon: Bell,
    color: "text-muted-foreground",
    bgColor: "bg-muted/50 border-border",
    description: "Informational — no response needed",
    hasDueDate: false,
    hasActionUrl: true,
  },
  {
    value: "comment",
    label: "Reply",
    icon: MessageSquare,
    color: "text-primary",
    bgColor: "bg-primary/10 border-primary/30",
    description: "A follow-up message or response to the principal",
    hasDueDate: false,
    hasActionUrl: false,
  },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low", color: "text-muted-foreground" },
  { value: "medium", label: "Medium", color: "text-blue-400" },
  { value: "high", label: "High", color: "text-amber-400" },
  { value: "urgent", label: "Urgent", color: "text-red-400" },
];

export default function AdminMessagesPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [filterType, setFilterType] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  // Compose
  const [showCompose, setShowCompose] = useState(false);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [isSending, setIsSending] = useState(false);

  // Compose fields
  const [composeType, setComposeType] = useState("decision");
  const [composeTitle, setComposeTitle] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composePriority, setComposePriority] = useState("medium");
  const [composeAssetId, setComposeAssetId] = useState("");
  const [composeDueDate, setComposeDueDate] = useState("");
  const [composeActionUrl, setComposeActionUrl] = useState("");

  // Confirmation modal
  const [confirmingResponse, setConfirmingResponse] = useState<{
    responseId: string;
    messageTitle: string;
    responseType: string;
  } | null>(null);
  const [confirmNote, setConfirmNote] = useState("");
  const [isConfirming, setIsConfirming] = useState(false);

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Context menu
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const loadData = async () => {
    const [msgData, assetRes] = await Promise.all([
      fetchMessages({
        type: filterType,
        priority: filterPriority,
        status: filterStatus,
        includeArchived: showArchived,
        search: searchQuery || undefined,
      }),
      db.from("assets").select("id, name, category").eq("is_deleted", false).order("name"),
    ]);
    setMessages(msgData);
    setAssets(assetRes.data || []);
    setIsLoading(false);
  };

  useEffect(() => {
    setIsLoading(true);
    loadData();
  }, [filterType, filterPriority, filterStatus, showArchived]);

  // Debounced search
  useEffect(() => {
    const timeout = setTimeout(() => {
      setIsLoading(true);
      loadData();
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  // Stats
  const stats = useMemo(() => {
    const all = messages;
    return {
      total: all.length,
      pending: all.filter((m) => getMessageStatus(m) === "pending" && (m.type === "decision" || m.type === "action_required")).length,
      needsConfirmation: all.filter((m) => {
        const s = getMessageStatus(m);
        return (s === "approved" || s === "rejected") && !m.response?.confirmed_at;
      }).length,
      confirmed: all.filter((m) => m.response?.confirmed_at).length,
      approved: all.filter((m) => m.response?.response_type === "approved").length,
      rejected: all.filter((m) => m.response?.response_type === "rejected").length,
    };
  }, [messages]);

  // ─── COMPOSE ───

  const typeConfig = MESSAGE_TYPES.find((t) => t.value === composeType)!;

  const resetCompose = () => {
    setComposeType("decision");
    setComposeTitle("");
    setComposeBody("");
    setComposePriority("medium");
    setComposeAssetId("");
    setComposeDueDate("");
    setComposeActionUrl("");
    setEditingMessage(null);
  };

  const openCompose = (msg?: Message) => {
    if (msg) {
      setEditingMessage(msg);
      setComposeType(msg.type);
      setComposeTitle(msg.title);
      setComposeBody(msg.body || "");
      setComposePriority(msg.priority);
      setComposeAssetId(msg.asset_id || "");
      setComposeDueDate(msg.due_date ? msg.due_date.split("T")[0] : "");
      setComposeActionUrl(msg.action_url || "");
    } else {
      resetCompose();
    }
    setShowCompose(true);
  };

  const handleSend = async () => {
    if (!composeTitle.trim()) return;
    setIsSending(true);

    if (editingMessage) {
      await updateMessage(editingMessage.id, {
        title: composeTitle.trim(),
        body: composeBody.trim() || null,
        type: composeType as any,
        priority: composePriority as any,
        asset_id: composeAssetId || null,
        due_date: composeDueDate || null,
        action_url: composeActionUrl.trim() || null,
      });
    } else {
      await createMessage({
        title: composeTitle.trim(),
        body: composeBody.trim() || undefined,
        type: composeType,
        priority: composePriority,
        asset_id: composeAssetId || null,
        due_date: composeDueDate || null,
        action_url: composeActionUrl.trim() || null,
        organization_id: ORG_ID,
      });
    }

    resetCompose();
    setShowCompose(false);
    setIsSending(false);
    await loadData();
  };

  // ─── ACTIONS ───

  const handleConfirm = async () => {
    if (!confirmingResponse) return;
    setIsConfirming(true);
    await confirmResponse(confirmingResponse.responseId, confirmNote || undefined);
    setConfirmingResponse(null);
    setConfirmNote("");
    setIsConfirming(false);
    await loadData();
  };

  const handleDelete = async (id: string) => {
    await deleteMessage(id);
    setDeletingId(null);
    await loadData();
  };

  const handleArchive = async (id: string) => {
    await archiveMessage(id);
    setOpenMenuId(null);
    await loadData();
  };

  const handleUnarchive = async (id: string) => {
    await unarchiveMessage(id);
    setOpenMenuId(null);
    await loadData();
  };

  // ─── GROUP BY CATEGORY ───

  const groupedAssets = useMemo(() => {
    const groups: Record<string, AssetOption[]> = {};
    assets.forEach((a) => {
      if (!groups[a.category]) groups[a.category] = [];
      groups[a.category].push(a);
    });
    return groups;
  }, [assets]);

  // ─── RENDER ───

  const typeIcons: Record<string, React.ReactNode> = {
    alert: <AlertTriangle className="h-4 w-4 text-amber-400" />,
    action_required: <CheckCircle className="h-4 w-4 text-orange-400" />,
    decision: <HelpCircle className="h-4 w-4 text-blue-400" />,
    update: <Bell className="h-4 w-4 text-muted-foreground" />,
    comment: <MessageSquare className="h-4 w-4 text-primary" />,
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
      </div>
      <Navbar />

      <motion.main initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <MessageSquare className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Message Center</h1>
              <p className="text-sm text-muted-foreground">Compose, manage, and track principal communications</p>
            </div>
          </div>
          <Button onClick={() => openCompose()}>
            <Plus className="mr-2 h-4 w-4" />New Message
          </Button>
        </div>

        {/* Stats Row */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <button onClick={() => { setFilterStatus("all"); }} className="text-left">
            <Card className={`border-border bg-card/60 transition-colors hover:border-primary/30 ${filterStatus === "all" ? "border-primary/50" : ""}`}>
              <CardContent className="p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</p>
                <p className="text-xl font-bold text-foreground">{stats.total}</p>
              </CardContent>
            </Card>
          </button>
          <button onClick={() => setFilterStatus("pending")} className="text-left">
            <Card className={`border-border bg-card/60 transition-colors hover:border-amber-500/30 ${filterStatus === "pending" ? "border-amber-500/50" : ""}`}>
              <CardContent className="p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Awaiting Response</p>
                <p className="text-xl font-bold text-amber-400">{stats.pending}</p>
              </CardContent>
            </Card>
          </button>
          <button onClick={() => setFilterStatus("needs_confirmation")} className="text-left">
            <Card className={`border-border bg-card/60 transition-colors hover:border-orange-500/30 ${filterStatus === "needs_confirmation" ? "border-orange-500/50" : ""}`}>
              <CardContent className="p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Needs Confirmation</p>
                <p className="text-xl font-bold text-orange-400">{stats.needsConfirmation}</p>
              </CardContent>
            </Card>
          </button>
          <button onClick={() => setFilterStatus("confirmed")} className="text-left">
            <Card className={`border-border bg-card/60 transition-colors hover:border-primary/30 ${filterStatus === "confirmed" ? "border-primary/50" : ""}`}>
              <CardContent className="p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Confirmed</p>
                <p className="text-xl font-bold text-primary">{stats.confirmed}</p>
              </CardContent>
            </Card>
          </button>
        </div>

        {/* Search & Filters */}
        <div className="mb-6 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search messages, assets..."
              className="pl-10"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground"><Filter className="inline h-3 w-3 mr-1" />Type:</span>
            {[{ value: "all", label: "All" }, ...MESSAGE_TYPES.map((t) => ({ value: t.value, label: t.label }))].map((t) => (
              <button key={t.value} onClick={() => setFilterType(t.value)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  filterType === t.value ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:text-foreground"
                }`}>
                {t.label}
              </button>
            ))}
            <span className="ml-2 text-xs text-muted-foreground">Priority:</span>
            {[{ value: "all", label: "All" }, ...PRIORITY_OPTIONS].map((p) => (
              <button key={p.value} onClick={() => setFilterPriority(p.value)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  filterPriority === p.value ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:text-foreground"
                }`}>
                {p.label}
              </button>
            ))}
            <label className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)}
                className="rounded border-border" />
              Show archived
            </label>
          </div>
        </div>

        {/* ═══ COMPOSE FORM ═══ */}
        <AnimatePresence>
          {showCompose && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="mb-6">
              <Card className="border-primary/30 bg-card/90 shadow-lg shadow-primary/5">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-base font-semibold text-foreground">
                      {editingMessage ? "Edit Message" : "New Message to Principal"}
                    </h2>
                    <button onClick={() => { setShowCompose(false); resetCompose(); }}>
                      <X className="h-5 w-5 text-muted-foreground" />
                    </button>
                  </div>

                  {/* Type selector — visual cards */}
                  <div className="mb-5">
                    <label className="mb-2 block text-xs font-semibold text-muted-foreground uppercase tracking-wider">Message Type</label>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                      {MESSAGE_TYPES.map((t) => {
                        const Icon = t.icon;
                        const isSelected = composeType === t.value;
                        return (
                          <button
                            key={t.value}
                            onClick={() => setComposeType(t.value)}
                            className={`rounded-xl border p-3 text-left transition-all ${
                              isSelected ? `${t.bgColor} ring-1 ring-current` : "border-border bg-background/50 hover:border-muted-foreground/30"
                            }`}>
                            <Icon className={`h-4 w-4 mb-1 ${isSelected ? t.color : "text-muted-foreground"}`} />
                            <p className={`text-xs font-semibold ${isSelected ? t.color : "text-foreground"}`}>{t.label}</p>
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">{typeConfig.description}</p>
                  </div>

                  {/* Priority selector */}
                  <div className="mb-5">
                    <label className="mb-2 block text-xs font-semibold text-muted-foreground uppercase tracking-wider">Priority</label>
                    <div className="flex gap-2">
                      {PRIORITY_OPTIONS.map((p) => (
                        <button key={p.value} onClick={() => setComposePriority(p.value)}
                          className={`rounded-lg px-4 py-2 text-xs font-medium border transition-all ${
                            composePriority === p.value
                              ? `${p.color} border-current bg-current/10`
                              : "border-border text-muted-foreground hover:border-muted-foreground/30"
                          }`}>
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Title */}
                  <div className="mb-4">
                    <label className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wider">Title</label>
                    <Input
                      value={composeTitle}
                      onChange={(e) => setComposeTitle(e.target.value)}
                      placeholder={
                        composeType === "decision"
                          ? "e.g., Approve yacht insurance renewal at $45K/year?"
                          : composeType === "action_required"
                          ? "e.g., Sign updated LLC operating agreement"
                          : composeType === "alert"
                          ? "e.g., Property tax assessment increased 18% for Park Ave residence"
                          : composeType === "update"
                          ? "e.g., Q1 portfolio rebalancing complete"
                          : "e.g., Following up on the wine collection appraisal"
                      }
                      className="text-sm"
                    />
                  </div>

                  {/* Body */}
                  <div className="mb-4">
                    <label className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Details {composeType === "update" ? "(optional)" : ""}
                    </label>
                    <textarea
                      value={composeBody}
                      onChange={(e) => setComposeBody(e.target.value)}
                      placeholder={
                        composeType === "decision"
                          ? "Provide the context needed to make this decision. Include relevant numbers, options considered, and your recommendation..."
                          : composeType === "action_required"
                          ? "What needs to be done, by when, and any steps already completed..."
                          : composeType === "alert"
                          ? "What happened, the impact, and what the team is doing about it..."
                          : "Additional context or details..."
                      }
                      rows={4}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                    />
                  </div>

                  {/* Asset, Due Date, Action URL — dynamic row */}
                  <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {/* Asset — always shown */}
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        <Building2 className="inline h-3 w-3 mr-1" />Related Asset
                      </label>
                      <select value={composeAssetId} onChange={(e) => setComposeAssetId(e.target.value)}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                        <option value="">None (General)</option>
                        {Object.entries(groupedAssets).map(([category, items]) => (
                          <optgroup key={category} label={category.charAt(0).toUpperCase() + category.slice(1)}>
                            {items.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                          </optgroup>
                        ))}
                      </select>
                    </div>

                    {/* Due Date — for decisions and action_required */}
                    {typeConfig.hasDueDate && (
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          <CalendarIcon className="inline h-3 w-3 mr-1" />Response Needed By
                        </label>
                        <input
                          type="date"
                          value={composeDueDate}
                          onChange={(e) => setComposeDueDate(e.target.value)}
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    )}

                    {/* Action URL — for action_required and updates */}
                    {typeConfig.hasActionUrl && (
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          <LinkIcon className="inline h-3 w-3 mr-1" />Link / Document URL
                        </label>
                        <Input
                          value={composeActionUrl}
                          onChange={(e) => setComposeActionUrl(e.target.value)}
                          placeholder="https://..."
                        />
                      </div>
                    )}
                  </div>

                  {/* Preview & Send */}
                  <div className="flex items-center justify-between border-t border-border pt-4">
                    <div className="flex items-center gap-2">
                      {typeIcons[composeType]}
                      <span className="text-xs text-muted-foreground capitalize">{composeType.replace("_", " ")}</span>
                      <Badge variant="outline" className="text-[10px]">{composePriority}</Badge>
                      {composeAssetId && (
                        <span className="text-xs text-primary">
                          {assets.find((a) => a.id === composeAssetId)?.name}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => { setShowCompose(false); resetCompose(); }}>
                        Cancel
                      </Button>
                      <Button size="sm" onClick={handleSend} disabled={!composeTitle.trim() || isSending}>
                        {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          : editingMessage ? <Pencil className="mr-2 h-4 w-4" /> : <Send className="mr-2 h-4 w-4" />}
                        {editingMessage ? "Save Changes" : "Send to Principal"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══ MESSAGE LIST ═══ */}
        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : messages.length === 0 ? (
          <div className="text-center py-20">
            <MessageSquare className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
            <p className="text-muted-foreground">No messages match your filters</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => openCompose()}>
              <Plus className="mr-2 h-4 w-4" />Create First Message
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((msg) => {
              const status = getMessageStatus(msg);
              const needsConfirmation = msg.response && !msg.response.confirmed_at &&
                (msg.response.response_type === "approved" || msg.response.response_type === "rejected");
              const isOverdue = msg.due_date && new Date(msg.due_date) < new Date() && status === "pending";
              const menuOpen = openMenuId === msg.id;

              return (
                <motion.div key={msg.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} layout>
                  <Card className={`border-border bg-card/60 backdrop-blur-sm transition-colors ${
                    needsConfirmation ? "border-amber-500/30 bg-amber-500/[0.02]"
                    : isOverdue ? "border-red-500/30 bg-red-500/[0.02]"
                    : msg.is_archived ? "opacity-60" : ""
                  }`}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">{typeIcons[msg.type]}</div>
                        <div className="flex-1 min-w-0">
                          {/* Top row: title + badges + menu */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-sm font-semibold text-foreground truncate">{msg.title}</h3>
                                {msg.is_archived && <Badge variant="outline" className="text-[10px]">Archived</Badge>}
                                {isOverdue && (
                                  <Badge variant="outline" className="text-[10px] border-red-500/50 text-red-400 bg-red-500/10">Overdue</Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {/* Status badge */}
                              {status === "pending" && (msg.type === "decision" || msg.type === "action_required") && (
                                <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-400">
                                  <Clock className="mr-1 h-2.5 w-2.5" />Pending
                                </Badge>
                              )}
                              {needsConfirmation && (
                                <Badge variant="outline" className="text-[10px] border-orange-500/30 text-orange-400 bg-orange-500/10">
                                  {msg.response?.response_type === "approved"
                                    ? <><ThumbsUp className="mr-1 h-2.5 w-2.5" />Approved</>
                                    : <><ThumbsDown className="mr-1 h-2.5 w-2.5" />Rejected</>}
                                </Badge>
                              )}
                              {status === "confirmed" && (
                                <Badge variant="outline" className="text-[10px] border-primary/30 text-primary bg-primary/10">
                                  <ShieldCheck className="mr-1 h-2.5 w-2.5" />Done
                                </Badge>
                              )}
                              {status === "acknowledged" && (
                                <Badge variant="outline" className="text-[10px] border-blue-500/30 text-blue-400"><Eye className="mr-1 h-2.5 w-2.5" />Seen</Badge>
                              )}

                              {/* Context menu */}
                              <div className="relative">
                                <button onClick={() => setOpenMenuId(menuOpen ? null : msg.id)}
                                  className="rounded-md p-1 text-muted-foreground hover:bg-muted">
                                  <MoreHorizontal className="h-4 w-4" />
                                </button>
                                {menuOpen && (
                                  <>
                                    <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
                                    <div className="absolute right-0 top-8 z-50 w-40 rounded-lg border border-border bg-card shadow-xl py-1">
                                      {!msg.response && (
                                        <button onClick={() => { setOpenMenuId(null); openCompose(msg); }}
                                          className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-muted">
                                          <Pencil className="h-3 w-3" />Edit
                                        </button>
                                      )}
                                      {!msg.is_archived ? (
                                        <button onClick={() => handleArchive(msg.id)}
                                          className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-muted">
                                          <Archive className="h-3 w-3" />Archive
                                        </button>
                                      ) : (
                                        <button onClick={() => handleUnarchive(msg.id)}
                                          className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-muted">
                                          <ArchiveRestore className="h-3 w-3" />Unarchive
                                        </button>
                                      )}
                                      <button onClick={() => { setOpenMenuId(null); setDeletingId(msg.id); }}
                                        className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10">
                                        <Trash2 className="h-3 w-3" />Delete
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Body preview */}
                          {msg.body && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{msg.body}</p>}

                          {/* Meta row */}
                          <div className="mt-2 flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] text-muted-foreground">{formatTimeAgo(msg.created_at)}</span>
                            <Badge variant="outline" className="text-[10px] capitalize">{msg.type.replace("_", " ")}</Badge>
                            <Badge variant="outline" className="text-[10px]">{msg.priority}</Badge>
                            {msg.asset_name && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-primary">
                                <Building2 className="h-2.5 w-2.5" />{msg.asset_name}
                              </span>
                            )}
                            {msg.due_date && (
                              <span className={`inline-flex items-center gap-1 text-[10px] ${isOverdue ? "text-red-400" : "text-muted-foreground"}`}>
                                <CalendarIcon className="h-2.5 w-2.5" />Due {new Date(msg.due_date).toLocaleDateString()}
                              </span>
                            )}
                            {msg.action_url && (
                              <a href={msg.action_url} target="_blank" rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline">
                                <LinkIcon className="h-2.5 w-2.5" />Link
                              </a>
                            )}
                            {msg.sender_email && (
                              <span className="text-[10px] text-muted-foreground">by {msg.sender_email}</span>
                            )}
                          </div>

                          {/* Response detail */}
                          {msg.response && (
                            <div className="mt-3 rounded-lg border border-border bg-background/30 p-3 space-y-1.5">
                              <div className="flex items-center gap-2">
                                {msg.response.response_type === "approved" && <ThumbsUp className="h-3 w-3 text-emerald-400" />}
                                {msg.response.response_type === "rejected" && <ThumbsDown className="h-3 w-3 text-red-400" />}
                                {msg.response.response_type === "acknowledged" && <Eye className="h-3 w-3 text-blue-400" />}
                                {msg.response.response_type === "comment" && <MessageSquare className="h-3 w-3 text-muted-foreground" />}
                                <span className="text-xs font-medium capitalize text-foreground">{msg.response.response_type}</span>
                                <span className="text-[10px] text-muted-foreground">
                                  by {msg.response.user_email} · {formatTimeAgo(msg.response.created_at)}
                                </span>
                              </div>
                              {msg.response.comment && (
                                <p className="text-xs text-muted-foreground">
                                  Principal&apos;s note: <span className="italic">&ldquo;{msg.response.comment}&rdquo;</span>
                                </p>
                              )}
                              {msg.response.confirmed_at && (
                                <div className="flex items-center gap-2 pt-1.5 border-t border-border">
                                  <ShieldCheck className="h-3 w-3 text-primary" />
                                  <span className="text-[10px] text-primary font-medium">
                                    Confirmed {msg.response.confirmed_by_email && `by ${msg.response.confirmed_by_email}`} · {formatTimeAgo(msg.response.confirmed_at)}
                                  </span>
                                </div>
                              )}
                              {msg.response.confirmation_note && (
                                <p className="text-xs text-muted-foreground">
                                  Team note: <span className="italic">&ldquo;{msg.response.confirmation_note}&rdquo;</span>
                                </p>
                              )}
                            </div>
                          )}

                          {/* Confirm button */}
                          {needsConfirmation && (
                            <div className="mt-3">
                              <Button size="sm" className="text-xs"
                                onClick={() => setConfirmingResponse({
                                  responseId: msg.response!.id,
                                  messageTitle: msg.title,
                                  responseType: msg.response!.response_type,
                                })}>
                                <ShieldCheck className="mr-1.5 h-3 w-3" />
                                Confirm {msg.response!.response_type === "approved" ? "Approval" : "Rejection"} Processed
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.main>

      {/* ═══ CONFIRM MODAL ═══ */}
      <AnimatePresence>
        {confirmingResponse && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setConfirmingResponse(null)}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed left-1/2 top-1/2 z-50 w-[min(450px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold text-foreground">Confirm Processed</h3>
                </div>
                <button onClick={() => setConfirmingResponse(null)}><X className="h-5 w-5 text-muted-foreground" /></button>
              </div>
              <div className="mb-4 rounded-lg bg-background/50 p-3">
                <p className="text-sm font-medium text-foreground">{confirmingResponse.messageTitle}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Principal {confirmingResponse.responseType === "approved" ? "approved" : "rejected"} this.
                  Confirming means the action has been executed by the team.
                </p>
              </div>
              <textarea value={confirmNote} onChange={(e) => setConfirmNote(e.target.value)}
                placeholder="Add a note (e.g., 'Policy renewed, confirmation #12345')"
                className="mb-4 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                rows={3} autoFocus />
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setConfirmingResponse(null)}>Cancel</Button>
                <Button size="sm" onClick={handleConfirm} disabled={isConfirming}>
                  {isConfirming ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <ShieldCheck className="mr-1.5 h-3 w-3" />}
                  Mark as Confirmed
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ═══ DELETE MODAL ═══ */}
      <AnimatePresence>
        {deletingId && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setDeletingId(null)}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed left-1/2 top-1/2 z-50 w-[min(400px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-6 shadow-2xl">
              <div className="flex items-center gap-2 mb-3">
                <Trash2 className="h-5 w-5 text-red-400" />
                <h3 className="text-lg font-semibold text-foreground">Delete Message</h3>
              </div>
              <p className="mb-4 text-sm text-muted-foreground">
                This will remove the message from the principal&apos;s view. This can&apos;t be undone.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setDeletingId(null)}>Cancel</Button>
                <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={() => handleDelete(deletingId)}>
                  <Trash2 className="mr-1.5 h-3 w-3" />Delete
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
