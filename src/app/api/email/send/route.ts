import { NextResponse } from "next/server";
import { EmailService } from "@/lib/outreach/email-service";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { to, subject, message, leadId, businessName } = body;

    if (!to || !to.includes("@")) {
      return NextResponse.json(
        { error: "A valid recipient email address is required" },
        { status: 400 }
      );
    }

    if (!subject || !subject.trim()) {
      return NextResponse.json(
        { error: "Email subject line is required" },
        { status: 400 }
      );
    }

    if (!message || !message.trim()) {
      return NextResponse.json(
        { error: "Email message body is required" },
        { status: 400 }
      );
    }

    const result = await EmailService.sendLeadEmail({
      to: to.trim(),
      subject: subject.trim(),
      body: message.trim(),
      leadId,
      businessName,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to send email" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      message: `Email successfully sent to ${to}`,
    });
  } catch (error: any) {
    console.error("[API /email/send POST] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to send email" },
      { status: 500 }
    );
  }
}
