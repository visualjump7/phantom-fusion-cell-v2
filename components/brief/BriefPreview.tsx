"use client";

import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import {
  Brief,
  BriefBlock,
  CashFlowBlockData,
  BillBlockData,
  ProjectsBlockData,
  DecisionsBlockData,
} from "@/lib/brief-service";

interface BriefPreviewProps {
  brief: Brief;
  liveData: Record<string, any>;
  compact?: boolean;
}

export function BriefPreview({ brief, liveData, compact }: BriefPreviewProps) {
  const dateFormatted = new Date(brief.brief_date + "T00:00:00").toLocaleDateString(
    "en-US",
    { month: "long", day: "numeric", year: "numeric" }
  );

  return (
    <div className={compact ? "space-y-4" : "space-y-6"}>
      {/* Header */}
      <div>
        <h2 className={compact ? "text-lg font-bold text-foreground" : "text-2xl font-bold text-foreground font-serif"}>
          {brief.title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {dateFormatted} · Prepared by your Fusion Cell team
        </p>
      </div>

      {/* Blocks */}
      {brief.blocks?.map((block) => (
        <BriefBlockPreview
          key={block.id}
          block={block}
          liveData={liveData}
          compact={compact}
        />
      ))}

      {(!brief.blocks || brief.blocks.length === 0) && (
        <p className="text-sm italic text-muted-foreground">
          No content blocks added yet.
        </p>
      )}
    </div>
  );
}

function BriefBlockPreview({
  block,
  liveData,
  compact,
}: {
  block: BriefBlock;
  liveData: Record<string, any>;
  compact?: boolean;
}) {
  // Text / Document block
  if (block.type === "text" || block.type === "document") {
    if (!block.content_html) return null;
    return (
      <div
        className="prose-brief text-foreground"
        dangerouslySetInnerHTML={{ __html: block.content_html }}
      />
    );
  }

  // Cash Flow block
  if (block.type === "cashflow") {
    const data = liveData.cashflow as CashFlowBlockData | undefined;
    if (!data) return null;
    return (
      <div className="rounded-lg border border-border bg-card/50 p-4">
        <h3 className="text-sm font-semibold text-foreground">
          Cash Flow — {data.month} {data.year}
        </h3>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Paid out</p>
            <p className="text-lg font-bold text-red-400">
              {formatCurrency(data.cashOut / 100)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Pending</p>
            <p className="text-lg font-bold text-yellow-400">
              {data.pendingCount}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Net</p>
            <p className={`text-lg font-bold ${data.net < 0 ? "text-red-400" : "text-emerald-400"}`}>
              {formatCurrency(data.net / 100)}
            </p>
          </div>
        </div>
        {block.commentary && (
          <p className="mt-3 border-t border-border pt-3 text-sm text-muted-foreground italic">
            {block.commentary}
          </p>
        )}
      </div>
    );
  }

  // Bills block
  if (block.type === "bills") {
    const daysAhead = block.config?.days_ahead || 7;
    const dataKey = `bills_${daysAhead}`;
    const data = liveData[dataKey] as BillBlockData | undefined;
    if (!data) return null;
    return (
      <div className="rounded-lg border border-border bg-card/50 p-4">
        <h3 className="text-sm font-semibold text-foreground">
          Bills Due — Next {daysAhead} Days
        </h3>
        {data.bills.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No bills due.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {data.bills.map((bill) => (
              <div
                key={bill.id}
                className="flex items-center justify-between text-sm"
              >
                <div>
                  <p className="text-foreground">{bill.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(bill.due_date + "T00:00:00").toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                    {bill.asset_name && ` · ${bill.asset_name}`}
                  </p>
                </div>
                <p className="font-medium text-foreground">
                  {formatCurrency(bill.amount_cents / 100)}
                </p>
              </div>
            ))}
            <div className="border-t border-border pt-2 text-right">
              <p className="text-sm font-semibold text-foreground">
                Total: {formatCurrency(data.total / 100)}
              </p>
            </div>
          </div>
        )}
        {block.commentary && (
          <p className="mt-3 border-t border-border pt-3 text-sm text-muted-foreground italic">
            {block.commentary}
          </p>
        )}
      </div>
    );
  }

  // Projects block
  if (block.type === "projects") {
    const data = liveData.projects as ProjectsBlockData | undefined;
    if (!data) return null;

    const categoryColors: Record<string, string> = {
      family: "bg-emerald-600 text-white",
      business: "bg-blue-600 text-white",
      personal: "bg-violet-600 text-white",
    };

    const filteredProjects =
      block.config?.category && block.config.category !== "all"
        ? data.projects.filter((h) => h.category === block.config.category)
        : data.projects;

    const filteredTotal = filteredProjects.reduce(
      (s, h) => s + (h.estimated_value || 0),
      0
    );

    return (
      <div className="rounded-lg border border-border bg-card/50 p-4">
        <h3 className="text-sm font-semibold text-foreground">
          Projects Snapshot
        </h3>
        {filteredProjects.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No projects found.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {filteredProjects.map((h) => (
              <div
                key={h.id}
                className="flex items-center justify-between text-sm"
              >
                <div className="flex items-center gap-2">
                  <Badge className={`text-[10px] ${categoryColors[h.category] || ""}`}>
                    {h.category}
                  </Badge>
                  <span className="text-foreground">{h.name}</span>
                </div>
                <span className="font-medium text-foreground">
                  {formatCurrency(h.estimated_value)}
                </span>
              </div>
            ))}
            <div className="border-t border-border pt-2 text-right">
              <p className="text-sm font-semibold text-foreground">
                Total: {formatCurrency(filteredTotal)}
              </p>
            </div>
          </div>
        )}
        {block.commentary && (
          <p className="mt-3 border-t border-border pt-3 text-sm text-muted-foreground italic">
            {block.commentary}
          </p>
        )}
      </div>
    );
  }

  // Decisions block
  if (block.type === "decisions") {
    const data = liveData.decisions as DecisionsBlockData | undefined;
    if (!data) return null;

    const priorityColors: Record<string, string> = {
      urgent: "bg-red-600 text-white border-red-600",
      high: "bg-amber-600 text-white border-amber-600",
      medium: "bg-blue-600 text-white border-blue-600",
      low: "border-border text-muted-foreground",
    };

    return (
      <div className="rounded-lg border border-border bg-card/50 p-4">
        <h3 className="text-sm font-semibold text-foreground">
          Pending Decisions ({data.count})
        </h3>
        {data.decisions.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No pending decisions.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {data.decisions.map((d) => (
              <div key={d.id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="text-foreground">{d.title}</p>
                  {d.due_date && (
                    <p className="text-xs text-muted-foreground">
                      Due{" "}
                      {new Date(d.due_date + "T00:00:00").toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  )}
                </div>
                <Badge
                  variant="outline"
                  className={`text-[10px] ${priorityColors[d.priority] || ""}`}
                >
                  {d.priority}
                </Badge>
              </div>
            ))}
          </div>
        )}
        {block.commentary && (
          <p className="mt-3 border-t border-border pt-3 text-sm text-muted-foreground italic">
            {block.commentary}
          </p>
        )}
      </div>
    );
  }

  return null;
}
