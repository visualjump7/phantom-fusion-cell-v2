"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2, Receipt, MessageSquare, Upload, ChevronRight, Loader2, Trash2, FileText, Users, Tag, Globe, Sparkles,
  Pencil, Check, X as XIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useClientContext } from "@/lib/use-client-context";
import { formatCurrency, cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { fetchBillSummary, BillSummary } from "@/lib/bill-service";
import { deletePrincipal, updateClientProfile } from "@/lib/client-service";
import { useActivePrincipal } from "@/lib/use-active-principal";
import { DeletePrincipalModal } from "@/components/admin/shared/DeletePrincipalModal";
import { useRole } from "@/lib/use-role";
import { hasPermission } from "@/lib/permissions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export default function WorkspaceDashboard() {
  const { orgId, clientName, setClientName } = useClientContext();
  const { activePrincipal, clearActivePrincipal } = useActivePrincipal();
  const { role, isAdmin } = useRole();
  const canEditName = isAdmin;
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const canUpload = hasPermission(role, "uploadBudgets");
  const canDelete = hasPermission(role, "deletePrincipal");
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [projectsCount, setProjectsCount] = useState(0);
  const [projectsValue, setProjectsValue] = useState(0);
  const [billSummary, setBillSummary] = useState<BillSummary | null>(null);
  const [alertsCount, setAlertsCount] = useState(0);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteToast, setDeleteToast] = useState<string | null>(null);
  const [allowedCategories, setAllowedCategories] = useState<string[]>(["business", "personal", "family"]);
  const [savingCategories, setSavingCategories] = useState(false);
  const [showGlobeMap, setShowGlobeMap] = useState(true);
  const [savingGlobe, setSavingGlobe] = useState(false);
  const ALL_CATS = [
    { value: "business", label: "Business" },
    { value: "personal", label: "Personal" },
    { value: "family", label: "Family" },
  ];

  useEffect(() => {
    async function loadData() {
      const [assetsRes, billsRes, messagesRes, profileRes, orgRes] = await Promise.all([
        db.from("assets").select("id, estimated_value").eq("organization_id", orgId).eq("is_deleted", false),
        fetchBillSummary(orgId),
        db.from("messages").select("id").eq("organization_id", orgId).eq("is_deleted", false).eq("is_archived", false),
        db.from("client_profiles").select("allowed_categories").eq("organization_id", orgId).single(),
        db.from("organizations").select("show_globe_map").eq("id", orgId).single(),
      ]);

      const assets = assetsRes.data || [];
      setProjectsCount(assets.length);
      setProjectsValue(assets.reduce((sum: number, a: { estimated_value: number }) => sum + (a.estimated_value || 0), 0));
      setBillSummary(billsRes);
      setAlertsCount((messagesRes.data || []).length);
      if (profileRes.data?.allowed_categories) {
        setAllowedCategories(profileRes.data.allowed_categories);
      }
      setShowGlobeMap(orgRes?.data?.show_globe_map ?? true);
      setIsLoading(false);
    }
    loadData();
  }, [orgId]);

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  function startEditName() {
    setNameDraft(clientName);
    setNameError(null);
    setIsEditingName(true);
  }

  function cancelEditName() {
    setIsEditingName(false);
    setNameError(null);
  }

  async function saveName() {
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      setNameError("Name can't be empty.");
      return;
    }
    if (trimmed === clientName) {
      setIsEditingName(false);
      return;
    }
    setSavingName(true);
    setNameError(null);
    const res = await updateClientProfile(orgId, { display_name: trimmed });
    setSavingName(false);
    if (!res.success) {
      setNameError(res.error ?? "Couldn't save the new name.");
      return;
    }
    setClientName(trimmed);
    setIsEditingName(false);
  }

  const quickLinks = [
    { name: "Projects", href: `/admin/client/${orgId}/projects`, icon: Building2, stat: `${projectsCount} projects` },
    { name: "Bills", href: `/admin/client/${orgId}/bills`, icon: Receipt, stat: `${billSummary?.upcomingCount || 0} pending` },
    { name: "Alerts", href: `/admin/client/${orgId}/messages`, icon: MessageSquare, stat: `${alertsCount} active` },
    { name: "Daily Briefs", href: `/admin/client/${orgId}/briefs`, icon: FileText, stat: "Compose briefs" },
    { name: "Principal Experience", href: `/admin/client/${orgId}/principal-experience`, icon: Sparkles, stat: "Module visibility" },
    ...(isAdmin ? [{ name: "Delegates", href: `/admin/client/${orgId}/delegates`, icon: Users, stat: "Manage access" }] : []),
    ...(canUpload ? [{ name: "Budget Upload", href: `/admin/client/${orgId}/upload`, icon: Upload, stat: "Import budgets" }] : []),
  ];

  return (
    <div className="space-y-8">
      <div>
        {isEditingName ? (
          <div className="flex flex-wrap items-center gap-2">
            <input
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  saveName();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  cancelEditName();
                }
              }}
              disabled={savingName}
              aria-label="Principal name"
              className="min-w-[16rem] rounded-md border border-border bg-background px-3 py-1.5 text-2xl font-bold text-foreground focus:border-primary focus:outline-none disabled:opacity-60"
            />
            <Button
              size="sm"
              onClick={saveName}
              disabled={savingName}
              className="gap-1"
            >
              {savingName ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={cancelEditName}
              disabled={savingName}
              className="gap-1"
            >
              <XIcon className="h-4 w-4" />
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">
              {clientName}&apos;s Workspace
            </h1>
            {canEditName && (
              <button
                type="button"
                onClick={startEditName}
                aria-label="Rename principal"
                className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
        {nameError && (
          <p className="mt-2 text-sm text-red-400">{nameError}</p>
        )}
        <p className="mt-1 text-sm text-muted-foreground">
          Manage projects, bills, alerts, and budgets for this principal.
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="border-border">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-foreground">{projectsCount}</p>
            <p className="text-xs text-muted-foreground">Projects</p>
            {projectsValue > 0 && (
              <p className="mt-1 text-sm text-muted-foreground">{formatCurrency(projectsValue)}</p>
            )}
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-foreground">{billSummary?.upcomingCount || 0}</p>
            <p className="text-xs text-muted-foreground">Pending Bills</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatCurrency((billSummary?.totalDueThisMonth || 0) / 100)} this month
            </p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-foreground">{billSummary?.overdueCount || 0}</p>
            <p className="text-xs text-muted-foreground">Overdue</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatCurrency((billSummary?.overdueTotal || 0) / 100)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-foreground">{alertsCount}</p>
            <p className="text-xs text-muted-foreground">Active Alerts</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick links */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-foreground">Quick Access</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {quickLinks.map((link) => (
            <Link key={link.name} href={link.href}>
              <Card className="group cursor-pointer border-border transition-colors hover:bg-muted/30">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <link.icon className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium text-foreground">{link.name}</p>
                      <p className="text-xs text-muted-foreground">{link.stat}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Allowed Categories — admin editable */}
      {isAdmin && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Tag className="h-4 w-4 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Asset Categories</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Choose which asset categories are available for this principal. At least one is required.
          </p>
          <div className="flex flex-wrap gap-3">
            {ALL_CATS.map((cat) => {
              const selected = allowedCategories.includes(cat.value);
              return (
                <button
                  key={cat.value}
                  disabled={savingCategories}
                  onClick={async () => {
                    if (selected && allowedCategories.length <= 1) return;
                    const next = selected
                      ? allowedCategories.filter((c) => c !== cat.value)
                      : [...allowedCategories, cat.value];
                    setAllowedCategories(next);
                    setSavingCategories(true);
                    await updateClientProfile(orgId, { allowed_categories: next });
                    setSavingCategories(false);
                  }}
                  className={cn(
                    "rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
                    selected
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted/30"
                  )}
                >
                  {cat.label}
                </button>
              );
            })}
            {savingCategories && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground self-center" />}
          </div>
        </div>
      )}

      {/* Globe Map Toggle — admin only */}
      {isAdmin && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Globe className="h-4 w-4 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Global Projects Map</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Show the interactive globe map on the principal&apos;s dashboard.
          </p>
          <button
            disabled={savingGlobe}
            onClick={async () => {
              const next = !showGlobeMap;
              setShowGlobeMap(next);
              setSavingGlobe(true);
              await db.from("organizations").update({ show_globe_map: next }).eq("id", orgId);
              setSavingGlobe(false);
            }}
            className={cn(
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
              showGlobeMap ? "bg-primary" : "bg-muted"
            )}
          >
            <span
              className={cn(
                "inline-block h-4 w-4 rounded-full bg-white transition-transform",
                showGlobeMap ? "translate-x-6" : "translate-x-1"
              )}
            />
          </button>
          <span className="ml-3 text-sm text-muted-foreground">
            {showGlobeMap ? "Enabled" : "Disabled"}
            {savingGlobe && <Loader2 className="ml-2 inline h-3 w-3 animate-spin" />}
          </span>
        </div>
      )}

      {/* Danger Zone — admin only */}
      {canDelete && <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-5">
        <div className="flex items-center gap-2 mb-2">
          <Trash2 className="h-4 w-4 text-red-400" />
          <h3 className="text-sm font-semibold text-red-400">Danger Zone</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Permanently delete this principal and all associated data. This cannot be undone.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
          onClick={() => setShowDeleteModal(true)}
        >
          <Trash2 className="mr-2 h-3.5 w-3.5" />
          Delete Principal
        </Button>
      </div>}

      {canDelete && <DeletePrincipalModal
        open={showDeleteModal}
        orgId={orgId}
        principalName={clientName}
        onCancel={() => setShowDeleteModal(false)}
        onConfirmDelete={async () => {
          const result = await deletePrincipal(orgId);
          if (result.success) {
            if (activePrincipal?.orgId === orgId) {
              clearActivePrincipal();
            }
            setShowDeleteModal(false);
            setDeleteToast(`${clientName} has been permanently deleted`);
            setTimeout(() => router.push("/admin"), 1500);
          }
        }}
      />}

      {deleteToast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-border bg-card px-5 py-3 shadow-xl">
          <p className="text-sm font-medium text-foreground">{deleteToast}</p>
        </div>
      )}
    </div>
  );
}
