"use client";

import { useState, useRef } from "react";
import { Loader2, Upload, X, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import type { Brief } from "@/lib/brief-service";

interface CoverPageSettingsProps {
  brief: Brief;
  orgId: string;
  clientName: string;
  onUpdate: (updates: Partial<Brief>) => void;
}

const presetColors = [
  { label: "Mint", value: "#4ade80" },
  { label: "Blue", value: "#3b82f6" },
  { label: "Amber", value: "#f59e0b" },
  { label: "Rose", value: "#f43f5e" },
  { label: "Violet", value: "#8b5cf6" },
  { label: "White", value: "#ffffff" },
];

export function CoverPageSettings({ brief, orgId, clientName, onUpdate }: CoverPageSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const fileName = `logo-${Date.now()}.${ext}`;
      const { error } = await (supabase as any).storage
        .from("brief-logos")
        .upload(`${orgId}/${fileName}`, file, { upsert: true });

      if (error) {
        console.error("Logo upload error:", error);
        setUploading(false);
        return;
      }

      const { data: urlData } = (supabase as any).storage
        .from("brief-logos")
        .getPublicUrl(`${orgId}/${fileName}`);

      onUpdate({ cover_logo_url: urlData.publicUrl });
    } catch (err) {
      console.error("Upload failed:", err);
    }
    setUploading(false);
  };

  const handleRemoveLogo = () => {
    onUpdate({ cover_logo_url: null });
  };

  return (
    <div className="rounded-lg border border-border">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/30 transition-colors"
      >
        <span>Cover Page Settings</span>
        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>

      {isOpen && (
        <div className="border-t border-border px-4 py-4 space-y-4">
          {/* Cover title */}
          <div>
            <label className="text-xs text-muted-foreground">Cover Title</label>
            <input
              type="text"
              value={brief.cover_title || ""}
              onChange={(e) => onUpdate({ cover_title: e.target.value })}
              placeholder="Daily Brief"
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
            />
          </div>

          {/* Cover subtitle */}
          <div>
            <label className="text-xs text-muted-foreground">Subtitle (optional)</label>
            <input
              type="text"
              value={brief.cover_subtitle || ""}
              onChange={(e) => onUpdate({ cover_subtitle: e.target.value })}
              placeholder={`Prepared for the ${clientName}`}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
            />
          </div>

          {/* Logo */}
          <div>
            <label className="text-xs text-muted-foreground">Logo</label>
            <div className="mt-1 flex items-center gap-3">
              {brief.cover_logo_url ? (
                <div className="flex items-center gap-2">
                  <img
                    src={brief.cover_logo_url}
                    alt="Cover logo"
                    className="h-10 max-w-[120px] rounded border border-border object-contain bg-zinc-900 p-1"
                  />
                  <button
                    onClick={handleRemoveLogo}
                    className="rounded p-1 text-muted-foreground hover:bg-red-500/10 hover:text-red-400 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml"
                    className="hidden"
                    onChange={handleLogoUpload}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="mr-2 h-3.5 w-3.5" />
                    )}
                    Upload Logo
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Checkboxes */}
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={brief.cover_show_date !== false}
                onChange={(e) => onUpdate({ cover_show_date: e.target.checked })}
                className="rounded border-border"
              />
              Show date
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={brief.cover_show_principal !== false}
                onChange={(e) => onUpdate({ cover_show_principal: e.target.checked })}
                className="rounded border-border"
              />
              Show principal name
            </label>
          </div>

          {/* Accent color */}
          <div>
            <label className="text-xs text-muted-foreground">Accent Color</label>
            <div className="mt-1.5 flex items-center gap-2">
              {presetColors.map((c) => (
                <button
                  key={c.value}
                  onClick={() => onUpdate({ cover_accent_color: c.value })}
                  title={c.label}
                  className={`h-6 w-6 rounded-full border-2 transition-all ${
                    (brief.cover_accent_color || "#4ade80") === c.value
                      ? "border-foreground scale-110"
                      : "border-transparent hover:border-muted-foreground"
                  }`}
                  style={{ backgroundColor: c.value }}
                />
              ))}
              <input
                type="color"
                value={brief.cover_accent_color || "#4ade80"}
                onChange={(e) => onUpdate({ cover_accent_color: e.target.value })}
                className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0"
                title="Custom color"
              />
            </div>
          </div>

          {/* Cover preview */}
          <div>
            <label className="text-xs text-muted-foreground">Preview</label>
            <div className="mt-1.5 rounded-lg border border-border bg-[#0a0a0a] p-6 text-center">
              {brief.cover_logo_url && (
                <img
                  src={brief.cover_logo_url}
                  alt=""
                  className="mx-auto mb-4 h-8 max-w-[100px] object-contain"
                />
              )}
              <p className="text-sm font-bold text-white">
                {brief.cover_title || "Daily Brief"}
              </p>
              {brief.cover_subtitle && (
                <p className="mt-1 text-[10px] text-zinc-400">
                  {brief.cover_subtitle}
                </p>
              )}
              <div
                className="mx-auto my-3 h-0.5 w-8"
                style={{ backgroundColor: brief.cover_accent_color || "#4ade80" }}
              />
              {brief.cover_show_date !== false && (
                <p className="text-[10px] text-zinc-500">
                  {new Date(brief.brief_date + "T00:00:00").toLocaleDateString("en-US", {
                    month: "long", day: "numeric", year: "numeric",
                  })}
                </p>
              )}
              {brief.cover_show_principal !== false && (
                <p className="text-[10px] text-zinc-500">
                  Prepared for {clientName}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
