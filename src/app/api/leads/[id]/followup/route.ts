import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getFollowUpPitch } from "@/lib/ai/gemini";
import { whatsAppManager } from "@/lib/outreach/whatsapp-service";
import { EmailService } from "@/lib/outreach/email-service";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const business = await prisma.business.findUnique({
      where: { id },
      include: {
        lead: true,
        outreachLogs: {
          orderBy: { sentAt: "desc" },
        },
      },
    });

    if (!business) {
      return NextResponse.json({ success: false, error: "Lead not found" }, { status: 404 });
    }

    let auditData: any = null;
    try {
      if (business.lead?.aiAnalysis) {
        auditData = JSON.parse(business.lead.aiAnalysis);
      }
    } catch {}

    const nextStep = (business.followUpCount ?? 0) + 1;
    const previewWhatsApp = getFollowUpPitch(auditData, business, "WHATSAPP", nextStep);
    const previewEmail = getFollowUpPitch(auditData, business, "EMAIL", nextStep);

    return NextResponse.json({
      success: true,
      data: {
        businessId: business.id,
        businessName: business.name,
        status: business.status,
        lastContactedAt: business.lastContactedAt,
        followUpCount: business.followUpCount ?? 0,
        nextFollowUpAt: business.nextFollowUpAt,
        nextStep,
        isFollowUpDue: Boolean(business.nextFollowUpAt && new Date(business.nextFollowUpAt) <= new Date()),
        preview: {
          whatsapp: previewWhatsApp,
          email: previewEmail,
        },
        outreachLogs: business.outreachLogs,
      },
    });
  } catch (error: any) {
    console.error("[API /leads/[id]/followup GET] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { channel: preferredChannel, customMessage } = body;

    const business = await prisma.business.findUnique({
      where: { id },
      include: { lead: true },
    });

    if (!business) {
      return NextResponse.json({ success: false, error: "Lead not found" }, { status: 404 });
    }

    // Safety rule: Never send automated cold follow-up to replied or meeting leads
    if (["REPLIED", "MEETING", "WON"].includes(business.status)) {
      return NextResponse.json(
        {
          success: false,
          error: `Lead is currently in '${business.status}' status. Manual direct messaging should be used.`,
        },
        { status: 400 }
      );
    }

    const nextStep = (business.followUpCount ?? 0) + 1;
    const waState = whatsAppManager.getState();
    const isWaReady = waState.status === "CONNECTED";

    // Determine target channel
    let targetChannel: "WHATSAPP" | "EMAIL" | null = null;
    if (preferredChannel) {
      targetChannel = preferredChannel;
    } else if (isWaReady && business.phone) {
      targetChannel = "WHATSAPP";
    } else if (business.email) {
      targetChannel = "EMAIL";
    }

    if (!targetChannel) {
      return NextResponse.json(
        { success: false, error: "No available outreach channel (Phone/WhatsApp or Email required)" },
        { status: 400 }
      );
    }

    let auditData: any = null;
    try {
      if (business.lead?.aiAnalysis) {
        auditData = JSON.parse(business.lead.aiAnalysis);
      }
    } catch {}

    const messageToSend =
      customMessage || getFollowUpPitch(auditData, business, targetChannel, nextStep);

    let sendSuccess = false;
    let sendError: string | null = null;

    if (targetChannel === "WHATSAPP") {
      if (!business.phone) {
        return NextResponse.json({ success: false, error: "Lead does not have a phone number" }, { status: 400 });
      }
      if (!isWaReady) {
        return NextResponse.json({ success: false, error: "WhatsApp is not currently connected" }, { status: 400 });
      }

      const res = await whatsAppManager.sendMessage(business.phone, messageToSend, business.city);
      sendSuccess = res.success;
      sendError = res.error || null;
    } else if (targetChannel === "EMAIL") {
      if (!business.email) {
        return NextResponse.json({ success: false, error: "Lead does not have an email address" }, { status: 400 });
      }

      const { subject, body: emailBody } = EmailService.parseEmailPitch(messageToSend, business.name);
      const res = await EmailService.sendLeadEmail({
        to: business.email,
        subject,
        body: emailBody,
        leadId: business.id,
        businessName: business.name,
      });
      sendSuccess = res.success;
      sendError = res.error || null;
    }

    if (!sendSuccess) {
      return NextResponse.json(
        { success: false, error: sendError || "Failed to dispatch message" },
        { status: 500 }
      );
    }

    // Advance cadence: next follow-up in 2 days if step < 2, else sequence completed (null)
    const nextFollowUpAt = nextStep < 2
      ? new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
      : null;

    const updatedBusiness = await prisma.business.update({
      where: { id: business.id },
      data: {
        status: "CONTACTED",
        lastContactedAt: new Date(),
        followUpCount: nextStep,
        nextFollowUpAt,
      },
    });

    const newLog = await (prisma as any).outreachLog.create({
      data: {
        businessId: business.id,
        channel: targetChannel,
        step: nextStep,
        message: messageToSend,
        status: "SENT",
      },
    });

    return NextResponse.json({
      success: true,
      message: `Follow-up #${nextStep} successfully sent via ${targetChannel}!`,
      data: {
        business: updatedBusiness,
        outreachLog: newLog,
      },
    });
  } catch (error: any) {
    console.error("[API /leads/[id]/followup POST] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const updated = await prisma.business.update({
      where: { id },
      data: {
        nextFollowUpAt: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Scheduled follow-ups paused for this lead.",
      data: updated,
    });
  } catch (error: any) {
    console.error("[API /leads/[id]/followup DELETE] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
