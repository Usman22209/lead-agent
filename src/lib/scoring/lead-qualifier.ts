import { RawBusinessLead, LeadScoreResult, PriorityTier, OpportunityType } from "../types";

// High Customer Lifetime Value (Tier 1) categories with highest ROI for digital funnels
const TIER_1_HIGH_TICKET_CATEGORIES = [
  "dentist",
  "dental",
  "orthodontist",
  "clinic",
  "medical",
  "doctor",
  "dermatology",
  "plastic surgery",
  "aesthetic",
  "gym",
  "fitness",
  "crossfit",
  "health club",
  "boxing",
  "law",
  "lawyer",
  "attorney",
  "legal",
  "real estate",
  "property",
  "realtor",
  "car dealership",
  "auto repair",
  "spa",
  "day spa",
];

// Medium Customer Lifetime Value (Tier 2) categories
const TIER_2_MEDIUM_TICKET_CATEGORIES = [
  "salon",
  "hair salon",
  "beauty salon",
  "restaurant",
  "bistro",
  "cafe",
  "catering",
  "contractor",
  "construction",
  "plumber",
  "electrician",
  "roofing",
  "consulting",
  "accounting",
];

export function qualifyAndScoreLead(business: RawBusinessLead): LeadScoreResult {
  let score = 0;
  const reasons: string[] = [];

  const rawWeb = (business.website || "").trim().toLowerCase();
  const hasValidWebsite = Boolean(
    rawWeb &&
    rawWeb.length > 0 &&
    !rawWeb.includes("facebook.com") &&
    !rawWeb.includes("instagram.com") &&
    !rawWeb.includes("tiktok.com")
  );

  const isSocialOnlySite = Boolean(
    rawWeb &&
    (rawWeb.includes("facebook.com") || rawWeb.includes("instagram.com") || rawWeb.includes("tiktok.com"))
  );

  const isSubdomainOrWeak = Boolean(
    rawWeb &&
    (rawWeb.includes("wixsite.com") ||
      rawWeb.includes("weebly.com") ||
      rawWeb.includes("linktr.ee") ||
      rawWeb.includes("wordpress.com") ||
      rawWeb.startsWith("http://"))
  );

  const rating = Number(business.rating) || 0;
  const reviews = Number(business.reviewCount) || 0;

  let noWebsiteBonus = 0;
  let ratingBonus = 0;
  let reviewCountBonus = 0;
  let phoneAvailableBonus = 0;
  let categoryBonus = 0;
  let unclaimedOrWeakPresenceBonus = 0;

  // --------------------------------------------------------------------------
  // PILLAR 1: Website Health & Digital Upgrade Need (Max 35 pts)
  // --------------------------------------------------------------------------
  if (!rawWeb) {
    noWebsiteBonus = 35;
    score += noWebsiteBonus;
    reasons.push("Zero Website Detected — Top opportunity for a complete custom Next.js web build (+35 pts)");
  } else if (isSocialOnlySite) {
    noWebsiteBonus = 30;
    score += noWebsiteBonus;
    reasons.push("Using Social Media Link As Website — High urgency for dedicated branded conversion funnel (+30 pts)");
  } else if (isSubdomainOrWeak) {
    noWebsiteBonus = 25;
    score += noWebsiteBonus;
    reasons.push("Outdated / Unsecured Web Presence — Needs modern Next.js upgrade, SSL & SEO overhaul (+25 pts)");
  } else if (reviews >= 200) {
    noWebsiteBonus = 20;
    score += noWebsiteBonus;
    reasons.push("High-Traffic Established Website — Ideal target for 24/7 AI WhatsApp Booker, Speed & Redesign (+20 pts)");
  } else if (reviews >= 50) {
    noWebsiteBonus = 15;
    score += noWebsiteBonus;
    reasons.push("Active Local Website — Strong candidate for AI modernization & lead capture revamp (+15 pts)");
  } else {
    noWebsiteBonus = 10;
    score += noWebsiteBonus;
    reasons.push("Existing Website — Potential for modern SEO and conversion rate optimization (+10 pts)");
  }

  // --------------------------------------------------------------------------
  // PILLAR 2: Customer Demand & Market Authority (Max 25 pts)
  // --------------------------------------------------------------------------
  if (reviews >= 1000) {
    reviewCountBonus = 25;
    reasons.push(`Market Leader (${reviews.toLocaleString()} Google reviews) — High budget capacity & massive customer volume (+25 pts)`);
  } else if (reviews >= 500) {
    reviewCountBonus = 22;
    reasons.push(`Dominant Local Brand (${reviews} Google reviews) — High-revenue business with strong market share (+22 pts)`);
  } else if (reviews >= 200) {
    reviewCountBonus = 18;
    reasons.push(`Strong Customer Footfall (${reviews} Google reviews) — Steady inbound customer stream (+18 pts)`);
  } else if (reviews >= 100) {
    reviewCountBonus = 14;
    reasons.push(`Solid Local Presence (${reviews} Google reviews) — Well recognized in the area (+14 pts)`);
  } else if (reviews >= 30) {
    reviewCountBonus = 10;
    reasons.push(`Active Local Business (${reviews} Google reviews) — Consistent review velocity (+10 pts)`);
  } else if (reviews >= 10) {
    reviewCountBonus = 6;
    reasons.push(`Emerging Local Business (${reviews} Google reviews) (+6 pts)`);
  } else {
    reviewCountBonus = 2;
    reasons.push(`New / Low Review Count (${reviews} reviews) (+2 pts)`);
  }
  score += reviewCountBonus;

  // --------------------------------------------------------------------------
  // PILLAR 3: Customer Trust & Reputation Quality (Max 20 pts)
  // --------------------------------------------------------------------------
  if (rating >= 4.8) {
    ratingBonus = 20;
    reasons.push(`Elite Customer Satisfaction (${rating.toFixed(1)} Stars) — Exceptional local trust & highest conversion probability (+20 pts)`);
  } else if (rating >= 4.5) {
    ratingBonus = 16;
    reasons.push(`Strong Customer Reputation (${rating.toFixed(1)} Stars) — High quality service (+16 pts)`);
  } else if (rating >= 4.2) {
    ratingBonus = 12;
    reasons.push(`Good Standing (${rating.toFixed(1)} Stars) (+12 pts)`);
  } else if (rating >= 3.8) {
    ratingBonus = 8;
    reasons.push(`Moderate Reputation (${rating.toFixed(1)} Stars) (+8 pts)`);
  } else if (rating > 0) {
    ratingBonus = 4;
    reasons.push(`Reputation Enhancement Target (${rating.toFixed(1)} Stars) (+4 pts)`);
  }
  score += ratingBonus;

  // --------------------------------------------------------------------------
  // PILLAR 4: Industry Value (LTV) & Direct Reachability (Max 20 pts)
  // --------------------------------------------------------------------------
  const normalizedCategory = (business.category || "").toLowerCase();
  const isTier1 = TIER_1_HIGH_TICKET_CATEGORIES.some((cat) =>
    normalizedCategory.includes(cat)
  );
  const isTier2 = TIER_2_MEDIUM_TICKET_CATEGORIES.some((cat) =>
    normalizedCategory.includes(cat)
  );

  if (isTier1) {
    categoryBonus = 10;
    reasons.push(`High-LTV Premium Industry (${business.category}) — High client lifetime value & strong willingness to invest (+10 pts)`);
  } else if (isTier2) {
    categoryBonus = 8;
    reasons.push(`High-Volume Commercial Industry (${business.category}) (+8 pts)`);
  } else {
    categoryBonus = 5;
    reasons.push(`Standard Local Business (${business.category}) (+5 pts)`);
  }
  score += categoryBonus;

  if (business.phone && business.phone.trim().length >= 7) {
    phoneAvailableBonus = 10;
    reasons.push("Direct Phone / WhatsApp Contact Available (+10 pts)");
  } else {
    phoneAvailableBonus = 0;
    reasons.push("No Direct Phone Listed (0 pts)");
  }
  score += phoneAvailableBonus;

  // Cap score between 0 and 100
  score = Math.min(100, Math.max(0, score));

  // Determine Priority Tier with clear, business-focused thresholds
  let priority: PriorityTier = "D";
  if (score >= 80) {
    priority = "A"; // Hot Lead (Urgent High-Value Target)
  } else if (score >= 65) {
    priority = "B"; // Warm Lead (Strong Upgrade Candidate)
  } else if (score >= 45) {
    priority = "C"; // Standard Lead (Moderate Potential)
  } else {
    priority = "D"; // Low Priority (Low Reviews or Incomplete Contact)
  }

  // Determine Specific Opportunity Type for tailored pitching
  let opportunityType: OpportunityType = "STANDARD_IMPROVEMENT";
  if (!rawWeb && reviews >= 50) {
    opportunityType = "NO_WEBSITE";
  } else if (isSocialOnlySite) {
    opportunityType = "HIGH_RATING_UNCLAIMED";
  } else if (hasValidWebsite && reviews >= 200) {
    opportunityType = "OUTDATED_WEBSITE";
  } else {
    opportunityType = "LOCAL_SEO_EXPANSION";
  }

  return {
    score,
    priority,
    reasons,
    opportunityType,
    scoreBreakdown: {
      noWebsiteBonus,
      ratingBonus,
      reviewCountBonus,
      phoneAvailableBonus,
      categoryBonus,
      unclaimedOrWeakPresenceBonus,
    },
  };
}
