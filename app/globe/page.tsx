"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { FloatingTopBar } from "@/components/map/FloatingTopBar";
import {
  LeftStatPanel,
  ExpandedCard,
  AlertFilter,
  PanelMessage,
  PanelBill,
  PanelAsset,
} from "@/components/map/LeftStatPanel";
import { RightStatPanel } from "@/components/map/RightStatPanel";
import { ImmersiveBottomBar } from "@/components/map/ImmersiveBottomBar";
import { MobileTopBar } from "@/components/map/MobileTopBar";
import { BottomDrawer } from "@/components/map/BottomDrawer";
import { MobileStatsContent } from "@/components/map/MobileStatsContent";
import { MobileDrillDown } from "@/components/map/MobileDrillDown";
import { supabase } from "@/lib/supabase";
import { useRole } from "@/lib/use-role";
import { useScopedOrgId, useEffectiveOrgId } from "@/lib/use-active-principal";
import { useBreakpoint } from "@/lib/use-breakpoint";
import { DecisionModal } from "@/components/dashboard/DecisionModal";
import { DashboardSearchBar } from "@/components/dashboard/DashboardSearchBar";
import { AssetPin, UnlocatedAsset } from "@/lib/map-types";

// Mapbox GL is client-only
const GlobeMap = dynamic(
  () => import("@/components/map/GlobeMap").then((m) => m.GlobeMap),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 flex items-center justify-center bg-black">
        <Loader2 className="h-10 w-10 animate-spin text-white/40" />
      </div>
    ),
  }
);

