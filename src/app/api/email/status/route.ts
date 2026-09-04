import { NextResponse } from "next/server";
import { EmailService } from "@/lib/outreach/email-service";

export async function GET() {
  try {
    const status = await EmailService.verifyConnection();
    return NextResponse.json({
      success: true,
      ...status,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      isConfigured: Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD),
      userEmail: process.env.GMAIL_USER || null,
      isValid: false,
      error: error.message || "Failed to check Gmail status",
    });
  }
}
