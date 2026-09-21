import { prisma } from "@/lib/db";
import { generateGeminiAudit, sanitizePitchText, GeminiAuditResult } from "@/lib/ai/gemini";
import { whatsAppManager } from "@/lib/outreach/whatsapp-service";
import { EmailService } from "@/lib/outreach/email-service";
import { EmailScraper } from "@/lib/collectors/email-scraper";
import { QueueManager } from "./queue-manager";

export interface PipelineDispatchResult {
  success: boolean;
  businessId: string;
  businessName?: string;
  channel?: "WHATSAPP" | "EMAIL";
  phone?: string | null;
  email?: string | null;
  pitch?: string;
  audit?: GeminiAuditResult;
  error?: string;
  skipped?: boolean;
}

export interface PipelineOptions {
  forceChannel?: "WHATSAPP" | "EMAIL";
  enableEmail?: boolean;
  followUpIntervalDays?: number;
  dryRun?: boolean;
}

export class LeadPipeline {
  /**
   * Process a single business lead strictly Just-In-Time (JIT):
   * 1. Validate & Guard against double outreach
   * 2. JIT public email discovery from website if missing
   * 3. JIT Gemini 2.5 Flash audit & custom pitch generation
   * 4. Multi-channel dispatch (WhatsApp priority, SMTP email secondary)
   * 5. State update, OutreachLog persistence, and queue completion
   */
  static async processAndDispatch(
    businessId: string,
    options: PipelineOptions = {}
  ): Promise<PipelineDispatchResult> {
    const {
      forceChannel,
      enableEmail = true,
      followUpIntervalDays = 2,
      dryRun = false,
    } = options;

    try {
      // 1. Fetch Business with Lead & OutreachLogs
      const business = await prisma.business.findUnique({
        where: { id: businessId },
        include: {
          lead: true,
          outreachLogs: { where: { status: "SENT" } },
        },
      });

      if (!business) {
        await QueueManager.skipLead(businessId, "Business record not found");
        return { success: false, businessId, error: "Business not found", skipped: true };
      }

      // 2. Anti-double-contact Guard
      if (business.status === "CONTACTED" || business.outreachLogs.length > 0) {
        await QueueManager.completeLead(businessId);
        return {
          success: true,
          businessId,
          businessName: business.name,
          skipped: true,
          error: "Lead has already been contacted",
        };
      }

      // 3. Contact Validation: Need at least phone, email, or a website to enrich
      let targetPhone = business.phone;
      let targetEmail = business.email;

      if (!targetPhone && !targetEmail && !business.website) {
        await QueueManager.skipLead(businessId, "No phone, email, or website available");
        return {
          success: false,
          businessId,
          businessName: business.name,
          skipped: true,
          error: "No contact info available",
        };
      }

      // 4. JIT Email Discovery from Website if email is missing
      if (!targetEmail && business.website && enableEmail) {
        try {
          console.log(`[LeadPipeline] JIT discovering public email for "${business.name}" from ${business.website}...`);
          const scraped = await EmailScraper.scrapeEmailFromWebsite(business.website);
          if (scraped) {
            targetEmail = scraped;
            await prisma.business.update({
              where: { id: business.id },
              data: { email: targetEmail },
            }).catch(() => null);
            console.log(`[LeadPipeline] JIT discovered email for "${business.name}": ${targetEmail}`);
          }
        } catch (e: any) {
          console.warn(`[LeadPipeline] JIT email scraping notice for "${business.name}":`, e.message);
        }
      }

      // 5. JIT Gemini 2.5 Flash Audit
      let audit: GeminiAuditResult;
      if (business.lead?.aiAnalysis) {
        try {
          audit = JSON.parse(business.lead.aiAnalysis);
        } catch {
          audit = await this.generateAudit(business);
        }
      } else {
        audit = await this.generateAudit(business);
      }

      // 6. Channel Selection
      const waState = whatsAppManager.getState();
      const isWaReady = waState.status === "CONNECTED";

      let channel: "WHATSAPP" | "EMAIL" | null = null;
      if (forceChannel === "WHATSAPP" && targetPhone) {
        channel = "WHATSAPP";
      } else if (forceChannel === "EMAIL" && targetEmail) {
        channel = "EMAIL";
      } else if (isWaReady && targetPhone) {
        channel = "WHATSAPP";
      } else if (enableEmail && targetEmail) {
        channel = "EMAIL";
      }

      if (!channel) {
        const reason = !isWaReady && !enableEmail
          ? "WhatsApp is disconnected and auto-email is disabled"
          : !targetPhone && !targetEmail
          ? "No valid phone number or email found"
          : "Required dispatch channel is offline";

        await QueueManager.failLead(businessId, reason);
        return {
          success: false,
          businessId,
          businessName: business.name,
          error: reason,
        };
      }

      // 7. Pitch Preparation
      let pitchText: string | null = null;
      if (channel === "WHATSAPP") {
        const rawPitch = audit.suggestedPitch?.whatsapp;
        pitchText = rawPitch ? sanitizePitchText(rawPitch, { name: business.name, city: business.city }) : null;
      } else {
        pitchText = audit.suggestedPitch?.email || null;
      }

      if (!pitchText) {
        await QueueManager.failLead(businessId, "Gemini failed to craft a personalized pitch");
        return {
          success: false,
          businessId,
          businessName: business.name,
          error: "No pitch generated",
        };
      }

      // Dry run bypass
      if (dryRun) {
        await QueueManager.completeLead(businessId);
        return {
          success: true,
          businessId,
          businessName: business.name,
          channel,
          phone: targetPhone,
          email: targetEmail,
          pitch: pitchText,
          audit,
        };
      }

      // 8. Execute Channel Dispatch
      if (channel === "WHATSAPP" && targetPhone) {
        // Humanized connection stabilization check
        if (waState.lastConnectedAt) {
          const connectedAgo = Date.now() - new Date(waState.lastConnectedAt).getTime();
          if (connectedAgo < 8000) {
            await new Promise((r) => setTimeout(r, 8000 - connectedAgo));
          }
        }

        const sendRes = await whatsAppManager.sendMessage(targetPhone, pitchText, business.city);
        if (sendRes.success) {
          await this.recordSuccessfulOutreach(business.id, "WHATSAPP", pitchText, followUpIntervalDays);
          await QueueManager.completeLead(business.id);

          return {
            success: true,
            businessId,
            businessName: business.name,
            channel: "WHATSAPP",
            phone: targetPhone,
            pitch: pitchText,
            audit,
          };
        } else {
          // WhatsApp error handling
          if (sendRes.error?.includes("not registered on WhatsApp") || sendRes.error?.includes("invalid")) {
            await prisma.business.update({
              where: { id: business.id },
              data: { status: "DISQUALIFIED" },
            }).catch(() => null);
            await QueueManager.skipLead(business.id, sendRes.error);
          } else {
            await QueueManager.failLead(business.id, sendRes.error || "WhatsApp send failed");
          }

          return {
            success: false,
            businessId,
            businessName: business.name,
            channel: "WHATSAPP",
            phone: targetPhone,
            error: sendRes.error,
          };
        }
      } else if (channel === "EMAIL" && targetEmail) {
        const { subject, body } = EmailService.parseEmailPitch(pitchText, business.name);
        const emailRes = await EmailService.sendLeadEmail({
          to: targetEmail,
          subject,
          body,
          leadId: business.id,
          businessName: business.name,
        });

        if (emailRes.success) {
          const fullMessage = `Subject: ${subject}\n\n${body}`;
          await this.recordSuccessfulOutreach(business.id, "EMAIL", fullMessage, followUpIntervalDays);
          await QueueManager.completeLead(business.id);

          return {
            success: true,
            businessId,
            businessName: business.name,
            channel: "EMAIL",
            email: targetEmail,
            pitch: fullMessage,
            audit,
          };
        } else {
          await QueueManager.failLead(business.id, emailRes.error || "Email send failed");
          return {
            success: false,
            businessId,
            businessName: business.name,
            channel: "EMAIL",
            email: targetEmail,
            error: emailRes.error,
          };
        }
      }

      return {
        success: false,
        businessId,
        businessName: business.name,
        error: "Dispatch channel execution failed",
      };
    } catch (err: any) {
      console.error(`[LeadPipeline] Error processing ${businessId}:`, err.message);
      await QueueManager.failLead(businessId, err.message);
      return { success: false, businessId, error: err.message };
    }
  }

