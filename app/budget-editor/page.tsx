"use client";

/**
 * Budget Editor — Budget Library page.
 *
 * Phase 1 scope (per x-fusion-cell-budget-editor-build-spec.docx):
 *   - List every asset for the current org, grouped by category
 *   - Show which assets have a budget uploaded (year label) vs don't
 *   - Click an asset with a budget → /budget-editor/[assetId] (Phase 2)
 *   - Click an asset without a budget → /upload (existing wizard)
 *   - "Import New Budget" button in the header → /upload
 *   - Admin-only access; principals (executive/delegate) are redirected
 *
 * Role gating (per the agreed mapping):
 *   - admin / manager     → full access (edit privileges arrive in Phase 3)
 *   - viewer              → read-only (same page, Save/Import hidden later)
 *   - executive / delegate → blocked; redirected to "/"
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Loader2,
  Upload,
  FileSpreadsheet,
  ChevronRight,
  Wallet,
  Building2,
  Home,
  Briefcase,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { useRole } from "@/lib/use-role";
import { useScopedOrgId, useEffectiveOrgId } from "@/lib/use-active-principal";
import {
  fetchAssetsWithBudgetStatus,
  type BudgetLibraryData,
  type AssetWithBudgetStatus,
} from "@/lib/budget-editor-service";

// ─── Category display config ────────────────────────────────────────────

type CategoryKey = "business" | "family" | "personal" | "other";

const CATEGORY_CONFIG: Record<
  CategoryKey,
  { label: string; icon: typeof Building2; accent: string }
> = {
  business: { label: "Business", icon: Briefcase, accent: "#3b82f6" },
  family: { label: "Family", icon: Home, accent: "#10b981" },
  personal: { label: "Personal", icon: Wallet, accent: "#8b5cf6" },
  other: { label: "Other", icon: Building2, accent: "#71717a" },
};

// Order the sections appear in on the page.
const SECTION_ORDER: CategoryKey[] = ["business", "family", "personal", "other"];

// ─── Page ──────────────────────────────────────────────────────────────

export default function BudgetEditorLibraryPage() {
  const router = useRouter();
  const { role, isLoading: roleLoading, isPrincipalSide } = useRole();
  const { scopedOrgId, isLoading: scopedLoading } = useScopedOrgId();
  const { orgId: effectiveOrgId, isLoading: effectiveLoading } =
    useEffectiveOrgId();
  const libraryOrgId = scopedOrgId ?? effectiveOrgId;
  const orgResolved = !scopedLoading && !effectiveLoading;

  const [data, setData] = useState<BudgetLibraryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Role gate: redirect principals away as soon as role is known.
  useEffect(() => {
    if (roleLoading) return;
    if (isPrincipalSide) {
      router.replace("/");
    }
  }, [roleLoading, isPrincipalSide, router]);

  // Load data.
  useEffect(() => {
    if (!orgResolved || !libraryOrgId || isPrincipalSide) {
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    fetchAssetsWithBudgetStatus(libraryOrgId)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load budgets"
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orgResolved, libraryOrgId, isPrincipalSide]);

  // ─── Loading / auth states ─────────────────────────────────────────────

  if (roleLoading || !orgResolved) {
    return (
      <div className="min-h-screen bg-black">
        <Navbar />
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-white/40" />
        </div>
      </div>
    );
  }

  if (isPrincipalSide) {
    // Redirect is in flight — render nothing.
    return null;
  }

  if (!libraryOrgId) {
    return (
      <div className="min-h-screen bg-black">
        <Navbar />
        <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
          <p className="text-sm text-white/60">
            No organization is linked to this session. Open the Command
            Center to select a principal.
          </p>
        </main>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────

  const totalAssets = data
    ? data.business.length +
      data.family.length +
      data.personal.length +
      data.other.length
    : 0;
  const totalWithBudgets = data
    ? [
        ...data.business,
        ...data.family,
        ...data.personal,
        ...data.other,
      ].filter((a) => a.hasBudget).length
    : 0;

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-8"
        >
          <div>
            <div className="flex items-center gap-2 mb-1">
              <FileSpreadsheet className="h-4 w-4 text-[#4ade80]" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
                Budget Editor
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white">Budget Library</h1>
            <p className="text-sm text-white/50 mt-1">
              {isLoading
                ? "Loading…"
                : totalAssets === 0
                  ? "No projects yet."
                  : `${totalWithBudgets} of ${totalAssets} project${totalAssets === 1 ? "" : "s"} have a budget`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/upload"
              className="flex items-center gap-2 rounded-lg border border-[#222222] bg-[#111111] px-4 py-2 text-xs font-medium text-white/80 hover:border-[#4ade80] hover:text-white transition-colors"
            >
              <Upload className="h-3.5 w-3.5" />
              Import New Budget
            </Link>
          </div>
        </motion.div>

        {/* Body */}
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-white/40" />
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-5 text-sm text-red-300">
            {error}
          </div>
        ) : totalAssets === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-10">
            {SECTION_ORDER.map((key) => {
              const items = data?.[key] ?? [];
              if (items.length === 0) return null;
              return (
                <CategorySection key={key} category={key} assets={items} />
              );
            })}
          </div>
        )}

        {/* Read-only notice for viewers (Phase 3 enforces this in the editor) */}
        {role === "viewer" && !isLoading && totalAssets > 0 && (
          <p className="mt-8 text-[11px] text-white/40">
            You have read-only access. Budget changes require a director or admin.
          </p>
        )}
      </main>
    </div>
  );
}

