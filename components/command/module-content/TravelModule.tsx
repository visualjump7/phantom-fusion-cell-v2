"use client";

/**
 * Travel module — passive Mapbox itinerary visualization.
 *
 * List view: upcoming published trips. Detail view: Mapbox map of all legs
 * as connected pins (mint line, chronological order) + vertical timeline
 * below. No flight tracking, just documents + metadata.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  Plane,
  Hotel,
  Car,
  Utensils,
  Users,
  MapPin,
  Plus,
  FileText,
  Download,
  ChevronLeft,
  X,
  Trash2,
  Send,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEffectiveOrgId } from "@/lib/use-active-principal";
import { useRole } from "@/lib/use-role";
import { usePreview } from "@/lib/preview-context";
import { useActionGuard } from "@/lib/use-action-guard";
import {
  fetchItineraries,
  fetchItinerary,
  createItinerary,
  addLeg,
  deleteLeg,
  publishItinerary,
  uploadTravelDocument,
  getSignedDocumentUrl,
  type TravelItinerary,
  type TravelItineraryDetail,
  type LegType,
} from "@/lib/travel-service";

const LEG_ICONS: Record<LegType, typeof Plane> = {
  flight: Plane,
  hotel: Hotel,
  ground: Car,
  restaurant: Utensils,
  meeting: Users,
  custom: MapPin,
};

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtDateRange(start: string | null, end: string | null): string {
  if (!start && !end) return "Dates TBD";
  if (start && end) return `${fmtDate(start)} — ${fmtDate(end)}`;
  return fmtDate(start ?? end);
}

export function TravelModule() {
  const { orgId } = useEffectiveOrgId();
  const { userId, isStaff } = useRole();
  const preview = usePreview();
  const { blocked, guardClick } = useActionGuard();

  const principalId = preview.active ? preview.principalId : userId;
  const [trips, setTrips] = useState<TravelItinerary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<TravelItineraryDetail | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);

  const loadTrips = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    const rows = await fetchItineraries(orgId, {
      ...(isStaff && !preview.active ? {} : { status: "published" }),
      ...(preview.active && principalId ? { principalId } : {}),
    });
    setTrips(rows);
    setLoading(false);
  }, [orgId, isStaff, preview.active, principalId]);

  useEffect(() => {
    loadTrips();
  }, [loadTrips]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedDetail(null);
      return;
    }
    fetchItinerary(selectedId).then(setSelectedDetail);
  }, [selectedId]);

  if (selectedId && selectedDetail) {
    return (
      <TripDetailView
        itinerary={selectedDetail}
        onBack={() => setSelectedId(null)}
        canEdit={isStaff && !preview.active}
        onRefresh={async () => {
          const fresh = await fetchItinerary(selectedId);
          setSelectedDetail(fresh);
        }}
        guardClick={guardClick}
        blocked={blocked}
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-white/5 px-4 py-3">
        <h3 className="text-sm font-semibold text-white">Upcoming trips</h3>
        {isStaff && !preview.active && (
          <Button size="sm" onClick={() => setShowBuilder(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            New itinerary
          </Button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {loading ? (
          <p className="py-12 text-center text-sm text-white/50">Loading trips…</p>
        ) : trips.length === 0 ? (
          <p className="py-12 text-center text-sm text-white/50">
            No trips yet. {isStaff && "Create an itinerary to get started."}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {trips.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedId(t.id)}
                className="group rounded-xl border border-white/10 bg-white/[0.02] p-4 text-left transition hover:border-emerald-400/40 hover:bg-white/[0.04]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{t.title}</p>
                    <p className="mt-0.5 text-xs text-white/60">
                      {fmtDateRange(t.trip_start, t.trip_end)}
                    </p>
                  </div>
                  <span
                    className={
                      "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium " +
                      (t.status === "published"
                        ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30"
                        : t.status === "draft"
                          ? "bg-white/10 text-white/70"
                          : t.status === "cancelled"
                            ? "bg-red-500/15 text-red-300"
                            : "bg-blue-500/15 text-blue-300")
                    }
                  >
                    {t.status}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {showBuilder && (
        <NewItineraryModal
          orgId={orgId!}
          principalId={principalId}
          onClose={() => setShowBuilder(false)}
          onCreated={(id) => {
            setShowBuilder(false);
            setSelectedId(id);
            loadTrips();
          }}
        />
      )}
    </div>
  );
}

// ============================================
// Trip detail (map + legs + docs)
// ============================================

function TripDetailView({
  itinerary,
  onBack,
  canEdit,
  onRefresh,
  guardClick,
  blocked,
}: {
  itinerary: TravelItineraryDetail;
  onBack: () => void;
  canEdit: boolean;
  onRefresh: () => Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  guardClick: <T extends (...args: any[]) => any>(handler: T) => T;
  blocked: boolean;
}) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [showAddLeg, setShowAddLeg] = useState(false);

  const pinned = useMemo(
    () =>
      itinerary.legs
        .filter(
          (l) =>
            l.departure_lat !== null &&
            l.departure_lng !== null &&
            !Number.isNaN(l.departure_lat!) &&
            !Number.isNaN(l.departure_lng!)
        )
        .map((l) => ({
          id: l.id,
          label: l.departure_location || l.provider || l.leg_type,
          lat: l.departure_lat!,
          lng: l.departure_lng!,
        })),
    [itinerary]
  );

  useEffect(() => {
    if (!mapContainer.current) return;
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      console.warn("[travel] NEXT_PUBLIC_MAPBOX_TOKEN missing");
      return;
    }
    mapboxgl.accessToken = token;

    // Pick a reasonable default center
    const center: [number, number] =
      pinned.length > 0 ? [pinned[0].lng, pinned[0].lat] : [-40, 40];

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center,
      zoom: 2.5,
      attributionControl: false,
    });
    mapRef.current = map;

    map.on("load", () => {
      if (pinned.length === 0) return;

      const bounds = new mapboxgl.LngLatBounds();
      for (const p of pinned) {
        const el = document.createElement("div");
        el.style.cssText =
          "width:14px;height:14px;border-radius:9999px;background:#4ADE80;box-shadow:0 0 12px rgba(74,222,128,0.6);border:2px solid #0f172a;";
        new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat([p.lng, p.lat])
          .setPopup(new mapboxgl.Popup({ offset: 12 }).setText(p.label))
          .addTo(map);
        bounds.extend([p.lng, p.lat]);
      }

      if (pinned.length >= 2) {
        map.addSource("route", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: pinned.map((p) => [p.lng, p.lat]),
            },
          },
        });
        map.addLayer({
          id: "route-line",
          type: "line",
          source: "route",
          paint: {
            "line-color": "#4ADE80",
            "line-opacity": 0.65,
            "line-width": 2,
            "line-dasharray": [0.5, 1.5],
          },
        });
      }

      map.fitBounds(bounds, { padding: 60, maxZoom: 6, animate: false });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [pinned]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div>
            <h3 className="text-sm font-semibold text-white">{itinerary.title}</h3>
            <p className="text-xs text-white/50">
              {fmtDateRange(itinerary.trip_start, itinerary.trip_end)} · {itinerary.legs.length} legs
            </p>
          </div>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            {itinerary.status === "draft" && (
              <Button
                size="sm"
                onClick={guardClick(async () => {
                  const res = await publishItinerary(itinerary.id);
                  if (res.success) onRefresh();
                })}
                disabled={blocked}
                className="gap-1.5"
              >
                <Send className="h-3.5 w-3.5" />
                Publish
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowAddLeg(true)}
              disabled={blocked}
              className="gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Add leg
            </Button>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div ref={mapContainer} className="h-[280px] w-full bg-black md:h-[360px]" />

        <div className="p-4">
          <h4 className="mb-3 text-xs font-medium uppercase tracking-wide text-white/50">
            Timeline
          </h4>
          {itinerary.legs.length === 0 ? (
            <p className="py-6 text-center text-sm text-white/50">
              No legs yet. {canEdit && "Add a flight, hotel, or ground transport to build the trip."}
            </p>
          ) : (
            <ol className="space-y-3">
              {itinerary.legs.map((leg) => {
                const Icon = LEG_ICONS[leg.leg_type] ?? MapPin;
                const legDocs = itinerary.documents.filter((d) => d.leg_id === leg.id);
                return (
                  <li key={leg.id}>
                    <Card className="border-white/10 bg-white/[0.02]">
                      <CardContent className="p-3">
                        <div className="flex items-start gap-3">
                          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
                            <Icon className="h-4 w-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-white">
                              {leg.provider || leg.leg_type}
                              {leg.departure_location && leg.arrival_location && (
                                <> · {leg.departure_location} → {leg.arrival_location}</>
                              )}
                            </p>
                            <p className="mt-0.5 text-xs text-white/60">
                              {leg.departure_time && fmtDate(leg.departure_time)}
                              {leg.arrival_time && ` → ${fmtDate(leg.arrival_time)}`}
                              {leg.confirmation_number && ` · #${leg.confirmation_number}`}
                            </p>
                            {leg.details && (
                              <p className="mt-1 whitespace-pre-wrap text-xs text-white/70">
                                {leg.details}
                              </p>
                            )}
                            {(leg.contact_name || leg.contact_phone) && (
                              <p className="mt-1 text-xs text-white/60">
                                {leg.contact_name}
                                {leg.contact_phone && ` · ${leg.contact_phone}`}
                              </p>
                            )}
                            {legDocs.length > 0 && (
                              <ul className="mt-2 space-y-1">
                                {legDocs.map((d) => (
                                  <DocRow key={d.id} doc={d} />
                                ))}
                              </ul>
                            )}
                          </div>
                          {canEdit && (
                            <button
                              onClick={guardClick(async () => {
                                if (!confirm("Delete this leg?")) return;
                                await deleteLeg(leg.id);
                                onRefresh();
                              })}
                              disabled={blocked}
                              className="text-white/50 hover:text-red-400 disabled:opacity-40"
                              aria-label="Delete leg"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </li>
                );
              })}
            </ol>
          )}

          {itinerary.documents.filter((d) => !d.leg_id).length > 0 && (
            <div className="mt-6">
              <h4 className="mb-3 text-xs font-medium uppercase tracking-wide text-white/50">
                Trip documents
              </h4>
              <ul className="space-y-1">
                {itinerary.documents
                  .filter((d) => !d.leg_id)
                  .map((d) => (
                    <DocRow key={d.id} doc={d} />
                  ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {showAddLeg && (
        <AddLegModal
          orgId={itinerary.organization_id}
          itineraryId={itinerary.id}
          nextPosition={itinerary.legs.length}
          onClose={() => setShowAddLeg(false)}
          onAdded={() => {
            setShowAddLeg(false);
            onRefresh();
          }}
        />
      )}
    </div>
  );
}

function DocRow({ doc }: { doc: TravelItineraryDetail["documents"][number] }) {
  async function open() {
    const url = await getSignedDocumentUrl(doc.storage_path);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }
  return (
    <li>
      <button
        onClick={open}
        className="flex w-full items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-left text-xs text-white transition hover:border-emerald-400/40"
      >
        <FileText className="h-4 w-4 shrink-0 text-emerald-400" />
        <span className="flex-1 truncate">{doc.title}</span>
        <Download className="h-3.5 w-3.5 text-white/50" />
      </button>
    </li>
  );
}

// ============================================
// New itinerary modal
// ============================================

function NewItineraryModal({
  orgId,
  principalId,
  onClose,
  onCreated,
}: {
  orgId: string;
  principalId: string | null;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [tripStart, setTripStart] = useState("");
  const [tripEnd, setTripEnd] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!title.trim()) return;
    setSaving(true);
    const res = await createItinerary({
      organization_id: orgId,
      principal_id: principalId,
      title: title.trim(),
      trip_start: tripStart || undefined,
      trip_end: tripEnd || undefined,
    });
    setSaving(false);
    if (res.success && res.id) onCreated(res.id);
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-md rounded-2xl border border-emerald-400/30 bg-black p-5">
        <div className="mb-4 flex items-center justify-between">
          <h4 className="text-base font-semibold text-white">New itinerary</h4>
          <button onClick={onClose} aria-label="Close" className="text-white/60 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3">
          <Input placeholder="Title (e.g., Geneva Trip)" value={title} onChange={(e) => setTitle(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-white/60">
              Start
              <Input type="date" value={tripStart} onChange={(e) => setTripStart(e.target.value)} />
            </label>
            <label className="text-xs text-white/60">
              End
              <Input type="date" value={tripEnd} onChange={(e) => setTripEnd(e.target.value)} />
            </label>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving || !title.trim()}>
            {saving ? "Creating…" : "Create"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Add leg modal (minimal — lat/lng entered manually)
// ============================================

function AddLegModal({
  orgId,
  itineraryId,
  nextPosition,
  onClose,
  onAdded,
}: {
  orgId: string;
  itineraryId: string;
  nextPosition: number;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [type, setType] = useState<LegType>("flight");
  const [provider, setProvider] = useState("");
  const [depLoc, setDepLoc] = useState("");
  const [depLat, setDepLat] = useState("");
  const [depLng, setDepLng] = useState("");
  const [arrLoc, setArrLoc] = useState("");
  const [arrLat, setArrLat] = useState("");
  const [arrLng, setArrLng] = useState("");
  const [depTime, setDepTime] = useState("");
  const [arrTime, setArrTime] = useState("");
  const [details, setDetails] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!provider.trim() && !depLoc.trim()) return;
    setSaving(true);
    const res = await addLeg({
      itinerary_id: itineraryId,
      organization_id: orgId,
      leg_type: type,
      position: nextPosition,
      provider: provider.trim() || undefined,
      confirmation_number: confirmation.trim() || undefined,
      departure_location: depLoc.trim() || undefined,
      departure_lat: depLat ? parseFloat(depLat) : undefined,
      departure_lng: depLng ? parseFloat(depLng) : undefined,
      arrival_location: arrLoc.trim() || undefined,
      arrival_lat: arrLat ? parseFloat(arrLat) : undefined,
      arrival_lng: arrLng ? parseFloat(arrLng) : undefined,
      departure_time: depTime || undefined,
      arrival_time: arrTime || undefined,
      details: details.trim() || undefined,
    });
    if (res.success && res.id && file) {
      await uploadTravelDocument({
        itineraryId,
        organizationId: orgId,
        file,
        legId: res.id,
      });
    }
    setSaving(false);
    if (res.success) onAdded();
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-emerald-400/30 bg-black p-5">
        <div className="mb-4 flex items-center justify-between">
          <h4 className="text-base font-semibold text-white">Add leg</h4>
          <button onClick={onClose} aria-label="Close" className="text-white/60 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as LegType)}
            className="w-full rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-sm text-white"
          >
            <option value="flight">Flight</option>
            <option value="hotel">Hotel</option>
            <option value="ground">Ground</option>
            <option value="restaurant">Restaurant</option>
            <option value="meeting">Meeting</option>
            <option value="custom">Custom</option>
          </select>
          <Input placeholder="Provider (e.g., NetJets, Ritz Geneva)" value={provider} onChange={(e) => setProvider(e.target.value)} />
          <Input placeholder="Confirmation number" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
          <div className="grid grid-cols-3 gap-2">
            <Input placeholder="Dep location" value={depLoc} onChange={(e) => setDepLoc(e.target.value)} />
            <Input placeholder="Dep lat" value={depLat} onChange={(e) => setDepLat(e.target.value)} />
            <Input placeholder="Dep lng" value={depLng} onChange={(e) => setDepLng(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Input placeholder="Arr location" value={arrLoc} onChange={(e) => setArrLoc(e.target.value)} />
            <Input placeholder="Arr lat" value={arrLat} onChange={(e) => setArrLat(e.target.value)} />
            <Input placeholder="Arr lng" value={arrLng} onChange={(e) => setArrLng(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-white/60">
              Departure
              <Input type="datetime-local" value={depTime} onChange={(e) => setDepTime(e.target.value)} />
            </label>
            <label className="text-xs text-white/60">
              Arrival
              <Input type="datetime-local" value={arrTime} onChange={(e) => setArrTime(e.target.value)} />
            </label>
          </div>
          <textarea
            placeholder="Details / notes"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-sm text-white"
            rows={3}
          />
          <label className="block text-xs text-white/60">
            Attach document (optional)
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-1 block w-full text-xs text-white/80"
            />
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Add leg"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default TravelModule;
