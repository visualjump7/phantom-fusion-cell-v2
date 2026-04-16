"use client";

import { useState } from "react";
import { Plus, Plane, Car, Building2, Utensils } from "lucide-react";
import type { ItineraryEvent, EventType } from "@/lib/travel-types";
import { EVENT_META } from "@/lib/travel-types";
import { AirportSearch } from "./AirportSearch";
import type { Airport } from "@/lib/airports";

interface AddEventFormProps {
  tripId: string;
  onAddEvent: (event: ItineraryEvent) => void;
}

const TABS: { type: EventType; Icon: typeof Plane }[] = [
  { type: "flight", Icon: Plane },
  { type: "ground", Icon: Car },
  { type: "hotel", Icon: Building2 },
  { type: "reservation", Icon: Utensils },
];

export function AddEventForm({ tripId, onAddEvent }: AddEventFormProps) {
  const [activeTab, setActiveTab] = useState<EventType>("flight");

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 px-4 pt-4 pb-3 border-b border-border">
        <div className="flex items-center gap-2 mb-3">
          <Plus className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Add Event</h2>
        </div>

        {/* Type tabs */}
        <div className="flex gap-1 rounded-lg bg-muted/30 p-1">
          {TABS.map(({ type, Icon }) => (
            <button
              key={type}
              type="button"
              onClick={() => setActiveTab(type)}
              className={`
                flex-1 flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-medium transition-all
                ${activeTab === type
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
                }
              `}
            >
              <Icon className="h-3 w-3" style={activeTab === type ? { color: EVENT_META[type].color } : undefined} />
              <span className="hidden sm:inline">{EVENT_META[type].label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Form body — switches per tab */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "flight" && <FlightForm tripId={tripId} onAdd={onAddEvent} />}
        {activeTab === "ground" && <GroundForm tripId={tripId} onAdd={onAddEvent} />}
        {activeTab === "hotel" && <HotelForm tripId={tripId} onAdd={onAddEvent} />}
        {activeTab === "reservation" && <ReservationForm tripId={tripId} onAdd={onAddEvent} />}
      </div>
    </div>
  );
}

// ── Shared field components ─────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50";
const textareaCls = `${inputCls} resize-none`;

function SubmitButton({ disabled }: { disabled: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className={`
        w-full flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all duration-200
        ${disabled
          ? "border-border text-muted-foreground cursor-not-allowed opacity-50"
          : "border-primary text-primary hover:bg-primary hover:text-primary-foreground cursor-pointer"
        }
      `}
    >
      <Plus className="h-4 w-4" />
      Add Event
    </button>
  );
}

// ── Flight form ─────────────────────────────────────────────────

function FlightForm({ tripId, onAdd }: { tripId: string; onAdd: (e: ItineraryEvent) => void }) {
  const [from, setFrom] = useState<Airport | null>(null);
  const [to, setTo] = useState<Airport | null>(null);
  const [date, setDate] = useState("");
  const [depTime, setDepTime] = useState("");
  const [arrTime, setArrTime] = useState("");
  const [airline, setAirline] = useState("");
  const [flightNum, setFlightNum] = useState("");
  const [tailNum, setTailNum] = useState("");
  const [notes, setNotes] = useState("");

  const valid = from && to && date && depTime && arrTime;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    onAdd({
      id: `ev-${Date.now()}`, tripId, type: "flight", status: "upcoming",
      startTime: `${date}T${depTime}:00`, endTime: `${date}T${arrTime}:00`,
      departureAirport: from, arrivalAirport: to,
      airline: airline || undefined, flightNumber: flightNum || undefined,
      tailNumber: tailNum || undefined, notes: notes || undefined,
    });
    setFrom(null); setTo(null); setDate(""); setDepTime(""); setArrTime("");
    setAirline(""); setFlightNum(""); setTailNum(""); setNotes("");
  }

  return (
    <form onSubmit={submit} className="p-4 space-y-3">
      <AirportSearch label="From" value={from} onChange={setFrom} placeholder="Departure airport..." />
      <AirportSearch label="To" value={to} onChange={setTo} placeholder="Arrival airport..." />
      <Field label="Date"><input type="date" value={date} onChange={e => setDate(e.target.value)} className={`${inputCls} [color-scheme:dark]`} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Departure"><input type="time" value={depTime} onChange={e => setDepTime(e.target.value)} className={`${inputCls} [color-scheme:dark]`} /></Field>
        <Field label="Arrival"><input type="time" value={arrTime} onChange={e => setArrTime(e.target.value)} className={`${inputCls} [color-scheme:dark]`} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Airline"><input type="text" value={airline} onChange={e => setAirline(e.target.value)} placeholder="Optional" className={inputCls} /></Field>
        <Field label="Flight #"><input type="text" value={flightNum} onChange={e => setFlightNum(e.target.value)} placeholder="Optional" className={inputCls} /></Field>
      </div>
      <Field label="Tail #"><input type="text" value={tailNum} onChange={e => setTailNum(e.target.value)} placeholder="Optional" className={inputCls} /></Field>
      <Field label="Notes"><textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Catering, special instructions..." rows={2} className={textareaCls} /></Field>
      <SubmitButton disabled={!valid} />
    </form>
  );
}

// ── Ground form ─────────────────────────────────────────────────

function GroundForm({ tripId, onAdd }: { tripId: string; onAdd: (e: ItineraryEvent) => void }) {
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [company, setCompany] = useState("");
  const [notes, setNotes] = useState("");

  const valid = pickup && dropoff && date && time;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    onAdd({
      id: `ev-${Date.now()}`, tripId, type: "ground", status: "upcoming",
      startTime: `${date}T${time}:00`, endTime: `${date}T${endTime || time}:00`,
      pickupLocation: pickup, dropoffLocation: dropoff,
      vehicleType: vehicle || undefined, driverOrCompany: company || undefined,
      notes: notes || undefined,
    });
    setPickup(""); setDropoff(""); setDate(""); setTime(""); setEndTime("");
    setVehicle(""); setCompany(""); setNotes("");
  }

  return (
    <form onSubmit={submit} className="p-4 space-y-3">
      <Field label="Pickup location"><input type="text" value={pickup} onChange={e => setPickup(e.target.value)} placeholder="Address or landmark..." className={inputCls} /></Field>
      <Field label="Dropoff location"><input type="text" value={dropoff} onChange={e => setDropoff(e.target.value)} placeholder="Address or landmark..." className={inputCls} /></Field>
      <Field label="Date"><input type="date" value={date} onChange={e => setDate(e.target.value)} className={`${inputCls} [color-scheme:dark]`} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Pickup time"><input type="time" value={time} onChange={e => setTime(e.target.value)} className={`${inputCls} [color-scheme:dark]`} /></Field>
        <Field label="Arrival time"><input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className={`${inputCls} [color-scheme:dark]`} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Vehicle type">
          <select value={vehicle} onChange={e => setVehicle(e.target.value)} className={inputCls}>
            <option value="">Select...</option>
            <option value="sedan">Sedan</option>
            <option value="suv">SUV</option>
            <option value="van">Van / Sprinter</option>
            <option value="helicopter">Helicopter</option>
            <option value="yacht">Yacht / Boat</option>
            <option value="other">Other</option>
          </select>
        </Field>
        <Field label="Driver / Company"><input type="text" value={company} onChange={e => setCompany(e.target.value)} placeholder="Optional" className={inputCls} /></Field>
      </div>
      <Field label="Notes"><textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Meet & greet details, instructions..." rows={2} className={textareaCls} /></Field>
      <SubmitButton disabled={!valid} />
    </form>
  );
}

