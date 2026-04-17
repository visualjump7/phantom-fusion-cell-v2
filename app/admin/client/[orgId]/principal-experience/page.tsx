"use client";

/**
 * Principal Experience — per-principal module visibility configuration.
 *
 * Admin checks/unchecks which modules appear on the principal's nucleus.
 * Dashboard and Comms are required and cannot be toggled off. Changes
 * apply immediately (optimistic UI) via setModuleVisibility.
 *
 * Each card has a "Preview" link that activates View-as-Principal for
 * this principal and routes to /nucleus.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Eye, RotateCcw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useClientContext } from "@/lib/use-client-context";
import { supabase } from "@/lib/supabase";
import {
  getModuleConfigForPrincipal,
  resetPrincipalToDefaults,
  setModuleVisibility,
  type ModuleConfigRow,
} from "@/lib/module-visibility-service";
import { MODULE_METADATA } from "@/lib/module-metadata";
import { ALL_MODULE_KEYS, isRequiredModule, type ModuleKey } from "@/lib/modules";
import { usePreview } from "@/lib/preview-context";
import { useActionGuard } from "@/lib/use-action-guard";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface PrincipalRow {
  userId: string;
  name: string;
  email: string;
}

export default function PrincipalExperiencePage() {
  const router = useRouter();
  const { orgId, clientName } = useClientContext();
  const { enterPreview } = usePreview();
  const { blocked, guardClick } = useActionGuard();

  const [principals, setPrincipals] = useState<PrincipalRow[]>([]);
  const [selectedPrincipalId, setSelectedPrincipalId] = useState<string | null>(null);
  const [config, setConfig] = useState<ModuleConfigRow[]>([]);
  const [loadingPrincipals, setLoadingPrincipals] = useState(true);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  // Load principals for this org
  useEffect(() => {
    let cancelled = false;
    setLoadingPrincipals(true);
    (async () => {
      const { data: members } = await db
        .from("organization_members")
        .select("user_id, role")
        .eq("organization_id", orgId)
        .in("role", ["executive"]);
      const userIds = (members || []).map((m: { user_id: string }) => m.user_id);
      if (userIds.length === 0) {
        if (!cancelled) {
          setPrincipals([]);
          setLoadingPrincipals(false);
        }
        return;
      }
      const { data: profiles } = await db
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);
      const rows: PrincipalRow[] = (profiles || []).map(
        (p: { id: string; full_name: string | null; email: string | null }) => ({
          userId: p.id,
          name: p.full_name || p.email || "Unnamed principal",
          email: p.email || "",
        })
      );
      if (!cancelled) {
        setPrincipals(rows);
        setSelectedPrincipalId(rows[0]?.userId ?? null);
        setLoadingPrincipals(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  // Load config for selected principal
  useEffect(() => {
    if (!selectedPrincipalId) return;
    let cancelled = false;
    setLoadingConfig(true);
    getModuleConfigForPrincipal(orgId, selectedPrincipalId)
      .then((rows) => {
        if (!cancelled) {
          setConfig(rows);
          setLoadingConfig(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadingConfig(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orgId, selectedPrincipalId]);

  const configByKey = useMemo(() => {
    const map = new Map<string, ModuleConfigRow>();
    config.forEach((r) => map.set(r.module_key, r));
    return map;
  }, [config]);

  async function handleToggle(moduleKey: ModuleKey, next: boolean) {
    if (!selectedPrincipalId) return;
    if (isRequiredModule(moduleKey)) return;

    // Optimistic
    setConfig((prev) =>
      prev.map((r) => (r.module_key === moduleKey ? { ...r, is_visible: next } : r))
    );
    setSaving((s) => ({ ...s, [moduleKey]: true }));

    const res = await setModuleVisibility(orgId, selectedPrincipalId, moduleKey, next);
    setSaving((s) => ({ ...s, [moduleKey]: false }));

    if (!res.success) {
      // Rollback on failure
      setConfig((prev) =>
        prev.map((r) => (r.module_key === moduleKey ? { ...r, is_visible: !next } : r))
      );
    }
  }

  async function handleReset() {
    if (!selectedPrincipalId) return;
    const res = await resetPrincipalToDefaults(orgId, selectedPrincipalId);
    if (res.success) {
      const fresh = await getModuleConfigForPrincipal(orgId, selectedPrincipalId);
      setConfig(fresh);
    }
  }

  async function handlePreview() {
    if (!selectedPrincipalId) return;
    const principal = principals.find((p) => p.userId === selectedPrincipalId);
    if (!principal) return;
    await enterPreview({
      principalId: principal.userId,
      principalName: principal.name,
      orgId,
    });
    router.push("/command");
    router.refresh();
  }

  if (loadingPrincipals) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (principals.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center text-muted-foreground">
        No principals found for <strong>{clientName}</strong>. Onboard a principal to configure their experience.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Principal Experience</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose which modules appear on each principal&apos;s nucleus. Dashboard and Comms are always enabled —
            Dashboard is the principal&apos;s full view and Comms powers decision approvals.
          </p>
        </div>
      </div>

      {/* Principal selector */}
      {principals.length > 1 && (
        <div className="mb-6">
          <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Principal
          </label>
          <select
            value={selectedPrincipalId ?? ""}
            onChange={(e) => setSelectedPrincipalId(e.target.value)}
            className="w-full max-w-sm rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          >
            {principals.map((p) => (
              <option key={p.userId} value={p.userId}>
                {p.name} {p.email ? `— ${p.email}` : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      <Card className="mb-6 border-border/60 bg-muted/30">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-xs text-muted-foreground">
            Defaults: <strong>Dashboard</strong>, <strong>Daily Brief</strong>, and <strong>Comms</strong> are
            enabled. Toggle other modules to expand this principal&apos;s view.
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={guardClick(handleReset)}
              disabled={blocked}
              className="gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset to defaults
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handlePreview}
              className="gap-1.5"
            >
              <Eye className="h-3.5 w-3.5" />
              Preview as principal
            </Button>
          </div>
        </CardContent>
      </Card>

      {loadingConfig ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {ALL_MODULE_KEYS.map((key) => {
            const meta = MODULE_METADATA[key];
            const row = configByKey.get(key);
            const isOn = row?.is_visible ?? false;
            const required = isRequiredModule(key);
            const isSaving = saving[key];
            return (
              <Card
                key={key}
                className={
                  "border-border bg-card/60 transition " +
                  (isOn ? "" : "opacity-70")
                }
              >
                <CardContent className="flex items-start justify-between gap-3 p-4">
                  <div className="flex items-start gap-3">
                    <span
                      className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                      style={{ background: `${meta.accent}20`, color: meta.accent }}
                    >
                      <meta.icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{meta.label}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{meta.description}</p>
                      {required && (
                        <p className="mt-1 text-[11px] text-amber-400">
                          {key === "dashboard"
                            ? "Always available — it is the principal's full view."
                            : "Required for decision approval workflows."}
                        </p>
                      )}
                    </div>
                  </div>

                  <label
                    className={
                      "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition " +
                      (isOn ? "bg-emerald-500/80" : "bg-muted") +
                      (required || blocked ? " opacity-60" : " cursor-pointer")
                    }
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={isOn}
                      disabled={required || blocked || isSaving}
                      onChange={(e) => {
                        if (required) return;
                        guardClick(() => handleToggle(key, e.target.checked))();
                      }}
                    />
                    <span
                      className={
                        "inline-block h-4 w-4 transform rounded-full bg-white transition " +
                        (isOn ? "translate-x-6" : "translate-x-1")
                      }
                    />
                  </label>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
