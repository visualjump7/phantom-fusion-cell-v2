"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  ChevronDown,
  Check,
  Loader2,
  MapPin,
  Globe,
  AlertCircle,
  Navigation,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// ─── Country list ───────────────────────────────────────────────
const COUNTRIES = [
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "CH", name: "Switzerland" },
  { code: "SG", name: "Singapore" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "HK", name: "Hong Kong" },
  { code: "JP", name: "Japan" },
  { code: "NZ", name: "New Zealand" },
  { code: "IE", name: "Ireland" },
  { code: "LU", name: "Luxembourg" },
  { code: "NL", name: "Netherlands" },
  { code: "IT", name: "Italy" },
  { code: "ES", name: "Spain" },
  { code: "BR", name: "Brazil" },
  { code: "MX", name: "Mexico" },
  { code: "IN", name: "India" },
  { code: "CN", name: "China" },
  { code: "KR", name: "South Korea" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "ZA", name: "South Africa" },
  { code: "NO", name: "Norway" },
  { code: "SE", name: "Sweden" },
  { code: "DK", name: "Denmark" },
  { code: "IL", name: "Israel" },
  { code: "QA", name: "Qatar" },
  { code: "BM", name: "Bermuda" },
  { code: "KY", name: "Cayman Islands" },
  { code: "VG", name: "British Virgin Islands" },
  { code: "PA", name: "Panama" },
  { code: "BS", name: "Bahamas" },
  { code: "MC", name: "Monaco" },
].sort((a, b) => a.name.localeCompare(b.name));

// ─── Types ──────────────────────────────────────────────────────
export interface LocationData {
  latitude: number | null;
  longitude: number | null;
  address_line: string;
  city: string;
  state_province: string;
  country: string;
  location_type: string;
}

export interface LocationEditorProps {
  latitude: number | null;
  longitude: number | null;
  addressLine: string;
  city: string;
  stateProvince: string;
  country: string;
  locationType: string;
  onChange: (location: LocationData) => void;
  /** If true, show compact summary with "Edit Location" expand toggle */
  collapsible?: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────
function detectLocationType(
  country: string,
  city: string,
  addressLine: string,
  lat: number | null,
  lng: number | null
): string {
  const hasCoords = lat != null && lng != null;
  const hasAddress = !!addressLine.trim();
  const hasCity = !!city.trim();
  const hasCountry = !!country.trim();

  if (hasCoords || (hasAddress && hasCity)) return "precise";
  if (hasCity && hasCountry) return "city";
  if (hasCountry) return "country";
  return "unlocated";
}

function getCountryName(code: string): string {
  return COUNTRIES.find((c) => c.code === code)?.name || code;
}

// ─── Mini Map Preview (static image, no heavy JS) ──────────────
function MiniMapPreview({
  lat,
  lng,
}: {
  lat: number;
  lng: number;
}) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return null;

  // Use Mapbox Static Images API — lightweight, no JS map needed
  const url = `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/pin-s+4ade80(${lng},${lat})/${lng},${lat},10,0/400x200@2x?access_token=${token}`;

  return (
    <div className="mt-2 rounded-lg overflow-hidden border border-border">
      <img
        src={url}
        alt="Location preview"
        className="w-full h-[200px] object-cover"
        loading="lazy"
      />
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────
export function LocationEditor({
  latitude,
  longitude,
  addressLine,
  city,
  stateProvince,
  country,
  locationType,
  onChange,
  collapsible = false,
}: LocationEditorProps) {
  const [showManualCoords, setShowManualCoords] = useState(
    !!(latitude || longitude)
  );
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodeStatus, setGeocodeStatus] = useState<
    "idle" | "success" | "error"
  >("idle");
  const [geocodeMessage, setGeocodeMessage] = useState("");
  const [isExpanded, setIsExpanded] = useState(!collapsible);
  const [otherCountry, setOtherCountry] = useState("");
  const isOther =
    country && !COUNTRIES.find((c) => c.code === country);

  // Clear geocode status after 5s
  useEffect(() => {
    if (geocodeStatus !== "idle") {
      const t = setTimeout(() => setGeocodeStatus("idle"), 5000);
      return () => clearTimeout(t);
    }
  }, [geocodeStatus]);

  // ── Emit changes ──────────────────────────────────────────────
  const emit = useCallback(
    (partial: Partial<{
      country: string;
      city: string;
      state_province: string;
      address_line: string;
      latitude: number | null;
      longitude: number | null;
    }>) => {
      const next = {
        country: partial.country ?? country,
        city: partial.city ?? city,
        state_province: partial.state_province ?? stateProvince,
        address_line: partial.address_line ?? addressLine,
        latitude: partial.latitude !== undefined ? partial.latitude : latitude,
        longitude:
          partial.longitude !== undefined ? partial.longitude : longitude,
      };
      const lt = detectLocationType(
        next.country,
        next.city,
        next.address_line,
        next.latitude,
        next.longitude
      );
      onChange({ ...next, location_type: lt });
    },
    [country, city, stateProvince, addressLine, latitude, longitude, onChange]
  );

  // ── Geocode ───────────────────────────────────────────────────
  const handleGeocode = async () => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) return;

