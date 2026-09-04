import axios from "axios";
import { RawBusinessLead } from "../types";

interface GooglePlaceResult {
  place_id: string;
  name: string;
  formatted_address?: string;
  rating?: number;
  user_ratings_total?: number;
  types?: string[];
  website?: string;
  formatted_phone_number?: string;
  international_phone_number?: string;
  url?: string;
}

/**
 * Clean and format Google Places raw type into a readable business category
 */
function cleanGooglePlaceCategory(types: string[] | undefined, defaultQuery: string): string {
  if (!types || types.length === 0) return defaultQuery;

  // Filter out generic boilerplate types
  const ignored = [
    "point_of_interest",
    "establishment",
    "premise",
    "subpremise",
    "food",
    "store",
    "health",
  ];

  const meaningful = types.filter((t) => !ignored.includes(t.toLowerCase()));

  if (meaningful.length > 0) {
    const raw = meaningful[0].replace(/_/g, " ");
    return raw
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  return defaultQuery;
}

/**
 * Searches Google Places API (if API Key provided), or falls back to intelligent generator for testing
 */
export async function searchGooglePlaces(
  query: string,
  location: string,
  limit: number = 20
): Promise<RawBusinessLead[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const fullQuery = `${query} in ${location}`;

  if (apiKey && apiKey.trim() !== "" && apiKey !== "your_google_places_api_key_here") {
    try {
      console.log(`[Google Places API] Querying live Google Places API for "${fullQuery}"`);
      return await fetchFromGooglePlacesApi(fullQuery, query, location, apiKey, limit);
    } catch (error: any) {
      console.error("[Google Places API] Error fetching live data, falling back to local engine:", error?.response?.data || error.message);
      return generateSimulatedLeads(query, location, limit);
    }
  }

  // Fallback simulator with realistic local data
  console.log(`[Local Discovery Engine] Generating realistic sandbox SMBs for "${query}" in "${location}"`);
  return generateSimulatedLeads(query, location, limit);
}

/**
 * Real Google Places API integration
 */
async function fetchFromGooglePlacesApi(
  fullQuery: string,
  baseQuery: string,
  location: string,
  apiKey: string,
  limit: number
): Promise<RawBusinessLead[]> {
  const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
    fullQuery
  )}&key=${apiKey}`;

  const searchRes = await axios.get(searchUrl);
  const places: GooglePlaceResult[] = searchRes.data.results || [];
  console.log(`[Google Places API] Found ${places.length} raw results from text search`);

  const leads: RawBusinessLead[] = [];

  for (const place of places.slice(0, limit)) {
    let website: string | null = null;
    let phone: string | null = null;
    let mapsUrl = place.place_id
      ? `https://www.google.com/maps/place/?q=place_id:${place.place_id}`
      : null;

    // Fetch details for place to get website, phone, and direct URL
    try {
      const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=website,formatted_phone_number,international_phone_number,url&key=${apiKey}`;
      const detailsRes = await axios.get(detailsUrl);
      const detail = detailsRes.data.result;

      if (detail) {
        website = detail.website || null;
        phone = detail.international_phone_number || detail.formatted_phone_number || null;
        if (detail.url) mapsUrl = detail.url;
      }
    } catch {
      // Ignore detail fetch errors and proceed
    }

    const category = cleanGooglePlaceCategory(place.types, baseQuery);

    leads.push({
      name: place.name,
      category,
      phone,
      email: null,
      website,
      address: place.formatted_address || `${location}`,
      city: location,
      rating: place.rating || 0,
      reviewCount: place.user_ratings_total || 0,
      googleMapsUrl: mapsUrl,
      googlePlaceId: place.place_id,
    });
  }

  return leads;
}

/**
 * Intelligent generator that creates realistic, authentic-feeling local SMB business profiles
 * for any given niche and city to test the scoring, database, deduplication, and UI pipeline.
 */
function generateSimulatedLeads(
  keyword: string,
  location: string,
  limit: number = 15
): RawBusinessLead[] {
  const cleanKeyword = keyword.trim();
  const cleanCity = location.trim() || "London";

  const sampleNames = getIndustrySampleNames(cleanKeyword, cleanCity);
  const areas = getCityAreas(cleanCity);

  const leads: RawBusinessLead[] = [];
  const count = Math.min(limit, sampleNames.length);

  for (let i = 0; i < count; i++) {
    const item = sampleNames[i];
    const area = areas[i % areas.length];
    const hasSite = item.hasWebsite;
    const phonePrefix = getCityPhonePrefix(cleanCity);
    const randomPhoneDigits = Math.floor(1000000 + Math.random() * 9000000);
    const phone = `${phonePrefix} ${randomPhoneDigits}`;
    const slug = item.name.toLowerCase().replace(/[^a-z0-9]/g, "");

    leads.push({
      name: item.name,
      category: item.category || cleanKeyword,
      phone,
      email: hasSite ? `info@${slug}.com` : null,
      website: hasSite ? `https://www.${slug}.com` : (item.socialOnly ? `https://facebook.com/${slug}` : null),
      address: `${item.addressLine || "Shop #" + (i + 1) + ", Main Boulevard"}, ${area}, ${cleanCity}`,
      city: cleanCity,
      rating: item.rating,
      reviewCount: item.reviews,
      googleMapsUrl: `https://maps.google.com/?q=${encodeURIComponent(item.name + " " + cleanCity)}`,
      googlePlaceId: `mock_place_${cleanCity.toLowerCase()}_${slug}_${i + 1}`,
    });
  }

  return leads;
}