// ── Hotel form ──────────────────────────────────────────────────

function HotelForm({ tripId, onAdd }: { tripId: string; onAdd: (e: ItineraryEvent) => void }) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [room, setRoom] = useState("");
  const [conf, setConf] = useState("");
  const [notes, setNotes] = useState("");

  const valid = name && checkIn && checkOut;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    onAdd({
      id: `ev-${Date.now()}`, tripId, type: "hotel", status: "upcoming",
      startTime: `${checkIn}T15:00:00`, endTime: `${checkOut}T11:00:00`,
      propertyName: name, propertyAddress: address || undefined,
      roomType: room || undefined, confirmationNumber: conf || undefined,
      notes: notes || undefined,
    });
    setName(""); setAddress(""); setCheckIn(""); setCheckOut("");
    setRoom(""); setConf(""); setNotes("");
  }

  return (
    <form onSubmit={submit} className="p-4 space-y-3">
      <Field label="Property name"><input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Hotel or property..." className={inputCls} /></Field>
      <Field label="Address"><input type="text" value={address} onChange={e => setAddress(e.target.value)} placeholder="Full address..." className={inputCls} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Check-in"><input type="date" value={checkIn} onChange={e => setCheckIn(e.target.value)} className={`${inputCls} [color-scheme:dark]`} /></Field>
        <Field label="Check-out"><input type="date" value={checkOut} onChange={e => setCheckOut(e.target.value)} className={`${inputCls} [color-scheme:dark]`} /></Field>
      </div>
      <Field label="Room type"><input type="text" value={room} onChange={e => setRoom(e.target.value)} placeholder="Suite, deluxe, etc..." className={inputCls} /></Field>
      <Field label="Confirmation #"><input type="text" value={conf} onChange={e => setConf(e.target.value)} placeholder="Optional" className={inputCls} /></Field>
      <Field label="Notes"><textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Special requests, late check-out..." rows={2} className={textareaCls} /></Field>
      <SubmitButton disabled={!valid} />
    </form>
  );
}

