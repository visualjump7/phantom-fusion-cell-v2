"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Map, { Marker, NavigationControl } from "react-map-gl/mapbox";
import { AnimatePresence } from "framer-motion";
import { Layers } from "lucide-react";
import { MapPin } from "./MapPin";
import { ProjectDrillDown } from "./ProjectDrillDown";
import { GlobeStatsBar } from "./GlobeStatsBar";
import { UnlocatedList } from "./UnlocatedList";
import { AssetPin, UnlocatedAsset } from "@/lib/map-types";
import "mapbox-gl/dist/mapbox-gl.css";

const MAP_STYLES = {
  dark: "mapbox://styles/mapbox/dark-v11",
  satellite: "mapbox://styles/mapbox/satellite-streets-v12",
} as const;

type MapStyleKey = keyof typeof MAP_STYLES;

// Country centroids for flyTo
export const COUNTRY_VIEWS: Record<string, { center: [number, number]; zoom: number }> = {
  US: { center: [-98.5, 39.8], zoom: 3.5 },
  GB: { center: [-1.5, 53.0], zoom: 5 },
  DE: { center: [10.4, 51.1], zoom: 5 },
  FR: { center: [2.2, 46.6], zoom: 5 },
  CH: { center: [8.2, 46.8], zoom: 7 },
  SG: { center: [103.8, 1.35], zoom: 10 },
  AE: { center: [54.3, 24.4], zoom: 6 },
  JP: { center: [138.2, 36.2], zoom: 5 },
  AU: { center: [134.5, -25.7], zoom: 3.5 },
  CA: { center: [-96.0, 56.0], zoom: 3 },
  IN: { center: [78.9, 20.6], zoom: 4 },
  BR: { center: [-51.9, -14.2], zoom: 3.5 },
  MX: { center: [-102.5, 23.6], zoom: 4.5 },
  HK: { center: [114.2, 22.3], zoom: 10 },
  NL: { center: [5.3, 52.1], zoom: 7 },
  IE: { center: [-8.2, 53.4], zoom: 6 },
  SA: { center: [45.1, 23.9], zoom: 5 },
  KR: { center: [127.8, 35.9], zoom: 6 },
};

interface GlobeMapProps {
  locatedAssets: AssetPin[];
  unlocatedAssets: UnlocatedAsset[];
  organizationId: string;
  height?: string;
  /** Immersive mode: cinematic fog, auto-rotation, higher pitch */
  immersive?: boolean;
  /** Category filter — dims non-matching pins */
  categoryFilter?: string | null;
  /** External selected asset (for immersive page control) */
  externalSelectedId?: string | null;
  onExternalSelect?: (id: string | null) => void;
  /** External map style control */
  externalMapStyle?: MapStyleKey;
  /** Hide built-in overlays (stats bar, unlocated list, style toggle) */
  hideOverlays?: boolean;
  /** Mobile mode: larger pins, closer zoom, no nav controls */
  mobileMode?: boolean;
  /** Asset IDs to highlight with a colored ring — others get dimmed */
  highlightAssetIds?: string[] | null;
  /** Color for the highlight ring (e.g., "#ef4444" for red) */
  highlightColor?: string | null;
}

function getAccentColor(): string {
  if (typeof window === "undefined") return "#4ade80";
  const theme = document.documentElement.getAttribute("data-theme");
  switch (theme) {
    case "hybrid":
      return "#FCA311";
    case "light":
      return "#16a34a";
    default:
      return "#4ade80";
  }
}

