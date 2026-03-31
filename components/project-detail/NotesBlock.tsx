"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Check, Loader2 } from "lucide-react";
import { TipTapEditor } from "@/components/brief/TipTapEditor";
import { updateBlock } from "@/lib/project-detail-service";

interface NotesBlockProps {
  blockId: string;
  config: Record<string, any>;
}

export function NotesBlock({ blockId, config }: NotesBlockProps) {
  const [content, setContent] = useState(config.content_html || "");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "idle">("idle");
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const initialLoad = useRef(true);

  const saveContent = useCallback(
    async (html: string) => {
      setSaveStatus("saving");
      await updateBlock(blockId, { config: { content_html: html } });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    },
    [blockId]
  );

  const handleChange = (html: string) => {
    setContent(html);
    if (initialLoad.current) {
      initialLoad.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => saveContent(html), 1000);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div>
      <TipTapEditor
        content={content}
        onChange={handleChange}
        placeholder="Add project notes, milestones, or status updates..."
      />
      <div className="mt-2 flex items-center justify-end">
        {saveStatus === "saving" && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Saving...
          </span>
        )}
        {saveStatus === "saved" && (
          <span className="flex items-center gap-1 text-xs text-green-400">
            <Check className="h-3 w-3" />
            Saved
          </span>
        )}
      </div>
    </div>
  );
}
