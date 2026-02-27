"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare, Loader2, Building2, X, Send, ThumbsUp,
  ThumbsDown, Eye, Archive, ShieldCheck, Clock,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRole } from "@/lib/use-role";
import {
  fetchMessages,
  respondToMessage,
  archiveMessage,
  createMessage,
  getMessageStatus,
  Message,
} from "@/lib/message-service";
import { formatTimeAgo } from "@/lib/utils";

const ORG_ID = "00000000-0000-0000-0000-000000000001";

export default function MessagesPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const { isAdmin, isExecutive } = useRole();

  // Response modal
  const [respondingTo, setRespondingTo] = useState<Message | null>(null);
  const [respondComment, setRespondComment] = useState("");
  const [respondAction, setRespondAction] = useState<"approved" | "rejected" | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reply composer
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [isSendingReply, setIsSendingReply] = useState(false);

  const loadMessages = async () => {
    const data = await fetchMessages({ type: filter !== "all" ? filter : undefined });
    setMessages(data);
    setIsLoading(false);
  };

  useEffect(() => {
    setIsLoading(true);
    loadMessages();
  }, [filter]);

  // ─── APPROVE / REJECT ───
  const openResponseModal = (msg: Message, action: "approved" | "rejected") => {
    setRespondingTo(msg);
    setRespondAction(action);
    setRespondComment("");
  };

  const handleQuickAcknowledge = async (messageId: string) => {
    setIsSubmitting(true);
    await respondToMessage(messageId, "acknowledged");
    await loadMessages();
    setIsSubmitting(false);
  };

  const handleConfirmResponse = async () => {
    if (!respondingTo || !respondAction) return;
    setIsSubmitting(true);
    const result = await respondToMessage(respondingTo.id, respondAction, respondComment || undefined);
    if (result.success) {
      setRespondingTo(null);
      setRespondComment("");
      setRespondAction(null);
      await loadMessages();
    }
    setIsSubmitting(false);
  };

  // ─── CLIENT REPLY ───
  const handleSendReply = async () => {
    if (!replyText.trim()) return;
    setIsSendingReply(true);
    await createMessage({
      title: replyText.trim(),
      type: "comment",
      priority: "medium",
      organization_id: ORG_ID,
    });
    setReplyText("");
    setShowReply(false);
    await loadMessages();
    setIsSendingReply(false);
  };

  const handleArchive = async (messageId: string) => {
    await archiveMessage(messageId);
    await loadMessages();
  };

  // ─── CATEGORIZE ───
  const pendingDecisions = messages.filter(
    (m) => (m.type === "decision" || m.type === "action_required") && !m.response
  );
  const awaitingConfirmation = messages.filter(
    (m) => m.response && !m.response.confirmed_at && (m.response.response_type === "approved" || m.response.response_type === "rejected")
  );
  const confirmed = messages.filter((m) => m.response?.confirmed_at);
  const otherMessages = messages.filter(
    (m) => {
      const status = getMessageStatus(m);
      if (status === "pending" && (m.type === "decision" || m.type === "action_required")) return false;
      if (m.response && (m.response.response_type === "approved" || m.response.response_type === "rejected")) return false;
      return true;
    }
  );

  // ─── COLORS ───
  const priorityBarColors: Record<string, string> = {
    urgent: "bg-red-500",
    high: "bg-amber-500",
    medium: "bg-blue-500",
    low: "bg-white/20",
  };

  const priorityColors: Record<string, string> = {
    urgent: "bg-red-600 text-white border-red-600",
    high: "bg-amber-600 text-white border-amber-600",
    medium: "bg-blue-600 text-white border-blue-600",
    low: "border-border text-muted-foreground",
  };

  // ─── RENDER STATUS BADGE ───
  const renderStatus = (msg: Message) => {
    const status = getMessageStatus(msg);

    switch (status) {
      case "approved":
        return (
          <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
            <div className="flex items-center gap-2">
              <ThumbsUp className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-xs font-semibold text-emerald-400">Approved</span>
              <span className="text-[10px] text-muted-foreground">
                by {msg.response?.user_email} · {formatTimeAgo(msg.response!.created_at)}
              </span>
            </div>
            {msg.response?.comment && (
              <p className="mt-1.5 text-xs text-muted-foreground italic">&ldquo;{msg.response.comment}&rdquo;</p>
            )}
            <div className="mt-2 flex items-center gap-1.5">
              <Clock className="h-3 w-3 text-amber-400" />
              <span className="text-[10px] font-medium text-amber-400">Awaiting team confirmation</span>
            </div>
          </div>
        );

      case "rejected":
        return (
          <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/5 p-3">
            <div className="flex items-center gap-2">
              <ThumbsDown className="h-3.5 w-3.5 text-red-400" />
              <span className="text-xs font-semibold text-red-400">Rejected</span>
              <span className="text-[10px] text-muted-foreground">
                by {msg.response?.user_email} · {formatTimeAgo(msg.response!.created_at)}
              </span>
            </div>
            {msg.response?.comment && (
              <p className="mt-1.5 text-xs text-muted-foreground italic">&ldquo;{msg.response.comment}&rdquo;</p>
            )}
            <div className="mt-2 flex items-center gap-1.5">
              <Clock className="h-3 w-3 text-amber-400" />
              <span className="text-[10px] font-medium text-amber-400">Awaiting team confirmation</span>
            </div>
          </div>
        );

      case "confirmed":
        return (
          <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-semibold text-primary">
                {msg.response?.response_type === "approved" ? "Approved" : "Rejected"} &amp; Confirmed
              </span>
              <span className="text-[10px] text-muted-foreground">
                {msg.response?.confirmed_by_email && `by ${msg.response.confirmed_by_email} · `}
                {msg.response?.confirmed_at && formatTimeAgo(msg.response.confirmed_at)}
              </span>
            </div>
            {msg.response?.comment && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                Your note: <span className="italic">&ldquo;{msg.response.comment}&rdquo;</span>
              </p>
            )}
            {msg.response?.confirmation_note && (
              <p className="mt-1 text-xs text-muted-foreground">
                Team note: <span className="italic">&ldquo;{msg.response.confirmation_note}&rdquo;</span>
              </p>
            )}
          </div>
        );

      case "acknowledged":
        return (
          <div className="mt-3 rounded-lg border border-blue-500/30 bg-blue-500/5 p-3">
            <div className="flex items-center gap-2">
              <Eye className="h-3.5 w-3.5 text-blue-400" />
              <span className="text-xs font-semibold text-blue-400">Acknowledged</span>
              <span className="text-[10px] text-muted-foreground">{formatTimeAgo(msg.response!.created_at)}</span>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // ─── RENDER MESSAGE ───
  const renderMessage = (msg: Message) => {
    const status = getMessageStatus(msg);
    const isResolved = status === "confirmed";

    return (
      <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card className={`border-border bg-card/60 backdrop-blur-sm ${isResolved ? "opacity-70" : ""}`}>
          <CardContent className="p-5">
            <div className="flex items-stretch gap-4">
              <div className={`w-0.5 shrink-0 rounded-full ${priorityBarColors[msg.priority] || "bg-white/20"}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <h3 className="text-sm font-semibold text-foreground">{msg.title}</h3>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatTimeAgo(msg.created_at)}</span>
                </div>

                {msg.body && <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{msg.body}</p>}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={`text-xs ${priorityColors[msg.priority]}`}>{msg.priority}</Badge>
                  <Badge variant="outline" className="text-xs capitalize">{msg.type.replace("_", " ")}</Badge>
                  {msg.asset_name && (
                    <Link href={`/assets/${msg.asset_id}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                      <Building2 className="h-3 w-3" />{msg.asset_name}
                    </Link>
                  )}
                </div>

                {/* Status display */}
                {renderStatus(msg)}

                {/* Action buttons — only for pending decisions */}
                {status === "pending" && (msg.type === "decision" || msg.type === "action_required") && (
                  <div className="mt-4 flex items-center gap-2">
                    <Button
                      size="sm"
                      className="text-xs bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => openResponseModal(msg, "approved")}
                      disabled={isSubmitting}
                    >
                      <ThumbsUp className="mr-1.5 h-3 w-3" />Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
                      onClick={() => openResponseModal(msg, "rejected")}
                      disabled={isSubmitting}
                    >
                      <ThumbsDown className="mr-1.5 h-3 w-3" />Reject
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs text-muted-foreground"
                      onClick={() => handleQuickAcknowledge(msg.id)}
                      disabled={isSubmitting}
                    >
                      <Eye className="mr-1.5 h-3 w-3" />Acknowledge
                    </Button>
                  </div>
                )}

                {/* Archive — admin only, non-actionable */}
                {isAdmin && !msg.response && msg.type !== "decision" && msg.type !== "action_required" && (
                  <div className="mt-3">
                    <Button size="sm" variant="ghost" className="text-xs text-muted-foreground" onClick={() => handleArchive(msg.id)}>
                      <Archive className="mr-1.5 h-3 w-3" />Archive
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
      </div>
      <Navbar />
      <motion.main initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <MessageSquare className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Messages</h1>
              <p className="text-sm text-muted-foreground">
                {isExecutive ? "Communications from your Fusion Cell team" : "Manage principal communications"}
              </p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => setShowReply(!showReply)}>
            <Send className="mr-2 h-4 w-4" />Send Message
          </Button>
        </div>

        {/* Reply composer */}
        <AnimatePresence>
          {showReply && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="mb-6">
              <Card className="border-primary/30 bg-card/80">
                <CardContent className="p-4">
                  <p className="mb-3 text-sm font-medium text-foreground">
                    {isExecutive ? "Send a message to your Fusion Cell team" : "Send a message"}
                  </p>
                  <div className="flex gap-2">
                    <Input value={replyText} onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Type your message..." onKeyDown={(e) => e.key === "Enter" && handleSendReply()} className="flex-1" />
                    <Button onClick={handleSendReply} disabled={!replyText.trim() || isSendingReply} size="sm">
                      {isSendingReply ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap gap-2">
          {["all", "decision", "action_required", "alert", "update", "comment"].map((t) => (
            <button key={t} onClick={() => setFilter(t)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                filter === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
              }`}>
              {t === "all" ? "All" : t === "comment" ? "Replies" : t.replace("_", " ")}
              {t === "all" && pendingDecisions.length > 0 && (
                <span className="ml-1.5 rounded-full bg-amber-500/20 px-1.5 text-[10px] text-amber-400">{pendingDecisions.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : messages.length === 0 ? (
          <p className="text-center text-muted-foreground py-20">No messages</p>
        ) : (
          <div className="space-y-6">
            {pendingDecisions.length > 0 && (
              <div>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                  Needs Your Response ({pendingDecisions.length})
                </h2>
                <div className="space-y-3">{pendingDecisions.map(renderMessage)}</div>
              </div>
            )}

            {awaitingConfirmation.length > 0 && (
              <div>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Clock className="h-4 w-4 text-amber-400" />
                  Awaiting Team Confirmation ({awaitingConfirmation.length})
                </h2>
                <div className="space-y-3">{awaitingConfirmation.map(renderMessage)}</div>
              </div>
            )}

            {otherMessages.length > 0 && (
              <div>
                <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Other Messages</h2>
                <div className="space-y-3">{otherMessages.map(renderMessage)}</div>
              </div>
            )}

            {confirmed.length > 0 && (
              <div>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Completed ({confirmed.length})
                </h2>
                <div className="space-y-3">{confirmed.map(renderMessage)}</div>
              </div>
            )}
          </div>
        )}
      </motion.main>

      {/* Approve/Reject Modal */}
      <AnimatePresence>
        {respondingTo && respondAction && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => { setRespondingTo(null); setRespondAction(null); }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed left-1/2 top-1/2 z-50 w-[min(480px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-6 shadow-2xl">

              {/* Modal header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {respondAction === "approved"
                    ? <ThumbsUp className="h-5 w-5 text-emerald-400" />
                    : <ThumbsDown className="h-5 w-5 text-red-400" />}
                  <h3 className="text-lg font-semibold text-foreground">
                    {respondAction === "approved" ? "Approve" : "Reject"}
                  </h3>
                </div>
                <button onClick={() => { setRespondingTo(null); setRespondAction(null); }}>
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>

              {/* What they're responding to */}
              <div className="mb-4 rounded-lg bg-background/50 p-3">
                <p className="text-sm font-medium text-foreground">{respondingTo.title}</p>
                {respondingTo.body && <p className="mt-1 text-xs text-muted-foreground">{respondingTo.body}</p>}
              </div>

              {/* Confirmation prompt */}
              <p className="mb-3 text-sm text-muted-foreground">
                {respondAction === "approved"
                  ? "Are you sure you want to approve this? Your team will be notified and will confirm once processed."
                  : "Are you sure you want to reject this? Your team will be notified and may follow up."}
              </p>

              <textarea
                value={respondComment}
                onChange={(e) => setRespondComment(e.target.value)}
                placeholder="Add a note (optional)..."
                className="mb-4 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                rows={3}
                autoFocus
              />

              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => { setRespondingTo(null); setRespondAction(null); }}>Cancel</Button>
                <Button
                  size="sm"
                  className={respondAction === "approved" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}
                  onClick={handleConfirmResponse}
                  disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                    : respondAction === "approved" ? <ThumbsUp className="mr-1.5 h-3 w-3" /> : <ThumbsDown className="mr-1.5 h-3 w-3" />}
                  Confirm {respondAction === "approved" ? "Approval" : "Rejection"}
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
