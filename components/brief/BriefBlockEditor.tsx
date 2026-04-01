"use client";

import { useState, useRef } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TipTapEditor } from "./TipTapEditor";
import { BriefBlock, CashFlowBlockData, BillBlockData, ProjectsBlockData, DecisionsBlockData } from "@/lib/brief-service";
import { formatCurrency } from "@/lib/utils";

interface BriefBlockEditorProps {
  block: BriefBlock;
  liveData: Record<string, any>;
  orgId: string;
  onUpdate: (updates: Partial<Pick<BriefBlock, "content_html" | "config" | "commentary">>) => void;
}

export function BriefBlockEditor({ block, liveData, orgId, onUpdate }: BriefBlockEditorProps) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleDocxUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const mammoth = await import("mammoth");
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer });
      onUpdate({ content_html: result.value });
    } catch (err) {
      console.error("Error converting docx:", err);
    }
    setUploading(false);
  };

  // Text / Document block
  if (block.type === "text" || block.type === "document") {
    return (
      <div className="space-y-3">
        <TipTapEditor
          content={block.content_html || ""}
          onChange={(html) => onUpdate({ content_html: html })}
          placeholder={
            block.type === "document"
              ? "Upload a .docx or type content..."
              : "Write your commentary..."
          }
        />
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".docx"
            className="hidden"
            onChange={handleDocxUpload}
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
              <FileUp className="mr-2 h-3.5 w-3.5" />
            )}
            Upload .docx
          </Button>
        </div>
      </div>
    );
  }

  // Cash flow block
  if (block.type === "cashflow") {
    const data = liveData.cashflow as CashFlowBlockData | undefined;
    return (
      <div className="space-y-3">
        {data ? (
          <div className="rounded-lg bg-muted/30 p-3">
            <p className="text-sm font-medium text-foreground">
              Cash Flow — {data.month} {data.year}
            </p>
            <div className="mt-2 grid grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Paid</p>
                <p className="font-medium text-foreground">
                  {formatCurrency(data.cashOut / 100)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Pending</p>
                <p className="font-medium text-foreground">
                  {data.pendingCount} bills
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Net</p>
                <p className={`font-medium ${data.net < 0 ? "text-red-400" : "text-emerald-400"}`}>
                  {formatCurrency(data.net / 100)}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg bg-muted/30 p-3">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
        <div>
          <label className="text-xs text-muted-foreground">Commentary (optional)</label>
          <textarea
            value={block.commentary || ""}
            onChange={(e) => onUpdate({ commentary: e.target.value })}
            placeholder="Add a note below this data..."
            rows={2}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
          />
        </div>
      </div>
    );
  }

  // Bills block
  if (block.type === "bills") {
    const daysAhead = block.config?.days_ahead || 7;
    const dataKey = `bills_${daysAhead}`;
    const data = liveData[dataKey] as BillBlockData | undefined;

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Show bills due in next:</label>
          <select
            value={daysAhead}
            onChange={(e) => onUpdate({ config: { ...block.config, days_ahead: Number(e.target.value) } })}
            className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
          >
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
          </select>
        </div>
        {data ? (
          <div className="rounded-lg bg-muted/30 p-3">
            <p className="text-sm font-medium text-foreground">
              {data.bills.length} bill{data.bills.length !== 1 ? "s" : ""} due — {formatCurrency(data.total / 100)}
            </p>
            {data.bills.length > 0 && (
              <div className="mt-2 space-y-1">
                {data.bills.slice(0, 5).map((bill) => (
                  <div key={bill.id} className="flex justify-between text-xs text-muted-foreground">
                    <span>{bill.title}</span>
                    <span>{formatCurrency(bill.amount_cents / 100)}</span>
                  </div>
                ))}
                {data.bills.length > 5 && (
                  <p className="text-xs text-muted-foreground">+ {data.bills.length - 5} more</p>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-lg bg-muted/30 p-3">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
        <div>
          <label className="text-xs text-muted-foreground">Commentary (optional)</label>
          <textarea
            value={block.commentary || ""}
            onChange={(e) => onUpdate({ commentary: e.target.value })}
            placeholder="Add a note below this data..."
            rows={2}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
          />
        </div>
      </div>
    );
  }

  // Projects block
  if (block.type === "projects") {
    const category = block.config?.category || "all";
    const data = liveData.projects as ProjectsBlockData | undefined;

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Category:</label>
          <select
            value={category}
            onChange={(e) => onUpdate({ config: { ...block.config, category: e.target.value } })}
            className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
          >
            <option value="all">All</option>
            <option value="family">Family</option>
            <option value="business">Business</option>
            <option value="personal">Personal</option>
          </select>
        </div>
        {data ? (
          <div className="rounded-lg bg-muted/30 p-3">
            <p className="text-sm font-medium text-foreground">
              {data.projects.length} project{data.projects.length !== 1 ? "s" : ""} — {formatCurrency(data.totalValue)}
            </p>
            {data.projects.length > 0 && (
              <div className="mt-2 space-y-1">
                {data.projects.slice(0, 5).map((h) => (
                  <div key={h.id} className="flex justify-between text-xs text-muted-foreground">
                    <span>{h.name}</span>
                    <span>{formatCurrency(h.estimated_value)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-lg bg-muted/30 p-3">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
        <div>
          <label className="text-xs text-muted-foreground">Commentary (optional)</label>
          <textarea
            value={block.commentary || ""}
            onChange={(e) => onUpdate({ commentary: e.target.value })}
            placeholder="Add a note below this data..."
            rows={2}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
          />
        </div>
      </div>
    );
  }

  // Decisions block
  if (block.type === "decisions") {
    const data = liveData.decisions as DecisionsBlockData | undefined;

    return (
      <div className="space-y-3">
        {data ? (
          <div className="rounded-lg bg-muted/30 p-3">
            <p className="text-sm font-medium text-foreground">
              {data.count} pending decision{data.count !== 1 ? "s" : ""}
            </p>
            {data.decisions.length > 0 && (
              <div className="mt-2 space-y-1">
                {data.decisions.slice(0, 5).map((d) => (
                  <div key={d.id} className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{d.title}</span>
                    <span className="capitalize">{d.priority}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-lg bg-muted/30 p-3">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
        <div>
          <label className="text-xs text-muted-foreground">Commentary (optional)</label>
          <textarea
            value={block.commentary || ""}
            onChange={(e) => onUpdate({ commentary: e.target.value })}
            placeholder="Add a note below this data..."
            rows={2}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
          />
        </div>
      </div>
    );
  }

  return null;
}
