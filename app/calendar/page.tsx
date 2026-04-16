"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, MapPin } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { TripCard } from "@/components/travel/TripCard";
import { CreateTripModal } from "@/components/travel/CreateTripModal";
import { ConfirmDeleteDialog } from "@/components/travel/ConfirmDeleteDialog";
import { useTravel } from "@/lib/travel-store";
import type { Trip } from "@/lib/travel-types";

export default function TravelListPage() {
  const { trips, addTrip, updateTrip, deleteTrip } = useTravel();
  const router = useRouter();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
  const [deletingTrip, setDeletingTrip] = useState<Trip | null>(null);

  function handleSaveTrip(trip: Trip) {
    if (editingTrip) {
      updateTrip(trip.id, { name: trip.name, startDate: trip.startDate, endDate: trip.endDate });
    } else {
      addTrip(trip);
      router.push(`/calendar/${trip.id}`);
    }
    setEditingTrip(null);
  }

  function handleEditTrip(trip: Trip) {
    setEditingTrip(trip);
    setModalOpen(true);
  }

  function handleDeleteTrip(trip: Trip) {
    setDeletingTrip(trip);
  }

  function confirmDelete() {
    if (deletingTrip) {
      deleteTrip(deletingTrip.id);
      setDeletingTrip(null);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
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
            onClick={() => { setEditingTrip(null); setModalOpen(true); }}
            className="flex items-center gap-2 rounded-lg border border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-200"
          >
            <Plus className="h-4 w-4" />
            New Trip
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {trips.map((trip) => (
            <TripCard
              key={trip.id}
              trip={trip}
              onEdit={handleEditTrip}
              onDelete={handleDeleteTrip}
            />
          ))}
        </div>

        {trips.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">
            <MapPin className="h-8 w-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No trips yet. Create your first itinerary.</p>
          </div>
        )}
      </div>

      <CreateTripModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingTrip(null); }}
        onSave={handleSaveTrip}
        editTrip={editingTrip}
      />

      <ConfirmDeleteDialog
        open={!!deletingTrip}
        title={`Delete "${deletingTrip?.name}"?`}
        description="This will remove the trip and all its events. This action cannot be undone."
        onConfirm={confirmDelete}
        onCancel={() => setDeletingTrip(null)}
      />
    </div>
  );
}