// ── Reservation form ────────────────────────────────────────────

function ReservationForm({ tripId, onAdd }: { tripId: string; onAdd: (e: ItineraryEvent) => void }) {
  const [venue, setVenue] = useState("");
  const [address, setAddress] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [party, setParty] = useState("");
  const [conf, setConf] = useState("");
  const [notes, setNotes] = useState("");

  const valid = venue && date && time;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    onAdd({
      id: `ev-${Date.now()}`, tripId, type: "reservation", status: "upcoming",
      startTime: `${date}T${time}:00`, endTime: `${date}T${endTime || time}:00`,
      venueName: venue, venueAddress: address || undefined,
      partySize: party ? parseInt(party, 10) : undefined,
      reservationConfirmation: conf || undefined,
      notes: notes || undefined,
    });
    setVenue(""); setAddress(""); setDate(""); setTime(""); setEndTime("");
    setParty(""); setConf(""); setNotes("");
  }

  return (
    <form onSubmit={submit} className="p-4 space-y-3">
      <Field label="Venue name"><input type="text" value={venue} onChange={e => setVenue(e.target.value)} placeholder="Restaurant, club, spa..." className={inputCls} /></Field>
      <Field label="Address"><input type="text" value={address} onChange={e => setAddress(e.target.value)} placeholder="Full address..." className={inputCls} /></Field>
      <Field label="Date"><input type="date" value={date} onChange={e => setDate(e.target.value)} className={`${inputCls} [color-scheme:dark]`} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Time"><input type="time" value={time} onChange={e => setTime(e.target.value)} className={`${inputCls} [color-scheme:dark]`} /></Field>
        <Field label="End time"><input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className={`${inputCls} [color-scheme:dark]`} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Party size"><input type="number" value={party} onChange={e => setParty(e.target.value)} placeholder="Guests" min="1" className={inputCls} /></Field>
        <Field label="Confirmation #"><input type="text" value={conf} onChange={e => setConf(e.target.value)} placeholder="Optional" className={inputCls} /></Field>
      </div>
      <Field label="Notes"><textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Dietary restrictions, table requests..." rows={2} className={textareaCls} /></Field>
      <SubmitButton disabled={!valid} />
    </form>
  );
}