    setIsGeocoding(true);
    setGeocodeStatus("idle");
    try {
      const parts = [addressLine, city, stateProvince, country].filter(Boolean);
      const query = encodeURIComponent(parts.join(", "));
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${token}&limit=1`
      );
      const data = await res.json();
      if (data.features?.length > 0) {
        const [lng, lat] = data.features[0].center;
        emit({ latitude: lat, longitude: lng });
        setShowManualCoords(true);
        setGeocodeStatus("success");
        const placeName = data.features[0].place_name || `${city}, ${country}`;
        setGeocodeMessage(`Location found — ${placeName}`);
      } else {
        setGeocodeStatus("error");
        setGeocodeMessage(
          "Location not found. Try a different address or enter coordinates manually."
        );
      }
    } catch {
      setGeocodeStatus("error");
      setGeocodeMessage("Geocoding failed. Check your connection and try again.");
    } finally {
      setIsGeocoding(false);
    }
  };

  // ── Summary line for collapsible mode ─────────────────────────
  const summaryText = (() => {
    if (latitude && longitude && city && country)
      return `${city}${stateProvince ? `, ${stateProvince}` : ""}, ${getCountryName(country)}`;
    if (city && country) return `${city}, ${getCountryName(country)}`;
    if (country) return getCountryName(country);
    return "No location set";
  })();

  const hasLocation = locationType !== "unlocated" && country;

  // ── Collapsible wrapper ───────────────────────────────────────
  if (collapsible && !isExpanded) {
    return (
      <div className="border-t border-border pt-3 mt-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-medium text-foreground">
              Project Location
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            className="text-xs text-primary hover:underline"
          >
            Edit Location
          </button>
        </div>
        <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
          {hasLocation ? (
            <>
              <MapPin className="h-3 w-3 text-green-400" />
              <span>{summaryText}</span>
            </>
          ) : (
            <>
              <MapPin className="h-3 w-3 text-muted-foreground" />
              <span className="italic">No location set</span>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Full form ─────────────────────────────────────────────────
  return (
    <div className="border-t border-border pt-3 mt-3">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Globe className="h-3.5 w-3.5 text-primary" />
          <label className="text-xs font-medium text-foreground">
            Project Location
          </label>
        </div>
        {collapsible && (
          <button
            type="button"
            onClick={() => setIsExpanded(false)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Collapse
          </button>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground mb-3">
        Add a location to display on the holdings map.
      </p>

      <div className="space-y-2">
        {/* Country dropdown — always visible */}
        <div>
          <label className="text-xs text-muted-foreground">Country</label>
          <select
            value={isOther ? "__other__" : country}
            onChange={(e) => {
              const val = e.target.value;
              if (val === "__other__") {
                emit({ country: otherCountry });
              } else {
                emit({ country: val });
              }
            }}
            className="w-full mt-1 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
          >
            <option value="">Select a country...</option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
            <option value="__other__">Other...</option>
          </select>
          {(isOther || (!country && otherCountry)) && (
            <Input
              value={isOther ? country : otherCountry}
              onChange={(e) => {
                setOtherCountry(e.target.value);
                emit({ country: e.target.value });
              }}
              placeholder="Enter country code (e.g. NG, PH)"
              className="mt-1.5"
            />
          )}
        </div>

        {/* City — appears after country is selected */}
        {country && (
          <div>
            <label className="text-xs text-muted-foreground">City</label>
            <Input
              value={city}
              onChange={(e) => emit({ city: e.target.value })}
              placeholder="e.g. Austin, London, Dubai"
            />
          </div>
        )}

        {/* Address line — appears after country (optional) */}
        {country && (
          <div>
            <label className="text-xs text-muted-foreground">
              Address{" "}
              <span className="text-muted-foreground/60">(optional)</span>
            </label>
            <Input
              value={addressLine}
              onChange={(e) => emit({ address_line: e.target.value })}
              placeholder="Street address for precise pin"
            />
          </div>
        )}

        {/* State/Province — appears after country (optional) */}
        {country && (
          <div>
            <label className="text-xs text-muted-foreground">
              State / Province{" "}
              <span className="text-muted-foreground/60">(optional)</span>
            </label>
            <Input
              value={stateProvince}
              onChange={(e) => emit({ state_province: e.target.value })}
              placeholder="e.g. TX, ON, Bavaria"
            />
          </div>
        )}

        {/* Find on Map button — appears when country + city are filled */}
        {country && city.trim() && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleGeocode}
            disabled={isGeocoding}
            className="w-full"
          >
            {isGeocoding ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                Finding location...
              </>
            ) : (
              <>
                <Navigation className="mr-2 h-3.5 w-3.5" />
                Find on Map
              </>
            )}
          </Button>
        )}

        {/* Geocode result feedback */}
        {geocodeStatus === "success" && (
          <div className="flex items-center gap-2 text-xs text-green-400 bg-green-500/5 border border-green-500/20 rounded-lg px-3 py-2">
            <Check className="h-3.5 w-3.5 shrink-0" />
            <span>{geocodeMessage}</span>
          </div>
        )}
        {geocodeStatus === "error" && (
          <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{geocodeMessage}</span>
          </div>
        )}

        {/* Mini map preview */}
        {latitude != null && longitude != null && (
          <MiniMapPreview lat={latitude} lng={longitude} />
        )}

        {/* No-location placeholder */}
        {(latitude == null || longitude == null) && country && (
          <div className="mt-2 rounded-lg border border-border bg-muted/20 flex items-center justify-center h-[80px]">
            <div className="text-center">
              <MapPin className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
              <p className="text-[10px] text-muted-foreground">
                No coordinates set
              </p>
            </div>
          </div>
        )}

        {/* Manual coordinates — collapsed section */}
        <div>
          <button
            type="button"
            onClick={() => setShowManualCoords(!showManualCoords)}
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors py-1"
          >
            <ChevronDown
              className={cn(
                "h-3 w-3 transition-transform",
                showManualCoords && "rotate-180"
              )}
            />
            Manual coordinates
            {latitude != null && longitude != null && (
              <span className="text-primary ml-1">
                ({latitude.toFixed(4)}, {longitude.toFixed(4)})
              </span>
            )}
          </button>
          {showManualCoords && (
            <div className="grid grid-cols-2 gap-2 mt-1.5">
              <div>
                <label className="text-xs text-muted-foreground">
                  Latitude
                </label>
                <Input
                  type="number"
                  step="any"
                  value={latitude != null ? String(latitude) : ""}
                  onChange={(e) =>
                    emit({
                      latitude: e.target.value ? parseFloat(e.target.value) : null,
                    })
                  }
                  placeholder="e.g. 30.267"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">
                  Longitude
                </label>
                <Input
                  type="number"
                  step="any"
                  value={longitude != null ? String(longitude) : ""}
                  onChange={(e) =>
                    emit({
                      longitude: e.target.value
                        ? parseFloat(e.target.value)
                        : null,
                    })
                  }
                  placeholder="e.g. -97.743"
                />
              </div>
            </div>
          )}
        </div>

        {/* Tier indicator */}
        {country && (
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground pt-1">
            <MapPin className="h-3 w-3" />
            {latitude != null && longitude != null ? (
              <span className="text-green-400">Precise location set</span>
            ) : city.trim() ? (
              <span className="text-blue-400">City-level pin</span>
            ) : (
              <span className="text-amber-400">Country-level pin</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
