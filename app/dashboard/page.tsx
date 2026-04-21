"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Loader2,
  Building2,
  TrendingUp,
  MessageSquare,
  ChevronRight,
  FileText,
  Maximize2,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CashFlowCard } from "@/components/dashboard/CashFlowCard";
import { supabase } from "@/lib/supabase";
import { formatCurrency } from "@/lib/utils";
import { useRole } from "@/lib/use-role";
import { useThemePreferences } from "@/components/ThemeProvider";
import { useScopedOrgId, useEffectiveOrgId } from "@/lib/use-active-principal";
import {
  fetchBillSummary,
  fetchUpcomingBills,
  BillSummary,
  Bill,
} from "@/lib/bill-service";
import { fetchLatestPublishedBrief, Brief } from "@/lib/brief-service";
import { useRouter } from "next/navigation";
import { useAllowedCategories } from "@/lib/use-allowed-categories";
import { AssetPin, UnlocatedAsset } from "@/lib/map-types";
import { useBreakpoint } from "@/lib/use-breakpoint";
import { GlobeMapDynamic } from "@/components/map/GlobeMapDynamic";

interface Asset {
  id: string;
  organization_id?: string;
  name: string;
  category: string;
  estimated_value: number;
  latitude?: number | null;
  longitude?: number | null;
  city?: string | null;
  state_province?: string | null;
  country?: string | null;
  location_type?: string | null;
}

interface Message {
  id: string;
  title: string;
  type: string;
  priority: string;
  asset_id: string | null;
  created_at: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export default function DashboardPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [billSummary, setBillSummary] = useState<BillSummary | null>(null);
  const [upcomingBills, setUpcomingBills] = useState<Bill[]>([]);
  const [latestBrief, setLatestBrief] = useState<Brief | null>(null);
  const [showGlobeMap, setShowGlobeMap] = useState(false);
  const { userName, isAdmin, isExecutive, isDelegate, role } = useRole();
  const { density, theme } = useThemePreferences();
  const { scopedOrgId } = useScopedOrgId();
  const { orgId: effectiveOrgId } = useEffectiveOrgId();
  /** Map uses principal scope when set; otherwise admin/staff fall back to their home org */
  const globeOrgId = scopedOrgId ?? effectiveOrgId ?? null;
  const { allowedCategories } = useAllowedCategories(scopedOrgId);
  const dashRouter = useRouter();
  const { isMobile, isTablet } = useBreakpoint();

  // Delegates should never see the Dashboard — redirect to /assets
  useEffect(() => {
    if (isDelegate) {
      dashRouter.replace("/assets");
    }
  }, [isDelegate, dashRouter]);

  useEffect(() => {
    async function loadData() {
      try {
        let assetQuery = db
          .from("assets")
          .select("id, organization_id, name, category, estimated_value, latitude, longitude, city, state_province, country, location_type")
          .eq("is_deleted", false)
          .order("estimated_value", { ascending: false });
        if (scopedOrgId) assetQuery = assetQuery.eq("organization_id", scopedOrgId);

        let msgQuery = db.from("messages").select("id, title, type, priority, asset_id, created_at").eq("is_deleted", false).eq("is_archived", false).order("created_at", { ascending: false }).limit(5);
        if (scopedOrgId) msgQuery = msgQuery.eq("organization_id", scopedOrgId);

        const orgForGlobeSettings = scopedOrgId ?? effectiveOrgId;
        const orgSettingsPromise = orgForGlobeSettings
          ? db.from("organizations").select("show_globe_map").eq("id", orgForGlobeSettings).single()
          : Promise.resolve({ data: null });

        const [assetRes, msgRes, summary, upcoming, briefRes, orgSettings] = await Promise.all([
          assetQuery,
          msgQuery,
          fetchBillSummary(scopedOrgId || undefined),
          fetchUpcomingBills(7, scopedOrgId || undefined),
          scopedOrgId ? fetchLatestPublishedBrief(scopedOrgId) : Promise.resolve(null),
          orgSettingsPromise,
        ]);

        setAssets(assetRes.data || []);
        setMessages(msgRes.data || []);
        setBillSummary(summary);
        setUpcomingBills(upcoming);
        setLatestBrief(briefRes);
        setShowGlobeMap(orgSettings?.data?.show_globe_map ?? true);
      } catch (error) {
        console.error("Error loading dashboard:", error);
      } finally {
        setIsLoading(false);
      }
    }
    setIsLoading(true);
    loadData();
  }, [scopedOrgId, effectiveOrgId]);

