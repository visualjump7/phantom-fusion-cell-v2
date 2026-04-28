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
import { useRouter, useSearchParams } from "next/navigation";
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
import {
  SUMMARY_CARDS,
  getSummaryConfigForPrincipal,
  setSummaryCardVisibility,
  type SummaryCardKey,
  type SummaryConfigRow,
} from "@/lib/principal-summary-service";
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
  const searchParams = useSearchParams();
  // Deep-link target: /admin/client/[orgId]/principal-experience?principalId=X
  // selects that executive on first render so the executives roster page can
  // jump straight to their view config.
  const requestedPrincipalId = searchParams.get("principalId");
  const { orgId, clientName } = useClientContext();
  const { enterPreview } = usePreview();
  const { blocked, guardClick } = useActionGuard();

  const [principals, setPrincipals] = useState<PrincipalRow[]>([]);
  const [selectedPrincipalId, setSelectedPrincipalId] = useState<string | null>(null);
  const [config, setConfig] = useState<ModuleConfigRow[]>([]);
  const [summaryConfig, setSummaryConfig] = useState<SummaryConfigRow[]>([]);
  const [loadingPrincipals, setLoadingPrincipals] = useState(true);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [savingSummary, setSavingSummary] = useState<Record<string, boolean>>({});

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
        // Honor ?principalId= when present and valid, else fall back to the
        // first executive in the list.
        const wantedId = requestedPrincipalId &&
          rows.some((r) => r.userId === requestedPrincipalId)
            ? requestedPrincipalId
            : rows[0]?.userId ?? null;
        setSelectedPrincipalId(wantedId);
        setLoadingPrincipals(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  // Honor ?principalId= when navigating between executives without a full
  // remount (e.g. router.push from the executives roster page after adding).
  useEffect(() => {
    if (!requestedPrincipalId || principals.length === 0) return;
    if (principals.some((p) => p.userId === requestedPrincipalId)) {
      setSelectedPrincipalId(requestedPrincipalId);
    }
  }, [requestedPrincipalId, principals]);

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

  // Load summary-card config in parallel with module config. Shares the
  // same loading state since we show both sections together and a single
  // spinner is simpler than interleaving two.
  useEffect(() => {
    if (!orgId || !selectedPrincipalId) {
      setSummaryConfig([]);
      return;
    }
    let cancelled = false;
    getSummaryConfigForPrincipal(orgId, selectedPrincipalId)
      .then((rows) => {
        if (!cancelled) setSummaryConfig(rows);
      })
      .catch(() => {
        /* leave summaryConfig empty — UI renders defaults-off */
      });
    return () => {
      cancelled = true;
    };
  }, [orgId, selectedPrincipalId]);

  const summaryByKey = useMemo(() => {
    const map = new Map<string, SummaryConfigRow>();
    summaryConfig.forEach((r) => map.set(r.card_key, r));
    return map;
  }, [summaryConfig]);

  async function handleSummaryToggle(cardKey: SummaryCardKey, next: boolean) {
    if (!selectedPrincipalId) return;
    // Optimistic
    setSummaryConfig((prev) =>
      prev.map((r) => (r.card_key === cardKey ? { ...r, is_visible: next } : r))
    );
    setSavingSummary((s) => ({ ...s, [cardKey]: true }));

    const res = await setSummaryCardVisibility(
      orgId,
      selectedPrincipalId,
      cardKey,
      next
    );
    setSavingSummary((s) => ({ ...s, [cardKey]: false }));

    if (!res.success) {
      setSummaryConfig((prev) =>
        prev.map((r) =>
          r.card_key === cardKey ? { ...r, is_visible: !next } : r
        )
      );
    }
  }

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
        No executives on <strong>{clientName}</strong> yet. Add one from the
        Executives section to configure their view.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Executive View</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose what each executive on <strong>{clientName}</strong> sees when they sign in.
            Dashboard and Comms are always enabled — Dashboard is their full view and Comms
            powers decision approvals.
          </p>
        </div>
      </div>

      {/* Executive selector — always visible, even with one person, so the admin
          knows whose view they're configuring. */}
      {principals.length >= 1 && (
        <div className="mb-6">
          <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Executive
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
              Preview as executive
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

      {/* ─── Summary cards (below the orbital ring) ────────────────────
          These show for principals ONLY, underneath the orbital command
          ring. Defaults-off — the principal sees nothing until the admin
          turns cards on here. Click-through opens the corresponding
          orbital module overlay. */}
      <div className="mt-10">
        <div className="mb-3">
          <h2 className="text-lg font-semibold tracking-tight">
            Summary cards
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Quick-glance cards that appear <strong>below</strong> the
            orbital ring on this executive&apos;s command page. Redundant
            with the ring on purpose — lets them scroll to check status
            without opening an overlay. All off by default.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {SUMMARY_CARDS.map((card) => {
            const row = summaryByKey.get(card.key);
            const isOn = row?.is_visible ?? false;
            const isSavingCard = savingSummary[card.key];
            return (
              <Card
                key={card.key}
                className={
                  "border-border bg-card/60 transition " +
                  (isOn ? "" : "opacity-70")
                }
              >
                <CardContent className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      {card.label}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {card.description}
                    </p>
                  </div>

                  <label
                    className={
                      "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition " +
                      (isOn ? "bg-emerald-500/80" : "bg-muted") +
                      (blocked ? " opacity-60" : " cursor-pointer")
                    }
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={isOn}
                      disabled={blocked || isSavingCard}
                      onChange={(e) => {
                        guardClick(() =>
                          handleSummaryToggle(card.key, e.target.checked)
                        )();
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
      </div>
    </div>
  );
}
