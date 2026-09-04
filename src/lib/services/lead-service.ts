import prisma from "../db";
import { searchGooglePlaces } from "../collectors/google-maps";
import { qualifyAndScoreLead } from "../scoring/lead-qualifier";
import { EmailScraper } from "../collectors/email-scraper";
import { RawBusinessLead, LeadFilterParams } from "../types";

export interface DiscoveryResult {
  searchLogId: string;
  totalFound: number;
  newLeadsCreated: number;
  duplicatesSkipped: number;
  leads: Array<{
    id: string;
    name: string;
    category: string;
    city: string;
    phone: string | null;
    website: string | null;
    rating: number;
    reviewCount: number;
    score: number;
    priority: string;
    hasWebsite: boolean;
    reasons: string[];
    isNew: boolean;
  }>;
}

export class LeadService {
  /**
   * Run automated lead discovery for a niche + location
   */
  static async discoverAndIngest(
    keyword: string,
    location: string,
    limit: number = 20
  ): Promise<DiscoveryResult> {
    console.log(`[LeadService.discoverAndIngest] Starting discovery for query: "${keyword}" in location: "${location}" (limit: ${limit})`);
    const rawLeads = await searchGooglePlaces(keyword, location, limit);
    console.log(`[LeadService.discoverAndIngest] Collector returned ${rawLeads.length} raw leads`);

    let newLeadsCount = 0;
    let duplicatesCount = 0;
    const processedResults: DiscoveryResult["leads"] = [];

    for (const raw of rawLeads) {
      // 1. Check for duplicate business
      const existing = await this.findDuplicate(raw);

      // Score the lead using qualification engine
      const scored = qualifyAndScoreLead(raw);
      const hasWebsite = Boolean(
        raw.website &&
        raw.website.trim().length > 0 &&
        !raw.website.includes("facebook.com") &&
        !raw.website.includes("instagram.com")
      );

      if (existing) {
        duplicatesCount++;
        // Update rating/reviews if newer
        await prisma.business.update({
          where: { id: existing.id },
          data: {
            category: raw.category || existing.category,
            rating: raw.rating || existing.rating,
            reviewCount: raw.reviewCount || existing.reviewCount,
            phone: raw.phone || existing.phone,
            website: raw.website || existing.website,
          },
        });

        // Update score
        if (existing.lead) {
          await prisma.lead.update({
            where: { id: existing.lead.id },
            data: {
              score: scored.score,
              priority: scored.priority,
              qualificationReasons: JSON.stringify(scored.reasons),
              hasWebsite,
              opportunityType: scored.opportunityType,
            },
          });
        }

        processedResults.push({
          id: existing.id,
          name: existing.name,
          category: raw.category || existing.category,
          city: existing.city,
          phone: raw.phone || existing.phone,
          website: raw.website || existing.website,
          rating: raw.rating,
          reviewCount: raw.reviewCount,
          score: scored.score,
          priority: scored.priority,
          hasWebsite,
          reasons: scored.reasons,
          isNew: false,
        });
      } else {
        // Automatically scrape public email if website exists
        let discoveredEmail = raw.email || null;
        if (!discoveredEmail && raw.website) {
          try {
            discoveredEmail = await EmailScraper.scrapeEmailFromWebsite(raw.website);
          } catch {
            // ignore scraper error
          }
        }

        // Create new Business + Lead
        newLeadsCount++;
        const createdBusiness = await prisma.business.create({
          data: {
            name: raw.name,
            category: raw.category || keyword,
            phone: raw.phone || null,
            email: discoveredEmail,
            website: raw.website || null,
            address: raw.address || null,
            city: raw.city || location,
            rating: raw.rating || 0,
            reviewCount: raw.reviewCount || 0,
            googleMapsUrl: raw.googleMapsUrl || null,
            googlePlaceId: raw.googlePlaceId || null,
            status: "NEW",
            lead: {
              create: {
                score: scored.score,
                priority: scored.priority,
                qualificationReasons: JSON.stringify(scored.reasons),
                hasWebsite,
                opportunityType: scored.opportunityType,
                source: "GOOGLE_MAPS",
                assignedStatus: "NEW",
              },
            },
          },
          include: {
            lead: true,
          },
        });

        processedResults.push({
          id: createdBusiness.id,
          name: createdBusiness.name,
          category: createdBusiness.category,
          city: createdBusiness.city,
          phone: createdBusiness.phone,
          website: createdBusiness.website,
          rating: createdBusiness.rating,
          reviewCount: createdBusiness.reviewCount,
          score: scored.score,
          priority: scored.priority,
          hasWebsite,
          reasons: scored.reasons,
          isNew: true,
        });
      }
    }

    // Create Search Log
    const searchLog = await prisma.searchLog.create({
      data: {
        query: keyword,
        location,
        resultsCount: rawLeads.length,
        newLeadsCount,
        status: "COMPLETED",
      },
    });

    console.log(`[LeadService.discoverAndIngest] Ingestion completed. New: ${newLeadsCount}, Duplicates updated: ${duplicatesCount}`);

    return {
      searchLogId: searchLog.id,
      totalFound: rawLeads.length,
      newLeadsCreated: newLeadsCount,
      duplicatesSkipped: duplicatesCount,
      leads: processedResults,
    };
  }

