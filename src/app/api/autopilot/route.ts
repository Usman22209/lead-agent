import { NextResponse } from "next/server";
import { autoPilotEngine } from "@/lib/workers/autopilot-engine";
import { QueueManager } from "@/lib/workers/queue-manager";
import { CampaignSweeper } from "@/lib/workers/campaign-sweeper";

export async function GET() {
  try {
    const state = await autoPilotEngine.getStateAsync();
    return NextResponse.json({ success: true, data: state });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action, config, queues, businessId, businessIds, queueItemId, minScore } = body;

    if (action === "start") {
      autoPilotEngine.start();
      const state = await autoPilotEngine.getStateAsync();
      return NextResponse.json({
        success: true,
        message: "Autonomous Auto-Pilot Loop Engine started",
        data: state,
      });
    }

    if (action === "pause" || action === "stop") {
      autoPilotEngine.pause();
      const state = await autoPilotEngine.getStateAsync();
      return NextResponse.json({
        success: true,
        message: "Auto-Pilot Outbound Agent paused",
        data: state,
      });
    }

    if (action === "update-config") {
      autoPilotEngine.updateConfig(config, queues);
      const state = await autoPilotEngine.getStateAsync();
      return NextResponse.json({
        success: true,
        message: "Configuration & campaign queues updated",
        data: state,
      });
    }

    if (action === "run-now") {
      autoPilotEngine.runSingleStep().catch(console.error);
      const state = await autoPilotEngine.getStateAsync();
      return NextResponse.json({
        success: true,
        message: "Single execution step triggered",
        data: state,
      });
    }

    if (action === "enqueue") {
      if (businessId) {
        const result = await QueueManager.enqueueLead(businessId, body.priority || 0);
        const state = await autoPilotEngine.getStateAsync();
        return NextResponse.json({ success: result.success, result, data: state });
      } else if (Array.isArray(businessIds)) {
        const result = await QueueManager.enqueueMany(businessIds, body.priority || 0);
        const state = await autoPilotEngine.getStateAsync();
        return NextResponse.json({ success: true, result, data: state });
      }
      return NextResponse.json({ success: false, error: "Missing businessId or businessIds" }, { status: 400 });
    }

    if (action === "requeue-qualified") {
      const threshold = typeof minScore === "number" ? minScore : 60;
      const count = await QueueManager.requeueAllQualified(threshold);
      const state = await autoPilotEngine.getStateAsync();
      return NextResponse.json({
        success: true,
        message: `Enqueued ${count} qualified uncontacted leads into queue`,
        count,
        data: state,
      });
    }

    if (action === "remove-queue-item") {
      if (!queueItemId) {
        return NextResponse.json({ success: false, error: "Missing queueItemId" }, { status: 400 });
      }
      await QueueManager.removeFromQueue(queueItemId);
      const state = await autoPilotEngine.getStateAsync();
      return NextResponse.json({
        success: true,
        message: "Lead removed from queue",
        data: state,
      });
    }

    if (action === "clear-queue" || action === "drain-queue") {
      const cleared = await QueueManager.drainQueue();
      const state = await autoPilotEngine.getStateAsync();
      return NextResponse.json({
        success: true,
        message: `Cleared ${cleared} pending items from queue`,
        cleared,
        data: state,
      });
    }

    if (action === "sweep-now") {
      const sweep = await CampaignSweeper.sweepNextCampaign(15);
      const state = await autoPilotEngine.getStateAsync();
      return NextResponse.json({
        success: true,
        message: sweep
          ? `Swept ${sweep.campaign.keyword}: enqueued ${sweep.enqueuedCount} leads`
          : "Sweep completed or skipped",
        sweep,
        data: state,
      });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