// ─── Subcomponents ──────────────────────────────────────────────────────

function CategorySection({
  category,
  assets,
}: {
  category: CategoryKey;
  assets: AssetWithBudgetStatus[];
}) {
  const config = CATEGORY_CONFIG[category];
  const Icon = config.icon;
  const withBudget = assets.filter((a) => a.hasBudget).length;

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-3.5 w-3.5" style={{ color: config.accent }} />
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
          {config.label}
        </h2>
        <span className="text-[11px] text-white/30">
          {withBudget}/{assets.length} with budget
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {assets.map((asset) => (
          <AssetCard key={asset.id} asset={asset} accent={config.accent} />
        ))}
      </div>
    </section>
  );
}

function AssetCard({
  asset,
  accent,
}: {
  asset: AssetWithBudgetStatus;
  accent: string;
}) {
  const hasBudget = asset.hasBudget;

  // Every card is clickable. Assets with a budget open the editor;
  // assets without a budget open the upload wizard pre-scoped to that
  // asset so the user can immediately drop in a spreadsheet.
  const href = hasBudget
    ? `/budget-editor/${asset.id}`
    : `/upload?asset=${asset.id}`;

  const cardClasses = [
    "group relative flex flex-col gap-3 rounded-xl border border-[#222222] bg-[#111111] p-4 transition-all",
    "hover:-translate-y-[1px] hover:border-[#4ade80]",
    hasBudget ? "" : "opacity-70",
  ].join(" ");

  return (
    <Link href={href} className={cardClasses}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white truncate">
            {asset.name}
          </p>
          <p className="text-[11px] text-white/40 mt-0.5 capitalize">
            {asset.category}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-white/30 transition-colors group-hover:text-[#4ade80]" />
      </div>

      <div className="flex items-center justify-between gap-2">
        {hasBudget ? (
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium"
            style={{
              borderColor: `${accent}40`,
              backgroundColor: `${accent}10`,
              color: accent,
            }}
          >
            <FileSpreadsheet className="h-3 w-3" />
            {asset.latestBudgetYear} Budget
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#4ade80]/30 bg-[#4ade80]/5 px-2 py-0.5 text-[10px] text-[#4ade80]">
            <Upload className="h-3 w-3" />
            Import budget
          </span>
        )}
      </div>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#222222] bg-[#0a0a0a] px-6 py-16 text-center">
      <FileSpreadsheet className="h-10 w-10 text-white/20 mb-3" />
      <p className="text-sm font-medium text-white">No projects yet</p>
      <p className="text-xs text-white/40 mt-1 max-w-sm">
        Add a project first, then upload its budget spreadsheet to start
        editing.
      </p>
      <Link
        href="/assets"
        className="mt-5 inline-flex items-center gap-2 rounded-lg border border-[#222222] bg-[#111111] px-4 py-2 text-xs font-medium text-white/80 hover:border-[#4ade80] hover:text-white transition-colors"
      >
        Go to Projects
      </Link>
    </div>
  );
}