  /**
   * Rescore all existing leads in the database using the updated multi-pillar scoring algorithm
   */
  static async rescoreAllLeads() {
    const businesses = await prisma.business.findMany({
      include: { lead: true },
    });

    let updatedCount = 0;
    for (const b of businesses) {
      const raw: RawBusinessLead = {
        name: b.name,
        category: b.category,
        city: b.city,
        address: b.address || "",
        phone: b.phone,
        email: b.email,
        website: b.website,
        rating: b.rating,
        reviewCount: b.reviewCount,
        googleMapsUrl: b.googleMapsUrl,
        googlePlaceId: b.googlePlaceId,
      };

      const scored = qualifyAndScoreLead(raw);
      const hasWebsite = Boolean(
        raw.website &&
        raw.website.trim().length > 0 &&
        !raw.website.includes("facebook.com") &&
        !raw.website.includes("instagram.com")
      );

      if (b.lead) {
        await prisma.lead.update({
          where: { id: b.lead.id },
          data: {
            score: scored.score,
            priority: scored.priority,
            qualificationReasons: JSON.stringify(scored.reasons),
            hasWebsite,
            opportunityType: scored.opportunityType,
          },
        });
        updatedCount++;
      }
    }

    console.log(`[LeadService.rescoreAllLeads] Rescored ${updatedCount} leads in database.`);
    return { count: updatedCount };
  }

  /**
   * Multi-factor deduplication check
   */
  private static async findDuplicate(raw: RawBusinessLead) {
    if (raw.googlePlaceId) {
      const byPlace = await prisma.business.findUnique({
        where: { googlePlaceId: raw.googlePlaceId },
        include: { lead: true },
      });
      if (byPlace) return byPlace;
    }

    if (raw.phone && raw.phone.trim().length > 6) {
      const byPhone = await prisma.business.findFirst({
        where: { phone: raw.phone.trim() },
        include: { lead: true },
      });
      if (byPhone) return byPhone;
    }

    // Name + City match
    const byNameAndCity = await prisma.business.findFirst({
      where: {
        name: { equals: raw.name.trim() },
        city: { equals: raw.city.trim() },
      },
      include: { lead: true },
    });

    return byNameAndCity;
  }

  /**
   * Get filtered and paginated leads with full relation
   */
  static async getLeads(params: LeadFilterParams) {
    const {
      query,
      city,
      category,
      priority,
      hasWebsite,
      status,
      minScore,
      page = 1,
      limit = 20,
    } = params;

    const skip = (page - 1) * limit;

    const where: any = {};

    if (query && query.trim() !== "") {
      const q = query.trim();
      where.OR = [
        { name: { contains: q } },
        { phone: { contains: q } },
        { address: { contains: q } },
        { category: { contains: q } },
        { city: { contains: q } },
      ];
    }

    if (city && city !== "all") {
      where.city = { contains: city.trim() };
    }

    if (category && category !== "all") {
      where.category = { contains: category.trim() };
    }

    if (status && status !== "all") {
      where.status = status;
    }

    // Lead model filters
    const leadWhere: any = {};

    if (priority && priority !== "all") {
      leadWhere.priority = priority;
    }

    if (hasWebsite === "no") {
      leadWhere.hasWebsite = false;
    } else if (hasWebsite === "yes") {
      leadWhere.hasWebsite = true;
    }

    if (minScore !== undefined && minScore > 0) {
      leadWhere.score = { gte: minScore };
    }

    if (Object.keys(leadWhere).length > 0) {
      where.lead = leadWhere;
    }

    console.log("[LeadService.getLeads] Querying leads with WHERE clause:", JSON.stringify(where));

    const [total, items] = await Promise.all([
      prisma.business.count({ where }),
      prisma.business.findMany({
        where,
        include: {
          lead: true,
        },
        orderBy: [
          {
            lead: {
              score: "desc",
            },
          },
          { createdAt: "desc" },
        ],
        skip,
        take: limit,
      }),
    ]);

    console.log(`[LeadService.getLeads] Found ${total} total matching leads (returning ${items.length} items on page ${page})`);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      items,
    };
  }

  /**
   * Get single lead by ID with full details
   */
  static async getLeadById(id: string) {
    return await prisma.business.findUnique({
      where: { id },
      include: { lead: true },
    });
  }

  /**
   * Get unique available cities and categories for UI filter dropdowns
   */
  static async getAvailableFilters() {
    const [businesses, categories] = await Promise.all([
      prisma.business.findMany({
        select: { city: true },
        distinct: ["city"],
      }),
      prisma.business.findMany({
        select: { category: true },
        distinct: ["category"],
      }),
    ]);

    const cities = businesses.map((b) => b.city).filter(Boolean);
    const uniqueCategories = categories.map((c) => c.category).filter(Boolean);

    return {
      cities,
      categories: uniqueCategories,
    };
  }

  /**
   * Get dashboard statistics
   */
  static async getDashboardStats() {
    const [
      totalBusinesses,
      priorityACount,
      priorityBCount,
      priorityCCount,
      priorityDCount,
      noWebsiteCount,
      hasWebsiteCount,
      recentSearches,
      recentLeads,
      filters,
    ] = await Promise.all([
      prisma.business.count(),
      prisma.lead.count({ where: { priority: "A" } }),
      prisma.lead.count({ where: { priority: "B" } }),
      prisma.lead.count({ where: { priority: "C" } }),
      prisma.lead.count({ where: { priority: "D" } }),
      prisma.lead.count({ where: { hasWebsite: false } }),
      prisma.lead.count({ where: { hasWebsite: true } }),
      prisma.searchLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.business.findMany({
        include: { lead: true },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
      this.getAvailableFilters(),
    ]);

    return {
      totalBusinesses,
      priorityACount,
      priorityBCount,
      priorityCCount,
      priorityDCount,
      noWebsiteCount,
      hasWebsiteCount,
      recentSearches,
      recentLeads,
      availableCities: filters.cities,
      availableCategories: filters.categories,
    };
  }
}
