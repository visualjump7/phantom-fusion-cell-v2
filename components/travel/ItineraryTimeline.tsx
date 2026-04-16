"use client";

import { MapPin, Plane, Car, Building2, Utensils } from "lucide-react";
import type { ItineraryEvent, EventType } from "@/lib/travel-types";
import { EVENT_META } from "@/lib/travel-types";
import { EventCard } from "./EventCard";

interface ItineraryTimelineProps {
  tripName: string;
  events: ItineraryEvent[];
  selectedEventId: string | null;
  onSelectEvent: (id: string) => void;
}

export function ItineraryTimeline({ tripName, events, selectedEventId, onSelectEvent }: ItineraryTimelineProps) {
  // Count events by type
  const counts = events.reduce((acc, e) => {
    acc[e.type] = (acc[e.type] || 0) + 1;
    return acc;
  }, {} as Record<EventType, number>);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 px-4 pt-4 pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">{tripName}</h2>
        </div>
        <div className="flex items-center gap-3 mt-2">
          {counts.flight && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Plane className="h-3 w-3" style={{ color: EVENT_META.flight.color }} />
              {counts.flight}
            </span>
          )}
          {counts.ground && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Car className="h-3 w-3" style={{ color: EVENT_META.ground.color }} />
              {counts.ground}
            </span>
          )}
          {counts.hotel && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Building2 className="h-3 w-3" style={{ color: EVENT_META.hotel.color }} />
              {counts.hotel}
            </span>
          )}
          {counts.reservation && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Utensils className="h-3 w-3" style={{ color: EVENT_META.reservation.color }} />
              {counts.reservation}
            </span>
          )}
        </div>
      </div>

      {/* Scrollable event list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {events.map((event, i) => (
          <EventCard
            key={event.id}
            event={event}
            index={i}
            isSelected={event.id === selectedEventId}
            onClick={() => onSelectEvent(event.id)}
          />
        ))}

        {events.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            No events yet.
            <br />
            Use the form to build the itinerary.
          </div>
        )}
      </div>
    </div>
  );
}