export function GlobeMap({
  locatedAssets,
  unlocatedAssets,
  organizationId,
  height = "45vh",
  immersive = false,
  categoryFilter = null,
  externalSelectedId,
  onExternalSelect,
  externalMapStyle,
  hideOverlays = false,
  mobileMode = false,
  highlightAssetIds = null,
  highlightColor = null,
}: GlobeMapProps) {
  const mapRef = useRef<any>(null);
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null);
  const [showUnlocated, setShowUnlocated] = useState(false);
  const [accentColor, setAccentColor] = useState("#4ade80");
  const [internalMapStyle, setInternalMapStyle] = useState<MapStyleKey>("dark");

  // Use external or internal state
  const selectedAssetId = externalSelectedId !== undefined ? externalSelectedId : internalSelectedId;
  const setSelectedAssetId = onExternalSelect || setInternalSelectedId;
  const mapStyle = externalMapStyle || internalMapStyle;

  // Determine accent color on mount and theme changes
  useEffect(() => {
    setAccentColor(getAccentColor());
    const observer = new MutationObserver(() => {
      setAccentColor(getAccentColor());
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  // Auto-rotation for immersive mode
  useEffect(() => {
    if (!immersive || !mapRef.current) return;

    const ROTATION_SPEED = 0.015;
    const IDLE_TIMEOUT = 10_000;
    let animFrame: number;
    let idleTimer: ReturnType<typeof setTimeout>;
    let isUserInteracting = false;

    const rotate = () => {
      if (!isUserInteracting && mapRef.current) {
        const map = mapRef.current.getMap();
        if (map) {
          const bearing = map.getBearing() + ROTATION_SPEED;
          map.setBearing(bearing);
        }
      }
      animFrame = requestAnimationFrame(rotate);
    };

    const onInteractionStart = () => {
      isUserInteracting = true;
      clearTimeout(idleTimer);
    };

    const onInteractionEnd = () => {
      idleTimer = setTimeout(() => {
        isUserInteracting = false;
      }, IDLE_TIMEOUT);
    };

    // Wait for map to be ready
    const initTimeout = setTimeout(() => {
      const map = mapRef.current?.getMap();
      if (!map) return;

      map.on("mousedown", onInteractionStart);
      map.on("touchstart", onInteractionStart);
      map.on("mouseup", onInteractionEnd);
      map.on("touchend", onInteractionEnd);
      map.on("dragend", onInteractionEnd);

      animFrame = requestAnimationFrame(rotate);
    }, 1000);

    return () => {
      clearTimeout(initTimeout);
      cancelAnimationFrame(animFrame);
      clearTimeout(idleTimer);
      const map = mapRef.current?.getMap();
      if (map) {
        map.off("mousedown", onInteractionStart);
        map.off("touchstart", onInteractionStart);
        map.off("mouseup", onInteractionEnd);
        map.off("touchend", onInteractionEnd);
        map.off("dragend", onInteractionEnd);
      }
    };
  }, [immersive]);

  const handlePinClick = useCallback(
    (assetId: string) => {
      setSelectedAssetId(assetId);
      setShowUnlocated(false);
    },
    [setSelectedAssetId]
  );

  const handleViewOnMap = useCallback(() => {
    if (!selectedAssetId || !mapRef.current) return;
    const asset = locatedAssets.find((a) => a.id === selectedAssetId);
    if (asset) {
      mapRef.current.flyTo({
        center: [asset.longitude, asset.latitude],
        zoom: 12,
        duration: 2000,
      });
    }
  }, [selectedAssetId, locatedAssets]);

  const handleUnlocatedSelect = useCallback(
    (assetId: string) => {
      setSelectedAssetId(assetId);
      setShowUnlocated(false);
    },
    [setSelectedAssetId]
  );

  // Public flyTo method for external control
  const flyToCountry = useCallback((code: string) => {
    const view = COUNTRY_VIEWS[code];
    if (view && mapRef.current) {
      mapRef.current.getMap()?.flyTo({
        center: view.center,
        zoom: view.zoom,
        pitch: immersive ? 45 : 25,
        duration: 2000,
        essential: true,
      });
    }
  }, [immersive]);

  const flyToAsset = useCallback((assetId: string) => {
    const asset = locatedAssets.find((a) => a.id === assetId);
    if (asset && mapRef.current) {
      mapRef.current.getMap()?.flyTo({
        center: [asset.longitude, asset.latitude],
        zoom: 10,
        pitch: immersive ? 45 : 25,
        duration: 2000,
        essential: true,
      });
    }
    setSelectedAssetId(assetId);
  }, [locatedAssets, immersive, setSelectedAssetId]);

  // Expose flyTo methods via ref for parent access
  useEffect(() => {
    if (mapRef.current) {
      (mapRef.current as any).__flyToCountry = flyToCountry;
      (mapRef.current as any).__flyToAsset = flyToAsset;
    }
  }, [flyToCountry, flyToAsset]);

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return null;

  const initialView = immersive
    ? {
        longitude: -95.7,
        latitude: 37.0,
        zoom: mobileMode ? 3.2 : 3.0,
        pitch: 40,
        bearing: 0,
      }
    : { longitude: -95.7, latitude: 37.0, zoom: 2.8, pitch: 25, bearing: 0 };

  const fogConfig = immersive
    ? {
        range: [0.5, 10],
        color: "#0a0a1a",
        "horizon-blend": 0.15,
        "high-color": "#0a0a2e",
        "space-color": "#000000",
        "star-intensity": 0.8,
      }
    : {
        range: [0.5, 10],
        color: "#0a0a1a",
        "horizon-blend": 0.1,
        "high-color": "#0a0a2e",
        "space-color": "#000000",
        "star-intensity": 0.6,
      };

  return (
    <div className="relative w-full" style={{ height }}>
      <Map
        ref={mapRef}
        mapboxAccessToken={token}
        initialViewState={initialView}
        style={{ width: "100%", height: "100%" }}
        mapStyle={MAP_STYLES[mapStyle]}
        projection={{ name: "globe" } as any}
        fog={fogConfig as any}
        maxZoom={18}
        minZoom={1.2}
        dragRotate={true}
        touchZoomRotate={true}
      >
        {!mobileMode && <NavigationControl position="bottom-right" />}

        {/* Asset markers */}
        {locatedAssets.map((asset) => {
          const dimmedByCategory =
            categoryFilter != null && asset.category !== categoryFilter;
          const dimmedByHighlight =
            highlightAssetIds != null && !highlightAssetIds.includes(asset.id);
          const isHighlighted =
            highlightAssetIds != null && highlightAssetIds.includes(asset.id);
          return (
            <Marker
              key={asset.id}
              longitude={asset.longitude}
              latitude={asset.latitude}
              anchor="center"
            >
              <MapPin
                color={accentColor}
                isSelected={selectedAssetId === asset.id}
                isApproximate={asset.locationType !== "precise"}
                value={asset.estimatedValue}
                name={asset.name}
                onClick={() => handlePinClick(asset.id)}
                dimmed={dimmedByCategory || dimmedByHighlight}
                isMobile={mobileMode}
                highlightColor={isHighlighted ? highlightColor : null}
              />
            </Marker>
          );
        })}
      </Map>

      {/* Map style toggle — only when overlays visible */}
      {!hideOverlays && (
        <div className="absolute top-3 left-3 z-20">
          <div className="flex items-center gap-0.5 rounded-full border border-white/15 bg-black/60 backdrop-blur-md p-0.5">
            <Layers className="h-3.5 w-3.5 text-white/50 ml-2 mr-1" />
            {(["dark", "satellite"] as MapStyleKey[]).map((key) => (
              <button
                key={key}
                onClick={() => setInternalMapStyle(key)}
                className={`rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
                  mapStyle === key
                    ? "bg-white/15 text-white"
                    : "text-white/50 hover:text-white/80"
                }`}
              >
                {key === "dark" ? "Dark" : "Satellite"}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Drill-down panel */}
      <AnimatePresence>
        {selectedAssetId && (
          <ProjectDrillDown
            assetId={selectedAssetId}
            organizationId={organizationId}
            onClose={() => setSelectedAssetId(null)}
            onViewOnMap={handleViewOnMap}
            showViewOnMap={
              !!locatedAssets.find((a) => a.id === selectedAssetId)
            }
          />
        )}
      </AnimatePresence>

      {/* Built-in overlays (hidden in immersive mode) */}
      {!hideOverlays && (
        <>
          <UnlocatedList
            assets={unlocatedAssets}
            onSelect={handleUnlocatedSelect}
            isOpen={showUnlocated}
            onToggle={() => setShowUnlocated(!showUnlocated)}
          />
          <div className="absolute bottom-0 left-0 right-0 z-20">
            <GlobeStatsBar
              locatedAssets={locatedAssets}
              unlocatedAssets={unlocatedAssets}
              onShowUnlocated={() => setShowUnlocated(!showUnlocated)}
            />
          </div>
        </>
      )}
    </div>
  );
}
