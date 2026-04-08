"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import {
  X,
  AlertTriangle,
  DollarSign,
  Receipt,
  Users,
  ChevronRight,
  ExternalLink,
  Loader2,
  MapPin,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { formatCurrency, getCategoryColor } from "@/lib/utils";
import { DrillDownData } from "@/lib/map-types";
import Link from "next/link";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface ProjectDrillDownProps {
  assetId: string;
  organizationId: string;
  onClose: () => void;
  onViewOnMap?: () => void;
  showViewOnMap?: boolean;
}

const priorityColors: Record<string, string> = {
  urgent: "bg-red-600 text-white",
  high: "bg-amber-600 text-white",
  medium: "bg-blue-600 text-white",
  low: "bg-border text-muted-foreground",
};

const billStatusColors: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  paid: "bg-green-500/10 text-green-400 border-green-500/20",
  overdue: "bg-red-500/10 text-red-400 border-red-500/20",
};

export function ProjectDrillDown({
  assetId,
  organizationId,
  onClose,
  onViewOnMap,
  showViewOnMap = true,
}: ProjectDrillDownProps) {
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

      // Process budget data
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
          .map((li: { expense_categories: { name: string } | null; annual_total: number }) => ({
            name: li.expense_categories?.name || "Uncategorized",
            amount: li.annual_total || 0,
          }))
          .sort((a: { amount: number }, b: { amount: number }) => b.amount - a.amount)
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
      console.error("Error fetching drill-down data:", err);
    } finally {
      setIsLoading(false);
    }
  }, [assetId, organizationId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const locationText = data?.asset
    ? [data.asset.city, data.asset.state_province, data.asset.country]
        .filter(Boolean)
        .join(", ")
    : "";

  const pendingTotal =
    data?.bills
      .filter((b) => b.status === "pending")
      .reduce((sum, b) => sum + (b.amount_cents || 0), 0) || 0;

  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      {/* Backdrop — full viewport, above page content and bottom nav */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/30 z-[90]"
        onClick={onClose}
      />

      {/* Panel — full viewport height, slides in from the right */}
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed top-0 right-0 bottom-0 w-full sm:w-[420px] z-[100] overflow-y-auto border-l border-white/10 bg-card/95 backdrop-blur-xl"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-50 rounded-full p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
              <p className="text-sm text-muted-foreground">Loading project data...</p>
            </div>
          </div>
        ) : data?.asset ? (
          <div className="p-5 space-y-5">
            {/* Header */}
            <div className="pr-8">
              <div className="flex items-center gap-2 mb-2">
                <Badge
                  variant="outline"
                  className={getCategoryColor(data.asset.category)}
                >
                  {data.asset.category}
                </Badge>
                {data.asset.location_type && data.asset.location_type !== "unlocated" && (
                  <Badge
                    variant="outline"
                    className="text-[10px] border-white/20 text-muted-foreground"
                  >
                    <MapPin className="h-2.5 w-2.5 mr-1" />
                    {data.asset.location_type}
                  </Badge>
                )}
              </div>
              <h2 className="text-xl font-bold text-foreground">
                {data.asset.name}
              </h2>
              {locationText && (
                <p className="text-sm text-muted-foreground mt-1">
                  {locationText}
                </p>
              )}
              {data.asset.estimated_value > 0 && (
                <p className="text-2xl font-bold text-foreground mt-2">
                  {formatCurrency(data.asset.estimated_value)}
                </p>
              )}
            </div>

            {/* Alerts Section */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-foreground">
                  Alerts & Decisions
                </h3>
              </div>
              {data.messages.length === 0 ? (
                <p className="text-xs text-muted-foreground italic pl-6">
                  No recent alerts
                </p>
              ) : (
                <div className="space-y-2">
                  {data.messages.map((msg) => (
                    <div
                      key={msg.id}
                      className="rounded-lg border border-border bg-muted/20 px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <Badge
                          className={`text-[10px] ${priorityColors[msg.priority] || ""}`}
                        >
                          {msg.priority}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground capitalize">
                          {msg.type.replace("_", " ")}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-foreground mt-1 line-clamp-1">
                        {msg.title}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {new Date(msg.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Budget Snapshot */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <DollarSign className="h-4 w-4 text-green-400" />
                <h3 className="text-sm font-semibold text-foreground">
                  Budget Snapshot
                </h3>
              </div>
              {!data.budget ? (
                <p className="text-xs text-muted-foreground italic pl-6">
                  No budget data
                </p>
              ) : (
                <div className="pl-6 space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Annual Budget</p>
                    <p className="text-lg font-bold text-foreground">
                      {formatCurrency(data.budget.annual_total)}
                    </p>
                  </div>
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
                              <span className="text-muted-foreground truncate">
                                {cat.name}
                              </span>
                              <span className="text-foreground font-medium">
                                {formatCurrency(cat.amount)}
                              </span>
                            </div>
                            <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-primary"
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Recent Bills */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Receipt className="h-4 w-4 text-blue-400" />
                <h3 className="text-sm font-semibold text-foreground">
                  Recent Bills
                </h3>
                {pendingTotal > 0 && (
                  <span className="text-[10px] text-amber-400 font-medium ml-auto">
                    {formatCurrency(pendingTotal / 100)} pending
                  </span>
                )}
              </div>
              {data.bills.length === 0 ? (
                <p className="text-xs text-muted-foreground italic pl-6">
                  No recent bills
                </p>
              ) : (
                <div className="space-y-2">
                  {data.bills.map((bill) => (
                    <div
                      key={bill.id}
                      className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-foreground truncate">
                          {bill.title}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          Due{" "}
                          {new Date(bill.due_date + "T00:00:00").toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 pl-2">
                        <span className="text-xs font-medium text-foreground whitespace-nowrap">
                          {formatCurrency(bill.amount_cents / 100)}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[9px] ${billStatusColors[bill.status] || ""}`}
                        >
                          {bill.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Personnel */}
            {data.contacts.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Users className="h-4 w-4 text-violet-400" />
                  <h3 className="text-sm font-semibold text-foreground">
                    Key Personnel
                  </h3>
                </div>
                <div className="space-y-2">
                  {data.contacts.map((contact, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                        {contact.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">
                          {contact.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {contact.role}
                          {contact.company ? ` · ${contact.company}` : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2 border-t border-border">
              <Link
                href={`/assets/${assetId}`}
                className="flex-1"
              >
                <Button className="w-full" size="sm">
                  View Full Project
                  <ExternalLink className="ml-2 h-3.5 w-3.5" />
                </Button>
              </Link>
              {showViewOnMap && onViewOnMap && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onViewOnMap}
                  className="flex-1"
                >
                  <MapPin className="mr-2 h-3.5 w-3.5" />
                  View on Map
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-muted-foreground">Project not found</p>
          </div>
        )}
      </motion.div>
    </>,
    document.body
  );
}
