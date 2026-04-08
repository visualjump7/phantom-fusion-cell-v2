"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import Map, { Marker, NavigationControl } from "react-map-gl/mapbox";
import { AnimatePresence } from "framer-motion";
import { MapViewToggle } from "./MapViewToggle";
import { useMapMode } from "@/lib/use-map-mode";
import { MapPin } from "./MapPin";
import { ProjectDrillDown } from "./ProjectDrillDown";
import { GlobeStatsBar } from "./GlobeStatsBar";
import { UnlocatedList } from "./UnlocatedList";
import { AssetPin, UnlocatedAsset } from "@/lib/map-types";
import "mapbox-gl/dist/mapbox-gl.css";

const MAP_STYLES = {
  dark: "mapbox://styles/mapbox/dark-v11",
  satellite: "mapbox://styles/mapbox/satellite-streets-v12",
  light: "mapbox://styles/mapbox/light-v11",
} as const;

export type MapStyleKey = keyof typeof MAP_STYLES;
export type MapProjectionKey = "3D" | "2D";

/**
 * Map default driven by the current app theme.
 * - light → 2D Light (mercator, light-v11)
 * - dark / hybrid / anything else → 3D Dark (globe, dark-v11)
 */
export function getMapDefaultForAppTheme(appTheme: string | null | undefined): {
  projection: MapProjectionKey;
  style: MapStyleKey;
} {
  if (appTheme === "light") return { projection: "2D", style: "light" };
  return { projection: "3D", style: "dark" };
}

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

export interface GlobeMapProps {
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
  /** External projection control ("3D" = globe, "2D" = mercator) */
  externalProjection?: MapProjectionKey;
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
  externalProjection,
  hideOverlays = false,
  mobileMode = false,
  highlightAssetIds = null,
  highlightColor = null,
}: GlobeMapProps) {
  const mapRef = useRef<any>(null);
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null);
  const [showUnlocated, setShowUnlocated] = useState(false);
  const [accentColor, setAccentColor] = useState("#4ade80");
  // Pull shared map mode from the context store. The store itself is
  // seeded from localStorage → theme default and automatically resets when
  // the app theme changes.
  const {
    style: storeMapStyle,
    projection: storeProjection,
    setMapStyle: setStoreMapStyle,
    setMapProjection: setStoreProjection,
  } = useMapMode();

  // Use external or internal (store-backed) state
  const selectedAssetId = externalSelectedId !== undefined ? externalSelectedId : internalSelectedId;
  const setSelectedAssetId = onExternalSelect || setInternalSelectedId;
  const mapStyle: MapStyleKey = externalMapStyle || storeMapStyle;
  const projection: MapProjectionKey = externalProjection || storeProjection;
  const is2D = projection === "2D";

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

  // Auto-rotation for immersive mode (globe projection only)
  useEffect(() => {
    if (!immersive || is2D || !mapRef.current) return;

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
  }, [immersive, is2D]);

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

  // Projection changes are handled by remounting the Map (key={projectionName}),
  // so there's no need to imperatively easeTo / toggle handlers here.

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

  // Memoize so prop identity stays stable across renders — otherwise
  // react-map-gl's proxy transform re-diffs and blows the call stack.
  const fogConfig = useMemo(() => {
    if (is2D) return null;
    return immersive
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
  }, [immersive, is2D]);

  const projectionName = is2D ? "mercator" : "globe";

  const isLightMode = is2D && mapStyle === "light";

  return (
    <div
      className="globe-light-scope relative w-full"
      data-theme={isLightMode ? "light" : undefined}
      style={{ height }}
    >
      <Map
        // Keying on projection forces a full remount when the user toggles
        // 3D ⇄ 2D. @vis.gl/react-mapbox's proxy-transform stacks on runtime
        // projection changes and infinite-recurses in _calcMatrices — remount
        // sidesteps it cleanly. Pins/markers/fog all re-apply automatically
        // because they're declarative children.
        key={`map-${projectionName}`}
        ref={mapRef}
        mapboxAccessToken={token}
        initialViewState={is2D ? { ...initialView, pitch: 0, bearing: 0 } : initialView}
        style={{ width: "100%", height: "100%" }}
        mapStyle={MAP_STYLES[mapStyle]}
        projection={projectionName as any}
        fog={fogConfig as any}
        maxZoom={18}
        minZoom={1.2}
        dragRotate={!is2D}
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

      {/* Two-tier projection + style toggle (top-right).
          Only rendered when overlays are visible (i.e. not immersive mode;
          the immersive page renders its own MapViewToggle inside FloatingTopBar). */}
      {!hideOverlays && (
        <div className="absolute top-3 right-3 z-20">
          <MapViewToggle
            size="sm"
            projection={projection}
            onProjectionChange={setStoreProjection}
            mapStyle={mapStyle}
            onMapStyleChange={setStoreMapStyle}
          />
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
