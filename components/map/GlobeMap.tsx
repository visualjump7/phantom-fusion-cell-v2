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

interface GlobeMapProps {
  locatedAssets: AssetPin[];
  unlocatedAssets: UnlocatedAsset[];
  organizationId: string;
  height?: string;
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
}: GlobeMapProps) {
  const mapRef = useRef<any>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [showUnlocated, setShowUnlocated] = useState(false);
  const [accentColor, setAccentColor] = useState("#4ade80");
  const [mapStyle, setMapStyle] = useState<MapStyleKey>("dark");

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

  const handlePinClick = useCallback((assetId: string) => {
    setSelectedAssetId(assetId);
    setShowUnlocated(false);
  }, []);

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

  const handleUnlocatedSelect = useCallback((assetId: string) => {
    setSelectedAssetId(assetId);
    setShowUnlocated(false);
  }, []);

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return null;

  return (
    <div className="relative w-full" style={{ height }}>
      <Map
        ref={mapRef}
        mapboxAccessToken={token}
        initialViewState={{
          longitude: -40,
          latitude: 30,
          zoom: 1.8,
          pitch: 25,
          bearing: 0,
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle={MAP_STYLES[mapStyle]}
        projection={{ name: "globe" } as any}
        fog={{
          range: [0.5, 10],
          color: "#0a0a1a",
          "horizon-blend": 0.1,
          "high-color": "#0a0a2e",
          "space-color": "#000000",
          "star-intensity": 0.6,
        } as any}
        maxZoom={18}
        minZoom={1.2}
        dragRotate={true}
        touchZoomRotate={true}
      >
        <NavigationControl position="bottom-right" />

        {/* Asset markers */}
        {locatedAssets.map((asset) => (
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
            />
          </Marker>
        ))}
      </Map>

      {/* Map style toggle */}
      <div className="absolute top-3 left-3 z-20">
        <div className="flex items-center gap-0.5 rounded-full border border-white/15 bg-black/60 backdrop-blur-md p-0.5">
          <Layers className="h-3.5 w-3.5 text-white/50 ml-2 mr-1" />
          {(["dark", "satellite"] as MapStyleKey[]).map((key) => (
            <button
              key={key}
              onClick={() => setMapStyle(key)}
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

      {/* Unlocated list */}
      <UnlocatedList
        assets={unlocatedAssets}
        onSelect={handleUnlocatedSelect}
        isOpen={showUnlocated}
        onToggle={() => setShowUnlocated(!showUnlocated)}
      />

      {/* Stats bar at bottom */}
      <div className="absolute bottom-0 left-0 right-0 z-20">
        <GlobeStatsBar
          locatedAssets={locatedAssets}
          unlocatedAssets={unlocatedAssets}
          onShowUnlocated={() => setShowUnlocated(!showUnlocated)}
        />
      </div>
    </div>
  );
}
