/** Fusion Cell — Travel utility functions (v2)
 *  Great-circle arcs, pin GeoJSON, duration formatting. */

import type { Airport } from "./airports";
import type { ItineraryEvent } from "./travel-types";

// ── Great-circle arc interpolation ──────────────────────────────

export function greatCirclePoints(
  from: Airport,
  to: Airport,
  numPoints = 64
): [number, number][] {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;

  const lat1 = toRad(from.lat);
  const lng1 = toRad(from.lng);
  const lat2 = toRad(to.lat);
  const lng2 = toRad(to.lng);

  const d =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin((lat2 - lat1) / 2) ** 2 +
          Math.cos(lat1) * Math.cos(lat2) * Math.sin((lng2 - lng1) / 2) ** 2
      )
    );

  if (d < 1e-10) return [[from.lng, from.lat]];

  const points: [number, number][] = [];
  for (let i = 0; i <= numPoints; i++) {
    const f = i / numPoints;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(lat1) * Math.cos(lng1) + B * Math.cos(lat2) * Math.cos(lng2);
    const y = A * Math.cos(lat1) * Math.sin(lng1) + B * Math.cos(lat2) * Math.sin(lng2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);
    const lat = toDeg(Math.atan2(z, Math.sqrt(x * x + y * y)));
    const lng = toDeg(Math.atan2(y, x));
    points.push([lng, lat]);
  }
  return points;
}

/**
 * Straight-line flight path points.
 *
 * Linear lng/lat interpolation between departure and arrival — renders
 * as a straight line on mercator (what we want — no earth-curvature
 * visualization) and as a tight geodesic on the 3D globe. Multiple
 * points (not just 2) so progressive-draw animation on selection has
 * something to slice.
 */
export function flightArcPoints(
  from: Airport,
  to: Airport,
  numPoints = 32
): [number, number][] {
  const dLat = to.lat - from.lat;
  const dLng = to.lng - from.lng;
  const points: [number, number][] = [];
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    points.push([from.lng + dLng * t, from.lat + dLat * t]);
  }
  return points;
}

// ── GeoJSON builders ────────────────────────────────────────────

/**
 * Flight arcs as GeoJSON LineStrings.
 *
 * Uses `flightArcPoints` (arched) instead of bare great-circle so even
 * short continental hops render as visible arcs on a flat map. Each
 * flight carries an `arcProgress` 0..1 property; normally set to 1 (full
 * length). Callers can override it for a specific flight to animate the
 * arc drawing — we truncate the coordinate array to `progress * length`
 * and the map redraws when the GeoJSON changes.
 */
export function flightArcsGeoJSON(
  events: ItineraryEvent[],
  selectedId?: string,
  selectedProgress = 1
): GeoJSON.FeatureCollection {
  const flights = events.filter(
    (e) => e.type === "flight" && e.departureAirport && e.arrivalAirport
  );
  return {
    type: "FeatureCollection",
    features: flights.map((e) => {
      const full = flightArcPoints(e.departureAirport!, e.arrivalAirport!);
      const isSelected = e.id === selectedId;
      // Animated draw on the selected flight: truncate to the current
      // progress. Keep at least 2 points so Mapbox still renders a line.
      const coords =
        isSelected && selectedProgress < 1
          ? full.slice(0, Math.max(2, Math.ceil(full.length * selectedProgress)))
          : full;
      return {
        type: "Feature" as const,
        properties: { id: e.id, selected: isSelected },
        geometry: {
          type: "LineString" as const,
          coordinates: coords,
        },
      };
    }),
  };
}

/** Airport dots from flight events. */
export function airportDotsGeoJSON(events: ItineraryEvent[]): GeoJSON.FeatureCollection {
  const seen = new Set<string>();
  const features: GeoJSON.Feature[] = [];
  for (const e of events) {
    if (e.type !== "flight") continue;
    for (const ap of [e.departureAirport, e.arrivalAirport]) {
      if (!ap || seen.has(ap.code)) continue;
      seen.add(ap.code);
      features.push({
        type: "Feature",
        properties: { code: ap.code, city: ap.city, type: "airport" },
        geometry: { type: "Point", coordinates: [ap.lng, ap.lat] },
      });
    }
  }
  return { type: "FeatureCollection", features };
}

/** Pin markers for non-flight events (hotels, ground, reservations). */
export function locationPinsGeoJSON(
  events: ItineraryEvent[],
  selectedId?: string
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];

  for (const e of events) {
    if (e.type === "flight") continue;

    const points = getEventCoordinates(e);
    for (const pt of points) {
      features.push({
        type: "Feature",
        properties: {
          id: e.id,
          type: e.type,
          label: getEventLabel(e),
          selected: e.id === selectedId,
        },
        geometry: { type: "Point", coordinates: [pt.lng, pt.lat] },
      });
    }
  }
  return { type: "FeatureCollection", features };
}

// ── Coordinate extraction per event type ────────────────────────

