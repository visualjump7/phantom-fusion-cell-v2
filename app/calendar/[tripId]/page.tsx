"use client";

/**
 * Fusion Cell — Travel: Trip Detail
 *
 * Three-panel itinerary view with responsive behavior:
 * - Desktop (lg+): left timeline + map + collapsible right form panel
 * - Tablet (md–lg): left timeline + map, form slides in as overlay
 * - Mobile (<md): full map, bottom timeline, FAB opens form as bottom sheet
 */

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, X, PanelRightOpen, PanelRightClose } from "lucide-react";
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

  // Panel state: desktop/tablet slide toggle + mobile bottom sheet
  const [formOpen, setFormOpen] = useState(true);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  // Auto-open form when editing an event
  useEffect(() => {
    if (editingEvent) {
      setFormOpen(true);
      setMobileSheetOpen(true);
    }
  }, [editingEvent]);

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

  function handleCloseForm() {
    setFormOpen(false);
    setMobileSheetOpen(false);
    setEditingEvent(null);
  }

  // Shared form props
  const formProps = {
    tripId,
    onAddEvent: handleAddEvent,
    onUpdateEvent: handleUpdateEvent,
    editingEvent,
    onCancelEdit: () => setEditingEvent(null),
    onClose: handleCloseForm,
  };

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
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

      {/* ═══════════════════════════════════════════════════════════
          MAIN LAYOUT: left timeline + center map + right form
          ═══════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left panel: timeline (hidden on mobile) */}
        <div className="hidden md:flex flex-col w-[320px] shrink-0 border-r border-border overflow-hidden bg-background">
          <ItineraryTimeline
            tripName={tripName}
            events={events}
            selectedEventId={selectedEventId}
            onSelectEvent={setSelectedEventId}
            onEditEvent={handleEditEvent}
            onDeleteEvent={handleDeleteEvent}
          />
        </div>

        {/* Center: map (fills remaining space) */}
        <div className="flex-1 relative min-h-0">
          <TravelMap
            events={events}
            selectedEventId={selectedEventId}
            onSelectEvent={setSelectedEventId}
          />

          {/* Desktop/Tablet: slide toggle button on right edge of map */}
          <button
            type="button"
            onClick={() => setFormOpen((v) => !v)}
            className="hidden md:flex absolute top-1/2 right-0 -translate-y-1/2 z-20 items-center justify-center w-8 h-16 rounded-l-lg bg-card/90 backdrop-blur-sm border border-r-0 border-border text-muted-foreground hover:text-foreground hover:bg-card transition-all"
            aria-label={formOpen ? "Hide form panel" : "Show form panel"}
          >
            {formOpen ? (
              <PanelRightClose className="h-4 w-4" />
            ) : (
              <PanelRightOpen className="h-4 w-4" />
            )}
          </button>

          {/* Mobile: floating action button */}
          <button
            type="button"
            onClick={() => setMobileSheetOpen(true)}
            className="md:hidden absolute bottom-20 right-4 z-20 flex items-center justify-center w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 active:scale-95 transition-all"
            aria-label="Add event"
          >
            <Plus className="h-6 w-6" />
          </button>
        </div>

        {/* Right panel: form — slides in/out on desktop/tablet */}
        <div
          className={`
            hidden md:flex flex-col shrink-0 border-l border-border bg-background overflow-hidden
            transition-all duration-350 ease-[cubic-bezier(.22,.61,.36,1)]
            ${formOpen ? "w-[340px] opacity-100" : "w-0 opacity-0 border-l-0"}
          `}
          style={{ transitionDuration: "350ms" }}
        >
          {formOpen && (
            <AddEventForm {...formProps} />
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          MOBILE: bottom timeline
          ═══════════════════════════════════════════════════════════ */}
      <div className="md:hidden border-t border-border bg-background">
        {/* Drag handle indicator */}
        <div className="flex justify-center py-2">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>
        <div className="max-h-[35vh] overflow-y-auto pb-safe">
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

      {/* ═══════════════════════════════════════════════════════════
          MOBILE: bottom sheet for AddEventForm
          ═══════════════════════════════════════════════════════════ */}
      {mobileSheetOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleCloseForm}
          />

          {/* Sheet */}
          <div
            className="relative z-10 bg-background rounded-t-2xl border-t border-border overflow-hidden animate-in slide-in-from-bottom duration-300"
            style={{ maxHeight: "85vh" }}
          >
            {/* Sheet header with close button */}
            <div className="flex items-center justify-between px-4 pt-3 pb-1">
              <div className="flex justify-center flex-1">
                <div className="w-10 h-1 rounded-full bg-border" />
              </div>
              <button
                type="button"
                onClick={handleCloseForm}
                className="absolute right-3 top-3 p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form content — scrollable */}
            <div className="overflow-y-auto" style={{ maxHeight: "calc(85vh - 48px)" }}>
              <AddEventForm {...formProps} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