  const totalValue = assets.reduce((sum, a) => sum + (a.estimated_value || 0), 0);

  // Globe pins: only assets in the org used for map context (principal or home org for admins)
  const assetsForGlobe = globeOrgId
    ? assets.filter((a) => a.organization_id === globeOrgId)
    : [];

  const locatedAssets: AssetPin[] = assetsForGlobe
    .filter((a) => a.latitude != null && a.longitude != null)
    .map((a) => ({
      id: a.id,
      name: a.name,
      latitude: a.latitude!,
      longitude: a.longitude!,
      estimatedValue: a.estimated_value,
      category: a.category,
      locationType: (a.location_type as AssetPin["locationType"]) || "precise",
      city: a.city || undefined,
      stateProvince: a.state_province || undefined,
      country: a.country || undefined,
    }));

  const unlocatedAssets: UnlocatedAsset[] = assetsForGlobe
    .filter((a) => a.latitude == null || a.longitude == null)
    .map((a) => ({
      id: a.id,
      name: a.name,
      category: a.category,
      estimatedValue: a.estimated_value,
    }));

  const shouldShowGlobe =
    showGlobeMap &&
    locatedAssets.length > 0 &&
    !!process.env.NEXT_PUBLIC_MAPBOX_TOKEN &&
    !!globeOrgId;
  const categoryTotals = assets.reduce((acc, a) => {
    if (!allowedCategories.includes(a.category)) return acc;
    acc[a.category] = (acc[a.category] || 0) + (a.estimated_value || 0);
    return acc;
  }, {} as Record<string, number>);

  const categoryColors: Record<string, string> = {
    family: "text-white bg-emerald-600",
    business: "text-white bg-blue-600",
    personal: "text-white bg-violet-600",
  };

  const priorityBarColors: Record<string, string> = {
    urgent: "bg-red-500",
    high: "bg-amber-500",
    medium: "bg-blue-500",
    low: "bg-border",
  };

  const priorityColors: Record<string, string> = {
    urgent: "bg-red-600 text-white border-red-600",
    high: "bg-amber-600 text-white border-amber-600",
    medium: "bg-blue-600 text-white border-blue-600",
    low: "border-border text-muted-foreground",
  };