interface Asset {
  id: string;
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

interface Bill {
  id: string;
  title: string;
  amount_cents: number;
  due_date: string;
  status: string;
  asset_id?: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

const SNAP_COLLAPSED = 80;
const SNAP_HALF = "50%";
const SNAP_FULL = "92%";

/* Alert filter → highlight ring color */
const ALERT_HIGHLIGHT_COLORS: Record<string, string> = {
  urgent: "#ef4444",
  decisions: "#f59e0b",
  high: "#fb923c",
  medium: "#60a5fa",
};

export default function ImmersiveGlobePage() {
  const router = useRouter();
  const { userName } = useRole();
  const { scopedOrgId, isLoading: scopedLoading } = useScopedOrgId();
  const { orgId: effectiveOrgId, isLoading: effectiveLoading } = useEffectiveOrgId();
  const globeOrgId = scopedOrgId ?? effectiveOrgId;
  const orgResolved = !scopedLoading && !effectiveLoading;
  const { isMobile, isTablet } = useBreakpoint();
  const mapRef = useRef<any>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [decisionCount, setDecisionCount] = useState(0);
  const [principalName, setPrincipalName] = useState<string | undefined>();

  // Map controls
  const [mapStyle, setMapStyle] = useState<"dark" | "satellite">("dark");
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [drawerSnap, setDrawerSnap] = useState(0);

  // Interactive card state
  const [expandedCard, setExpandedCard] = useState<ExpandedCard>(null);
  const [alertFilter, setAlertFilter] = useState<AlertFilter>(null);
  const [selectedDecision, setSelectedDecision] = useState<PanelMessage | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const useDrawerLayout = isMobile || isTablet;

  // Load data — pre-fetch ALL messages (no limit) for alert expansion
  useEffect(() => {
    if (!orgResolved) return;

    if (!globeOrgId) {
      setIsLoading(false);
      return;
    }

    async function loadData() {
      try {
        const [assetRes, msgRes, billRes, decisionRes, orgRes] =
          await Promise.all([
            db
              .from("assets")
              .select(
                "id, name, category, estimated_value, latitude, longitude, city, state_province, country, location_type"
              )
              .eq("organization_id", globeOrgId)
              .eq("is_deleted", false)
              .order("estimated_value", { ascending: false }),
            db
              .from("messages")
              .select("id, title, type, priority, asset_id, created_at")
              .eq("organization_id", globeOrgId)
              .eq("is_deleted", false)
              .eq("is_archived", false)
              .order("created_at", { ascending: false })
              .limit(50),
            db
              .from("bills")
              .select("id, title, amount_cents, due_date, status, asset_id")
              .eq("organization_id", globeOrgId)
              .eq("is_deleted", false)
              .in("status", ["pending", "upcoming"])
              .order("due_date", { ascending: true })
              .limit(20),
            db
              .from("messages")
              .select("id", { count: "exact", head: true })
              .eq("organization_id", globeOrgId)
              .eq("type", "decision")
              .eq("is_deleted", false)
              .eq("is_archived", false),
            db
              .from("organizations")
              .select("name")
              .eq("id", globeOrgId)
              .single(),
          ]);

        setAssets(assetRes.data || []);
        setMessages(msgRes.data || []);
        setBills(billRes.data || []);
        setDecisionCount(decisionRes.count || 0);
        setPrincipalName(orgRes.data?.name || undefined);
      } catch (error) {
        console.error("Error loading immersive data:", error);
      } finally {
        setIsLoading(false);
      }
    }

    setIsLoading(true);
    loadData();
  }, [globeOrgId, orgResolved, refreshKey]);

  // ─── Derived data ───

  const locatedAssets: AssetPin[] = assets
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

  const unlocatedAssets: UnlocatedAsset[] = assets
    .filter((a) => a.latitude == null || a.longitude == null)
    .map((a) => ({
      id: a.id,
      name: a.name,
      category: a.category,
      estimatedValue: a.estimated_value,
    }));

  const totalValue = assets.reduce(
    (sum, a) => sum + (a.estimated_value || 0),
    0
  );

  const categoryBreakdown = Object.values(
    assets.reduce(
      (acc, a) => {
        if (!acc[a.category])
          acc[a.category] = { category: a.category, count: 0, value: 0 };
        acc[a.category].count++;
        acc[a.category].value += a.estimated_value || 0;
        return acc;
      },
      {} as Record<string, { category: string; count: number; value: number }>
    )
  ).sort((a, b) => b.value - a.value);

  const countryBreakdown = Object.values(
    assets
      .filter((a) => a.country)
      .reduce(
        (acc, a) => {
          const code = a.country!;
          if (!acc[code]) acc[code] = { code, count: 0, value: 0 };
          acc[code].count++;
          acc[code].value += a.estimated_value || 0;
          return acc;
        },
        {} as Record<string, { code: string; count: number; value: number }>
      )
  ).sort((a, b) => b.value - a.value);

  const alertCounts = {
    urgent: messages.filter((m) => m.priority === "urgent").length,
    high: messages.filter((m) => m.priority === "high").length,
    medium: messages.filter((m) => m.priority === "medium").length,
    decisions: decisionCount,
  };

  const pendingBillTotal = bills.reduce((s, b) => s + b.amount_cents, 0);
  const monthlyOutflow = pendingBillTotal;
  const nextDueBill = bills[0] || null;

  // Build asset name lookup for messages/bills
  const assetNameMap = useMemo(() => {
    const m = new Map<string, string>();
    assets.forEach((a) => m.set(a.id, a.name));
    return m;
  }, [assets]);

  // Enrich messages with asset names for the panel
  const panelMessages: PanelMessage[] = useMemo(
    () =>
      messages.map((m) => ({
        ...m,
        asset_name: m.asset_id ? assetNameMap.get(m.asset_id) : undefined,
      })),
    [messages, assetNameMap]
  );

  // Enrich bills with asset names
  const panelBills: PanelBill[] = useMemo(
    () =>
      bills.map((b) => ({
        ...b,
        asset_name: b.asset_id ? assetNameMap.get(b.asset_id) : undefined,
      })),
    [bills, assetNameMap]
  );

  // Build asset list for holdings panel
  const panelAssets: PanelAsset[] = useMemo(
    () =>
      assets.map((a) => ({
        id: a.id,
        name: a.name,
        category: a.category,
        estimated_value: a.estimated_value,
        hasLocation: a.latitude != null && a.longitude != null,
      })),
    [assets]
  );

  // ─── Highlight logic for alert filter ───

  const highlightAssetIds = useMemo<string[] | null>(() => {
    if (!alertFilter) return null;

    // Find messages matching the active filter
    let filtered: Message[];
    if (alertFilter === "urgent") {
      filtered = messages.filter((m) => m.priority === "urgent");
    } else if (alertFilter === "decisions") {
      filtered = messages.filter((m) => m.type === "decision");
    } else if (alertFilter === "high") {
      filtered = messages.filter((m) => m.priority === "high");
    } else {
      filtered = messages.filter((m) => m.priority === "medium");
    }

    // Get unique asset IDs that have coordinates
    const assetIds = new Set<string>();
    const locatedIds = new Set(locatedAssets.map((a) => a.id));
    filtered.forEach((m) => {
      if (m.asset_id && locatedIds.has(m.asset_id)) {
        assetIds.add(m.asset_id);
      }
    });

    return assetIds.size > 0 ? Array.from(assetIds) : null;
  }, [alertFilter, messages, locatedAssets]);

  const highlightColor = alertFilter
    ? ALERT_HIGHLIGHT_COLORS[alertFilter] || null
    : null;

  // ─── Handlers ───

  const handleCountryZoom = useCallback((code: string) => {
    if (mapRef.current?.__flyToCountry) {
      mapRef.current.__flyToCountry(code);
    }
  }, []);

  const handleAlertClick = useCallback((assetId: string) => {
    setSelectedAssetId(assetId);
    if (mapRef.current?.__flyToAsset) {
      mapRef.current.__flyToAsset(assetId);
    }
  }, []);

  // Asset click from panels — fly if located, just open drill-down otherwise
  const handlePanelAssetClick = useCallback(
    (assetId: string) => {
      setSelectedAssetId(assetId);
      const located = locatedAssets.find((a) => a.id === assetId);
      if (located && mapRef.current?.__flyToAsset) {
        mapRef.current.__flyToAsset(assetId);
      }
    },
    [locatedAssets]
  );

  const handleMobilePinSelect = useCallback((id: string | null) => {
    setSelectedAssetId(id);
    if (id) setDrawerSnap(1);
  }, []);

  const handleMobileDrillDownBack = useCallback(() => {
    setSelectedAssetId(null);
    setDrawerSnap(0);
  }, []);

  const handleDrawerSnapChange = useCallback((snapIndex: number) => {
    setDrawerSnap(snapIndex);
    if (snapIndex === 0) setSelectedAssetId(null);
  }, []);

  // When alert filter changes, clear category filter and vice versa
  const handleAlertFilterChange = useCallback((filter: AlertFilter) => {
    setAlertFilter(filter);
    if (filter) setCategoryFilter(null);
  }, []);

  const handleCategoryFilter = useCallback((cat: string | null) => {
    setCategoryFilter(cat);
    if (cat) {
      setAlertFilter(null);
      setExpandedCard(null);
    }
  }, []);

  if (!orgResolved || (globeOrgId && isLoading)) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black">
        <Loader2 className="h-10 w-10 animate-spin text-white/40" />
      </div>
    );
  }