function getCityAreas(city: string): string[] {
  const c = city.toLowerCase();
  if (c.includes("lahore")) {
    return ["Gulberg III", "DHA Phase 5", "Johar Town", "Model Town", "MM Alam Road", "Bahria Town", "Faisal Town", "Cantt"];
  }
  if (c.includes("karachi")) {
    return ["Clifton Block 4", "DHA Phase 6", "Gulshan-e-Iqbal", "PECHS Block 2", "North Nazimabad", "Zamzama", "Shahrah-e-Faisal"];
  }
  if (c.includes("islamabad") || c.includes("rawalpindi")) {
    return ["F-7 Markaz", "F-10 Markaz", "Blue Area", "F-6 Super Market", "Bahria Town Phase 4", "Saddar", "DHA Phase 2"];
  }
  if (c.includes("dubai")) {
    return ["Downtown Dubai", "Business Bay", "Dubai Marina", "Jumeirah 1", "Al Barsha", "Deira", "JLT"];
  }
  if (c.includes("london")) {
    return ["Mayfair", "Soho", "Covent Garden", "Chelsea", "Kensington", "Shoreditch", "Canary Wharf", "Westminster"];
  }
  return ["Downtown", "City Center", "Main Boulevard", "Commercial Area", "West End", "North Plaza"];
}

function getCityPhonePrefix(city: string): string {
  const c = city.toLowerCase();
  if (c.includes("lahore") || c.includes("karachi") || c.includes("islamabad") || c.includes("pakistan")) {
    return "+92 300";
  }
  if (c.includes("dubai") || c.includes("uae")) {
    return "+971 50";
  }
  if (c.includes("london") || c.includes("uk")) {
    return "+44 20";
  }
  return "+1 555";
}

