/**
 * Adapter: TravelLeg[] (DB shape) → ItineraryEvent[] (map shape).
 *
 * The `travel_legs` table stores leg rows with a `leg_type` enum of
 * (flight | hotel | ground | restaurant | meeting | custom) and generic
 * lat/lng + location fields. The rich map component at
 * `components/travel/TravelMap.tsx` wants the richer `ItineraryEvent`
 * shape from `lib/travel-types.ts` (flight has Airport objects, ground
 * has pickup/dropoff, hotel has property, reservation has venue). This
 * adapter bridges the two so the map can color-code and arc-draw using
 * existing infrastructure.
 *
 * Mapping:
 *   flight     → ItineraryEvent.type='flight'      (fabricates Airport objects)
 *   ground     → 'ground'
 *   hotel      → 'hotel'
 *   restaurant → 'reservation'
 *   meeting    → 'reservation'  (reservation is the closest existing bucket)
 *   custom     → 'reservation'
 *
 * Falls back gracefully when lat/lng is missing — those events simply
 * won't render their geometry on the map but still show in the timeline.
 */

import type { ItineraryEvent, Airport } from "./travel-types";
import type { TravelLeg } from "./travel-service";

/** Parse a 3-letter airport code out of a location string like
 *  "Phoenix Sky Harbor (PHX)" → "PHX". Returns "???" if not found. */
function parseAirportCode(loc: string | null): string {
  if (!loc) return "???";
  const m = loc.match(/\(([A-Z]{3,4})\)\s*$/);
  return m ? m[1] : "???";
}

/** Build a minimal Airport object from what a TravelLeg carries. */
function makeAirport(
  location: string | null,
  lat: number | null,
  lng: number | null
): Airport | undefined {
  if (lat == null || lng == null) return undefined;
  return {
    code: parseAirportCode(location),
    name: location ?? "",
    city: "",
    country: "",
    lat,
    lng,
  };
}

function safeIso(value: string | null, fallback: string): string {
  // TravelLeg.departure_time / arrival_time are ISO strings already, but may
  // be null. ItineraryEvent wants non-null startTime/endTime — fall back to
  // the trip's mid-range or current time so downstream sorting still works.
  return value ?? fallback;
}

export function legsToEvents(
  legs: TravelLeg[],
  tripId: string
): ItineraryEvent[] {
  const now = new Date().toISOString();
  // Ensure legs are in position order so the map reads the journey correctly.
  const sorted = [...legs].sort((a, b) => a.position - b.position);

  return sorted.map((leg): ItineraryEvent => {
    const startTime = safeIso(leg.departure_time, now);
    const endTime = safeIso(leg.arrival_time, startTime);
    const baseId = leg.id;

    if (leg.leg_type === "flight") {
      return {
        id: baseId,
        tripId,
        type: "flight",
        startTime,
        endTime,
        status: "upcoming",
        notes: leg.notes ?? leg.details ?? undefined,
        departureAirport: makeAirport(
          leg.departure_location,
          leg.departure_lat,
          leg.departure_lng
        ),
        arrivalAirport: makeAirport(
          leg.arrival_location,
          leg.arrival_lat,
          leg.arrival_lng
        ),
        airline: leg.provider ?? undefined,
        flightNumber: leg.confirmation_number ?? undefined,
      };
    }

    if (leg.leg_type === "ground") {
      return {
        id: baseId,
        tripId,
        type: "ground",
        startTime,
        endTime,
        status: "upcoming",
        notes: leg.notes ?? leg.details ?? undefined,
        pickupLocation: leg.departure_location ?? undefined,
        pickupLat: leg.departure_lat ?? undefined,
        pickupLng: leg.departure_lng ?? undefined,
        dropoffLocation: leg.arrival_location ?? undefined,
        dropoffLat: leg.arrival_lat ?? undefined,
        dropoffLng: leg.arrival_lng ?? undefined,
        vehicleType: undefined,
        driverOrCompany: leg.provider ?? undefined,
      };
    }

    if (leg.leg_type === "hotel") {
      return {
        id: baseId,
        tripId,
        type: "hotel",
        startTime,
        endTime,
        status: "upcoming",
        notes: leg.notes ?? leg.details ?? undefined,
        propertyName: leg.provider ?? leg.departure_location ?? "Hotel",
        propertyAddress: leg.departure_location ?? undefined,
        propertyLat: leg.departure_lat ?? undefined,
        propertyLng: leg.departure_lng ?? undefined,
        confirmationNumber: leg.confirmation_number ?? undefined,
      };
    }

    // restaurant / meeting / custom all fold into "reservation" — the map's
    // reservation bucket renders as a pin with its own color.
    return {
      id: baseId,
      tripId,
      type: "reservation",
      startTime,
      endTime,
      status: "upcoming",
      notes: leg.notes ?? leg.details ?? undefined,
      venueName: leg.provider ?? leg.departure_location ?? "Event",
      venueAddress: leg.departure_location ?? undefined,
      venueLat: leg.departure_lat ?? undefined,
      venueLng: leg.departure_lng ?? undefined,
      reservationConfirmation: leg.confirmation_number ?? undefined,
    };
  });
}