  if (!globeOrgId) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-black px-6 text-center">
        <p className="max-w-md text-sm text-white/70">
          No organization is linked to this session. Open{" "}
          <span className="font-medium text-white">Command Center</span>, select a principal, or ensure your account is a member of an organization.
        </p>
        <button
          type="button"
          onClick={() => router.push("/admin")}
          className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20"
        >
          Go to Command Center
        </button>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="text-sm text-white/50 hover:text-white/80"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  if (!process.env.NEXT_PUBLIC_MAPBOX_TOKEN) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-3 bg-black px-6 text-center">
        <p className="max-w-md text-sm text-amber-200/90">
          Mapbox is not configured for this deployment. Add{" "}
          <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs">NEXT_PUBLIC_MAPBOX_TOKEN</code>{" "}
          in Vercel (or your host) environment variables, then redeploy.
        </p>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="text-sm text-white/50 hover:text-white/80"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  // ─── Mobile/Tablet Layout: Bottom Drawer ───
  if (useDrawerLayout) {
    return (
      <div
        className="relative w-screen overflow-hidden bg-black"
        style={{ height: "100dvh" }}
      >
        <GlobeMap
          locatedAssets={locatedAssets}
          unlocatedAssets={unlocatedAssets}
          organizationId={globeOrgId}
          height="100%"
          immersive
          mobileMode
          categoryFilter={categoryFilter}
          externalSelectedId={selectedAssetId}
          onExternalSelect={handleMobilePinSelect}
          externalMapStyle={mapStyle}
          hideOverlays
          highlightAssetIds={highlightAssetIds}
          highlightColor={highlightColor}
        />

        <MobileTopBar
          onBack={() => router.push("/")}
          principalName={principalName}
          mapStyle={mapStyle}
          onMapStyleChange={setMapStyle}
        />

        <BottomDrawer
          snapPoints={[SNAP_COLLAPSED, SNAP_HALF, SNAP_FULL]}
          defaultSnap={selectedAssetId ? 1 : drawerSnap}
          onSnapChange={handleDrawerSnapChange}
        >
          {selectedAssetId ? (
            <MobileDrillDown
              assetId={selectedAssetId}
              organizationId={globeOrgId}
              onBack={handleMobileDrillDownBack}
            />
          ) : (
            <MobileStatsContent
              totalValue={totalValue}
              assetCount={assets.length}
              locatedCount={locatedAssets.length}
              alerts={alertCounts}
              monthlyOutflow={monthlyOutflow}
              pendingBillCount={bills.length}
              categories={categoryBreakdown}
              countries={countryBreakdown}
              recentMessages={messages.slice(0, 5)}
              activeFilter={categoryFilter}
              onCategoryFilter={handleCategoryFilter}
              onCountryZoom={handleCountryZoom}
              onAlertClick={handleAlertClick}
              allMessages={panelMessages}
              allBills={panelBills}
              allAssets={panelAssets}
              alertFilter={alertFilter}
              onAlertFilter={handleAlertFilterChange}
              expandedCard={expandedCard}
              onExpandCard={setExpandedCard}
              onAssetClick={handlePanelAssetClick}
              onMessageClick={setSelectedDecision}
            />
          )}
        </BottomDrawer>

        <DashboardSearchBar organizationId={globeOrgId} />

        <DecisionModal
          message={selectedDecision}
          onClose={() => setSelectedDecision(null)}
          onActionComplete={() => setRefreshKey((k) => k + 1)}
        />
      </div>
    );
  }

