import fs from "fs";
import path from "path";
import cron, { ScheduledTask } from "node-cron";
import { prisma } from "@/lib/db";
import { whatsAppManager } from "@/lib/outreach/whatsapp-service";
import { EmailService } from "@/lib/outreach/email-service";
import { getFollowUpPitch } from "@/lib/ai/gemini";
import { QueueManager, QueueStats } from "./queue-manager";
import { LeadPipeline } from "./lead-pipeline";
import { CampaignSweeper, TargetCampaign } from "./campaign-sweeper";

export type AutoPilotStatus =
  | "IDLE"
  | "RUNNING"
  | "SLEEPING_DELAY"
  | "WORK_HOURS_PAUSED"
  | "DAILY_QUOTA_REACHED"
  | "PAUSED";

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
  autoReplenishThreshold: number; // Replenish if pending queue falls below this
}

export interface AutoPilotLog {
  id: string;
  timestamp: string;
  type:
    | "DISCOVERY"
    | "AUDIT"
    | "WHATSAPP_SENT"
    | "WHATSAPP_ERROR"
    | "EMAIL_SENT"
    | "EMAIL_ERROR"
    | "FOLLOWUP_SENT"
    | "FOLLOWUP_ERROR"
    | "QUEUE_ENQUEUED"
    | "QUEUE_CLEARED"
    | "INFO"
    | "SKIPPED";
  message: string;
  businessName?: string;
  phone?: string;
  score?: number;
}

export interface AutoPilotState {
  status: AutoPilotStatus;
  isActive: boolean;
  sentToday: number;
  emailsSentToday: number;
  followUpsSentToday: number;
  pendingFollowUpsDue: number;
  dailyLimit: number;
  queueStats: QueueStats;
  activeQueue: any[];
  targetQueues: TargetCampaign[];
  config: AutoPilotConfig;
  logs: AutoPilotLog[];
  lastRunAt: string | null;
  nextScheduledRun: string | null;
  delayRemainingSeconds?: number;
}

class AutoPilotEngine {
  private status: AutoPilotStatus = "IDLE";
  private isRunning = false;
  private stopRequested = false;
  private isProcessingStep = false;
  private loopPromise: Promise<void> | null = null;

  private sentToday = 0;
  private emailsSentToday = 0;
  private followUpsSentToday = 0;
  private lastResetDate = new Date().toDateString();
  private lastRunAt: string | null = null;
  private logs: AutoPilotLog[] = [];
  private delayRemainingSeconds = 0;

  private config: AutoPilotConfig = {
    dailyWhatsAppLimit: 35,
    enableEmail: true,
    minDelaySeconds: 30,
    maxDelaySeconds: 60,
    workHoursOnly: false,
    startHour: 9,
    endHour: 18,
    minimumScore: 70,
    enableFollowUps: true,
    followUpIntervalDays: 2,
    maxFollowUps: 2,
    autoReplenishThreshold: 3,
  };

  private stateFilePath = path.join(process.cwd(), "data", "autopilot_state.json");

  constructor() {
    this.ensureDataDir();
    this.loadState();

    // Midnight counter reset
    cron.schedule("0 0 * * *", () => {
      this.sentToday = 0;
      this.emailsSentToday = 0;
      this.followUpsSentToday = 0;
      this.lastResetDate = new Date().toDateString();
      this.saveState();
      this.addLog("INFO", "Daily dispatch counters reset to 0 for the new day.");
    });
  }

