"use client";

/**
 * Fusion Cell — Travel state management (Phase 1: in-memory)
 *
 * Provides CRUD operations for trips and itinerary events via React Context.
 * Wraps /calendar/* routes via app/calendar/layout.tsx so state persists
 * across trip-list ↔ trip-detail navigation.
 *
 * Phase 2: swap the in-memory arrays for Supabase queries + mutations.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { SAMPLE_TRIPS } from "./sample-trips";
import type { Trip, ItineraryEvent } from "./travel-types";

// ── Context type ────────────────────────────────────────────────

interface TravelContextValue {
  trips: Trip[];
  getTrip: (id: string) => Trip | undefined;
  addTrip: (trip: Trip) => void;
  updateTrip: (id: string, updates: Partial<Omit<Trip, "id" | "events">>) => void;
  deleteTrip: (id: string) => void;
  addEvent: (tripId: string, event: ItineraryEvent) => void;
  updateEvent: (tripId: string, eventId: string, updates: Partial<ItineraryEvent>) => void;
  deleteEvent: (tripId: string, eventId: string) => void;
}

const TravelContext = createContext<TravelContextValue | null>(null);

// ── Provider ────────────────────────────────────────────────────

export function TravelProvider({ children }: { children: ReactNode }) {
  const [trips, setTrips] = useState<Trip[]>(SAMPLE_TRIPS);

  const getTrip = useCallback(
    (id: string) => trips.find((t) => t.id === id),
    [trips]
  );

  const addTrip = useCallback((trip: Trip) => {
    setTrips((prev) => [...prev, trip]);
  }, []);

  const updateTrip = useCallback(
    (id: string, updates: Partial<Omit<Trip, "id" | "events">>) => {
      setTrips((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
      );
    },
    []
  );

  const deleteTrip = useCallback((id: string) => {
    setTrips((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addEvent = useCallback((tripId: string, event: ItineraryEvent) => {
    setTrips((prev) =>
      prev.map((t) => {
        if (t.id !== tripId) return t;
        const events = [...t.events, event].sort(
          (a, b) =>
            new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
        );
        return { ...t, events };
      })
    );
  }, []);

  const updateEvent = useCallback(
    (tripId: string, eventId: string, updates: Partial<ItineraryEvent>) => {
      setTrips((prev) =>
        prev.map((t) => {
          if (t.id !== tripId) return t;
          const events = t.events
            .map((e) => (e.id === eventId ? { ...e, ...updates } : e))
            .sort(
              (a, b) =>
                new Date(a.startTime).getTime() -
                new Date(b.startTime).getTime()
            );
          return { ...t, events };
        })
      );
    },
    []
  );

  const deleteEvent = useCallback((tripId: string, eventId: string) => {
    setTrips((prev) =>
      prev.map((t) => {
        if (t.id !== tripId) return t;
        return { ...t, events: t.events.filter((e) => e.id !== eventId) };
      })
    );
  }, []);

  return (
    <TravelContext.Provider
      value={{
        trips,
        getTrip,
        addTrip,
        updateTrip,
        deleteTrip,
        addEvent,
        updateEvent,
        deleteEvent,
      }}
    >
      {children}
    </TravelContext.Provider>
  );
}

// ── Hook ────────────────────────────────────────────────────────

export function useTravel(): TravelContextValue {
  const ctx = useContext(TravelContext);
  if (!ctx) throw new Error("useTravel must be used within TravelProvider");
  return ctx;
}
