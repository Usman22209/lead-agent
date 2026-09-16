import cron, { ScheduledTask } from "node-cron";
import { prisma } from "@/lib/db";
import { LeadService } from "@/lib/services/lead-service";
import { generateGeminiAudit, sanitizePitchText, getFollowUpPitch } from "@/lib/ai/gemini";
import { whatsAppManager } from "@/lib/outreach/whatsapp-service";
import { EmailService } from "@/lib/outreach/email-service";
import { EmailScraper } from "@/lib/collectors/email-scraper";

export interface TargetCampaignQueue {
  id: string;
  keyword: string;
  location: string;
  enabled: boolean;
}

export interface AutoPilotConfig {
  dailyWhatsAppLimit: number;
  enableEmail: boolean;
  minDelaySeconds: number;
  maxDelaySeconds: number;
  workHoursOnly: boolean;
  startHour: number;
  endHour: number;
  minimumScore: number;
  enableFollowUps: boolean;
  followUpIntervalDays: number;
  maxFollowUps: number;
}

export interface AutoPilotLog {
  id: string;
  timestamp: string;
  type: "DISCOVERY" | "AUDIT" | "WHATSAPP_SENT" | "WHATSAPP_ERROR" | "EMAIL_SENT" | "EMAIL_ERROR" | "FOLLOWUP_SENT" | "FOLLOWUP_ERROR" | "INFO" | "SKIPPED";
  message: string;
  businessName?: string;
  phone?: string;
  score?: number;
}

export interface AutoPilotState {
  isActive: boolean;
  sentToday: number;
  emailsSentToday: number;
  followUpsSentToday: number;
  pendingFollowUpsDue: number;
  dailyLimit: number;
  currentQueueIndex: number;
  targetQueues: TargetCampaignQueue[];
  config: AutoPilotConfig;
  logs: AutoPilotLog[];
  lastRunAt: string | null;
  nextScheduledRun: string | null;
}

class AutoPilotEngine {
  private isActive = false;
  private sentToday = 0;
  private emailsSentToday = 0;
  private followUpsSentToday = 0;
  private lastResetDate = new Date().toDateString();
  private cronJob: ScheduledTask | null = null;
  private currentQueueIndex = 0;
  private lastRunAt: string | null = null;
  private logs: AutoPilotLog[] = [];

  private targetQueues: TargetCampaignQueue[] = [
    { id: "q1", keyword: "Gyms & Fitness", location: "London", enabled: true },
    { id: "q2", keyword: "Dentists", location: "Lahore", enabled: true },
    { id: "q3", keyword: "Beauty Salons & Spas", location: "Dubai", enabled: true },
    { id: "q4", keyword: "Medical Clinics", location: "Karachi", enabled: true },
  ];

  private config: AutoPilotConfig = {
    dailyWhatsAppLimit: 35,
    enableEmail: true,
    minDelaySeconds: 30,
    maxDelaySeconds: 60,
    workHoursOnly: false, // Default false so user can test immediately at any time
    startHour: 9,
    endHour: 18,
    minimumScore: 70, // Priority A & B leads
    enableFollowUps: true,
    followUpIntervalDays: 2,
    maxFollowUps: 2,
  };

  constructor() {
    // Schedule midnight reset for daily counter
    cron.schedule("0 0 * * *", () => {
      this.sentToday = 0;
      this.emailsSentToday = 0;
      this.followUpsSentToday = 0;
      this.lastResetDate = new Date().toDateString();
      this.addLog("INFO", "Daily dispatch counters reset to 0 for the new day.");
    });
  }

  public getState(): AutoPilotState {
    this.checkDailyReset();
    return {
      isActive: this.isActive,
      sentToday: this.sentToday,
      emailsSentToday: this.emailsSentToday,
      followUpsSentToday: this.followUpsSentToday,
      pendingFollowUpsDue: 0,
      dailyLimit: this.config.dailyWhatsAppLimit,
      currentQueueIndex: this.currentQueueIndex,
      targetQueues: this.targetQueues,
      config: this.config,
      logs: this.logs.slice(-25).reverse(),
      lastRunAt: this.lastRunAt,
      nextScheduledRun: this.isActive ? "Running active dispatch loop" : "Paused",
    };
  }

