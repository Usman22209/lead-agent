import { NextResponse } from "next/server";
import { LeadPipeline } from "@/lib/workers/lead-pipeline";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { forceChannel, dryRun, followUpIntervalDays } = body;

    const result = await LeadPipeline.processAndDispatch(id, {
      forceChannel,
      dryRun: Boolean(dryRun),
      followUpIntervalDays: followUpIntervalDays || 2,
    });

    if (!result.success && !result.skipped) {
      return NextResponse.json({
        success: false,
        error: result.error || "Failed to dispatch outreach",
        data: result,
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: result.skipped
        ? `Lead was skipped: ${result.error || "Already contacted"}`
        : `Successfully dispatched outreach via ${result.channel}!`,
      data: result,
    });
  } catch (err: any) {
    console.error("[Instant Outreach API Error]:", err.message);
    return NextResponse.json({
      success: false,
      error: err.message,
    }, { status: 500 });
  }
}