  // Greeting based on time of day
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const displayName = userName ? userName.charAt(0).toUpperCase() + userName.slice(1) : "Guest";

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.08, delayChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } },
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute top-1/2 -left-40 h-80 w-80 rounded-full bg-emerald-500/5 blur-3xl" />
      </div>

      <Navbar />

      {/* Globe Map Hero */}
      {!isLoading && shouldShowGlobe && (
        <div className="relative">
          <GlobeMapDynamic
            locatedAssets={locatedAssets}
            unlocatedAssets={unlocatedAssets}
            organizationId={globeOrgId!}
            height={isMobile ? "35vh" : isTablet ? "38vh" : "45vh"}
            mobileMode={isMobile}
          />
          {/* Immersive view button — positioned to the left of the
              view toggle (top-right on desktop, bottom-right on mobile)
              so it doesn't collide with the two-tier MapViewToggle. */}
          <Link
            href="/globe"
            className="absolute bottom-3 right-3 sm:top-3 sm:right-[150px] sm:bottom-auto z-20 flex items-center gap-1.5 rounded-full bg-black/50 backdrop-blur-md border border-white/15 px-3 py-1.5 text-[11px] text-white/70 hover:text-white hover:bg-white/10 transition-colors min-h-[44px] sm:min-h-0"
          >
            <Maximize2 className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
            <span>{isMobile ? "Explore" : "Immersive View"}</span>
          </Link>
        </div>
      )}

      {/* Hero Header — dark on light theme */}
      <div className={(theme === "light" || theme === "hybrid") ? "section-dark" : ""}>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8"
        >
          <h1 className="page-title font-bold text-foreground">
            {greeting}, {displayName}
          </h1>
          <p className={theme === "light" ? "caption-text" : "caption-text"}>
            {isExecutive
              ? "Here\u2019s your financial overview"
              : "Fusion Cell command center"}
          </p>
        </motion.div>
      </div>

      <motion.main
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="mx-auto max-w-7xl px-4 py-[var(--gap)] sm:px-6 lg:px-8"
      >

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div
            className={
              density === "comfort"
                ? "grid grid-cols-1 gap-[var(--gap)] xl:grid-cols-2"
                : "grid grid-cols-1 gap-6 lg:grid-cols-12"
            }
          >
            {/* Left Column */}
            <div className={density === "comfort" ? "space-y-[var(--gap)]" : "space-y-6 lg:col-span-4"}>
              {/* Portfolio Value */}
              <motion.div variants={itemVariants} data-section="portfolio">
                <Card className="border-border bg-card/60 backdrop-blur-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      Total Projects
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="data-value text-[length:var(--font-size-page-title)] font-bold text-foreground">{formatCurrency(totalValue)}</p>
                    <p className="mt-1 text-[length:var(--font-size-caption)] text-muted-foreground">{assets.length} projects</p>
                    <div className="mt-4 space-y-[calc(var(--gap)/2)]">
                      {Object.entries(categoryTotals).map(([cat, val]) => (
                        <div key={cat} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`rounded-md px-2 py-0.5 text-xs font-medium capitalize ${categoryColors[cat] || ""}`}>
                              {cat}
                            </div>
                          </div>
                          <span className="data-value text-foreground">{formatCurrency(val)}</span>
                        </div>
                      ))}
                    </div>
                    <Link href="/assets" className="mt-4 flex items-center gap-1 text-[length:var(--font-size-caption)] text-primary hover:underline">
                      View all projects <ChevronRight className="h-3 w-3" />
                    </Link>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Cash Flow */}
              <motion.div variants={itemVariants} data-section="cashflow">
                <CashFlowCard summary={billSummary} upcomingBills={upcomingBills} />
              </motion.div>
            </div>

            {/* Right Column */}
            <div className={density === "comfort" ? "space-y-[var(--gap)]" : "space-y-6 lg:col-span-8"}>
              {/* Daily Brief */}
              <motion.div variants={itemVariants} data-section="brief">
                <Card className="border-border bg-card/60 backdrop-blur-sm">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <FileText className="h-4 w-4 text-primary" />
                        Daily Brief
                      </CardTitle>
                      {latestBrief && (
                        <Link href="/brief" className="text-[length:var(--font-size-caption)] text-primary hover:underline">
                          Read Brief {"\u2192"}
                        </Link>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {latestBrief ? (
                      <Link href="/brief" className="block group">
                        <p className="font-medium text-foreground group-hover:text-primary transition-colors">
                          {latestBrief.title}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {new Date(latestBrief.brief_date + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                          {" · Prepared by your Fusion Cell team"}
                        </p>
                        {latestBrief.blocks && latestBrief.blocks.length > 0 && (
                          <p className="mt-2 text-[length:var(--font-size-body)] text-muted-foreground line-clamp-2">
                            {latestBrief.blocks.find(b => b.type === "text" || b.type === "document")?.content_html
                              ? latestBrief.blocks.find(b => b.type === "text" || b.type === "document")!.content_html!.replace(/<[^>]+>/g, "").slice(0, 150)
                              : `${latestBrief.blocks.length} sections`}
                          </p>
                        )}
                      </Link>
                    ) : (
                      <p className="text-[length:var(--font-size-body)] text-muted-foreground">
                        No brief available
                      </p>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Quick Stats — horizontal snap-scroll on mobile (tight 2x2 cramped
                  long currency values), 4-col grid on sm+ */}
              <motion.div variants={itemVariants} data-section="stats">
                <div
                  className={
                    density === "comfort"
                      ? "grid grid-cols-1 gap-[var(--gap)] md:grid-cols-2"
                      : "-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-4 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0"
                  }
                >
                  {[
                    { label: "Total Projects", value: String(assets.length) },
                    {
                      label: "Due This Month",
                      value: billSummary
                        ? `$${Math.round(billSummary.totalDueThisMonth / 100).toLocaleString()}`
                        : "\u2014",
                    },
                    { label: "Pending Bills", value: String(billSummary?.upcomingCount || 0) },
                    { label: "Alerts", value: String(messages.length) },
                  ].map((stat) => (
                    <Card
                      key={stat.label}
                      className="w-[68%] shrink-0 snap-start border-border bg-card/60 backdrop-blur-sm sm:w-auto sm:shrink"
                    >
                      <CardContent>
                        <p className="text-[length:var(--font-size-caption)] text-muted-foreground">
                          {stat.label}
                        </p>
                        <p className="data-value text-[length:var(--font-size-section-header)] font-bold text-foreground">
                          {stat.value}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </motion.div>

              {/* Project List */}
              <motion.div variants={itemVariants} data-section="projects">
                <Card className="border-border bg-card/60 backdrop-blur-sm">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Building2 className="h-4 w-4 text-primary" />
                        Projects
                      </CardTitle>
                      <Link href="/assets" className="text-[length:var(--font-size-caption)] text-primary hover:underline">
                        View all {"\u2192"}
                      </Link>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="divide-y divide-border">
                      {assets.slice(0, 6).map((asset) => (
                        <Link
                          key={asset.id}
                          href={`/assets/${asset.id}`}
                          className="flex min-h-[var(--table-row-height)] items-center justify-between gap-4 rounded-lg px-[var(--table-cell-padding-x)] py-[var(--table-cell-padding-y)] transition-colors hover:bg-muted/30"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-medium capitalize ${categoryColors[asset.category] || ""}`}>
                              {asset.category}
                            </div>
                            <span className="truncate text-[length:var(--font-size-body)] font-medium text-foreground">{asset.name}</span>
                          </div>
                          <span className="shrink-0 whitespace-nowrap data-value text-muted-foreground">{formatCurrency(asset.estimated_value)}</span>
                        </Link>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Alerts */}
              <motion.div variants={itemVariants} data-section="alerts">
                <Card className="border-border bg-card/60 backdrop-blur-sm">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <MessageSquare className="h-4 w-4 text-primary" />
                        Recent Alerts
                      </CardTitle>
                      <Link href="/messages" className="text-[length:var(--font-size-caption)] text-primary hover:underline">
                        View all {"\u2192"}
                      </Link>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {messages.length === 0 ? (
                      <p className="text-[length:var(--font-size-body)] text-muted-foreground italic">No alerts yet</p>
                    ) : (
                      <div className="divide-y divide-border">
                        {messages.map((msg) => (
                          <Link
                            key={msg.id}
                            href="/messages"
                            className="flex min-h-[var(--table-row-height)] items-stretch gap-3 rounded-lg px-[var(--table-cell-padding-x)] py-[var(--table-cell-padding-y)] transition-colors hover:bg-muted/30"
                          >
                            <div className={`w-0.5 shrink-0 rounded-full ${priorityBarColors[msg.priority] || "bg-border"}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-[length:var(--font-size-body)] font-medium text-foreground truncate">{msg.title}</p>
                              <div className="mt-1 flex items-center gap-2">
                                <Badge variant="outline" className={`text-[10px] ${priorityColors[msg.priority]}`}>
                                  {msg.priority}
                                </Badge>
                                <span className="text-[length:var(--font-size-caption)] text-muted-foreground capitalize">{msg.type.replace("_", " ")}</span>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>
        )}
      </motion.main>
    </div>
  );
}
