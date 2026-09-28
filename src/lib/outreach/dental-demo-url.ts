/**
 * Dental Demo Site URL Generator (Strictly for Dentists & Dental Clinics)
 *
 * Constructs a fully personalized preview URL for the dynamic dental site
 * (dental-site-sage.vercel.app) using the lead's real business data.
 *
 * NOTE: Strictly restricted to dentists, dental practices, orthodontists, etc.
 * Normal hospitals, general medical clinics, doctors, spas, salons, and gyms
 * are strictly EXCLUDED and must use standard website audit outreach.
 */

const DENTAL_SITE_BASE_URL = "https://dental-site-sage.vercel.app";

/**
 * Strict keywords that specifically identify a dental / dentist practice.
 */
const STRICT_DENTAL_KEYWORDS = [
  "dentist",
  "dental",
  "orthodont",
  "endodont",
  "periodont",
  "prosthodont",
  "teeth whitening",
  "dental implant",
  "dental clinic",
  "dental center",
  "dental centre",
  "dental care",
  "dental practice",
  "dental surgery",
  "cosmetic dentist",
  "pediatric dentist",
  "family dentist",
];

/**
 * Check if a business is strictly a dental/dentist practice.
 * Returns FALSE for normal hospitals, medical clinics, doctors, polyclinics, spas, gyms, etc.
 */
export function isDentalOnlyBusiness(
  category?: string | null,
  name?: string | null
): boolean {
  const cat = (category || "").toLowerCase().trim();
  const n = (name || "").toLowerCase().trim();

  // If no category and no name, return false
  if (!cat && !n) return false;

  // 1. Reject veterinary, animal, or pet clinics
  if (
    cat.includes("veterin") ||
    n.includes("veterin") ||
    cat.includes("pet ") ||
    n.includes("pet ") ||
    cat.includes("animal") ||
    n.includes("animal")
  ) {
    return false;
  }

  // 2. Reject normal hospitals, medical clinics, and doctors unless explicitly a dental clinic
  const isGeneralHospitalOrMedical =
    cat === "hospital" ||
    cat === "general hospital" ||
    cat === "medical clinics" ||
    cat === "medical clinic" ||
    cat === "medical center" ||
    cat === "medical centre" ||
    cat === "doctor" ||
    cat === "physician" ||
    cat === "polyclinic" ||
    cat === "health clinic" ||
    cat === "health center" ||
    cat === "urgent care" ||
    cat === "emergency room";

  const hasDentalInCat =
    cat.includes("dentist") ||
    cat.includes("dental") ||
    cat.includes("orthodont") ||
    cat.includes("endodont") ||
    cat.includes("periodont") ||
    cat.includes("prosthodont");

  const hasDentalInName =
    n.includes("dentist") ||
    n.includes("dental") ||
    n.includes("orthodont") ||
    n.includes("endodont") ||
    n.includes("periodont") ||
    n.includes("prosthodont");

  // If category is a normal hospital/medical clinic and category doesn't specify dental:
  if (isGeneralHospitalOrMedical && !hasDentalInCat) {
    return false;
  }

  // Normal hospitals (e.g. "American Hospital Dubai", "Mediclinic City Hospital", "Zulekha Hospital") must be rejected
  if (n.includes("hospital") && !n.includes("dental hospital")) {
    return false;
  }

  // General medical centers / clinics without dental in their name or category
  if (!hasDentalInCat && !hasDentalInName) {
    return false;
  }

  // Match against strict dental keywords
  if (STRICT_DENTAL_KEYWORDS.some((kw) => cat.includes(kw))) {
    return true;
  }

  if (STRICT_DENTAL_KEYWORDS.some((kw) => n.includes(kw))) {
    return true;
  }

  return false;
}

export const isDentalOrMedicalBusiness = isDentalOnlyBusiness;
export const isDentalBusiness = isDentalOnlyBusiness;

/**
 * Auto-detect regulatory license text based on city/country
 */
function detectLicense(city: string): string {
  const c = city.toLowerCase();
  if (["dubai", "abu dhabi", "sharjah", "ajman", "al ain", "ras al khaimah", "fujairah"].some((x) => c.includes(x))) {
    return "DHA Licensed Dental Practice";
  }
  if (["london", "manchester", "birmingham", "leeds", "glasgow", "edinburgh", "liverpool", "bristol"].some((x) => c.includes(x))) {
    return "GDC Registered Dental Practice";
  }
  if (["new york", "los angeles", "chicago", "houston", "miami", "dallas", "san francisco", "austin", "boston", "seattle"].some((x) => c.includes(x))) {
    return "ADA Certified Practice";
  }
  if (["toronto", "vancouver", "montreal", "calgary", "ottawa"].some((x) => c.includes(x))) {
    return "RCDSO Licensed Dental Practice";
  }
  if (["sydney", "melbourne", "brisbane", "perth", "adelaide"].some((x) => c.includes(x))) {
    return "AHPRA Registered Dental Practice";
  }
  if (["singapore"].some((x) => c.includes(x))) {
    return "MOH Licensed Dental Facility";
  }
  if (["tokyo", "osaka"].some((x) => c.includes(x))) {
    return "MHLW Certified Practice";
  }
  if (["lahore", "karachi", "islamabad", "rawalpindi", "faisalabad", "peshawar"].some((x) => c.includes(x))) {
    return "PMC Verified Dental Facility";
  }
  if (["riyadh", "jeddah", "dammam", "mecca", "medina"].some((x) => c.includes(x))) {
    return "MOH Licensed Dental Facility";
  }
  if (["doha"].some((x) => c.includes(x))) {
    return "MOPH Licensed Dental Facility";
  }
  return "Licensed & Accredited Dental Practice";
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
