"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  MessageSquare, Loader2, AlertTriangle, CheckCircle,
  HelpCircle, Bell, Building2, ChevronRight,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { formatTimeAgo } from "@/lib/utils";

interface Message {
  id: string;
  title: string;
  body: string | null;
  type: string;
  priority: string;
  asset_id: string | null;
  created_at: string;
  assets?: { name: string } | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export default function MessagesPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    async function load() {
      const { data } = await db
        .from("messages")
        .select("id, title, body, type, priority, asset_id, created_at, assets:asset_id(name)")
        .eq("is_deleted", false)
        .eq("is_archived", false)
        .order("created_at", { ascending: false });
      setMessages(data || []);
      setIsLoading(false);
    }
    load();
  }, []);

  const filtered = filter === "all" ? messages : messages.filter((m) => m.type === filter);

  const typeIcons: Record<string, React.ReactNode> = {
    alert: <AlertTriangle className="h-5 w-5 text-amber-400" />,
    action_required: <CheckCircle className="h-5 w-5 text-orange-400" />,
    decision: <HelpCircle className="h-5 w-5 text-blue-400" />,
    update: <Bell className="h-5 w-5 text-muted-foreground" />,
    comment: <MessageSquare className="h-5 w-5 text-muted-foreground" />,
  };

  const priorityColors: Record<string, string> = {
    urgent: "border-red-500/50 text-red-400 bg-red-500/10",
    high: "border-amber-500/50 text-amber-400 bg-amber-500/10",
    medium: "border-blue-500/50 text-blue-400",
    low: "border-border text-muted-foreground",
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
      </div>
      <Navbar />
      <motion.main initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <MessageSquare className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Messages</h1>
            <p className="text-sm text-muted-foreground">Communications from your Fusion Cell team</p>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap gap-2">
          {["all", "decision", "action_required", "alert", "update"].map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                filter === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "all" ? "All" : t.replace("_", " ")}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-20">No messages</p>
        ) : (
          <div className="space-y-3">
            {filtered.map((msg, i) => (
              <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <Card className="border-border bg-card/60 backdrop-blur-sm">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="mt-0.5">{typeIcons[msg.type]}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <h3 className="text-sm font-semibold text-foreground">{msg.title}</h3>
                          <span className="shrink-0 text-xs text-muted-foreground">{formatTimeAgo(msg.created_at)}</span>
                        </div>
                        {msg.body && <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{msg.body}</p>}
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className={`text-xs ${priorityColors[msg.priority]}`}>{msg.priority}</Badge>
                          <Badge variant="outline" className="text-xs capitalize">{msg.type.replace("_", " ")}</Badge>
                          {msg.assets?.name && (
                            <Link href={`/assets/${msg.asset_id}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                              <Building2 className="h-3 w-3" />
                              {msg.assets.name}
                            </Link>
                          )}
                        </div>
                        {(msg.type === "decision" || msg.type === "action_required") && (
                          <div className="mt-3 flex gap-2">
                            <Button size="sm" className="text-xs">Approve</Button>
                            <Button size="sm" variant="outline" className="text-xs">Reject</Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </motion.main>
    </div>
  );
}
