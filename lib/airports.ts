/** Fusion Cell — Airport reference data (IATA codes + coordinates)
 *  Covers major international hubs + key private aviation fields.
 *  Searchable by code or city name. */

import type { Airport } from "./travel-types";

// Re-export so callers already pointing at @/lib/airports for the Airport
// type continue to resolve (the canonical definition lives in travel-types).
export type { Airport };

export const AIRPORTS: Airport[] = [
  // North America
  { code: "JFK", name: "John F. Kennedy International", city: "New York", country: "US", lat: 40.6413, lng: -73.7781 },
  { code: "TEB", name: "Teterboro Airport", city: "Teterboro", country: "US", lat: 40.8501, lng: -74.0608 },
  { code: "LAX", name: "Los Angeles International", city: "Los Angeles", country: "US", lat: 33.9425, lng: -118.4081 },
  { code: "VNY", name: "Van Nuys Airport", city: "Van Nuys", country: "US", lat: 34.2098, lng: -118.4899 },
  { code: "MIA", name: "Miami International", city: "Miami", country: "US", lat: 25.7959, lng: -80.2870 },
  { code: "OPF", name: "Miami-Opa Locka Executive", city: "Miami", country: "US", lat: 25.9070, lng: -80.2784 },
  { code: "ORD", name: "O'Hare International", city: "Chicago", country: "US", lat: 41.9742, lng: -87.9073 },
  { code: "SFO", name: "San Francisco International", city: "San Francisco", country: "US", lat: 37.6213, lng: -122.3790 },
  { code: "ATL", name: "Hartsfield-Jackson International", city: "Atlanta", country: "US", lat: 33.6407, lng: -84.4277 },
  { code: "PDK", name: "DeKalb-Peachtree Airport", city: "Atlanta", country: "US", lat: 33.8756, lng: -84.3020 },
  { code: "DFW", name: "Dallas/Fort Worth International", city: "Dallas", country: "US", lat: 32.8998, lng: -97.0403 },
  { code: "SEA", name: "Seattle-Tacoma International", city: "Seattle", country: "US", lat: 47.4502, lng: -122.3088 },
  { code: "BOS", name: "Boston Logan International", city: "Boston", country: "US", lat: 42.3656, lng: -71.0096 },
  { code: "DEN", name: "Denver International", city: "Denver", country: "US", lat: 39.8561, lng: -104.6737 },
  { code: "IAD", name: "Washington Dulles International", city: "Washington DC", country: "US", lat: 38.9531, lng: -77.4565 },
  { code: "LAS", name: "Harry Reid International", city: "Las Vegas", country: "US", lat: 36.0840, lng: -115.1537 },
  { code: "HPN", name: "Westchester County Airport", city: "White Plains", country: "US", lat: 41.0670, lng: -73.7076 },
  { code: "SDL", name: "Scottsdale Airport", city: "Scottsdale", country: "US", lat: 33.6229, lng: -111.9106 },
  { code: "ASE", name: "Aspen/Pitkin County Airport", city: "Aspen", country: "US", lat: 39.2232, lng: -106.8688 },
  { code: "EGE", name: "Eagle County Regional", city: "Vail", country: "US", lat: 39.6426, lng: -106.9176 },
  { code: "PBI", name: "Palm Beach International", city: "Palm Beach", country: "US", lat: 26.6832, lng: -80.0956 },
  { code: "YYZ", name: "Toronto Pearson International", city: "Toronto", country: "CA", lat: 43.6777, lng: -79.6248 },
  { code: "YVR", name: "Vancouver International", city: "Vancouver", country: "CA", lat: 49.1967, lng: -123.1815 },
  { code: "MEX", name: "Mexico City International", city: "Mexico City", country: "MX", lat: 19.4363, lng: -99.0721 },
  { code: "SXM", name: "Princess Juliana International", city: "St. Maarten", country: "SX", lat: 18.0410, lng: -63.1089 },
  { code: "NAS", name: "Lynden Pindling International", city: "Nassau", country: "BS", lat: 25.0390, lng: -77.4662 },

  // Europe
  { code: "LHR", name: "London Heathrow", city: "London", country: "GB", lat: 51.4700, lng: -0.4543 },
  { code: "LTN", name: "London Luton", city: "London", country: "GB", lat: 51.8747, lng: -0.3683 },
  { code: "LBG", name: "Paris Le Bourget", city: "Paris", country: "FR", lat: 48.9694, lng: 2.4414 },
  { code: "CDG", name: "Paris Charles de Gaulle", city: "Paris", country: "FR", lat: 49.0097, lng: 2.5479 },
  { code: "NCE", name: "Nice Cote d'Azur", city: "Nice", country: "FR", lat: 43.6584, lng: 7.2159 },
  { code: "FRA", name: "Frankfurt Airport", city: "Frankfurt", country: "DE", lat: 50.0379, lng: 8.5622 },
  { code: "ZRH", name: "Zurich Airport", city: "Zurich", country: "CH", lat: 47.4647, lng: 8.5492 },
  { code: "GVA", name: "Geneva Airport", city: "Geneva", country: "CH", lat: 46.2381, lng: 6.1090 },
  { code: "FCO", name: "Leonardo da Vinci International", city: "Rome", country: "IT", lat: 41.8003, lng: 12.2389 },
  { code: "MXP", name: "Milan Malpensa", city: "Milan", country: "IT", lat: 45.6306, lng: 8.7281 },
  { code: "BCN", name: "Barcelona-El Prat", city: "Barcelona", country: "ES", lat: 41.2974, lng: 2.0833 },
  { code: "MAD", name: "Madrid-Barajas", city: "Madrid", country: "ES", lat: 40.4983, lng: -3.5676 },
  { code: "AMS", name: "Amsterdam Schiphol", city: "Amsterdam", country: "NL", lat: 52.3105, lng: 4.7683 },
  { code: "MUC", name: "Munich Airport", city: "Munich", country: "DE", lat: 48.3537, lng: 11.7750 },
  { code: "ATH", name: "Athens International", city: "Athens", country: "GR", lat: 37.9364, lng: 23.9445 },
  { code: "IST", name: "Istanbul Airport", city: "Istanbul", country: "TR", lat: 41.2753, lng: 28.7519 },
  { code: "JMK", name: "Mykonos Island National", city: "Mykonos", country: "GR", lat: 37.4351, lng: 25.3481 },
  { code: "OLB", name: "Olbia Costa Smeralda", city: "Sardinia", country: "IT", lat: 40.8987, lng: 9.5176 },

  // Middle East
  { code: "DXB", name: "Dubai International", city: "Dubai", country: "AE", lat: 25.2532, lng: 55.3657 },
  { code: "DWC", name: "Al Maktoum International", city: "Dubai", country: "AE", lat: 24.8960, lng: 55.1614 },
  { code: "DOH", name: "Hamad International", city: "Doha", country: "QA", lat: 25.2731, lng: 51.6081 },
  { code: "RUH", name: "King Khalid International", city: "Riyadh", country: "SA", lat: 24.9576, lng: 46.6988 },

  // Asia-Pacific
  { code: "SIN", name: "Singapore Changi", city: "Singapore", country: "SG", lat: 1.3644, lng: 103.9915 },
  { code: "HKG", name: "Hong Kong International", city: "Hong Kong", country: "HK", lat: 22.3080, lng: 113.9185 },
  { code: "NRT", name: "Narita International", city: "Tokyo", country: "JP", lat: 35.7647, lng: 140.3864 },
  { code: "HND", name: "Tokyo Haneda", city: "Tokyo", country: "JP", lat: 35.5494, lng: 139.7798 },
  { code: "SYD", name: "Sydney Kingsford Smith", city: "Sydney", country: "AU", lat: -33.9461, lng: 151.1772 },
  { code: "BKK", name: "Suvarnabhumi Airport", city: "Bangkok", country: "TH", lat: 13.6900, lng: 100.7501 },
  { code: "MLE", name: "Velana International", city: "Male", country: "MV", lat: 4.1918, lng: 73.5292 },
  { code: "DEL", name: "Indira Gandhi International", city: "New Delhi", country: "IN", lat: 28.5562, lng: 77.1000 },

  // Africa
  { code: "CPT", name: "Cape Town International", city: "Cape Town", country: "ZA", lat: -33.9715, lng: 18.6021 },
  { code: "JNB", name: "O.R. Tambo International", city: "Johannesburg", country: "ZA", lat: -26.1392, lng: 28.2460 },
  { code: "CMN", name: "Mohammed V International", city: "Casablanca", country: "MA", lat: 33.3675, lng: -7.5898 },
];

/** Search airports by IATA code or city name (case-insensitive). */
export function searchAirports(query: string, limit = 8): Airport[] {
  if (!query || query.length < 1) return [];
  const q = query.toLowerCase();
  return AIRPORTS.filter(
    (a) =>
      a.code.toLowerCase().startsWith(q) ||
      a.city.toLowerCase().includes(q) ||
      a.name.toLowerCase().includes(q)
  ).slice(0, limit);
}

/** Look up a single airport by IATA code. */
export function getAirport(code: string): Airport | undefined {
  return AIRPORTS.find((a) => a.code === code.toUpperCase());
}
