"use client";

/**
 * Fusion Cell — Travel: Trip Detail
 *
 * Three-panel itinerary view:
 * - Left: chronological timeline of all events (flights, ground, hotels, reservations)
 * - Center: Mapbox map with arcs for flights, pins for everything else
 * - Right: tabbed form to add new events
 *
 * Phase 1: events stored in local state (hydrated from sample data).
 * Phase 2: real Supabase CRUD.
 */

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { ItineraryTimeline } from "@/components/travel/ItineraryTimeline";
import { TravelMap } from "@/components/travel/TravelMap";
import { AddEventForm } from "@/components/travel/AddEventForm";
import { getSampleTrip } from "@/lib/sample-trips";
import type { ItineraryEvent } from "@/lib/travel-types";

export default function TripDetailPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const sampleTrip = getSampleTrip(tripId);

  const [events, setEvents] = useState<ItineraryEvent[]>(
    sampleTrip?.events ?? []
  );
  const [selectedEventId, setSelectedEventId] = useState<string | null>(
    events[0]?.id ?? null
  );

  const tripName = sampleTrip?.name ?? "Untitled Trip";

  function handleAddEvent(event: ItineraryEvent) {
    setEvents((prev) => {
      const updated = [...prev, event].sort(
        (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      );
      return updated;
    });
    setSelectedEventId(event.id);
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <Navbar />

      {/* Back bar */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-2 border-b border-border bg-background">
        <Link
          href="/calendar"
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All trips
        </Link>
        <span className="text-xs text-border">/</span>
        <span className="text-xs font-medium text-foreground">{tripName}</span>
      </div>

      {/* Three-panel layout */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-[320px_1fr] lg:grid-cols-[320px_1fr_340px] overflow-hidden">
        {/* Left: timeline */}
        <div className="hidden md:flex flex-col border-r border-border overflow-hidden bg-background">
          <ItineraryTimeline
            tripName={tripName}
            events={events}
            selectedEventId={selectedEventId}
            onSelectEvent={setSelectedEventId}
          />
        </div>

        {/* Center: map */}
        <div className="relative min-h-[400px]">
          <TravelMap
            events={events}
            selectedEventId={selectedEventId}
            onSelectEvent={setSelectedEventId}
          />
        </div>

        {/* Right: add event form */}
        <div className="hidden lg:flex flex-col border-l border-border overflow-hidden bg-background">
          <AddEventForm tripId={tripId} onAddEvent={handleAddEvent} />
        </div>
      </div>

      {/* Mobile: timeline below map */}
      <div className="md:hidden border-t border-border bg-background max-h-[40vh] overflow-y-auto">
        <ItineraryTimeline
          tripName={tripName}
          events={events}
          selectedEventId={selectedEventId}
          onSelectEvent={setSelectedEventId}
        />
      </div>
    </div>
  );
}
