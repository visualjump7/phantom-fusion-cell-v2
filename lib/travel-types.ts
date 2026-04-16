/** Fusion Cell — Travel module type definitions (v2)
 *  Universal itinerary events: flights, ground transport, hotels, reservations. */

import type { Airport } from "./airports";

export type EventType = "flight" | "ground" | "hotel" | "reservation";
export type EventStatus = "upcoming" | "in-progress" | "completed";

export interface ItineraryEvent {
  id: string;
  tripId: string;
  type: EventType;
  startTime: string;       // ISO 8601 (departure, check-in, pickup, reservation)
  endTime: string;         // ISO 8601 (arrival, check-out, dropoff, end)
  status: EventStatus;
  notes?: string;

  // ── Flight ──
  departureAirport?: Airport;
  arrivalAirport?: Airport;
  airline?: string;
  flightNumber?: string;
  tailNumber?: string;

  // ── Ground transport ──
  pickupLocation?: string;
  pickupLat?: number;
  pickupLng?: number;
  dropoffLocation?: string;
  dropoffLat?: number;
  dropoffLng?: number;
  vehicleType?: string;       // sedan, suv, helicopter, yacht, other
  driverOrCompany?: string;

  // ── Hotel / accommodation ──
  propertyName?: string;
  propertyAddress?: string;
  propertyLat?: number;
  propertyLng?: number;
  confirmationNumber?: string;
  roomType?: string;

  // ── Reservation (restaurant, club, spa, event) ──
  venueName?: string;
  venueAddress?: string;
  venueLat?: number;
  venueLng?: number;
  partySize?: number;
  reservationConfirmation?: string;
}

export interface Trip {
  id: string;
  name: string;
  organizationId: string;
  startDate: string;
  endDate: string;
  status: EventStatus;
  events: ItineraryEvent[];
}

/** Display config per event type. */
export const EVENT_META: Record<EventType, { label: string; color: string; iconName: string }> = {
  flight:      { label: "Flight",      color: "#4ade80", iconName: "plane" },
  ground:      { label: "Ground",      color: "#3b82f6", iconName: "car" },
  hotel:       { label: "Hotel",       color: "#f59e0b", iconName: "building-2" },
  reservation: { label: "Reservation", color: "#a78bfa", iconName: "utensils" },
};
