import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { LeadService } from "@/lib/services/lead-service";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const query = searchParams.get("query") || undefined;
    const city = searchParams.get("city") || undefined;
    const category = searchParams.get("category") || undefined;
    const priority = searchParams.get("priority") || undefined;
    const hasWebsite = searchParams.get("hasWebsite") || undefined;
    const status = searchParams.get("status") || undefined;
    const minScore = searchParams.get("minScore") ? Number(searchParams.get("minScore")) : undefined;
    const page = searchParams.get("page") ? Number(searchParams.get("page")) : 1;
    const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : 20;

    console.log("[GET /api/leads] Params:", {
      query,
      city,
      category,
      priority,
      hasWebsite,
      status,
      minScore,
      page,
      limit,
    });

    const [data, filters] = await Promise.all([
      LeadService.getLeads({
        query,
        city,
        category,
        priority,
        hasWebsite,
        status,
        minScore,
        page,
        limit,
      }),
      LeadService.getAvailableFilters(),
    ]);

    console.log(`[GET /api/leads] Returning ${data.items.length} items of ${data.total} total.`);

    return NextResponse.json({
      success: true,
      ...data,
      availableCities: filters.cities,
      availableCategories: filters.categories,
    });
  } catch (error: any) {
    console.error("[API /leads GET] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch leads" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const { ids } = body;

    console.log("[DELETE /api/leads] Deleting IDs:", ids);

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "Provide an array of business IDs to delete." },
        { status: 400 }
      );
    }

    const deleteResult = await prisma.business.deleteMany({
      where: {
        id: { in: ids },
      },
    });

    console.log(`[DELETE /api/leads] Successfully deleted ${deleteResult.count} leads.`);

    return NextResponse.json({
      success: true,
      message: `Deleted ${deleteResult.count} leads successfully.`,
      count: deleteResult.count,
    });
  } catch (error: any) {
    console.error("[API /leads DELETE] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete leads" },
      { status: 500 }
    );
  }
}
