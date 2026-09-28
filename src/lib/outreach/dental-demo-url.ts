/**
 * Dental Demo Site URL Generator
 *
 * Constructs a fully personalized preview URL for the dynamic dental site
 * (dental-site-sage.vercel.app) using the lead's real business data.
 *
 * The dental site reads all clinic info from URL query parameters and renders
 * a premium, fully-branded patient portal on-the-fly — zero manual coding.
 */

const DENTAL_SITE_BASE_URL = "https://dental-site-sage.vercel.app";

/**
 * Categories/keywords that indicate a dental or medical clinic
 */
const DENTAL_KEYWORDS = [
  "dentist", "dental", "orthodont", "endodont", "periodont",
  "oral", "tooth", "teeth", "smile", "implant", "prosthodont",
  "maxillofacial", "clinic", "medical", "doctor", "hospital",
  "dermat", "physio", "chiropr", "optom", "veterinar",
  "health", "wellness", "cosmetic", "aesthetic", "beauty",
  "spa", "salon", "skin", "hair", "laser",
];

/**
 * Check if a business category suggests it could benefit from a dental/medical demo site
 */
export function isDentalOrMedicalBusiness(category: string): boolean {
  if (!category) return false;
  const lower = category.toLowerCase();
  return DENTAL_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * Auto-detect regulatory license text based on city/country
 */
function detectLicense(city: string): string {
  const c = city.toLowerCase();
  if (["dubai", "abu dhabi", "sharjah", "ajman", "al ain", "ras al khaimah", "fujairah"].some((x) => c.includes(x))) {
    return "DHA Licensed Facility";
  }
  if (["london", "manchester", "birmingham", "leeds", "glasgow", "edinburgh", "liverpool", "bristol"].some((x) => c.includes(x))) {
    return "GDC Registered";
  }
  if (["new york", "los angeles", "chicago", "houston", "miami", "dallas", "san francisco", "austin", "boston", "seattle"].some((x) => c.includes(x))) {
    return "ADA Certified Practice";
  }
  if (["toronto", "vancouver", "montreal", "calgary", "ottawa"].some((x) => c.includes(x))) {
    return "RCDSO Licensed";
  }
  if (["sydney", "melbourne", "brisbane", "perth", "adelaide"].some((x) => c.includes(x))) {
    return "AHPRA Registered";
  }
  if (["singapore"].some((x) => c.includes(x))) {
    return "MOH Licensed Facility";
  }
  if (["tokyo", "osaka"].some((x) => c.includes(x))) {
    return "MHLW Certified";
  }
  if (["lahore", "karachi", "islamabad", "rawalpindi", "faisalabad", "peshawar"].some((x) => c.includes(x))) {
    return "PMC Verified Facility";
  }
  if (["riyadh", "jeddah", "dammam", "mecca", "medina"].some((x) => c.includes(x))) {
    return "MOH Licensed Facility";
  }
  if (["doha"].some((x) => c.includes(x))) {
    return "MOPH Licensed";
  }
  return "Licensed & Accredited Facility";
}

/**
 * Auto-detect common languages based on city
 */
function detectLanguages(city: string): string {
  const c = city.toLowerCase();
  if (["dubai", "abu dhabi", "sharjah"].some((x) => c.includes(x))) return "English, Arabic, Hindi, Tagalog";
  if (["london", "manchester", "birmingham"].some((x) => c.includes(x))) return "English";
  if (["new york", "los angeles", "miami", "chicago"].some((x) => c.includes(x))) return "English, Spanish";
  if (["toronto", "vancouver", "montreal"].some((x) => c.includes(x))) return "English, French";
  if (["paris"].some((x) => c.includes(x))) return "French, English";
  if (["berlin"].some((x) => c.includes(x))) return "German, English";
  if (["tokyo", "osaka"].some((x) => c.includes(x))) return "Japanese, English";
  if (["singapore"].some((x) => c.includes(x))) return "English, Mandarin, Malay";
  if (["sydney", "melbourne"].some((x) => c.includes(x))) return "English";
  if (["lahore", "karachi", "islamabad"].some((x) => c.includes(x))) return "Urdu, English, Punjabi";
  if (["riyadh", "jeddah"].some((x) => c.includes(x))) return "Arabic, English";
  return "English";
}

export interface DentalDemoUrlParams {
  name: string;
  category?: string | null;
  city: string;
  area?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  rating?: number;
  reviewCount?: number;
  googlePlaceId?: string | null;
}

/**
 * Generate a fully personalized dental demo site URL from business data
 */
export function generateDentalDemoUrl(business: DentalDemoUrlParams): string {
  const params = new URLSearchParams();

  // Clinic name
  params.set("name", business.name);

  // Subtitle: extract type from category or default
  const subtitle = business.category?.replace(/\b(dentist|dental)\b/gi, "").trim() || "Dental Clinic";
  params.set("subtitle", subtitle || "Dental Clinic");

  // Location
  params.set("city", business.city);
  if (business.area) {
    params.set("area", business.area);
  }
  if (business.address) {
    params.set("address", business.address);
  }

  // WhatsApp number (clean digits with country code)
  if (business.phone) {
    const cleanPhone = business.phone.replace(/[^0-9+]/g, "").replace(/^\+/, "");
    if (cleanPhone.length >= 8) {
      params.set("whatsapp", cleanPhone);
    }
  }

  // Google rating & reviews
  if (business.rating && business.rating > 0) {
    params.set("rating", business.rating.toFixed(1));
  }
  if (business.reviewCount && business.reviewCount > 0) {
    params.set("reviews", business.reviewCount.toString());
  }

  // Google Maps CID for directions
  if (business.googlePlaceId) {
    params.set("cid", business.googlePlaceId);
  }

  // Auto-detected fields
  params.set("license", detectLicense(business.city));
  params.set("languages", detectLanguages(business.city));

  // Default promotional offer
  params.set("offer", "Complimentary 3D Intraoral Scan & Consultation");

  // Default timings
  params.set("timings", "9:00 AM – 9:00 PM");
  params.set("days", "Mon – Sat");

  return `${DENTAL_SITE_BASE_URL}/?${params.toString()}`;
}

/**
 * Generate a shortened/display-friendly version of the URL for messages
 */
export function getDentalDemoDisplayUrl(business: DentalDemoUrlParams): string {
  const encodedName = encodeURIComponent(business.name);
  return `${DENTAL_SITE_BASE_URL}/?name=${encodedName}&city=${encodeURIComponent(business.city)}`;
}
