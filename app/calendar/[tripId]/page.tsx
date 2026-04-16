"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { ItineraryTimeline } from "@/components/travel/ItineraryTimeline";
import { TravelMap } from "@/components/travel/TravelMap";
import { AddEventForm } from "@/components/travel/AddEventForm";
import { useTravel } from "@/lib/travel-store";
import type { ItineraryEvent } from "@/lib/travel-types";

export default function TripDetailPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const { getTrip, addEvent, updateEvent, deleteEvent } = useTravel();
  const trip = getTrip(tripId);

  const events = trip?.events ?? [];
  const tripName = trip?.name ?? "Untitled Trip";

  const [selectedEventId, setSelectedEventId] = useState<string | null>(
    events[0]?.id ?? null
  );
  const [editingEvent, setEditingEvent] = useState<ItineraryEvent | null>(null);

  function handleAddEvent(event: ItineraryEvent) {
    addEvent(tripId, event);
    setSelectedEventId(event.id);
  }

  function handleUpdateEvent(eventId: string, event: ItineraryEvent) {
    updateEvent(tripId, eventId, event);
    setEditingEvent(null);
  }

  function handleDeleteEvent(eventId: string) {
    deleteEvent(tripId, eventId);
    if (selectedEventId === eventId) {
      setSelectedEventId(events.find((e) => e.id !== eventId)?.id ?? null);
    }
  }

  function handleEditEvent(event: ItineraryEvent) {
    setEditingEvent(event);
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
            onEditEvent={handleEditEvent}
            onDeleteEvent={handleDeleteEvent}
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

        {/* Right: add/edit event form */}
        <div className="hidden lg:flex flex-col border-l border-border overflow-hidden bg-background">
          <AddEventForm
            tripId={tripId}
            onAddEvent={handleAddEvent}
            onUpdateEvent={handleUpdateEvent}
            editingEvent={editingEvent}
            onCancelEdit={() => setEditingEvent(null)}
          />
        </div>
      </div>

      {/* Mobile: timeline below map */}
      <div className="md:hidden border-t border-border bg-background max-h-[40vh] overflow-y-auto">
        <ItineraryTimeline
          tripName={tripName}
          events={events}
          selectedEventId={selectedEventId}
          onSelectEvent={setSelectedEventId}
          onEditEvent={handleEditEvent}
          onDeleteEvent={handleDeleteEvent}
        />
      </div>
    </div>
  );
}
