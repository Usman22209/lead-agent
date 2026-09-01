import { NextResponse } from "next/server";
import { LeadService } from "@/lib/services/lead-service";

export async function POST() {
  try {
    const result = await LeadService.rescoreAllLeads();
    return NextResponse.json({
      success: true,
      message: `Successfully rescored ${result.count} leads with multi-pillar algorithm.`,
      count: result.count,
    });
  } catch (error: any) {
    console.error("[API /leads/rescore] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to rescore leads" },
      { status: 500 }
    );
  }
}
