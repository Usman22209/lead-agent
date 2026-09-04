import { NextResponse } from "next/server";
import { autoPilotEngine } from "@/lib/workers/autopilot-engine";

export async function GET() {
  try {
    const state = autoPilotEngine.getState();
    return NextResponse.json({ success: true, data: state });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action, config, queues } = body;

    if (action === "start") {
      autoPilotEngine.start();
      return NextResponse.json({
        success: true,
        message: "Auto-Pilot Outbound Agent started",
        data: autoPilotEngine.getState(),
      });
    }

    if (action === "pause" || action === "stop") {
      autoPilotEngine.pause();
      return NextResponse.json({
        success: true,
        message: "Auto-Pilot Outbound Agent paused",
        data: autoPilotEngine.getState(),
      });
    }

    if (action === "update-config") {
      autoPilotEngine.updateConfig(config, queues);
      return NextResponse.json({
        success: true,
        message: "Configuration updated successfully",
        data: autoPilotEngine.getState(),
      });
    }

    if (action === "run-now") {
      // Trigger a single cycle right away
      autoPilotEngine.runExecutionCycle().catch(console.error);
      return NextResponse.json({
        success: true,
        message: "Immediate execution cycle triggered",
        data: autoPilotEngine.getState(),
      });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
