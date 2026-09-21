import { prisma } from "@/lib/db";

export interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  skipped: number;
  total: number;
}

export interface EnqueueResult {
  success: boolean;
  businessId: string;
  reason?: string;
  queueItemId?: string;
}

export class QueueManager {
  /**
   * Enqueue a single business lead with deduplication and safety guards.
   */
  static async enqueueLead(businessId: string, priority: number = 0): Promise<EnqueueResult> {
    try {
      const business = await prisma.business.findUnique({
        where: { id: businessId },
        include: {
          lead: true,
          outreachLogs: { where: { status: "SENT" }, take: 1 },
          queueItem: true,
        },
      });

      if (!business) {
        return { success: false, businessId, reason: "BUSINESS_NOT_FOUND" };
      }

      // Anti-double-contact guard: Never enqueue already contacted leads
      if (business.status === "CONTACTED" || business.outreachLogs.length > 0) {
        return { success: false, businessId, reason: "ALREADY_CONTACTED" };
      }

      // Must have either phone or email or a website to enrich
      if (!business.phone && !business.email && !business.website) {
        return { success: false, businessId, reason: "NO_CONTACT_INFO" };
      }

      // Check existing queue item
      if (business.queueItem) {
        const item = business.queueItem;
        if (item.status === "PENDING" || item.status === "PROCESSING") {
          return { success: true, businessId, queueItemId: item.id, reason: "ALREADY_QUEUED" };
        }
        if (item.status === "COMPLETED") {
          return { success: false, businessId, reason: "ALREADY_COMPLETED" };
        }

        // If previously failed or skipped, reset to pending
        const updated = await prisma.queueItem.update({
          where: { id: item.id },
          data: {
            status: "PENDING",
            priority,
            retryCount: 0,
            lastError: null,
            addedAt: new Date(),
          },
        });

        await prisma.business.update({
          where: { id: businessId },
          data: { status: "QUEUED" },
        }).catch(() => null);

        return { success: true, businessId, queueItemId: updated.id };
      }

      // Create new QueueItem
      const created = await prisma.queueItem.create({
        data: {
          businessId,
          priority,
          status: "PENDING",
        },
      });

      // Update Business status to QUEUED if it was NEW or QUALIFIED
      if (business.status === "NEW" || business.status === "QUALIFIED") {
        await prisma.business.update({
          where: { id: businessId },
          data: { status: "QUEUED" },
        }).catch(() => null);
      }

      return { success: true, businessId, queueItemId: created.id };
    } catch (err: any) {
      console.error(`[QueueManager.enqueueLead] Error enqueuing ${businessId}:`, err.message);
      return { success: false, businessId, reason: err.message };
    }
  }

  /**
   * Batch enqueue multiple business IDs
   */
  static async enqueueMany(businessIds: string[], priority: number = 0): Promise<{ enqueued: number; skipped: number }> {
    let enqueued = 0;
    let skipped = 0;

    for (const id of businessIds) {
      const res = await this.enqueueLead(id, priority);
      if (res.success && res.reason !== "ALREADY_QUEUED") {
        enqueued++;
      } else {
        skipped++;
      }
    }

    return { enqueued, skipped };
  }

  /**
   * Atomically pop the next highest-priority pending lead for processing
   */
  static async popNextLead() {
    try {
      // Find highest priority pending item
      const nextItem = await prisma.queueItem.findFirst({
        where: { status: "PENDING" },
        orderBy: [
          { priority: "desc" },
          { addedAt: "asc" },
        ],
        include: {
          business: {
            include: {
              lead: true,
              outreachLogs: true,
            },
          },
        },
      });

      if (!nextItem) return null;

      // Atomically mark status as PROCESSING
      await prisma.queueItem.update({
        where: { id: nextItem.id },
        data: { status: "PROCESSING" },
      });

      return nextItem;
    } catch (err: any) {
      console.error("[QueueManager.popNextLead] Error:", err.message);
      return null;
    }
  }

  /**
   * Mark a queue item as successfully completed
   */
  static async completeLead(businessId: string) {
    try {
      await prisma.queueItem.updateMany({
        where: { businessId },
        data: {
          status: "COMPLETED",
          processedAt: new Date(),
          lastError: null,
        },
      });
    } catch (err: any) {
      console.error(`[QueueManager.completeLead] Error completing ${businessId}:`, err.message);
    }
  }

