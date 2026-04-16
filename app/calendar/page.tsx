"use client";

/**
 * Fusion Cell — Travel: Trip List
 *
 * Grid of trip cards. Click a trip to open its itinerary detail view
 * with the 3-panel map layout. "New Trip" creates a local trip (Phase 1).
 * Phase 2 wires to Supabase.
 */

import { useState } from "react";
import { Plus, MapPin } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { TripCard } from "@/components/travel/TripCard";
import { SAMPLE_TRIPS } from "@/lib/sample-trips";
import type { Trip } from "@/lib/travel-types";

export default function TravelListPage() {
  const [trips] = useState<Trip[]>(SAMPLE_TRIPS);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Travel
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {trips.length} itinerar{trips.length === 1 ? "y" : "ies"}
            </p>
          </div>
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg border border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-200"
          >
            <Plus className="h-4 w-4" />
            New Trip
          </button>
        </div>

        {/* Trip grid */}
        <div className="grid gap-4 sm:grid-cols-2">
          {trips.map((trip) => (
            <TripCard key={trip.id} trip={trip} />
          ))}
        </div>

        {trips.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">
            <MapPin className="h-8 w-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No trips yet. Create your first itinerary.</p>
          </div>
        )}
      </div>
    </div>
  );
}
