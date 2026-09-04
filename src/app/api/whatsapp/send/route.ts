import { NextResponse } from "next/server";
import { whatsAppManager } from "@/lib/outreach/whatsapp-service";
import { prisma } from "@/lib/db";
import { sanitizePitchText } from "@/lib/ai/gemini";

export async function POST(req: Request) {
  try {
    const { phone, text, leadId } = await req.json();

    if (!phone || !text) {
      return NextResponse.json({ success: false, error: "Phone number and text are required" }, { status: 400 });
    }

    let messageText = text;
    if (leadId) {
      const biz = await prisma.business.findUnique({ where: { id: leadId } });
      if (biz) {
        messageText = sanitizePitchText(text, { name: biz.name, city: biz.city });
      }
    }

    const result = await whatsAppManager.sendMessage(phone, messageText);

    if (result.success) {
      // If leadId provided, update status to CONTACTED
      if (leadId) {
        await prisma.business.update({
          where: { id: leadId },
          data: { status: "CONTACTED" },
        }).catch(() => null);
      }

      return NextResponse.json({
        success: true,
        message: "WhatsApp message dispatched successfully!",
        data: result,
      });
    } else {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
