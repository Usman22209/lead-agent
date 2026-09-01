import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const business = await prisma.business.findUnique({
      where: { id },
      include: { lead: true },
    });

    if (!business) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      lead: business,
    });
  } catch (error: any) {
    console.error("[API /leads/[id] GET] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch lead" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { status, assignedStatus, email, phone, website } = body;

    const updated = await prisma.business.update({
      where: { id },
      data: {
        ...(status ? { status } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(phone !== undefined ? { phone } : {}),
        ...(website !== undefined ? { website } : {}),
        ...(assignedStatus && {
          lead: {
            update: {
              assignedStatus,
            },
          },
        }),
      },
      include: {
        lead: true,
      },
    });

    return NextResponse.json({
      success: true,
      lead: updated,
    });
  } catch (error: any) {
    console.error("[API /leads/[id] PATCH] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update lead" },
      { status: 500 }
    );
  }
}