  // ─── Desktop Layout: Floating Panels ───
  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      <GlobeMap
        locatedAssets={locatedAssets}
        unlocatedAssets={unlocatedAssets}
        organizationId={globeOrgId}
        height="100vh"
        immersive
        categoryFilter={categoryFilter}
        externalSelectedId={selectedAssetId}
        onExternalSelect={setSelectedAssetId}
        externalMapStyle={mapStyle}
        hideOverlays
        highlightAssetIds={highlightAssetIds}
        highlightColor={highlightColor}
      />

      <div className="fixed inset-0 z-20 pointer-events-none">
        <FloatingTopBar
          principalName={principalName}
          totalValue={totalValue}
          pendingTotal={pendingBillTotal}
          mapStyle={mapStyle}
          onMapStyleChange={setMapStyle}
        />

        <LeftStatPanel
          totalValue={totalValue}
          assetCount={assets.length}
          alerts={alertCounts}
          monthlyOutflow={monthlyOutflow}
          pendingBillCount={bills.length}
          allMessages={panelMessages}
          allBills={panelBills}
          allAssets={panelAssets}
          expandedCard={expandedCard}
          onExpandCard={setExpandedCard}
          alertFilter={alertFilter}
          onAlertFilter={handleAlertFilterChange}
          onAssetClick={handlePanelAssetClick}
          onMessageClick={setSelectedDecision}
        />

        <RightStatPanel
          categories={categoryBreakdown}
          countries={countryBreakdown}
          recentMessages={messages.slice(0, 4)}
          activeFilter={categoryFilter}
          onCategoryFilter={handleCategoryFilter}
          onCountryZoom={handleCountryZoom}
          onAlertClick={handleAlertClick}
          visible={!selectedAssetId}
        />

        <ImmersiveBottomBar
          locatedCount={locatedAssets.length}
          totalCount={assets.length}
          pendingBillTotal={pendingBillTotal}
          decisionCount={decisionCount}
          nextDueDate={nextDueBill?.due_date || null}
          nextDueAmount={nextDueBill?.amount_cents || 0}
        />

        <DashboardSearchBar organizationId={globeOrgId} />
      </div>

      <DecisionModal
        message={selectedDecision}
        onClose={() => setSelectedDecision(null)}
        onActionComplete={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  );
}
