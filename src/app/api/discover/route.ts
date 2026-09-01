import { NextResponse } from "next/server";
import { LeadService } from "@/lib/services/lead-service";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("[POST /api/discover] Received request body:", body);
    const { keyword, location, limit = 20 } = body;

    if (!keyword || !location) {
      console.warn("[POST /api/discover] Missing keyword or location:", { keyword, location });
      return NextResponse.json(
        { error: "Keyword and location are required fields." },
        { status: 400 }
      );
    }

    const result = await LeadService.discoverAndIngest(keyword, location, Number(limit));

    console.log(`[POST /api/discover] Successfully processed "${keyword}" in "${location}": Found ${result.totalFound}, Created ${result.newLeadsCreated}, Updated ${result.duplicatesSkipped}`);

    return NextResponse.json({
      success: true,
      message: `Discovered ${result.totalFound} businesses in ${location}. Created ${result.newLeadsCreated} new leads (${result.duplicatesSkipped} existing updated).`,
      data: result,
    });
  } catch (error: any) {
    console.error("[API /discover] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to run lead discovery" },
      { status: 500 }
    );
  }
}
