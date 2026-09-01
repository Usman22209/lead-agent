import { NextResponse } from "next/server";
import { LeadService } from "@/lib/services/lead-service";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") || "csv";
    const priority = searchParams.get("priority") || undefined;
    const hasWebsite = searchParams.get("hasWebsite") || undefined;
    const city = searchParams.get("city") || undefined;
    const category = searchParams.get("category") || undefined;

    const data = await LeadService.getLeads({
      priority,
      hasWebsite,
      city,
      category,
      limit: 1000,
    });

    if (format === "json") {
      return new NextResponse(JSON.stringify(data.items, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="leads_export_${Date.now()}.json"`,
        },
      });
    }

    // CSV format
    const headers = [
      "ID",
      "Business Name",
      "Category",
      "Phone",
      "Email",
      "Website",
      "Address",
      "City",
      "Rating",
      "Review Count",
      "Lead Score",
      "Priority",
      "Has Website",
      "Opportunity Type",
      "Status",
      "Google Maps URL",
      "Qualification Reasons",
    ];

    const rows = data.items.map((item) => {
      let parsedReasons = "";
      try {
        if (item.lead?.qualificationReasons) {
          const list = JSON.parse(item.lead.qualificationReasons);
          parsedReasons = Array.isArray(list) ? list.join("; ") : "";
        }
      } catch {
        parsedReasons = "";
      }

      return [
        `"${item.id}"`,
        `"${(item.name || "").replace(/"/g, '""')}"`,
        `"${(item.category || "").replace(/"/g, '""')}"`,
        `"${(item.phone || "").replace(/"/g, '""')}"`,
        `"${(item.email || "").replace(/"/g, '""')}"`,
        `"${(item.website || "").replace(/"/g, '""')}"`,
        `"${(item.address || "").replace(/"/g, '""')}"`,
        `"${(item.city || "").replace(/"/g, '""')}"`,
        item.rating || 0,
        item.reviewCount || 0,
        item.lead?.score || 0,
        `"${item.lead?.priority || "D"}"`,
        item.lead?.hasWebsite ? "Yes" : "No",
        `"${item.lead?.opportunityType || ""}"`,
        `"${item.status || "NEW"}"`,
        `"${item.googleMapsUrl || ""}"`,
        `"${parsedReasons.replace(/"/g, '""')}"`,
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");

    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="leads_export_${Date.now()}.csv"`,
      },
    });
  } catch (error: any) {
    console.error("[API /export GET] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to export leads" },
      { status: 500 }
    );
  }
}
