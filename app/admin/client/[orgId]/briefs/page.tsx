"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Plus,
  Loader2,
  FileText,
  MoreVertical,
  Send,
  ArchiveRestore,
  Trash2,
  Calendar,
  Download,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useClientContext } from "@/lib/use-client-context";
import {
  fetchBriefs,
  createBrief,
  publishBrief,
  unpublishBrief,
  deleteBrief,
  Brief,
} from "@/lib/brief-service";
import { useRole } from "@/lib/use-role";

type FilterTab = "all" | "draft" | "published" | "archived";

export default function BriefsListPage() {
  const { orgId, clientName } = useClientContext();
  const { userId } = useRole();
  const router = useRouter();
  const [briefs, setBriefs] = useState<(Brief & { _blockCount?: number })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  const loadBriefs = async () => {
    setIsLoading(true);
    const data = await fetchBriefs(orgId, filter === "all" ? undefined : filter);
    setBriefs(data as any);
    setIsLoading(false);
  };

  useEffect(() => {
    loadBriefs();
  }, [orgId, filter]);

  const handleNewBrief = async () => {
    setCreating(true);
    const today = new Date().toISOString().split("T")[0];
    const brief = await createBrief(orgId, "Daily Brief", today);
    if (brief) {
      router.push(`/admin/client/${orgId}/briefs/${brief.id}`);
    } else {
      alert("Failed to create brief. Make sure the briefs table exists — run sql/009_daily_briefs.sql in your Supabase SQL Editor.");
    }
    setCreating(false);
  };

  const handlePublish = async (briefId: string) => {
    if (!userId) return;
    await publishBrief(briefId, userId);
    setMenuOpen(null);
    loadBriefs();
  };

  const handleUnpublish = async (briefId: string) => {
    await unpublishBrief(briefId);
    setMenuOpen(null);
    loadBriefs();
  };

  const handleDelete = async (briefId: string) => {
    await deleteBrief(briefId);
    setMenuOpen(null);
    loadBriefs();
  };

  const handleDownloadPDF = async (briefId: string) => {
    setDownloading(briefId);
    setMenuOpen(null);
    try {
      const res = await fetch("/api/brief/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ briefId }),
      });
      if (!res.ok) throw new Error("PDF generation failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const disposition = res.headers.get("Content-Disposition");
      const filename = disposition?.match(/filename="(.+)"/)?.[1] || "brief.pdf";
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed:", err);
    }
    setDownloading(null);
  };

  const statusColors: Record<string, string> = {
    draft: "bg-yellow-600/20 text-yellow-400 border-yellow-600/30",
    published: "bg-emerald-600/20 text-emerald-400 border-emerald-600/30",
    archived: "bg-zinc-600/20 text-zinc-400 border-zinc-600/30",
  };

  const filterTabs: { label: string; value: FilterTab }[] = [
    { label: "All", value: "all" },
    { label: "Drafts", value: "draft" },
    { label: "Published", value: "published" },
    { label: "Archived", value: "archived" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Daily Briefs</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Compose and publish briefs for {clientName}
          </p>
        </div>
        <Button onClick={handleNewBrief} disabled={creating}>
          {creating ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-2 h-4 w-4" />
          )}
          New Brief
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 rounded-lg border border-border bg-card/50 p-1">
        {filterTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === tab.value
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : briefs.length === 0 ? (
        <Card className="border-border">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground/30" />
            <p className="mt-4 text-sm text-muted-foreground">
              {filter === "all"
                ? "No briefs yet. Create your first brief to get started."
                : `No ${filter} briefs found.`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-3"
        >
          {briefs.map((brief) => (
            <Card
              key={brief.id}
              className="group cursor-pointer border-border transition-colors hover:bg-muted/20"
              onClick={() =>
                router.push(`/admin/client/${orgId}/briefs/${brief.id}`)
              }
            >
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{brief.title}</p>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(brief.brief_date + "T00:00:00").toLocaleDateString("en-US", {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                      <span>{(brief as any)._blockCount || 0} blocks</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={statusColors[brief.status] || ""}
                  >
                    {brief.status}
                  </Badge>

                  <div
                    className="relative"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() =>
                        setMenuOpen(menuOpen === brief.id ? null : brief.id)
                      }
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>

                    {menuOpen === brief.id && (
                      <div className="absolute right-0 top-full z-10 mt-1 min-w-[160px] rounded-lg border border-border bg-card py-1 shadow-lg">
                        {brief.status === "draft" && (
                          <button
                            onClick={() => handlePublish(brief.id)}
                            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted"
                          >
                            <Send className="h-3.5 w-3.5" />
                            Publish
                          </button>
                        )}
                        {brief.status === "published" && (
                          <button
                            onClick={() => handleUnpublish(brief.id)}
                            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted"
                          >
                            <ArchiveRestore className="h-3.5 w-3.5" />
                            Unpublish
                          </button>
                        )}
                        <button
                          onClick={() => handleDownloadPDF(brief.id)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download PDF
                        </button>
                        <button
                          onClick={() => handleDelete(brief.id)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-muted"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </motion.div>
      )}
    </div>
  );
}
