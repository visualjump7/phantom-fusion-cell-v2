"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Loader2,
  Plus,
  X,
  ChevronUp,
  ChevronDown,
  Send,
  Save,
  FileText,
  DollarSign,
  Receipt,
  Building2,
  AlertTriangle,
  FileUp,
  Type,
  GripVertical,
  Download,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useClientContext } from "@/lib/use-client-context";
import { useRole } from "@/lib/use-role";
import { formatCurrency } from "@/lib/utils";
import {
  fetchBrief,
  updateBrief,
  publishBrief,
  addBlock,
  updateBlock,
  deleteBlock,
  reorderBlocks,
  fetchCashFlowData,
  fetchUpcomingBillsData,
  fetchProjectsSnapshot,
  fetchPendingDecisions,
  Brief,
  BriefBlock,
  CashFlowBlockData,
  BillBlockData,
  ProjectsBlockData,
  DecisionsBlockData,
} from "@/lib/brief-service";
import { BriefBlockEditor } from "@/components/brief/BriefBlockEditor";
import { BriefPreview } from "@/components/brief/BriefPreview";
import { CoverPageSettings } from "@/components/brief/CoverPageSettings";

export default function BriefComposerPage() {
  const params = useParams();
  const briefId = params.briefId as string;
  const { orgId, clientName } = useClientContext();
  const { userId } = useRole();
  const router = useRouter();

  const [brief, setBrief] = useState<Brief | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showBlockPicker, setShowBlockPicker] = useState(false);
  const [liveData, setLiveData] = useState<Record<string, any>>({});
  const [isDownloading, setIsDownloading] = useState(false);

  const loadBrief = useCallback(async () => {
    const data = await fetchBrief(briefId);
    setBrief(data);
    setIsLoading(false);
  }, [briefId]);

  const loadLiveData = useCallback(async () => {
    const [cashflow, bills7, bills14, bills30, projects, decisions] = await Promise.all([
      fetchCashFlowData(orgId),
      fetchUpcomingBillsData(orgId, 7),
      fetchUpcomingBillsData(orgId, 14),
      fetchUpcomingBillsData(orgId, 30),
      fetchProjectsSnapshot(orgId),
      fetchPendingDecisions(orgId),
    ]);
    setLiveData({
      cashflow,
      bills_7: bills7,
      bills_14: bills14,
      bills_30: bills30,
      projects,
      decisions,
    });
  }, [orgId]);

  useEffect(() => {
    loadBrief();
    loadLiveData();
  }, [loadBrief, loadLiveData]);

  const handleTitleChange = async (title: string) => {
    if (!brief) return;
    setBrief({ ...brief, title });
    await updateBrief(briefId, { title });
  };

  const handleDateChange = async (briefDate: string) => {
    if (!brief) return;
    setBrief({ ...brief, brief_date: briefDate });
    await updateBrief(briefId, { brief_date: briefDate });
  };

  const handleAddBlock = async (type: string) => {
    if (!brief) return;
    const position = brief.blocks?.length || 0;
    const defaultConfig: Record<string, any> = {};
    if (type === "bills") defaultConfig.days_ahead = 7;
    if (type === "projects") defaultConfig.category = "all";

    const block = await addBlock(briefId, type, position, defaultConfig);
    if (block && brief.blocks) {
      setBrief({ ...brief, blocks: [...brief.blocks, block] });
    }
    setShowBlockPicker(false);
  };

  const handleUpdateBlock = async (
    blockId: string,
    updates: Partial<Pick<BriefBlock, "content_html" | "config" | "commentary">>
  ) => {
    await updateBlock(blockId, updates);
    if (brief?.blocks) {
      setBrief({
        ...brief,
        blocks: brief.blocks.map((b) =>
          b.id === blockId ? { ...b, ...updates } : b
        ),
      });
    }
  };

  const handleDeleteBlock = async (blockId: string) => {
    await deleteBlock(blockId);
    if (brief?.blocks) {
      setBrief({
        ...brief,
        blocks: brief.blocks.filter((b) => b.id !== blockId),
      });
    }
  };

  const handleMoveBlock = async (blockId: string, direction: "up" | "down") => {
    if (!brief?.blocks) return;
    const blocks = [...brief.blocks];
    const idx = blocks.findIndex((b) => b.id === blockId);
    if (idx < 0) return;
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= blocks.length) return;

    [blocks[idx], blocks[newIdx]] = [blocks[newIdx], blocks[idx]];
    const reordered = blocks.map((b, i) => ({ ...b, position: i }));
    setBrief({ ...brief, blocks: reordered });
    await reorderBlocks(briefId, reordered.map((b) => b.id));
  };

  const handleSave = async () => {
    setIsSaving(true);
    await updateBrief(briefId, { status: "draft" });
    setIsSaving(false);
  };

  const handlePublish = async () => {
    if (!userId) return;
    setIsSaving(true);
    const ok = await publishBrief(briefId, userId);
    if (ok && brief) {
      setBrief({
        ...brief,
        status: "published",
        published_at: new Date().toISOString(),
      });
    }
    setIsSaving(false);
  };

  const handleCoverUpdate = async (updates: Partial<Brief>) => {
    if (!brief) return;
    setBrief({ ...brief, ...updates });
    await updateBrief(briefId, updates as any);
  };

  const handleDownloadPDF = async () => {
    setIsDownloading(true);
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
      const coverTitle = brief?.cover_title || brief?.title || "Daily-Brief";
      const safeTitle = coverTitle.replace(/[^a-zA-Z0-9-_ ]/g, "").replace(/\s+/g, "-");
      a.href = url;
      a.download = `${safeTitle}-${brief?.brief_date || "brief"}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed:", err);
    }
    setIsDownloading(false);
  };

  const blockTypes = [
    { type: "text", label: "Text Block", icon: Type, desc: "Rich text commentary" },
    { type: "cashflow", label: "Cash Flow", icon: DollarSign, desc: "Monthly cash flow summary" },
    { type: "bills", label: "Upcoming Bills", icon: Receipt, desc: "Bills due soon" },
    { type: "projects", label: "Projects", icon: Building2, desc: "Projects snapshot" },
    { type: "decisions", label: "Decisions", icon: AlertTriangle, desc: "Pending decisions" },
    { type: "document", label: "Document", icon: FileUp, desc: "Upload .docx file" },
  ];

  if (isLoading || !brief) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    draft: "bg-yellow-600/20 text-yellow-400 border-yellow-600/30",
    published: "bg-emerald-600/20 text-emerald-400 border-emerald-600/30",
    archived: "bg-zinc-600/20 text-zinc-400 border-zinc-600/30",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push(`/admin/client/${orgId}/briefs`)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Briefs
        </button>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadPDF}
            disabled={isDownloading}
          >
            {isDownloading ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="mr-2 h-3.5 w-3.5" />
            )}
            Download PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="mr-2 h-3.5 w-3.5" />
            )}
            Save Draft
          </Button>
          <Button size="sm" onClick={handlePublish} disabled={isSaving}>
            <Send className="mr-2 h-3.5 w-3.5" />
            Publish
          </Button>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        {/* Left: Composer (60%) */}
        <div className="xl:col-span-3 space-y-4">
          {/* Brief metadata */}
          <Card className="border-border">
            <CardContent className="space-y-4 p-4">
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={brief.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  className="flex-1 bg-transparent text-xl font-bold text-foreground outline-none placeholder:text-muted-foreground"
                  placeholder="Brief title..."
                />
                <Badge
                  variant="outline"
                  className={statusColors[brief.status] || ""}
                >
                  {brief.status}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground">Date:</label>
                <input
                  type="date"
                  value={brief.brief_date}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
                />
              </div>
            </CardContent>
          </Card>

          {/* Cover page settings */}
          <CoverPageSettings
            brief={brief}
            orgId={orgId}
            clientName={clientName}
            onUpdate={handleCoverUpdate}
          />

          {/* Blocks */}
          {brief.blocks?.map((block, index) => (
            <motion.div
              key={block.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="border-border">
                <CardContent className="p-4">
                  {/* Block header */}
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground/50" />
                      <span className="text-sm font-medium capitalize text-foreground">
                        {block.type === "cashflow"
                          ? "Cash Flow"
                          : block.type === "bills"
                          ? "Upcoming Bills"
                          : block.type}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleMoveBlock(block.id, "up")}
                        disabled={index === 0}
                        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 transition-colors"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleMoveBlock(block.id, "down")}
                        disabled={index === (brief.blocks?.length || 0) - 1}
                        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 transition-colors"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteBlock(block.id)}
                        className="rounded p-1 text-muted-foreground hover:bg-red-500/10 hover:text-red-400 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Block editor */}
                  <BriefBlockEditor
                    block={block}
                    liveData={liveData}
                    orgId={orgId}
                    onUpdate={(updates) => handleUpdateBlock(block.id, updates)}
                  />
                </CardContent>
              </Card>
            </motion.div>
          ))}

          {/* Add block */}
          <div className="relative">
            <Button
              variant="outline"
              className="w-full border-dashed"
              onClick={() => setShowBlockPicker(!showBlockPicker)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Block
            </Button>

            {showBlockPicker && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute left-0 right-0 top-full z-10 mt-2 grid grid-cols-2 gap-2 rounded-lg border border-border bg-card p-3 shadow-lg sm:grid-cols-3"
              >
                {blockTypes.map((bt) => (
                  <button
                    key={bt.type}
                    onClick={() => handleAddBlock(bt.type)}
                    className="flex items-center gap-2 rounded-lg p-3 text-left transition-colors hover:bg-muted"
                  >
                    <bt.icon className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {bt.label}
                      </p>
                      <p className="text-xs text-muted-foreground">{bt.desc}</p>
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
          </div>
        </div>

        {/* Right: Live Preview (40%) */}
        <div className="xl:col-span-2">
          <div className="sticky top-24">
            <Card className="border-border">
              <CardContent className="p-0">
                <div className="border-b border-border px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Live Preview
                  </p>
                </div>
                <div className="max-h-[calc(100vh-200px)] overflow-y-auto p-4">
                  <BriefPreview
                    brief={brief}
                    liveData={liveData}
                    compact
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
