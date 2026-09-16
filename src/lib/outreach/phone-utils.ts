/**
 * Comprehensive international phone number normalizer.
 * Formats local and international phone numbers into E.164-compliant digit strings
 * compatible with WhatsApp JIDs (@s.whatsapp.net).
 */
export function normalizePhoneNumber(toPhone: string, contextCity?: string): string {
  if (!toPhone) return "";

  // Strip everything except digits
  let clean = toPhone.replace(/[^0-9]/g, "");

  // Handle leading double zero (e.g. 00971... -> 971...)
  if (clean.startsWith("00")) {
    clean = clean.slice(2);
  }

  const cityLower = (contextCity || "").toLowerCase();

  // 1. UAE (Dubai, Abu Dhabi, Sharjah, etc.)
  // UAE mobile starts with 05 (050, 052, 054, 055, 056, 058) with 10 digits
  // UAE landline starts with 04, 02, 03, 06, 07, 09 with 9 digits
  const isUaeContext =
    cityLower.includes("dubai") ||
    cityLower.includes("uae") ||
    cityLower.includes("emirates") ||
    cityLower.includes("abu dhabi");

  if (clean.startsWith("05") && clean.length === 10) {
    clean = "971" + clean.slice(1);
  } else if (isUaeContext && clean.startsWith("0") && (clean.length === 9 || clean.length === 10)) {
    clean = "971" + clean.slice(1);
  }

  // 2. Pakistan (Lahore, Karachi, Islamabad, etc.)
  // Local mobile: 03xx (11 digits)
  const isPkContext =
    cityLower.includes("lahore") ||
    cityLower.includes("karachi") ||
    cityLower.includes("islamabad") ||
    cityLower.includes("pakistan");

  if (clean.startsWith("03") && clean.length === 11) {
    clean = "92" + clean.slice(1);
  } else if (isPkContext && clean.startsWith("0") && clean.length === 11) {
    clean = "92" + clean.slice(1);
  }

  // 3. United Kingdom (London, Manchester, etc.)
  // Local mobile/landline: 07, 01, 02 (11 digits)
  const isUkContext =
    cityLower.includes("london") ||
    cityLower.includes("uk") ||
    cityLower.includes("england") ||
    cityLower.includes("manchester");

  if ((clean.startsWith("07") || isUkContext) && clean.startsWith("0") && clean.length === 11) {
    clean = "44" + clean.slice(1);
  }

  // 4. USA / Canada
  const isUsContext =
    cityLower.includes("usa") ||
    cityLower.includes("united states") ||
    cityLower.includes("new york") ||
    cityLower.includes("california");

  if (isUsContext && clean.length === 10 && !clean.startsWith("0") && !clean.startsWith("1")) {
    clean = "1" + clean;
  }

  return clean;
}
