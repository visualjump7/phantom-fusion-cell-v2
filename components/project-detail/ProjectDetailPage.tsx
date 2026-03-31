"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera, User, Building, FileText, Loader2, MoreVertical,
  ChevronUp, ChevronDown, Pencil, Trash2, X, Check,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  ProjectBlock,
  ProjectContact,
  fetchProjectBlocks,
  createBlock,
  updateBlock,
  deleteBlock,
  reorderBlocks,
} from "@/lib/project-detail-service";
import { GalleryBlock } from "./GalleryBlock";
import { PersonnelBlock } from "./PersonnelBlock";
import { SubcontractorBlock } from "./SubcontractorBlock";
import { NotesBlock } from "./NotesBlock";
import { AddPersonnelModal } from "./AddPersonnelModal";
import { AddSubcontractorModal } from "./AddSubcontractorModal";
import { cn } from "@/lib/utils";

interface ProjectDetailPageProps {
  assetId: string;
  orgId: string;
  assetName: string;
}

const BLOCK_TYPES = [
  { type: "gallery" as const, icon: Camera, label: "Gallery", desc: "Add photo gallery" },
  { type: "personnel" as const, icon: User, label: "Personnel", desc: "Add team members" },
  { type: "subcontractor" as const, icon: Building, label: "Subcontractor", desc: "Add subcontractors" },
  { type: "notes" as const, icon: FileText, label: "Notes", desc: "Add project notes" },
];

const BLOCK_TYPE_BADGES: Record<string, string> = {
  gallery: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  personnel: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  subcontractor: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  notes: "bg-purple-500/15 text-purple-400 border-purple-500/30",
};

