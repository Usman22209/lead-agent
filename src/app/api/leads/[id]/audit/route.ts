import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { runGeminiLeadAnalysis } from "@/lib/ai/gemini";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    let apiKey: string | undefined = undefined;

    try {
      const body = await req.json();
      apiKey = body?.apiKey;
    } catch {
      // Body is optional
    }

    const business = await prisma.business.findUnique({
      where: { id },
      include: { lead: true },
    });

    if (!business) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const audit = await runGeminiLeadAnalysis(
      {
        name: business.name,
        category: business.category,
        city: business.city,
        phone: business.phone,
        website: business.website,
        address: business.address,
        rating: business.rating,
        reviewCount: business.reviewCount,
        googleMapsUrl: business.googleMapsUrl,
      },
      apiKey
    );

    // Update status to AUDITED
    await prisma.business.update({
      where: { id },
      data: { status: "AUDITED" },
    });

    return NextResponse.json({
      success: true,
      audit,
      model: audit.modelUsed || "gemini-cascade",
    });
  } catch (error: any) {
    console.error("[API /leads/[id]/audit] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate AI audit" },
      { status: 500 }
    );
  }
}