interface Coord { lat: number; lng: number; }

export function getEventCoordinates(e: ItineraryEvent): Coord[] {
  switch (e.type) {
    case "flight":
      return [
        ...(e.departureAirport ? [{ lat: e.departureAirport.lat, lng: e.departureAirport.lng }] : []),
        ...(e.arrivalAirport ? [{ lat: e.arrivalAirport.lat, lng: e.arrivalAirport.lng }] : []),
      ];
    case "ground": {
      const pts: Coord[] = [];
      if (e.pickupLat != null && e.pickupLng != null) pts.push({ lat: e.pickupLat, lng: e.pickupLng });
      if (e.dropoffLat != null && e.dropoffLng != null) pts.push({ lat: e.dropoffLat, lng: e.dropoffLng });
      return pts;
    }
    case "hotel":
      return e.propertyLat != null && e.propertyLng != null
        ? [{ lat: e.propertyLat, lng: e.propertyLng }]
        : [];
    case "reservation":
      return e.venueLat != null && e.venueLng != null
        ? [{ lat: e.venueLat, lng: e.venueLng }]
        : [];
    default:
      return [];
  }
}

export function getEventLabel(e: ItineraryEvent): string {
  switch (e.type) {
    case "flight":
      return `${e.departureAirport?.code ?? "?"} → ${e.arrivalAirport?.code ?? "?"}`;
    case "ground":
      return e.driverOrCompany || "Ground transport";
    case "hotel":
      return e.propertyName || "Hotel";
    case "reservation":
      return e.venueName || "Reservation";
  }
}

// ── Ground routes via Mapbox Directions API ─────────────────────

/**
 * Fetch driving routes for ground transport events.
 * Returns a GeoJSON FeatureCollection of LineStrings — one per ground event
 * that has both pickup and dropoff coordinates.
 */
export async function fetchGroundRoutes(
  events: ItineraryEvent[],
  mapboxToken: string,
  selectedId?: string
): Promise<GeoJSON.FeatureCollection> {
  const groundEvents = events.filter(
    (e) =>
      e.type === "ground" &&
      e.pickupLat != null &&
      e.pickupLng != null &&
      e.dropoffLat != null &&
      e.dropoffLng != null
  );

  const features: GeoJSON.Feature[] = [];

  for (const e of groundEvents) {
    const props = {
      id: e.id,
      selected: e.id === selectedId,
      label: e.driverOrCompany || "Ground transport",
      vehicleType: e.vehicleType || "car",
    };

    // Straight-line fallback coordinates
    const fallbackGeometry: GeoJSON.LineString = {
      type: "LineString",
      coordinates: [
        [e.pickupLng!, e.pickupLat!],
        [e.dropoffLng!, e.dropoffLat!],
      ],
    };

    try {
      const coords = `${e.pickupLng},${e.pickupLat};${e.dropoffLng},${e.dropoffLat}`;
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?geometries=geojson&overview=full&access_token=${mapboxToken}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Directions API error");
      const data = await res.json();
      const route = data.routes?.[0]?.geometry;
      if (!route) throw new Error("No route geometry");

      features.push({ type: "Feature", properties: props, geometry: route });
    } catch {
      // Fallback: straight dashed line between pickup and dropoff
      features.push({ type: "Feature", properties: props, geometry: fallbackGeometry });
    }
  }

  return { type: "FeatureCollection", features };
}

// ── Formatting ──────────────────────────────────────────────────

export function formatDuration(startISO: string, endISO: string): string {
  const ms = new Date(endISO).getTime() - new Date(startISO).getTime();
  if (ms <= 0) return "—";
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h >= 24) {
    const days = Math.floor(h / 24);
    const remH = h % 24;
    return remH > 0 ? `${days}d ${remH}h` : `${days}d`;
  }
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function formatDateRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  if (sameMonth) {
    return `${s.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${e.getDate()}, ${e.getFullYear()}`;
  }
  return `${formatDate(start)} – ${formatDate(end)}, ${e.getFullYear()}`;
}

// ── Bounds from all events ──────────────────────────────────────

export function eventsBounds(events: ItineraryEvent[]): [[number, number], [number, number]] | null {
  const coords: Coord[] = [];
  for (const e of events) coords.push(...getEventCoordinates(e));
  if (!coords.length) return null;

  let minLng = Infinity, maxLng = -Infinity;
  let minLat = Infinity, maxLat = -Infinity;
  for (const c of coords) {
    if (c.lng < minLng) minLng = c.lng;
    if (c.lng > maxLng) maxLng = c.lng;
    if (c.lat < minLat) minLat = c.lat;
    if (c.lat > maxLat) maxLat = c.lat;
  }
  const lngPad = Math.max((maxLng - minLng) * 0.15, 2);
  const latPad = Math.max((maxLat - minLat) * 0.15, 2);
  return [
    [minLng - lngPad, minLat - latPad],
    [maxLng + lngPad, maxLat + latPad],
  ];
}