  public async getStateAsync(): Promise<AutoPilotState> {
    const state = this.getState();
    try {
      state.pendingFollowUpsDue = await prisma.business.count({
        where: {
          status: "CONTACTED",
          nextFollowUpAt: { lte: new Date() },
          followUpCount: { lt: this.config.maxFollowUps },
        },
      });
    } catch {}
    return state;
  }

  public updateConfig(newConfig: Partial<AutoPilotConfig>, newQueues?: TargetCampaignQueue[]) {
    this.config = { ...this.config, ...newConfig };
    if (newQueues) this.targetQueues = newQueues;
    this.addLog("INFO", "Auto-Pilot configuration & queues updated.");
  }

  public start(): void {
    if (this.isActive) return;
    this.isActive = true;
    this.addLog("INFO", "🚀 Auto-Pilot Outbound Agent started.");

    // Trigger an immediate execution run asynchronously
    this.runExecutionCycle().catch((err) => {
      this.addLog("INFO", `Cycle error: ${err.message}`);
    });
  }

  public pause(): void {
    this.isActive = false;
    this.addLog("INFO", "⏸️ Auto-Pilot Outbound Agent paused.");
  }

  private checkDailyReset() {
    const today = new Date().toDateString();
    if (today !== this.lastResetDate) {
      this.sentToday = 0;
      this.lastResetDate = today;
    }
  }

