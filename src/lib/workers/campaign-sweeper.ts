import { LeadService } from "@/lib/services/lead-service";
import { QueueManager } from "./queue-manager";

export interface TargetCampaign {
  id: string;
  keyword: string;
  location: string;
  enabled: boolean;
}

export interface SweepResult {
  campaign: TargetCampaign;
  totalFound: number;
  newLeadsCreated: number;
  enqueuedCount: number;
}

export class CampaignSweeper {
  private static campaigns: TargetCampaign[] = [
    { id: "q1", keyword: "Gyms & Fitness", location: "London", enabled: true },
    { id: "q2", keyword: "Dentists", location: "New York", enabled: true },
    { id: "q3", keyword: "Beauty Salons & Spas", location: "Dubai", enabled: true },
    { id: "q4", keyword: "Medical Clinics", location: "Los Angeles", enabled: true },
  ];

  private static currentIndex = 0;
  private static isSweeping = false;

  static getCampaigns(): TargetCampaign[] {
    return [...this.campaigns];
  }

  static setCampaigns(newCampaigns: TargetCampaign[]) {
    this.campaigns = newCampaigns;
  }

  static addCampaign(keyword: string, location: string): TargetCampaign {
    const newCamp: TargetCampaign = {
      id: "q_" + Math.random().toString(36).substring(2, 8),
      keyword: keyword.trim(),
      location: location.trim(),
      enabled: true,
    };
    this.campaigns.push(newCamp);
    return newCamp;
  }

  static removeCampaign(id: string) {
    this.campaigns = this.campaigns.filter((c) => c.id !== id);
  }

  static toggleCampaign(id: string) {
    this.campaigns = this.campaigns.map((c) =>
      c.id === id ? { ...c, enabled: !c.enabled } : c
    );
  }

  /**
   * Non-blocking Campaign Sweep:
   * Scrapes raw leads and enqueues them WITHOUT executing heavy LLM audits.
   */
  static async sweepNextCampaign(limit: number = 15): Promise<SweepResult | null> {
    if (this.isSweeping) {
      console.log("[CampaignSweeper] Sweep already in progress. Skipping.");
      return null;
    }

    const activeCampaigns = this.campaigns.filter((c) => c.enabled);
    if (activeCampaigns.length === 0) {
      console.warn("[CampaignSweeper] No enabled campaigns to sweep.");
      return null;
    }

    const campaign = activeCampaigns[this.currentIndex % activeCampaigns.length];
    this.currentIndex++;

    this.isSweeping = true;
    try {
      console.log(`[CampaignSweeper] Sweeping "${campaign.keyword}" in "${campaign.location}" (limit: ${limit})...`);
      const result = await LeadService.discoverAndIngest(campaign.keyword, campaign.location, limit);

      // Extract candidate business IDs that are eligible for outreach
      const candidateIds = result.leads.map((l) => l.id);

      // Non-blocking bulk enqueue into persistent QueueManager
      const { enqueued } = await QueueManager.enqueueMany(candidateIds, 0);

      console.log(
        `[CampaignSweeper] Sweep complete for "${campaign.keyword}": ${result.totalFound} found, ${result.newLeadsCreated} created, ${enqueued} enqueued into Autopilot Queue.`
      );

      return {
        campaign,
        totalFound: result.totalFound,
        newLeadsCreated: result.newLeadsCreated,
        enqueuedCount: enqueued,
      };
    } catch (err: any) {
      console.error(`[CampaignSweeper] Error sweeping campaign:`, err.message);
      return null;
    } finally {
      this.isSweeping = false;
    }
  }
}
