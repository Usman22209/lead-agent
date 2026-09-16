export type PriorityTier = "A" | "B" | "C" | "D";

export type OpportunityType =
  | "NO_WEBSITE"
  | "OUTDATED_WEBSITE"
  | "HIGH_RATING_UNCLAIMED"
  | "LOCAL_SEO_EXPANSION"
  | "STANDARD_IMPROVEMENT";

export interface RawBusinessLead {
  id?: string;
  name: string;
  category: string;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  address?: string | null;
  city: string;
  rating: number;
  reviewCount: number;
  googleMapsUrl?: string | null;
  googlePlaceId?: string | null;
}

export interface LeadScoreResult {
  score: number; // 0 - 100
  priority: PriorityTier;
  reasons: string[];
  opportunityType: OpportunityType;
  scoreBreakdown: {
    noWebsiteBonus: number;
    ratingBonus: number;
    reviewCountBonus: number;
    phoneAvailableBonus: number;
    categoryBonus: number;
    unclaimedOrWeakPresenceBonus: number;
  };
}

export interface BusinessWithLead {
  id: string;
  name: string;
  category: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  city: string;
  rating: number;
  reviewCount: number;
  googleMapsUrl: string | null;
  googlePlaceId: string | null;
  status: string;
  lastContactedAt?: Date | string | null;
  followUpCount?: number;
  nextFollowUpAt?: Date | string | null;
  outreachLogs?: {
    id: string;
    channel: string;
    step: number;
    message: string;
    sentAt: Date | string;
    status: string;
  }[];
  createdAt: Date;
  updatedAt: Date;
  lead?: {
    id: string;
    score: number;
    priority: string;
    qualificationReasons: string;
    hasWebsite: boolean;
    opportunityType: string;
    source: string;
    assignedStatus: string;
    createdAt: Date;
    updatedAt: Date;
  } | null;
}

export interface LeadFilterParams {
  query?: string;
  city?: string;
  category?: string;
  priority?: string;
  hasWebsite?: string; // "all" | "yes" | "no"
  status?: string;
  minScore?: number;
  page?: number;
  limit?: number;
}
