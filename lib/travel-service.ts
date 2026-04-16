import { supabase } from "@/lib/supabase";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// ============================================
// Types
// ============================================

export type TravelStatus = "draft" | "published" | "updated" | "completed" | "cancelled";
export type LegType = "flight" | "hotel" | "ground" | "restaurant" | "meeting" | "custom";

export interface TravelItinerary {
  id: string;
  organization_id: string;
  principal_id: string | null;
  asset_id: string | null;
  title: string;
  trip_start: string | null;
  trip_end: string | null;
  status: TravelStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TravelLeg {
  id: string;
  itinerary_id: string;
  organization_id: string;
  leg_type: LegType;
  provider: string | null;
  confirmation_number: string | null;
  departure_location: string | null;
  departure_lat: number | null;
  departure_lng: number | null;
  arrival_location: string | null;
  arrival_lat: number | null;
  arrival_lng: number | null;
  departure_time: string | null;
  arrival_time: string | null;
  details: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  notes: string | null;
  position: number;
  created_at: string;
}

export interface TravelDocument {
  id: string;
  itinerary_id: string;
  organization_id: string;
  leg_id: string | null;
  title: string;
  document_type: string | null;
  storage_path: string;
  file_name: string | null;
  file_size: number | null;
  ai_accessible: boolean;
  uploaded_by: string | null;
  created_at: string;
}

export interface TravelItineraryDetail extends TravelItinerary {
  legs: TravelLeg[];
  documents: TravelDocument[];
}

// ============================================
// Fetch
// ============================================

export interface FetchItinerariesOptions {
  status?: TravelStatus;
  principalId?: string;
  startDate?: string;
  endDate?: string;
}

export async function fetchItineraries(
  orgId: string,
  options: FetchItinerariesOptions = {}
): Promise<TravelItinerary[]> {
  let q = db
    .from("travel_itineraries")
    .select("*")
    .eq("organization_id", orgId)
    .order("trip_start", { ascending: true, nullsFirst: false });

  if (options.status) q = q.eq("status", options.status);
  if (options.principalId) q = q.eq("principal_id", options.principalId);
  if (options.startDate) q = q.gte("trip_start", options.startDate);
  if (options.endDate) q = q.lte("trip_end", options.endDate);

  const { data, error } = await q;
  if (error) {
    console.error("[fetchItineraries]", error);
    return [];
  }
  return data || [];
}

export async function fetchItinerary(id: string): Promise<TravelItineraryDetail | null> {
  const [itinRes, legsRes, docsRes] = await Promise.all([
    db.from("travel_itineraries").select("*").eq("id", id).maybeSingle(),
    db.from("travel_legs").select("*").eq("itinerary_id", id).order("position"),
    db.from("travel_documents").select("*").eq("itinerary_id", id).order("created_at"),
  ]);
  if (itinRes.error || !itinRes.data) {
    if (itinRes.error) console.error("[fetchItinerary]", itinRes.error);
    return null;
  }
  return {
    ...itinRes.data,
    legs: legsRes.data || [],
    documents: docsRes.data || [],
  };
}

// ============================================
// Create / update / delete
// ============================================

export async function createItinerary(input: {
  organization_id: string;
  principal_id: string | null;
  title: string;
  trip_start?: string;
  trip_end?: string;
  asset_id?: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await db
    .from("travel_itineraries")
    .insert({
      ...input,
      status: "draft",
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (error) return { success: false, error: error.message };
  return { success: true, id: data.id };
}

export async function updateItinerary(
  id: string,
  patch: Partial<Pick<TravelItinerary, "title" | "trip_start" | "trip_end" | "notes" | "status" | "asset_id">>
): Promise<{ success: boolean; error?: string }> {
  const { error } = await db
    .from("travel_itineraries")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function deleteItinerary(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await db.from("travel_itineraries").delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function addLeg(input: {
  itinerary_id: string;
  organization_id: string;
  leg_type: LegType;
  position: number;
  provider?: string;
  confirmation_number?: string;
  departure_location?: string;
  departure_lat?: number;
  departure_lng?: number;
  arrival_location?: string;
  arrival_lat?: number;
  arrival_lng?: number;
  departure_time?: string;
  arrival_time?: string;
  details?: string;
  contact_name?: string;
  contact_phone?: string;
  notes?: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const { data, error } = await db
    .from("travel_legs")
    .insert(input)
    .select("id")
    .single();
  if (error) return { success: false, error: error.message };
  return { success: true, id: data.id };
}

export async function updateLeg(
  id: string,
  patch: Partial<Omit<TravelLeg, "id" | "itinerary_id" | "organization_id" | "created_at">>
): Promise<{ success: boolean; error?: string }> {
  const { error } = await db.from("travel_legs").update(patch).eq("id", id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function deleteLeg(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await db.from("travel_legs").delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function reorderLegs(
  updates: Array<{ id: string; position: number }>
): Promise<{ success: boolean; error?: string }> {
  for (const u of updates) {
    // eslint-disable-next-line no-await-in-loop
    const { error } = await db.from("travel_legs").update({ position: u.position }).eq("id", u.id);
    if (error) return { success: false, error: error.message };
  }
  return { success: true };
}

// ============================================
// Documents
// ============================================

export async function uploadTravelDocument(input: {
  itineraryId: string;
  organizationId: string;
  file: File;
  legId?: string | null;
  type?: string;
  title?: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const ts = Date.now();
  const path = `${input.organizationId}/${input.itineraryId}/${ts}-${input.file.name}`;
  const { error: upErr } = await db.storage
    .from("travel-documents")
    .upload(path, input.file, { cacheControl: "3600", upsert: false });
  if (upErr) return { success: false, error: upErr.message };

  const { data, error } = await db
    .from("travel_documents")
    .insert({
      itinerary_id: input.itineraryId,
      organization_id: input.organizationId,
      leg_id: input.legId ?? null,
      title: input.title || input.file.name,
      document_type: input.type || null,
      storage_path: path,
      file_name: input.file.name,
      file_size: input.file.size,
      ai_accessible: true,
      uploaded_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (error) return { success: false, error: error.message };
  return { success: true, id: data.id };
}

export async function setDocumentAiAccessible(
  id: string,
  accessible: boolean
): Promise<{ success: boolean; error?: string }> {
  const { error } = await db
    .from("travel_documents")
    .update({ ai_accessible: accessible })
    .eq("id", id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function getSignedDocumentUrl(
  storagePath: string
): Promise<string | null> {
  const { data, error } = await db.storage
    .from("travel-documents")
    .createSignedUrl(storagePath, 60 * 15);
  if (error) {
    console.error("[getSignedDocumentUrl]", error);
    return null;
  }
  return data?.signedUrl ?? null;
}

// ============================================
// Publish
// ============================================

export async function publishItinerary(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const itin = await fetchItinerary(id);
  if (!itin) return { success: false, error: "Itinerary not found" };

  const { error } = await db
    .from("travel_itineraries")
    .update({ status: "published", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { success: false, error: error.message };

  // Create a Comms message for the principal announcing the trip.
  if (itin.principal_id) {
    try {
      await db.from("messages").insert({
        organization_id: itin.organization_id,
        sender_id: user?.id ?? null,
        type: "update",
        priority: "normal",
        title: `Itinerary published: ${itin.title}`,
        body: `Your itinerary "${itin.title}" has been published with ${itin.legs.length} legs. Open Travel to review.`,
        asset_id: itin.asset_id,
      });
    } catch (err) {
      console.warn("[publishItinerary] message create failed", err);
    }
  }

  return { success: true };
}
