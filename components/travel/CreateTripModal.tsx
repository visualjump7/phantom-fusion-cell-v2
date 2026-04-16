"use client";

import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import type { Trip } from "@/lib/travel-types";

interface CreateTripModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (trip: Trip) => void;
  editTrip?: Trip | null;   // if set, we're editing — pre-fill form
}

export function CreateTripModal({ open, onClose, onSave, editTrip }: CreateTripModalProps) {
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);

  const isEdit = !!editTrip;

  // Pre-fill when editing
  useEffect(() => {
    if (editTrip) {
      setName(editTrip.name);
      setStartDate(editTrip.startDate);
      setEndDate(editTrip.endDate);
    } else {
      setName("");
      setStartDate("");
      setEndDate("");
    }
  }, [editTrip, open]);

  // Focus name field on open
  useEffect(() => {
    if (open) setTimeout(() => nameRef.current?.focus(), 100);
  }, [open]);

  // Close on Esc
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const valid = name.trim() && startDate && endDate;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;

    const trip: Trip = {
      id: editTrip?.id || `trip-${Date.now()}`,
      name: name.trim(),
      organizationId: editTrip?.organizationId || "demo-org",
      startDate,
      endDate,
      status: "upcoming",
      events: editTrip?.events || [],
    };
    onSave(trip);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <form
        onSubmit={handleSubmit}
        className="relative z-10 w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-foreground">
            {isEdit ? "Edit Trip" : "New Trip"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Trip name
            </label>
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="European Summer Tour..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Start date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 [color-scheme:dark]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                End date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 [color-scheme:dark]"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!valid}
            className={`
              px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200
              ${valid
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-muted text-muted-foreground cursor-not-allowed"
              }
            `}
          >
            {isEdit ? "Save Changes" : "Create Trip"}
          </button>
        </div>
      </form>
    </div>
  );
}