  /**
   * Fail a lead with automatic retry backoff (up to 3 tries)
   */
  static async failLead(businessId: string, error: string) {
    try {
      const item = await prisma.queueItem.findUnique({
        where: { businessId },
      });

      if (!item) return;

      const newRetryCount = item.retryCount + 1;
      if (newRetryCount < 3) {
        // Re-queue with incremented retry count
        await prisma.queueItem.update({
          where: { id: item.id },
          data: {
            status: "PENDING",
            retryCount: newRetryCount,
            lastError: error,
          },
        });
        console.warn(`[QueueManager] Lead ${businessId} failed (attempt ${newRetryCount}/3). Requeued.`);
      } else {
        // Max retries exceeded
        await prisma.queueItem.update({
          where: { id: item.id },
          data: {
            status: "FAILED",
            retryCount: newRetryCount,
            lastError: error,
            processedAt: new Date(),
          },
        });
        console.error(`[QueueManager] Lead ${businessId} failed permanently after 3 attempts: ${error}`);
      }
    } catch (err: any) {
      console.error(`[QueueManager.failLead] Error for ${businessId}:`, err.message);
    }
  }

  /**
   * Mark a lead as skipped (e.g. no valid contact channel, duplicate, disqualified)
   */
  static async skipLead(businessId: string, reason: string) {
    try {
      await prisma.queueItem.updateMany({
        where: { businessId },
        data: {
          status: "SKIPPED",
          lastError: reason,
          processedAt: new Date(),
        },
      });

      await prisma.business.update({
        where: { id: businessId },
        data: { status: "SKIPPED" },
      }).catch(() => null);
    } catch (err: any) {
      console.error(`[QueueManager.skipLead] Error skipping ${businessId}:`, err.message);
    }
  }

  /**
   * Remove a single item from the queue
   */
  static async removeFromQueue(queueItemId: string) {
    try {
      const item = await prisma.queueItem.findUnique({
        where: { id: queueItemId },
      });

      if (item) {
        await prisma.queueItem.delete({
          where: { id: queueItemId },
        });

        // Reset business status to NEW if it was QUEUED
        await prisma.business.updateMany({
          where: { id: item.businessId, status: "QUEUED" },
          data: { status: "NEW" },
        });
      }
      return true;
    } catch (err: any) {
      console.error(`[QueueManager.removeFromQueue] Error:`, err.message);
      return false;
    }
  }

  /**
   * Wipe all pending queue items (Emergency clear)
   */
  static async drainQueue() {
    try {
      // Find all pending business IDs to reset their status
      const pendingItems = await prisma.queueItem.findMany({
        where: { status: "PENDING" },
        select: { businessId: true },
      });

      const businessIds = pendingItems.map((p) => p.businessId);

      await prisma.queueItem.deleteMany({
        where: { status: "PENDING" },
      });

      if (businessIds.length > 0) {
        await prisma.business.updateMany({
          where: { id: { in: businessIds }, status: "QUEUED" },
          data: { status: "NEW" },
        });
      }

      return businessIds.length;
    } catch (err: any) {
      console.error("[QueueManager.drainQueue] Error:", err.message);
      return 0;
    }
  }

  /**
   * Get active queue items for UI presentation
   */
  static async getQueueItems(limit: number = 30) {
    try {
      const items = await prisma.queueItem.findMany({
        where: { status: { in: ["PENDING", "PROCESSING"] } },
        orderBy: [
          { priority: "desc" },
          { addedAt: "asc" },
        ],
        take: limit,
        include: {
          business: {
            include: {
              lead: true,
            },
          },
        },
      });

      return items;
    } catch (err: any) {
      console.error("[QueueManager.getQueueItems] Error:", err.message);
      return [];
    }
  }

  /**
   * Get total queue stats
   */
  static async getQueueStats(): Promise<QueueStats> {
    try {
      const [pending, processing, completed, failed, skipped] = await Promise.all([
        prisma.queueItem.count({ where: { status: "PENDING" } }),
        prisma.queueItem.count({ where: { status: "PROCESSING" } }),
        prisma.queueItem.count({ where: { status: "COMPLETED" } }),
        prisma.queueItem.count({ where: { status: "FAILED" } }),
        prisma.queueItem.count({ where: { status: "SKIPPED" } }),
      ]);

      return {
        pending,
        processing,
        completed,
        failed,
        skipped,
        total: pending + processing,
      };
    } catch {
      return { pending: 0, processing: 0, completed: 0, failed: 0, skipped: 0, total: 0 };
    }
  }

  /**
   * Enqueue all uncontacted qualified leads currently sitting in the database
   */
  static async requeueAllQualified(minScore: number = 60): Promise<number> {
    try {
      const eligible = await prisma.business.findMany({
        where: {
          status: { in: ["NEW", "QUALIFIED"] },
          OR: [
            { phone: { not: null } },
            { email: { not: null } },
            { website: { not: null } },
          ],
          lead: {
            score: { gte: minScore },
          },
          queueItem: null,
        },
        select: { id: true },
        take: 100,
      });

      const { enqueued } = await this.enqueueMany(eligible.map((b) => b.id), 1);
      return enqueued;
    } catch (err: any) {
      console.error("[QueueManager.requeueAllQualified] Error:", err.message);
      return 0;
    }
  }
}
