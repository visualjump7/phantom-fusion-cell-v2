"use client";

import { Plane, Car, Building2, Utensils, Pencil, Trash2 } from "lucide-react";
import type { ItineraryEvent, EventType } from "@/lib/travel-types";
import { EVENT_META } from "@/lib/travel-types";
import { formatDuration, formatTime, formatDate } from "@/lib/travel-utils";

interface EventCardProps {
  event: ItineraryEvent;
  index: number;
  isSelected: boolean;
  onClick: () => void;
  onEdit?: (event: ItineraryEvent) => void;
  onDelete?: (eventId: string) => void;
}

const ICONS: Record<EventType, typeof Plane> = {
  flight: Plane,
  ground: Car,
  hotel: Building2,
  reservation: Utensils,
};

const STATUS_DOT: Record<string, string> = {
  upcoming: "bg-primary",
  "in-progress": "bg-amber-400",
  completed: "bg-muted-foreground/40",
};

export function EventCard({ event, index, isSelected, onClick, onEdit, onDelete }: EventCardProps) {
  const meta = EVENT_META[event.type];
  const Icon = ICONS[event.type];
  const duration = formatDuration(event.startTime, event.endTime);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        group relative w-full text-left rounded-xl border p-4 transition-all duration-300
        ${isSelected
          ? "border-border bg-card shadow-[0_0_16px_-4px] shadow-primary/8"
          : "border-border/60 bg-card/40 hover:border-border hover:bg-card/70"
        }
      `}
    >
      {/* Type accent bar on left edge */}
      <div
        className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full"
        style={{ backgroundColor: meta.color }}
      />

      {/* Header row */}
      <div className="flex items-center gap-2 mb-2 pl-2">
        <Icon className="h-3.5 w-3.5" style={{ color: meta.color }} />
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {meta.label}
        </span>
        <div className={`h-1.5 w-1.5 rounded-full ml-1 ${STATUS_DOT[event.status]}`} />
        <span className="ml-auto text-[11px] text-muted-foreground">{duration}</span>
        {onEdit && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onEdit(event); }}
            className="p-1 rounded text-muted-foreground/0 group-hover:text-muted-foreground hover:!text-foreground transition-all"
            aria-label="Edit event"
          >
            <Pencil className="h-3 w-3" />
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(event.id); }}
            className="p-1 rounded text-muted-foreground/0 group-hover:text-muted-foreground hover:!text-destructive transition-all"
            aria-label="Delete event"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Content — varies by type */}
      <div className="pl-2">
        {event.type === "flight" && <FlightContent event={event} />}
        {event.type === "ground" && <GroundContent event={event} />}
        {event.type === "hotel" && <HotelContent event={event} />}
        {event.type === "reservation" && <ReservationContent event={event} />}

        {/* Date + time */}
        <div className="flex items-center justify-between mt-2 text-[11px] text-muted-foreground">
          <span>{formatDate(event.startTime)} &middot; {formatTime(event.startTime)}</span>
          <span>{formatTime(event.endTime)}</span>
        </div>

        {/* Notes */}
        {event.notes && (
          <p className="mt-1.5 text-[11px] text-muted-foreground/70 line-clamp-2 leading-relaxed">
            {event.notes}
          </p>
        )}
      </div>
    </button>
  );
}

function FlightContent({ event }: { event: ItineraryEvent }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="text-lg font-bold text-foreground tracking-tight">{event.departureAirport?.code}</div>
        <div className="text-[11px] text-muted-foreground truncate">{event.departureAirport?.city}</div>
      </div>
      <div className="flex flex-col items-center px-1">
        <Plane className="h-3 w-3 text-primary rotate-45" />
        {event.flightNumber && (
          <div className="text-[10px] text-muted-foreground mt-0.5">{event.flightNumber}</div>
        )}
      </div>
      <div className="flex-1 min-w-0 text-right">
        <div className="text-lg font-bold text-foreground tracking-tight">{event.arrivalAirport?.code}</div>
        <div className="text-[11px] text-muted-foreground truncate">{event.arrivalAirport?.city}</div>
      </div>
    </div>
  );
}

function GroundContent({ event }: { event: ItineraryEvent }) {
  return (
    <div>
      <div className="text-sm font-medium text-foreground">{event.driverOrCompany || "Ground transport"}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5">
        {event.pickupLocation} → {event.dropoffLocation}
      </div>
      {event.vehicleType && (
        <div className="text-[11px] text-muted-foreground capitalize">{event.vehicleType}</div>
      )}
    </div>
  );
}

function HotelContent({ event }: { event: ItineraryEvent }) {
  return (
    <div>
      <div className="text-sm font-medium text-foreground">{event.propertyName}</div>
      {event.roomType && (
        <div className="text-[11px] text-muted-foreground">{event.roomType}</div>
      )}
      {event.confirmationNumber && (
        <div className="text-[10px] text-muted-foreground/60 font-mono">#{event.confirmationNumber}</div>
      )}
    </div>
  );
}

function ReservationContent({ event }: { event: ItineraryEvent }) {
  return (
    <div>
      <div className="text-sm font-medium text-foreground">{event.venueName}</div>
      {event.partySize && (
        <div className="text-[11px] text-muted-foreground">Party of {event.partySize}</div>
      )}
      {event.reservationConfirmation && (
        <div className="text-[10px] text-muted-foreground/60 font-mono">#{event.reservationConfirmation}</div>
      )}
    </div>
  );
}