  public async runExecutionCycle(): Promise<void> {
    if (!this.isActive) return;
    this.checkDailyReset();

    // 1. Check Daily Limit
    if (this.sentToday >= this.config.dailyWhatsAppLimit) {
      this.addLog(
        "INFO",
        `Daily limit of ${this.config.dailyWhatsAppLimit} messages reached for today (${this.sentToday} sent). Sleeping until next cycle.`
      );
      return;
    }

    // 2. Check Business Hours if enabled
    if (this.config.workHoursOnly) {
      const currentHour = new Date().getHours();
      if (currentHour < this.config.startHour || currentHour >= this.config.endHour) {
        this.addLog("INFO", `Outside business hours (${this.config.startHour}:00 - ${this.config.endHour}:00). Sleeping.`);
        return;
      }
    }

    // ══════════════════════════════════════════════════════════════════════
    // 3. PRIORITY PHASE 1: DISPATCH DUE FOLLOW-UPS (HIGHEST CONVERSION ROI)
    // ══════════════════════════════════════════════════════════════════════
    if (this.config.enableFollowUps) {
      try {
        const now = new Date();
        const dueFollowUps = await prisma.business.findMany({
          where: {
            status: "CONTACTED",
            nextFollowUpAt: { lte: now },
            followUpCount: { lt: this.config.maxFollowUps },
          },
          include: { lead: true },
          take: 5,
        });

        if (dueFollowUps.length > 0) {
          this.addLog("INFO", `Found ${dueFollowUps.length} follow-up(s) due for outreach sequence. Processing...`);

          for (const biz of dueFollowUps) {
            if (!this.isActive) break;
            if (this.sentToday >= this.config.dailyWhatsAppLimit) break;

            const waState = whatsAppManager.getState();
            const isWaReady = waState.status === "CONNECTED";
            const nextStep = (biz.followUpCount ?? 0) + 1;

            let auditData: any = null;
            try {
              if (biz.lead?.aiAnalysis) {
                auditData = JSON.parse(biz.lead.aiAnalysis);
              }
            } catch {}

            // Determine channel: Prioritize WhatsApp if connected and phone exists, else Email
            let channel: "WHATSAPP" | "EMAIL" | null = null;
            if (isWaReady && biz.phone) {
              channel = "WHATSAPP";
            } else if (this.config.enableEmail && biz.email) {
              channel = "EMAIL";
            }

            if (!channel) {
              // Both unavailable right now, postpone by 1 day
              await prisma.business.update({
                where: { id: biz.id },
                data: { nextFollowUpAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
              }).catch(() => null);
              continue;
            }

            const pitch = getFollowUpPitch(auditData, biz, channel, nextStep);
            let dispatched = false;

            if (channel === "WHATSAPP" && biz.phone) {
              const sendRes = await whatsAppManager.sendMessage(biz.phone, pitch, biz.city);
              if (sendRes.success) {
                dispatched = true;
                this.sentToday++;
                this.followUpsSentToday++;
                this.addLog(
                  "FOLLOWUP_SENT",
                  `✅ Sent Follow-up #${nextStep} via WhatsApp to "${biz.name}" (${biz.phone})!`,
                  biz.name,
                  biz.phone,
                  biz.lead?.score
                );
              } else {
                this.addLog(
                  "FOLLOWUP_ERROR",
                  `WhatsApp follow-up failed for "${biz.name}": ${sendRes.error}`,
                  biz.name,
                  biz.phone
                );
              }
            } else if (channel === "EMAIL" && biz.email) {
              try {
                const { subject, body } = EmailService.parseEmailPitch(pitch, biz.name);
                const emailRes = await EmailService.sendLeadEmail({
                  to: biz.email,
                  subject,
                  body,
                  leadId: biz.id,
                  businessName: biz.name,
                });
                if (emailRes.success) {
                  dispatched = true;
                  this.emailsSentToday++;
                  this.followUpsSentToday++;
                  this.addLog(
                    "FOLLOWUP_SENT",
                    `📧 Sent Follow-up #${nextStep} via Email to "${biz.name}" (${biz.email})!`,
                    biz.name,
                    undefined,
                    biz.lead?.score
                  );
                } else {
                  this.addLog(
                    "FOLLOWUP_ERROR",
                    `Email follow-up failed for "${biz.name}": ${emailRes.error}`,
                    biz.name
                  );
                }
              } catch (err: any) {
                this.addLog(
                  "FOLLOWUP_ERROR",
                  `Email follow-up error for "${biz.name}": ${err.message}`,
                  biz.name
                );
              }
            }

            if (dispatched) {
              const nextFollowUpAt =
                nextStep < this.config.maxFollowUps
                  ? new Date(Date.now() + this.config.followUpIntervalDays * 24 * 60 * 60 * 1000)
                  : null; // Final touch reached

              await prisma.business.update({
                where: { id: biz.id },
                data: {
                  lastContactedAt: new Date(),
                  followUpCount: nextStep,
                  nextFollowUpAt,
                },
              });

              await (prisma as any).outreachLog.create({
                data: {
                  businessId: biz.id,
                  channel,
                  step: nextStep,
                  message: pitch,
                  status: "SENT",
                },
              }).catch(() => null);

              // Jitter delay between follow-ups
              const delaySec = Math.floor(
                Math.random() * (this.config.maxDelaySeconds - this.config.minDelaySeconds + 1) +
                  this.config.minDelaySeconds
              );
              this.addLog("INFO", `Follow-up pacing delay: waiting ${delaySec}s before next action...`);
              await new Promise((res) => setTimeout(res, delaySec * 1000));
            }
          }
        }
      } catch (fErr: any) {
        this.addLog("INFO", `Follow-up check notice: ${fErr.message}`);
      }
    }

    // ══════════════════════════════════════════════════════════════════════
    // 4. PHASE 2: NEW LEAD DISCOVERY & INITIAL OUTREACH
    // ══════════════════════════════════════════════════════════════════════
    const activeQueues = this.targetQueues.filter((q) => q.enabled);
    if (activeQueues.length === 0) {
      this.addLog("INFO", "No active target search queues configured. Add a search target to proceed.");
      return;
    }

    const currentTarget = activeQueues[this.currentQueueIndex % activeQueues.length];
    this.currentQueueIndex++;
    this.lastRunAt = new Date().toISOString();

    this.addLog("DISCOVERY", `Searching market for "${currentTarget.keyword}" in "${currentTarget.location}"...`);

    try {
      // 5. Run Lead Discovery & Qualification
      const result = await LeadService.discoverAndIngest(currentTarget.keyword, currentTarget.location, 15);
      this.addLog(
        "DISCOVERY",
        `Discovery finished: ${result.totalFound} found (${result.newLeadsCreated} new, ${result.duplicatesSkipped} updated).`
      );

      // 6. Query candidate leads from database ready for outreach (either phone or email)
      const candidateLeads = await prisma.business.findMany({
        where: {
          city: currentTarget.location,
          OR: [
            { phone: { not: null } },
            { email: { not: null } },
          ],
          status: { in: ["NEW", "QUALIFIED"] },
          lead: {
            score: { gte: this.config.minimumScore },
          },
        },
        include: { lead: true },
        take: 10,
      });

      if (candidateLeads.length === 0) {
        this.addLog("INFO", `No uncontacted leads with Score >= ${this.config.minimumScore} in ${currentTarget.location}.`);
        return;
      }

      this.addLog("INFO", `Found ${candidateLeads.length} high-priority prospects ready for AI audit & outreach.`);

      // 7. Iterate through candidate leads with human pacing
      for (const biz of candidateLeads) {
        if (!this.isActive) break;

        const waState = whatsAppManager.getState();
        const isWaReady = waState.status === "CONNECTED";

        // Check if both channels are unavailable
        if (!isWaReady && !this.config.enableEmail) {
          this.addLog(
            "WHATSAPP_ERROR",
            "WhatsApp is not connected and Auto-Email is disabled! Connect WhatsApp or enable Email to proceed.",
            biz.name,
            biz.phone || undefined
          );
          break;
        }

        // Connection stabilization: don't send messages within 10s of connecting
        if (isWaReady && waState.lastConnectedAt) {
          const connectedAgo = Date.now() - new Date(waState.lastConnectedAt).getTime();
          if (connectedAgo < 10000) {
            const waitMs = 10000 - connectedAgo;
            this.addLog("INFO", `WhatsApp just connected ${Math.round(connectedAgo / 1000)}s ago. Stabilizing for ${Math.round(waitMs / 1000)}s...`);
            await new Promise((res) => setTimeout(res, waitMs));
          }
        }

        // A. Generate Gemini 2.5 Flash Audit and Custom Pitch
        this.addLog("AUDIT", `Generating Gemini 2.5 Flash custom audit & pitch for "${biz.name}"...`, biz.name);
        const audit = await generateGeminiAudit({
          id: biz.id,
          name: biz.name,
          category: biz.category,
          city: biz.city,
          rating: biz.rating,
          reviewCount: biz.reviewCount,
          website: biz.website,
          phone: biz.phone,
        });

        // Save audit to database
        await (prisma.lead.update as any)({
          where: { businessId: biz.id },
          data: { aiAnalysis: JSON.stringify(audit) },
        }).catch(() => null);

        const rawPitch = audit.suggestedPitch?.whatsapp;
        const pitchText = rawPitch ? sanitizePitchText(rawPitch, { name: biz.name, city: biz.city }) : null;
        if (isWaReady && this.sentToday < this.config.dailyWhatsAppLimit && pitchText && biz.phone) {
          // B. Send WhatsApp Message
          const sendRes = await whatsAppManager.sendMessage(biz.phone, pitchText, biz.city);

          if (sendRes.success) {
            this.sentToday++;
            const nextFollowUpDate = this.config.enableFollowUps
              ? new Date(Date.now() + this.config.followUpIntervalDays * 24 * 60 * 60 * 1000)
              : null;

            await prisma.business.update({
              where: { id: biz.id },
              data: {
                status: "CONTACTED",
                lastContactedAt: new Date(),
                followUpCount: 0,
                nextFollowUpAt: nextFollowUpDate,
              },
            });

            await (prisma as any).outreachLog.create({
              data: {
                businessId: biz.id,
                channel: "WHATSAPP",
                step: 0,
                message: pitchText,
                status: "SENT",
              },
            }).catch(() => null);

            this.addLog(
              "WHATSAPP_SENT",
              `✅ Sent personalized pitch to "${biz.name}" (${biz.phone})!`,
              biz.name,
              biz.phone,
              biz.lead?.score
            );

            // C. Randomized Human-like Jitter Delay (e.g. 30–60 seconds)
            const delaySec =
              Math.floor(
                Math.random() * (this.config.maxDelaySeconds - this.config.minDelaySeconds + 1) +
                  this.config.minDelaySeconds
              );
            this.addLog(
              "INFO",
              `Pacing safety delay: waiting ${delaySec}s before next message...`
            );
            await new Promise((res) => setTimeout(res, delaySec * 1000));
          } else {
            // If number is not on WhatsApp or invalid, mark lead so AutoPilot won't retry it repeatedly
            if (sendRes.error?.includes("not registered on WhatsApp") || sendRes.error?.includes("invalid")) {
              await prisma.business.update({
                where: { id: biz.id },
                data: { status: "DISQUALIFIED" },
              }).catch(() => null);
            }
            this.addLog(
              "WHATSAPP_ERROR",
              `Skipped "${biz.name}": ${sendRes.error}`,
              biz.name,
              biz.phone
            );
          }
        }

        // B2. Send Cold Email if enabled
        let targetEmail = biz.email;
        if (!targetEmail && biz.website && this.config.enableEmail) {
          try {
            targetEmail = await EmailScraper.scrapeEmailFromWebsite(biz.website);
            if (targetEmail) {
              await prisma.business.update({
                where: { id: biz.id },
                data: { email: targetEmail },
              }).catch(() => null);
              this.addLog("INFO", `🔍 Auto-scraped public email for "${biz.name}": ${targetEmail}`);
            }
          } catch {
            // ignore scraper error
          }
        }

        if (this.config.enableEmail && targetEmail && audit.suggestedPitch?.email) {
          try {
            const { subject, body } = EmailService.parseEmailPitch(audit.suggestedPitch.email, biz.name);
            const emailRes = await EmailService.sendLeadEmail({
              to: targetEmail,
              subject,
              body,
              leadId: biz.id,
              businessName: biz.name,
            });

            if (emailRes.success) {
              this.emailsSentToday++;
              const nextFollowUpDate = this.config.enableFollowUps
                ? new Date(Date.now() + this.config.followUpIntervalDays * 24 * 60 * 60 * 1000)
                : null;

              await prisma.business.update({
                where: { id: biz.id },
                data: {
                  status: "CONTACTED",
                  lastContactedAt: new Date(),
                  followUpCount: 0,
                  nextFollowUpAt: nextFollowUpDate,
                },
              }).catch(() => null);

              await (prisma as any).outreachLog.create({
                data: {
                  businessId: biz.id,
                  channel: "EMAIL",
                  step: 0,
                  message: `Subject: ${subject}\n\n${body}`,
                  status: "SENT",
                },
              }).catch(() => null);

              this.addLog(
                "EMAIL_SENT",
                `📧 Sent cold email pitch to "${biz.name}" (${targetEmail})!`,
                biz.name,
                undefined,
                biz.lead?.score
              );
            } else {
              this.addLog(
                "EMAIL_ERROR",
                `Failed to email "${biz.name}": ${emailRes.error}`,
                biz.name
              );
            }
          } catch (emailErr: any) {
            this.addLog(
              "EMAIL_ERROR",
              `Email error for "${biz.name}": ${emailErr.message}`,
              biz.name
            );
          }
        }
      }
    } catch (err: any) {
      this.addLog("INFO", `Auto-Pilot cycle encounter error: ${err.message}`);
    }
  }

  private addLog(
    type: AutoPilotLog["type"],
    message: string,
    businessName?: string,
    phone?: string,
    score?: number
  ) {
    const entry: AutoPilotLog = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      type,
      message,
      businessName,
      phone,
      score,
    };
    this.logs.push(entry);
    if (this.logs.length > 100) this.logs.shift();
    console.log(`[AutoPilot] [${entry.type}] ${entry.message}`);
  }
}

// Global singleton instance — MUST persist in both dev and production
const globalForAutoPilot = globalThis as unknown as { autoPilotEngine: AutoPilotEngine };
if (!globalForAutoPilot.autoPilotEngine) {
  globalForAutoPilot.autoPilotEngine = new AutoPilotEngine();
}
export const autoPilotEngine = globalForAutoPilot.autoPilotEngine;
