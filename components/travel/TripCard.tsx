"use client";

import Link from "next/link";
import { MapPin, Plane, Car, Building2, Utensils, ChevronRight, Pencil, Trash2 } from "lucide-react";
import type { Trip, EventType } from "@/lib/travel-types";
import { EVENT_META } from "@/lib/travel-types";
import { formatDateRange } from "@/lib/travel-utils";

interface TripCardProps {
  trip: Trip;
  onEdit?: (trip: Trip) => void;
  onDelete?: (trip: Trip) => void;
}

const ICONS: Record<EventType, typeof Plane> = {
  flight: Plane,
  ground: Car,
  hotel: Building2,
  reservation: Utensils,
};

export function TripCard({ trip, onEdit, onDelete }: TripCardProps) {
  const counts = trip.events.reduce((acc, e) => {
    acc[e.type] = (acc[e.type] || 0) + 1;
    return acc;
  }, {} as Record<EventType, number>);

  const dateRange = formatDateRange(trip.startDate, trip.endDate);

  return (
    <Link
      href={`/calendar/${trip.id}`}
      className="group block rounded-xl border border-border bg-card/60 p-5 transition-all duration-300 hover:border-primary/30 hover:bg-card/80 hover:shadow-[0_0_24px_-6px] hover:shadow-primary/8"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors">
            {trip.name}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">{dateRange}</p>
        </div>
        <div className="flex items-center gap-1">
          {onEdit && (
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(trip); }}
              className="p-1.5 rounded-md text-muted-foreground/0 group-hover:text-muted-foreground hover:!text-foreground hover:bg-muted/40 transition-all"
              aria-label="Edit trip"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(trip); }}
              className="p-1.5 rounded-md text-muted-foreground/0 group-hover:text-muted-foreground hover:!text-destructive hover:bg-destructive/10 transition-all"
              aria-label="Delete trip"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
      </div>

      {/* Event type counts */}
      <div className="flex items-center gap-4">
        {(Object.keys(counts) as EventType[]).map((type) => {
          const Icon = ICONS[type];
          const meta = EVENT_META[type];
          return (
            <span key={type} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Icon className="h-3 w-3" style={{ color: meta.color }} />
              {counts[type]} {meta.label.toLowerCase()}{counts[type] !== 1 ? "s" : ""}
            </span>
          );
        })}
      </div>

      {/* Total events */}
      <div className="flex items-center gap-1.5 mt-3 text-[11px] text-muted-foreground/60">
        <MapPin className="h-3 w-3" />
        {trip.events.length} event{trip.events.length !== 1 ? "s" : ""} total
      </div>
    </Link>
  );
}