export function ProjectDetailPage({
  assetId,
  orgId,
  assetName,
}: ProjectDetailPageProps) {
  const [blocks, setBlocks] = useState<ProjectBlock[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [titleText, setTitleText] = useState("");

  // Modal state
  const [personnelModal, setPersonnelModal] = useState<{
    open: boolean;
    blockId: string;
    editing: ProjectContact | null;
  }>({ open: false, blockId: "", editing: null });

  const [subcontractorModal, setSubcontractorModal] = useState<{
    open: boolean;
    blockId: string;
    editing: ProjectContact | null;
  }>({ open: false, blockId: "", editing: null });

  const loadBlocks = useCallback(async () => {
    const data = await fetchProjectBlocks(assetId);
    setBlocks(data);
    setIsLoading(false);
  }, [assetId]);

  useEffect(() => {
    loadBlocks();
  }, [loadBlocks]);

  const handleAddBlock = async (type: ProjectBlock["type"]) => {
    const block = await createBlock(assetId, orgId, type);
    if (block) {
      await loadBlocks();
      // Scroll to new block
      setTimeout(() => {
        const el = document.getElementById(`block-${block.id}`);
        el?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  };

  const handleDeleteBlock = async (blockId: string) => {
    await deleteBlock(blockId);
    setMenuOpen(null);
    await loadBlocks();
  };

  const handleMoveBlock = async (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= blocks.length) return;
    const newOrder = [...blocks];
    const [moved] = newOrder.splice(index, 1);
    newOrder.splice(newIndex, 0, moved);
    setBlocks(newOrder);
    await reorderBlocks(assetId, newOrder.map((b) => b.id));
  };

  const handleSaveTitle = async (blockId: string) => {
    await updateBlock(blockId, { title: titleText });
    setEditingTitle(null);
    await loadBlocks();
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Empty state
  if (blocks.length === 0) {
    return (
      <div className="space-y-8">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Building className="h-12 w-12 text-muted-foreground" />
          <h2 className="mt-4 text-lg font-semibold text-foreground">
            Build your project profile
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Add blocks to create a detailed view of {assetName}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {BLOCK_TYPES.map((bt) => (
            <button
              key={bt.type}
              onClick={() => handleAddBlock(bt.type)}
              className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-6 transition-colors hover:bg-muted/30 hover:border-primary/40"
            >
              <bt.icon className="h-8 w-8 text-primary" />
              <span className="text-sm font-medium text-foreground">{bt.label}</span>
              <span className="text-xs text-muted-foreground">{bt.desc}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Add Block toolbar */}
      <div className="flex flex-wrap gap-2">
        {BLOCK_TYPES.map((bt) => (
          <button
            key={bt.type}
            onClick={() => handleAddBlock(bt.type)}
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm transition-colors hover:bg-muted/30 hover:border-primary/40"
          >
            <bt.icon className="h-4 w-4 text-primary" />
            <span className="text-foreground">{bt.label}</span>
          </button>
        ))}
      </div>

      {/* Blocks */}
      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {blocks.map((block, index) => (
            <motion.div
              key={block.id}
              id={`block-${block.id}`}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Card className="border-border">
                {/* Block header */}
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <div className="flex items-center gap-3">
                    {/* Title */}
                    {editingTitle === block.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          value={titleText}
                          onChange={(e) => setTitleText(e.target.value)}
                          className="rounded border border-border bg-card px-2 py-1 text-sm font-medium text-foreground"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveTitle(block.id);
                            if (e.key === "Escape") setEditingTitle(null);
                          }}
                        />
                        <button
                          onClick={() => handleSaveTitle(block.id)}
                          className="rounded p-1 text-green-400 hover:bg-muted"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingTitle(null)}
                          className="rounded p-1 text-muted-foreground hover:bg-muted"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <h3
                        className="cursor-pointer text-sm font-semibold text-foreground hover:text-primary"
                        onDoubleClick={() => {
                          setEditingTitle(block.id);
                          setTitleText(block.title || "");
                        }}
                      >
                        {block.title || "Untitled Block"}
                      </h3>
                    )}
                    <Badge
                      variant="outline"
                      className={cn("text-xs", BLOCK_TYPE_BADGES[block.type])}
                    >
                      {block.type}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Reorder arrows */}
                    <button
                      onClick={() => handleMoveBlock(index, "up")}
                      disabled={index === 0}
                      className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleMoveBlock(index, "down")}
                      disabled={index === blocks.length - 1}
                      className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>

                    {/* Three-dot menu */}
                    <div className="relative">
                      <button
                        onClick={() =>
                          setMenuOpen(menuOpen === block.id ? null : block.id)
                        }
                        className="rounded p-1 text-muted-foreground hover:bg-muted"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                      {menuOpen === block.id && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setMenuOpen(null)}
                          />
                          <div className="absolute right-0 top-full z-20 mt-1 w-36 rounded-lg border border-border bg-card py-1 shadow-xl">
                            <button
                              onClick={() => {
                                setMenuOpen(null);
                                setEditingTitle(block.id);
                                setTitleText(block.title || "");
                              }}
                              className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-muted"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Rename
                            </button>
                            <button
                              onClick={() => handleDeleteBlock(block.id)}
                              className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-red-400 hover:bg-muted"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Block content */}
                <CardContent className="p-4">
                  {block.type === "gallery" && (
                    <GalleryBlock
                      blockId={block.id}
                      orgId={orgId}
                      assetId={assetId}
                      images={block.images || []}
                      onUpdate={loadBlocks}
                    />
                  )}
                  {block.type === "personnel" && (
                    <PersonnelBlock
                      blockId={block.id}
                      orgId={orgId}
                      contacts={block.contacts || []}
                      onUpdate={loadBlocks}
                      onAdd={() =>
                        setPersonnelModal({
                          open: true,
                          blockId: block.id,
                          editing: null,
                        })
                      }
                      onEdit={(contact) =>
                        setPersonnelModal({
                          open: true,
                          blockId: block.id,
                          editing: contact,
                        })
                      }
                    />
                  )}
                  {block.type === "subcontractor" && (
                    <SubcontractorBlock
                      blockId={block.id}
                      orgId={orgId}
                      contacts={block.contacts || []}
                      onUpdate={loadBlocks}
                      onAdd={() =>
                        setSubcontractorModal({
                          open: true,
                          blockId: block.id,
                          editing: null,
                        })
                      }
                      onEdit={(contact) =>
                        setSubcontractorModal({
                          open: true,
                          blockId: block.id,
                          editing: contact,
                        })
                      }
                    />
                  )}
                  {block.type === "notes" && (
                    <NotesBlock blockId={block.id} config={block.config} />
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Personnel Modal */}
      <AddPersonnelModal
        open={personnelModal.open}
        blockId={personnelModal.blockId}
        orgId={orgId}
        editing={personnelModal.editing}
        onClose={() =>
          setPersonnelModal({ open: false, blockId: "", editing: null })
        }
        onSaved={loadBlocks}
      />

      {/* Subcontractor Modal */}
      <AddSubcontractorModal
        open={subcontractorModal.open}
        blockId={subcontractorModal.blockId}
        orgId={orgId}
        editing={subcontractorModal.editing}
        onClose={() =>
          setSubcontractorModal({ open: false, blockId: "", editing: null })
        }
        onSaved={loadBlocks}
      />
    </div>
  );
}