  private static async generateAudit(business: any): Promise<GeminiAuditResult> {
    console.log(`[LeadPipeline] JIT generating Gemini 2.5 Flash audit for "${business.name}"...`);
    const audit = await generateGeminiAudit({
      id: business.id,
      name: business.name,
      category: business.category,
      city: business.city,
      rating: business.rating,
      reviewCount: business.reviewCount,
      website: business.website,
      phone: business.phone,
    });

    if (business.lead) {
      await prisma.lead.update({
        where: { id: business.lead.id },
        data: { aiAnalysis: JSON.stringify(audit) },
      }).catch(() => null);
    }

    return audit;
  }

  private static async recordSuccessfulOutreach(
    businessId: string,
    channel: "WHATSAPP" | "EMAIL",
    message: string,
    followUpIntervalDays: number
  ) {
    const nextFollowUpAt = new Date(Date.now() + followUpIntervalDays * 24 * 60 * 60 * 1000);

    await prisma.business.update({
      where: { id: businessId },
      data: {
        status: "CONTACTED",
        lastContactedAt: new Date(),
        followUpCount: 0,
        nextFollowUpAt,
      },
    });

    await prisma.outreachLog.create({
      data: {
        businessId,
        channel,
        step: 0,
        message,
        status: "SENT",
      },
    }).catch(() => null);
  }
}
