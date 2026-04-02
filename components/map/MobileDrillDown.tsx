"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ChevronLeft,
  AlertTriangle,
  DollarSign,
  Receipt,
  Users,
  Loader2,
  MapPin,
  ExternalLink,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatCurrency, getCategoryColor } from "@/lib/utils";
import { DrillDownData } from "@/lib/map-types";
import Link from "next/link";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface MobileDrillDownProps {
  assetId: string;
  organizationId: string;
  onBack: () => void;
}

const priorityColors: Record<string, string> = {
  urgent: "bg-red-500",
  high: "bg-amber-500",
  medium: "bg-blue-500",
  low: "bg-white/30",
};

const billStatusColors: Record<string, string> = {
  pending: "text-amber-400",
  paid: "text-green-400",
  overdue: "text-red-400",
};

export function MobileDrillDown({
  assetId,
  organizationId,
  onBack,
}: MobileDrillDownProps) {
  const [data, setData] = useState<DrillDownData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [assetRes, messagesRes, billsRes, budgetRes, contactsRes] =
        await Promise.all([
          db
            .from("assets")
            .select(
              "id, name, category, estimated_value, city, state_province, country, location_type"
            )
            .eq("id", assetId)
            .single(),
          db
            .from("messages")
            .select("id, type, priority, title, created_at")
            .eq("asset_id", assetId)
            .eq("organization_id", organizationId)
            .in("type", ["alert", "decision", "action_required"])
            .order("created_at", { ascending: false })
            .limit(5),
          db
            .from("bills")
            .select("id, title, amount_cents, due_date, status, category")
            .eq("asset_id", assetId)
            .eq("organization_id", organizationId)
            .order("due_date", { ascending: false })
            .limit(5),
          db
            .from("budgets")
            .select(
              `id, year, budget_line_items(annual_total, expense_category_id, expense_categories(name))`
            )
            .eq("asset_id", assetId)
            .eq("organization_id", organizationId)
            .order("year", { ascending: false })
            .limit(1),
          db
            .from("project_contacts")
            .select("name, role, company, contact_type")
            .eq("organization_id", organizationId)
            .eq("contact_type", "personnel")
            .limit(4)
            .then((res: { data: unknown[] | null }) => res)
            .catch(() => ({ data: [] })),
        ]);

      // Process budget
      let budget: DrillDownData["budget"] = null;
      if (budgetRes.data && budgetRes.data.length > 0) {
        const b = budgetRes.data[0];
        const lineItems = b.budget_line_items || [];
        const annualTotal = lineItems.reduce(
          (sum: number, li: { annual_total: number }) =>
            sum + (li.annual_total || 0),
          0
        );
        const topCategories = lineItems
          .map(
            (li: {
              expense_categories: { name: string } | null;
              annual_total: number;
            }) => ({
              name: li.expense_categories?.name || "Uncategorized",
              amount: li.annual_total || 0,
            })
          )
          .sort(
            (a: { amount: number }, b: { amount: number }) =>
              b.amount - a.amount
          )
          .slice(0, 3);
        budget = { annual_total: annualTotal, topCategories };
      }

      setData({
        asset: assetRes.data,
        messages: messagesRes.data || [],
        bills: billsRes.data || [],
        budget,
        contacts: contactsRes.data || [],
      });
    } catch (err) {
      console.error("Error fetching mobile drill-down:", err);
    } finally {
      setIsLoading(false);
    }
  }, [assetId, organizationId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const locationText = data?.asset
    ? [data.asset.city, data.asset.state_province, data.asset.country]
        .filter(Boolean)
        .join(", ")
    : "";

  const pendingTotal =
    data?.bills
      .filter((b) => b.status === "pending")
      .reduce((sum, b) => sum + (b.amount_cents || 0), 0) || 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-white/40" />
      </div>
    );
  }

  if (!data?.asset) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-white/40">Project not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-xs text-white/50 active:text-white transition-colors py-1"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Back to overview
      </button>

      {/* Header */}
      <div className="rounded-xl bg-white/5 border border-white/10 p-4">
        <div className="flex items-center gap-2 mb-2">
          <span
            className={`rounded-md px-2 py-0.5 text-[10px] font-medium capitalize ${getCategoryColor(data.asset.category)}`}
          >
            {data.asset.category}
          </span>
          {data.asset.location_type &&
            data.asset.location_type !== "unlocated" && (
              <span className="text-[10px] text-white/40 flex items-center gap-1">
                <MapPin className="h-2.5 w-2.5" />
                {data.asset.location_type}
              </span>
            )}
        </div>
        <h2 className="text-lg font-bold text-white">{data.asset.name}</h2>
        {locationText && (
          <p className="text-xs text-white/50 mt-0.5">{locationText}</p>
        )}
        {data.asset.estimated_value > 0 && (
          <p className="text-xl font-bold text-white mt-2">
            {formatCurrency(data.asset.estimated_value)}
          </p>
        )}
      </div>

      {/* Alerts */}
      <div className="rounded-xl bg-white/5 border border-white/10 p-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
          <span className="text-[11px] font-medium text-white/60 uppercase tracking-wider">
            Alerts & Decisions
          </span>
        </div>
        {data.messages.length === 0 ? (
          <p className="text-xs text-white/40 italic">No recent alerts</p>
        ) : (
          <div className="space-y-2">
            {data.messages.map((msg) => (
              <div
                key={msg.id}
                className="flex items-start gap-2 rounded-lg bg-white/5 px-3 py-2"
              >
                <div
                  className={`h-2 w-2 rounded-full mt-1 shrink-0 ${
                    priorityColors[msg.priority] || "bg-white/30"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-white/80 line-clamp-1">
                    {msg.title}
                  </p>
                  <p className="text-[10px] text-white/40">
                    {msg.type.replace("_", " ")} &middot;{" "}
                    {new Date(msg.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Budget */}
      <div className="rounded-xl bg-white/5 border border-white/10 p-4">
        <div className="flex items-center gap-2 mb-3">
          <DollarSign className="h-3.5 w-3.5 text-green-400" />
          <span className="text-[11px] font-medium text-white/60 uppercase tracking-wider">
            Budget Snapshot
          </span>
        </div>
        {!data.budget ? (
          <p className="text-xs text-white/40 italic">No budget data</p>
        ) : (
          <>
            <p className="text-lg font-bold text-white">
              {formatCurrency(data.budget.annual_total)}
            </p>
            <p className="text-[10px] text-white/40 mb-3">Annual Budget</p>
            {data.budget.topCategories.length > 0 && (
              <div className="space-y-2">
                {data.budget.topCategories.map((cat, i) => {
                  const pct =
                    data.budget!.annual_total > 0
                      ? (cat.amount / data.budget!.annual_total) * 100
                      : 0;
                  return (
                    <div key={i}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-white/50 truncate">
                          {cat.name}
                        </span>
                        <span className="text-white/80 font-medium">
                          {formatCurrency(cat.amount)}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500/60"
                          style={{
                            width: `${Math.min(pct, 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Recent Bills */}
      <div className="rounded-xl bg-white/5 border border-white/10 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Receipt className="h-3.5 w-3.5 text-blue-400" />
          <span className="text-[11px] font-medium text-white/60 uppercase tracking-wider">
            Recent Bills
          </span>
          {pendingTotal > 0 && (
            <span className="text-[10px] text-amber-400 font-medium ml-auto">
              {formatCurrency(pendingTotal / 100)} pending
            </span>
          )}
        </div>
        {data.bills.length === 0 ? (
          <p className="text-xs text-white/40 italic">No recent bills</p>
        ) : (
          <div className="space-y-2">
            {data.bills.map((bill) => (
              <div
                key={bill.id}
                className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-white/80 truncate">
                    {bill.title}
                  </p>
                  <p className="text-[10px] text-white/40">
                    Due{" "}
                    {new Date(
                      bill.due_date + "T00:00:00"
                    ).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 pl-2">
                  <span className="text-xs font-medium text-white/80 whitespace-nowrap">
                    {formatCurrency(bill.amount_cents / 100)}
                  </span>
                  <span
                    className={`text-[9px] font-medium ${
                      billStatusColors[bill.status] || "text-white/40"
                    }`}
                  >
                    {bill.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Personnel */}
      {data.contacts.length > 0 && (
        <div className="rounded-xl bg-white/5 border border-white/10 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-3.5 w-3.5 text-violet-400" />
            <span className="text-[11px] font-medium text-white/60 uppercase tracking-wider">
              Key Personnel
            </span>
          </div>
          <div className="space-y-2">
            {data.contacts.map((contact, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/70 text-[10px] font-semibold">
                  {contact.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-white/80 truncate">
                    {contact.name}
                  </p>
                  <p className="text-[10px] text-white/40 truncate">
                    {contact.role}
                    {contact.company ? ` \u00b7 ${contact.company}` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* View full project link */}
      <Link
        href={`/assets/${assetId}`}
        className="flex items-center justify-center gap-2 w-full rounded-xl bg-white/10 border border-white/10 py-3 text-sm font-medium text-white active:bg-white/20 transition-colors"
      >
        View Full Project
        <ExternalLink className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