  private ensureDataDir() {
    try {
      const dataDir = path.dirname(this.stateFilePath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
    } catch (e: any) {
      console.warn("Failed to create data dir:", e.message);
    }
  }

  private loadState() {
    try {
      if (fs.existsSync(this.stateFilePath)) {
        const raw = fs.readFileSync(this.stateFilePath, "utf8");
        const saved = JSON.parse(raw);
        if (saved.config) this.config = { ...this.config, ...saved.config };
        if (saved.sentToday && saved.lastResetDate === new Date().toDateString()) {
          this.sentToday = saved.sentToday;
          this.emailsSentToday = saved.emailsSentToday || 0;
          this.followUpsSentToday = saved.followUpsSentToday || 0;
        }
        if (saved.campaigns) {
          CampaignSweeper.setCampaigns(saved.campaigns);
        }
        console.log("💾 [AutoPilotEngine] State restored from disk.");
      }
    } catch (e: any) {
      console.warn("Failed to restore state:", e.message);
    }
  }

  private saveState() {
    try {
      this.ensureDataDir();
      const statePayload = {
        sentToday: this.sentToday,
        emailsSentToday: this.emailsSentToday,
        followUpsSentToday: this.followUpsSentToday,
        lastResetDate: this.lastResetDate,
        config: this.config,
        campaigns: CampaignSweeper.getCampaigns(),
        lastRunAt: this.lastRunAt,
      };
      fs.writeFileSync(this.stateFilePath, JSON.stringify(statePayload, null, 2), "utf8");
    } catch (e: any) {
      console.warn("Failed to save state to disk:", e.message);
    }
  }

  private checkDailyReset() {
    const today = new Date().toDateString();
    if (today !== this.lastResetDate) {
      this.sentToday = 0;
      this.emailsSentToday = 0;
      this.followUpsSentToday = 0;
      this.lastResetDate = today;
      this.saveState();
    }
  }

  private isWithinWorkingHours(): boolean {
    if (!this.config.workHoursOnly) return true;
    const currentHour = new Date().getHours();
    return currentHour >= this.config.startHour && currentHour < this.config.endHour;
  }

  public getState(): AutoPilotState {
    this.checkDailyReset();
    return {
      status: this.status,
      isActive: this.isRunning,
      sentToday: this.sentToday,
      emailsSentToday: this.emailsSentToday,
      followUpsSentToday: this.followUpsSentToday,
      pendingFollowUpsDue: 0,
      dailyLimit: this.config.dailyWhatsAppLimit,
      queueStats: { pending: 0, processing: 0, completed: 0, failed: 0, skipped: 0, total: 0 },
      activeQueue: [],
      targetQueues: CampaignSweeper.getCampaigns(),
      config: this.config,
      logs: this.logs.slice(-30).reverse(),
      lastRunAt: this.lastRunAt,
      nextScheduledRun: this.isRunning ? "Active Loop Worker" : "Paused",
      delayRemainingSeconds: this.delayRemainingSeconds,
    };
  }

  public async getStateAsync(): Promise<AutoPilotState> {
    const state = this.getState();
    try {
      const [queueStats, activeQueue, dueFollowUps] = await Promise.all([
        QueueManager.getQueueStats(),
        QueueManager.getQueueItems(15),
        prisma.business.count({
          where: {
            status: "CONTACTED",
            nextFollowUpAt: { lte: new Date() },
            followUpCount: { lt: this.config.maxFollowUps },
          },
        }),
      ]);

      state.queueStats = queueStats;
      state.activeQueue = activeQueue;
      state.pendingFollowUpsDue = dueFollowUps;
    } catch (err: any) {
      console.warn("Error fetching async state:", err.message);
    }
    return state;
  }

  public updateConfig(newConfig: Partial<AutoPilotConfig>, newQueues?: TargetCampaign[]) {
    this.config = { ...this.config, ...newConfig };
    if (newQueues) {
      CampaignSweeper.setCampaigns(newQueues);
    }
    this.saveState();
    this.addLog("INFO", "Auto-Pilot configuration & campaign targets updated.");
  }

  public start(): void {
    if (this.isRunning) {
      console.log("[AutoPilotEngine] Already running.");
      return;
    }

    this.isRunning = true;
    this.stopRequested = false;
    this.status = "RUNNING";
    this.addLog("INFO", "🚀 Autonomous Auto-Pilot Loop Engine started.");

    // Launch background worker loop
    this.loopPromise = this.runAutonomousLoop();
  }

  public pause(): void {
    this.stopRequested = true;
    this.isRunning = false;
    this.status = "PAUSED";
    this.delayRemainingSeconds = 0;
    this.addLog("INFO", "⏸️ Auto-Pilot Outbound Agent paused.");
  }

  public stop(): void {
    this.pause();
  }

  /**
   * The core persistent autonomous worker loop.
   * Continually runs while isRunning === true, resilient to unhandled errors.
   */
  private async runAutonomousLoop(): Promise<void> {
    console.log("[AutoPilotEngine] Worker loop initiated.");

    while (this.isRunning && !this.stopRequested) {
      try {
        this.checkDailyReset();

        // 1. Quota Check
        if (this.sentToday >= this.config.dailyWhatsAppLimit) {
          this.status = "DAILY_QUOTA_REACHED";
          this.addLog(
            "INFO",
            `Daily limit of ${this.config.dailyWhatsAppLimit} messages reached for today (${this.sentToday} sent). Sleeping 5 mins.`
          );
          await this.sleep(300000);
          continue;
        }

        // 2. Working Hours Check
        if (!this.isWithinWorkingHours()) {
          this.status = "WORK_HOURS_PAUSED";
          this.addLog(
            "INFO",
            `Outside active business hours (${this.config.startHour}:00 - ${this.config.endHour}:00). Sleeping 10 mins.`
          );
          await this.sleep(600000);
          continue;
        }

        // 3. PRIORITY: Due Multi-Touch Follow-Up Dispatch
        if (this.config.enableFollowUps) {
          const dispatchedFollowUp = await this.checkAndDispatchFollowUp();
          if (dispatchedFollowUp) {
            // Apply humanized delay after follow-up send
            await this.applyJitterDelay();
            continue;
          }
        }

        // 4. Dynamic Auto-Replenishment Check
        const stats = await QueueManager.getQueueStats();
        if (stats.pending <= this.config.autoReplenishThreshold) {
          this.addLog(
            "DISCOVERY",
            `Queue running low (${stats.pending} pending). Triggering campaign market sweep...`
          );
          const sweep = await CampaignSweeper.sweepNextCampaign(15);
          if (sweep && sweep.enqueuedCount > 0) {
            this.addLog(
              "QUEUE_ENQUEUED",
              `Sweep enriched queue: added ${sweep.enqueuedCount} new leads from "${sweep.campaign.keyword}" in "${sweep.campaign.location}".`
            );
          }
        }

        // 5. Pop Next Lead from Queue
        const nextItem = await QueueManager.popNextLead();
        if (!nextItem) {
          this.status = "IDLE";
          // No items ready, sleep briefly before checking queue again
          await this.sleep(15000);
          continue;
        }

        // 6. Mutex Step Lock & JIT Pipeline Execution
        this.isProcessingStep = true;
        this.status = "RUNNING";
        this.lastRunAt = new Date().toISOString();

        const biz = nextItem.business;
        this.addLog(
          "AUDIT",
          `Processing queued prospect "${biz.name}" (${biz.city}) via JIT AI Pipeline...`,
          biz.name,
          biz.phone || undefined,
          biz.lead?.score
        );

        const result = await LeadPipeline.processAndDispatch(biz.id, {
          enableEmail: this.config.enableEmail,
          followUpIntervalDays: this.config.followUpIntervalDays,
        });

        if (result.success && !result.skipped) {
          if (result.channel === "WHATSAPP") {
            this.sentToday++;
            this.addLog(
              "WHATSAPP_SENT",
              `✅ Sent personalized pitch via WhatsApp to "${biz.name}" (${result.phone})!`,
              biz.name,
              result.phone || undefined,
              biz.lead?.score
            );
          } else if (result.channel === "EMAIL") {
            this.emailsSentToday++;
            this.addLog(
              "EMAIL_SENT",
              `📧 Sent cold pitch via Email to "${biz.name}" (${result.email})!`,
              biz.name,
              undefined,
              biz.lead?.score
            );
          }
          this.saveState();
          // 7. Humanized Anti-Ban Jitter Delay
          await this.applyJitterDelay();
        } else if (result.skipped) {
          this.addLog(
            "SKIPPED",
            `Skipped "${biz.name}": ${result.error || "Already handled"}`,
            biz.name
          );
          // Brief pause between skipped items
          await this.sleep(2000);
        } else {
          // Failed
          const logType = result.channel === "EMAIL" ? "EMAIL_ERROR" : "WHATSAPP_ERROR";
          this.addLog(
            logType,
            `Failed outreach for "${biz.name}": ${result.error}`,
            biz.name,
            biz.phone || undefined
          );
          await this.sleep(5000);
        }

      } catch (err: any) {
        console.error("[AutoPilotEngine Loop Error]:", err.message);
        this.addLog("INFO", `Autopilot loop notice: ${err.message}`);
        await this.sleep(10000);
      } finally {
        this.isProcessingStep = false;
      }
    }

    this.isRunning = false;
    this.status = "PAUSED";
    console.log("[AutoPilotEngine] Worker loop exited.");
  }

  /**
   * Pacing with randomized jitter delay to mimic natural human typing & dispatch cadence
   */
  private async applyJitterDelay(): Promise<void> {
    if (!this.isRunning || this.stopRequested) return;

    const min = this.config.minDelaySeconds;
    const max = this.config.maxDelaySeconds;
    const delaySec = Math.floor(Math.random() * (max - min + 1) + min);

    this.status = "SLEEPING_DELAY";
    this.delayRemainingSeconds = delaySec;
    this.addLog("INFO", `Humanized anti-ban delay: waiting ${delaySec}s before next action...`);

    for (let sec = delaySec; sec > 0; sec--) {
      if (!this.isRunning || this.stopRequested) break;
      this.delayRemainingSeconds = sec;
      await this.sleep(1000);
    }

    this.delayRemainingSeconds = 0;
    if (this.isRunning) {
      this.status = "RUNNING";
    }
  }

  /**
   * Check and dispatch one due multi-touch follow-up
   */
  private async checkAndDispatchFollowUp(): Promise<boolean> {
    try {
      const now = new Date();
      const dueBiz = await prisma.business.findFirst({
        where: {
          status: "CONTACTED",
          nextFollowUpAt: { lte: now },
          followUpCount: { lt: this.config.maxFollowUps },
        },
        include: { lead: true },
      });

      if (!dueBiz) return false;

      const waState = whatsAppManager.getState();
      const isWaReady = waState.status === "CONNECTED";
      const nextStep = (dueBiz.followUpCount ?? 0) + 1;

      let channel: "WHATSAPP" | "EMAIL" | null = null;
      if (isWaReady && dueBiz.phone) {
        channel = "WHATSAPP";
      } else if (this.config.enableEmail && dueBiz.email) {
        channel = "EMAIL";
      }

      if (!channel) {
        // Postpone check by 12 hours
        await prisma.business.update({
          where: { id: dueBiz.id },
          data: { nextFollowUpAt: new Date(Date.now() + 12 * 60 * 60 * 1000) },
        }).catch(() => null);
        return false;
      }

      let auditData: any = null;
      try {
        if (dueBiz.lead?.aiAnalysis) {
          auditData = JSON.parse(dueBiz.lead.aiAnalysis);
        }
      } catch {}

      const pitch = getFollowUpPitch(auditData, dueBiz, channel, nextStep);
      let dispatched = false;

      if (channel === "WHATSAPP" && dueBiz.phone) {
        const sendRes = await whatsAppManager.sendMessage(dueBiz.phone, pitch, dueBiz.city);
        if (sendRes.success) {
          dispatched = true;
          this.sentToday++;
          this.followUpsSentToday++;
          this.addLog(
            "FOLLOWUP_SENT",
            `✅ Sent Follow-up #${nextStep} via WhatsApp to "${dueBiz.name}" (${dueBiz.phone})!`,
            dueBiz.name,
            dueBiz.phone,
            dueBiz.lead?.score
          );
        }
      } else if (channel === "EMAIL" && dueBiz.email) {
        const { subject, body } = EmailService.parseEmailPitch(pitch, dueBiz.name);
        const emailRes = await EmailService.sendLeadEmail({
          to: dueBiz.email,
          subject,
          body,
          leadId: dueBiz.id,
          businessName: dueBiz.name,
        });
        if (emailRes.success) {
          dispatched = true;
          this.emailsSentToday++;
          this.followUpsSentToday++;
          this.addLog(
            "FOLLOWUP_SENT",
            `📧 Sent Follow-up #${nextStep} via Email to "${dueBiz.name}" (${dueBiz.email})!`,
            dueBiz.name,
            undefined,
            dueBiz.lead?.score
          );
        }
      }

      if (dispatched) {
        const nextFollowUpAt =
          nextStep < this.config.maxFollowUps
            ? new Date(Date.now() + this.config.followUpIntervalDays * 24 * 60 * 60 * 1000)
            : null;

        await prisma.business.update({
          where: { id: dueBiz.id },
          data: {
            lastContactedAt: new Date(),
            followUpCount: nextStep,
            nextFollowUpAt,
          },
        });

        await prisma.outreachLog.create({
          data: {
            businessId: dueBiz.id,
            channel,
            step: nextStep,
            message: pitch,
            status: "SENT",
          },
        }).catch(() => null);

        this.saveState();
        return true;
      }

      return false;
    } catch (e: any) {
      console.warn("Follow-up dispatch error:", e.message);
      return false;
    }
  }

  /**
   * Run a single step immediately on demand
   */
  public async runSingleStep(): Promise<void> {
    if (this.isProcessingStep) {
      console.log("[AutoPilotEngine] Step already in progress.");
      return;
    }

    const item = await QueueManager.popNextLead();
    if (!item) {
      // If queue is empty, trigger one campaign sweep to replenish
      this.addLog("DISCOVERY", "Queue is empty. Running a manual sweep to replenish...");
      await CampaignSweeper.sweepNextCampaign(10);
      const replenishedItem = await QueueManager.popNextLead();
      if (!replenishedItem) {
        this.addLog("INFO", "No leads available to process right now.");
        return;
      }
      await this.executeItemStep(replenishedItem);
      return;
    }

    await this.executeItemStep(item);
  }

  private async executeItemStep(item: any) {
    this.isProcessingStep = true;
    try {
      const biz = item.business;
      this.addLog("AUDIT", `Running instant step for "${biz.name}"...`, biz.name);
      const res = await LeadPipeline.processAndDispatch(biz.id, {
        enableEmail: this.config.enableEmail,
        followUpIntervalDays: this.config.followUpIntervalDays,
      });

      if (res.success && !res.skipped) {
        if (res.channel === "WHATSAPP") this.sentToday++;
        if (res.channel === "EMAIL") this.emailsSentToday++;
        this.addLog("INFO", `Step finished: dispatched pitch to "${biz.name}" via ${res.channel}.`, biz.name);
      } else {
        this.addLog("INFO", `Step completed: ${res.error || "Handled"}`, biz.name);
      }
      this.saveState();
    } finally {
      this.isProcessingStep = false;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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

// Global singleton instance
const globalForAutoPilot = globalThis as unknown as { autoPilotEngine: AutoPilotEngine };
if (!globalForAutoPilot.autoPilotEngine) {
  globalForAutoPilot.autoPilotEngine = new AutoPilotEngine();
}
export const autoPilotEngine = globalForAutoPilot.autoPilotEngine;