function getIndustrySampleNames(keyword: string, city: string) {
  const k = keyword.toLowerCase();

  if (k.includes("dent") || k.includes("dental") || k.includes("teeth")) {
    return [
      { name: `Advanced Dental Care & Aesthetics`, category: "Dental Clinic", rating: 4.8, reviews: 342, hasWebsite: false, addressLine: "Floor 2, Central Plaza" },
      { name: `Apex Smile Studio`, category: "Orthodontist", rating: 4.9, reviews: 215, hasWebsite: false, addressLine: "Plaza 14, Commercial Lane" },
      { name: `Dr. Sarah Dental & Implant Center`, category: "Dentist", rating: 4.7, reviews: 184, hasWebsite: false, socialOnly: true, addressLine: "Sector Y Commercial" },
      { name: `Care Dental Clinic`, category: "Dental Clinic", rating: 4.6, reviews: 96, hasWebsite: false, addressLine: "Main Market" },
      { name: `Crown & Root Dental Hospital`, category: "Dentist", rating: 4.5, reviews: 120, hasWebsite: true, addressLine: "Building 8, High Street" },
      { name: `Family Dental Surgery`, category: "Dentist", rating: 4.3, reviews: 45, hasWebsite: false, addressLine: "Opposite General Hospital" },
      { name: `Pearl White Aesthetics Dental`, category: "Cosmetic Dentist", rating: 4.9, reviews: 410, hasWebsite: false, addressLine: "H-Block Commercial" },
      { name: `City Dental Practice`, category: "Dentist", rating: 3.9, reviews: 18, hasWebsite: false, addressLine: "Circular Road" },
      { name: `Elite Orthodontics & Dental Hub`, category: "Dental Clinic", rating: 4.7, reviews: 156, hasWebsite: false, socialOnly: true, addressLine: "Plaza 33, Broadway" },
      { name: `Modern Smile Care`, category: "Dentist", rating: 4.4, reviews: 78, hasWebsite: true, addressLine: "Mall Road" }
    ];
  }

  if (k.includes("gym") || k.includes("fitness") || k.includes("crossfit")) {
    return [
      { name: `Iron Pulse Fitness & Boxing Club`, category: "Gym & Fitness", rating: 4.9, reviews: 480, hasWebsite: false, addressLine: "Basement Plaza 9, Commercial Way" },
      { name: `Titanium Strength Gym`, category: "Gym", rating: 4.8, reviews: 320, hasWebsite: false, socialOnly: true, addressLine: "Sector C Commercial" },
      { name: `Elite Alpha Fitness Studio`, category: "Personal Trainer", rating: 4.7, reviews: 195, hasWebsite: false, addressLine: "Civic Centre" },
      { name: `Pulse 360 Health & Gym`, category: "Gym", rating: 4.6, reviews: 140, hasWebsite: true, addressLine: "Main Boulevard" },
      { name: `Spartan Training Club`, category: "Fitness Center", rating: 4.8, reviews: 260, hasWebsite: false, addressLine: "G-Block Market" },
      { name: `Vigor Ladies & Gents Gym`, category: "Gym", rating: 4.2, reviews: 65, hasWebsite: false, addressLine: "Plaza 12, Phase 3" },
      { name: `Powerhouse Fitness Hub`, category: "Gym", rating: 4.5, reviews: 88, hasWebsite: false, addressLine: "Canal Road" }
    ];
  }

  if (k.includes("salon") || k.includes("spa") || k.includes("hair") || k.includes("beauty")) {
    return [
      { name: `Lumière Luxury Salon & Spa`, category: "Beauty Salon", rating: 4.9, reviews: 520, hasWebsite: false, addressLine: "Villa 14-A, West End" },
      { name: `Glamour Cut Men & Women Lounge`, category: "Hair Salon", rating: 4.7, reviews: 280, hasWebsite: false, socialOnly: true, addressLine: "Sector Z Commercial" },
      { name: `Blush & Bronze Aesthetic Lounge`, category: "Spa & Salon", rating: 4.8, reviews: 310, hasWebsite: false, addressLine: "Mall 1, Downtown" },
      { name: `Royal Touch Beauty Clinic`, category: "Beauty Salon", rating: 4.6, reviews: 175, hasWebsite: true, addressLine: "Plaza 8, City Centre" },
      { name: `Velvet Scissors Hair Studio`, category: "Hair Salon", rating: 4.4, reviews: 92, hasWebsite: false, addressLine: "Main Market" },
      { name: `Zenitude Wellness Spa`, category: "Day Spa", rating: 4.8, reviews: 190, hasWebsite: false, addressLine: "Defence Club Road" }
    ];
  }

  if (k.includes("rest") || k.includes("cafe") || k.includes("food") || k.includes("burger") || k.includes("pizza") || k.includes("dine")) {
    return [
      { name: `The Rustic Oven Artisanal Bistro`, category: "Italian Restaurant", rating: 4.7, reviews: 850, hasWebsite: false, addressLine: "Plot 24, High Street" },
      { name: `Flavors & Smoke Charcoal Grill`, category: "BBQ & Grill", rating: 4.8, reviews: 1200, hasWebsite: false, socialOnly: true, addressLine: "Food Street" },
      { name: `Café Botanica & Bakery`, category: "Café", rating: 4.6, reviews: 620, hasWebsite: false, addressLine: "Off Main Boulevard" },
      { name: `Heritage Spice Kitchen`, category: "Indian/Pakistani Restaurant", rating: 4.5, reviews: 430, hasWebsite: true, addressLine: "Old City Gate" },
      { name: `Smash Bros Burger Co.`, category: "Fast Food", rating: 4.7, reviews: 390, hasWebsite: false, addressLine: "Phase 4 Commercial" },
      { name: `Urban Crust Woodfired Pizza`, category: "Pizza Restaurant", rating: 4.8, reviews: 510, hasWebsite: false, socialOnly: true, addressLine: "Market Square" }
    ];
  }

  if (k.includes("estate") || k.includes("property") || k.includes("realt") || k.includes("builder")) {
    return [
      { name: `Prime Legacy Real Estate & Advisory`, category: "Real Estate Agency", rating: 4.8, reviews: 165, hasWebsite: false, addressLine: "Plaza 40, Phase 5" },
      { name: `Signature Properties International`, category: "Property Consultant", rating: 4.9, reviews: 240, hasWebsite: true, addressLine: "Tower 6, Business Bay" },
      { name: `Al-Falah Estates & Builders`, category: "Real Estate Consultant", rating: 4.6, reviews: 110, hasWebsite: false, socialOnly: true, addressLine: "Commercial Broadway" },
      { name: `Apex Horizon Realtors`, category: "Commercial Real Estate", rating: 4.7, reviews: 85, hasWebsite: false, addressLine: "City Heights" },
      { name: `Crestview Lands & Investment Hub`, category: "Real Estate Agency", rating: 4.5, reviews: 72, hasWebsite: false, addressLine: "Commercial Complex" }
    ];
  }

  if (k.includes("law") || k.includes("attorney") || k.includes("legal")) {
    return [
      { name: `Justice & Partners Legal Associates`, category: "Law Firm", rating: 4.9, reviews: 95, hasWebsite: false, addressLine: "Chamber 12, High Court Road" },
      { name: `Apex Corporate Counsel & Advocates`, category: "Corporate Lawyer", rating: 4.8, reviews: 68, hasWebsite: true, addressLine: "Finance & Trade Centre" },
      { name: `Al-Mizan Legal Consultants`, category: "Advocate", rating: 4.6, reviews: 42, hasWebsite: false, addressLine: "District Courts Avenue" },
      { name: `Horizon Intellectual Property Law`, category: "IP Lawyer", rating: 4.9, reviews: 88, hasWebsite: false, addressLine: "Mall Complex" }
    ];
  }

  // Generic fallback generator for any custom niche
  return [
    { name: `Apex ${keyword} Center`, category: keyword, rating: 4.8, reviews: 240, hasWebsite: false, addressLine: "Main Plaza 1" },
    { name: `Premier ${keyword} Hub`, category: keyword, rating: 4.7, reviews: 180, hasWebsite: false, socialOnly: true, addressLine: "Sector B Commercial" },
    { name: `Elite ${keyword} Studio`, category: keyword, rating: 4.9, reviews: 310, hasWebsite: false, addressLine: "City Center, Block C" },
    { name: `Royal ${keyword} & Co.`, category: keyword, rating: 4.5, reviews: 95, hasWebsite: true, addressLine: "Commerce Way" },
    { name: `Care ${keyword} Services`, category: keyword, rating: 4.3, reviews: 40, hasWebsite: false, addressLine: "Main Avenue" },
    { name: `Prime ${keyword} Solutions`, category: keyword, rating: 4.6, reviews: 120, hasWebsite: false, addressLine: "Plaza 8" }
  ];
}
