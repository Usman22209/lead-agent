import { NextResponse } from "next/server";
import { LeadService } from "@/lib/services/lead-service";

export async function GET() {
  try {
    const stats = await LeadService.getDashboardStats();
    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error: any) {
    console.error("[API /stats GET] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
