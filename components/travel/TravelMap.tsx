"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import Map, { Source, Layer, type MapRef } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import type { ItineraryEvent } from "@/lib/travel-types";
import { EVENT_META } from "@/lib/travel-types";
import {
  flightArcsGeoJSON,
  airportDotsGeoJSON,
  locationPinsGeoJSON,
  fetchGroundRoutes,
  eventsBounds,
  getEventCoordinates,
} from "@/lib/travel-utils";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

interface TravelMapProps {
  events: ItineraryEvent[];
  selectedEventId: string | null;
  onSelectEvent: (id: string) => void;
}

export function TravelMap({ events, selectedEventId, onSelectEvent }: TravelMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [is3D, setIs3D] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [groundRoutes, setGroundRoutes] = useState<GeoJSON.FeatureCollection>(EMPTY_FC);

  const arcsGeo = flightArcsGeoJSON(events, selectedEventId ?? undefined);
  const airportsGeo = airportDotsGeoJSON(events);
  const pinsGeo = locationPinsGeoJSON(events, selectedEventId ?? undefined);

  // Fetch driving routes for ground transport events
  useEffect(() => {
    if (!MAPBOX_TOKEN) return;
    let alive = true;
    fetchGroundRoutes(events, MAPBOX_TOKEN, selectedEventId ?? undefined).then((fc) => {
      if (alive) setGroundRoutes(fc);
    });
    return () => { alive = false; };
  }, [events, selectedEventId]);

  // Fit all events on load
  const fitAll = useCallback(() => {
    const bounds = eventsBounds(events);
    if (!bounds || !mapRef.current) return;
    mapRef.current.fitBounds(bounds, {
      padding: { top: 60, bottom: 60, left: 60, right: 60 },
      duration: 1200,
    });
  }, [events]);

  useEffect(() => {
    if (loaded) fitAll();
  }, [loaded, fitAll]);

  // Fly to selected event
  useEffect(() => {
    if (!selectedEventId || !mapRef.current) return;
    const event = events.find((e) => e.id === selectedEventId);
    if (!event) return;

    const coords = getEventCoordinates(event);
    if (!coords.length) return;

    // Use midpoint of all coordinates for this event
    const midLat = coords.reduce((s, c) => s + c.lat, 0) / coords.length;
    const midLng = coords.reduce((s, c) => s + c.lng, 0) / coords.length;

    // Compute zoom from coordinate spread
    if (coords.length >= 2) {
      const latDiff = Math.abs(coords[0].lat - coords[coords.length - 1].lat);
      const lngDiff = Math.abs(coords[0].lng - coords[coords.length - 1].lng);
      const spread = Math.max(latDiff, lngDiff);
      const zoom = spread > 60 ? 2 : spread > 30 ? 3 : spread > 15 ? 4 : spread > 5 ? 5 : 6;
      mapRef.current.flyTo({ center: [midLng, midLat], zoom, duration: 1500, essential: true });
    } else {
      mapRef.current.flyTo({ center: [midLng, midLat], zoom: 12, duration: 1500, essential: true });
    }
  }, [selectedEventId, events]);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="flex items-center justify-center h-full bg-background text-muted-foreground text-sm">
        Mapbox token not configured
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={{ longitude: 0, latitude: 30, zoom: 2, pitch: is3D ? 25 : 0 }}
        projection={is3D ? "globe" : "mercator"}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        style={{ width: "100%", height: "100%" }}
        fog={is3D ? {
          color: "#0a0a0a",
          "high-color": "#111111",
          "space-color": "#000000",
          "horizon-blend": 0.02,
          "star-intensity": 0.1,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any : undefined}
        onLoad={() => setLoaded(true)}
        attributionControl={false}
        reuseMaps
      >
        {/* Flight arcs */}
        <Source id="flight-arcs" type="geojson" data={arcsGeo}>
          <Layer
            id="arcs-dim"
            type="line"
            filter={["!=", ["get", "selected"], true]}
            paint={{ "line-color": EVENT_META.flight.color, "line-opacity": 0.25, "line-width": 1.5 }}
            layout={{ "line-cap": "round", "line-join": "round" }}
          />
          <Layer
            id="arcs-selected"
            type="line"
            filter={["==", ["get", "selected"], true]}
            paint={{ "line-color": EVENT_META.flight.color, "line-opacity": 0.8, "line-width": 3 }}
            layout={{ "line-cap": "round", "line-join": "round" }}
          />
        </Source>

        {/* Ground transport driving routes */}
        {groundRoutes.features.length > 0 && (
          <Source id="ground-routes" type="geojson" data={groundRoutes}>
            <Layer
              id="ground-routes-dim"
              type="line"
              filter={["!=", ["get", "selected"], true]}
              paint={{
                "line-color": EVENT_META.ground.color,
                "line-opacity": 0.35,
                "line-width": 2.5,
                "line-dasharray": [3, 2],
              }}
              layout={{ "line-cap": "round", "line-join": "round" }}
            />
            <Layer
              id="ground-routes-selected"
              type="line"
              filter={["==", ["get", "selected"], true]}
              paint={{
                "line-color": EVENT_META.ground.color,
                "line-opacity": 0.85,
                "line-width": 4,
                "line-dasharray": [3, 2],
              }}
              layout={{ "line-cap": "round", "line-join": "round" }}
            />
          </Source>
        )}

        {/* Airport dots */}
        <Source id="airports" type="geojson" data={airportsGeo}>
          <Layer
            id="airport-dots"
            type="circle"
            paint={{ "circle-radius": 5, "circle-color": EVENT_META.flight.color, "circle-stroke-width": 1, "circle-stroke-color": "#000" }}
          />
          <Layer
            id="airport-labels"
            type="symbol"
            layout={{
              "text-field": ["get", "code"],
              "text-size": 11,
              "text-offset": [0, 1.4],
              "text-anchor": "top",
              "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
            }}
            paint={{ "text-color": "#a1a1aa", "text-halo-color": "#000", "text-halo-width": 1 }}
          />
        </Source>

        {/* Location pins (hotels, ground, reservations) */}
        <Source id="location-pins" type="geojson" data={pinsGeo}>
          <Layer
            id="pins-dim"
            type="circle"
            filter={["!=", ["get", "selected"], true]}
            paint={{
              "circle-radius": 6,
              "circle-color": [
                "match", ["get", "type"],
                "ground", EVENT_META.ground.color,
                "hotel", EVENT_META.hotel.color,
                "reservation", EVENT_META.reservation.color,
                "#ffffff",
              ],
              "circle-opacity": 0.7,
              "circle-stroke-width": 1.5,
              "circle-stroke-color": "#000",
            }}
          />
          <Layer
            id="pins-selected"
            type="circle"
            filter={["==", ["get", "selected"], true]}
            paint={{
              "circle-radius": 9,
              "circle-color": [
                "match", ["get", "type"],
                "ground", EVENT_META.ground.color,
                "hotel", EVENT_META.hotel.color,
                "reservation", EVENT_META.reservation.color,
                "#ffffff",
              ],
              "circle-opacity": 1,
              "circle-stroke-width": 2,
              "circle-stroke-color": "#fff",
            }}
          />
          <Layer
            id="pin-labels"
            type="symbol"
            layout={{
              "text-field": ["get", "label"],
              "text-size": 10,
              "text-offset": [0, 1.6],
              "text-anchor": "top",
              "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
              "text-max-width": 12,
            }}
            paint={{ "text-color": "#a1a1aa", "text-halo-color": "#000", "text-halo-width": 1 }}
          />
        </Source>
      </Map>

      {/* 3D / 2D toggle */}
      <div className="absolute top-3 right-3 flex rounded-lg overflow-hidden border border-border bg-card/90 backdrop-blur-sm">
        <button type="button" onClick={() => setIs3D(true)}
          className={`px-3 py-1.5 text-xs font-medium transition-colors ${is3D ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
          3D
        </button>
        <button type="button" onClick={() => setIs3D(false)}
          className={`px-3 py-1.5 text-xs font-medium transition-colors ${!is3D ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
          2D
        </button>
      </div>

      {/* Fit all */}
      <button type="button" onClick={fitAll}
        className="absolute bottom-3 right-3 px-3 py-1.5 rounded-lg border border-border bg-card/90 backdrop-blur-sm text-xs text-muted-foreground hover:text-foreground transition-colors">
        Fit all
      </button>
    </div>
  );
}
