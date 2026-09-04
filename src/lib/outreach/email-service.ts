import nodemailer, { type Transporter } from "nodemailer";
import prisma from "@/lib/db";

export interface SendEmailParams {
  to: string;
  subject: string;
  body: string;
  leadId?: string;
  businessName?: string;
}

export interface EmailStatusResult {
  isConfigured: boolean;
  userEmail: string | null;
  isValid: boolean;
  error?: string;
}

export class EmailService {
  private static transporter: Transporter | null = null;
  private static cachedConfig: string = "";

  /**
   * Initializes or returns the cached nodemailer transport
   */
  private static getTransporter(): Transporter {
    const user = process.env.GMAIL_USER?.trim() || "";
    // Remove spaces that users typically paste from Google App Password generator
    const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "") || "";

    const currentConfigKey = `${user}:${pass}`;

    if (!this.transporter || this.cachedConfig !== currentConfigKey) {
      if (!user || !pass) {
        throw new Error(
          "Gmail outreach credentials not configured in .env. Please set GMAIL_USER and GMAIL_APP_PASSWORD."
        );
      }

      this.transporter = nodemailer.createTransport({
        service: "gmail",
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: {
          user,
          pass,
        },
      });

      this.cachedConfig = currentConfigKey;
    }

    return this.transporter;
  }

  /**
   * Check if Gmail is configured and test SMTP authentication
   */
  static async verifyConnection(): Promise<EmailStatusResult> {
    const user = process.env.GMAIL_USER?.trim() || "";
    const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "") || "";

    if (!user || !pass) {
      return {
        isConfigured: false,
        userEmail: null,
        isValid: false,
        error: "GMAIL_USER or GMAIL_APP_PASSWORD missing in .env",
      };
    }

    try {
      const transporter = this.getTransporter();
      await transporter.verify();
      return {
        isConfigured: true,
        userEmail: user,
        isValid: true,
      };
    } catch (error: any) {
      console.error("[EmailService.verifyConnection] Verification failed:", error);
      return {
        isConfigured: true,
        userEmail: user,
        isValid: false,
        error: error.message || "Failed to authenticate with Gmail SMTP",
      };
    }
  }

  /**
   * Extracts Subject and Body from AI-generated pitch copy
   */
  static parseEmailPitch(
    rawPitch: string,
    businessName: string
  ): { subject: string; body: string } {
    if (!rawPitch || !rawPitch.trim()) {
      return {
        subject: `Quick question regarding ${businessName}`,
        body: `Hi ${businessName} team,\n\nI was looking at your Google profile and noticed an opportunity to improve direct client bookings. Let me know if you'd be open to a quick chat.`,
      };
    }

    let text = rawPitch.trim();
    let subject = `Quick question for ${businessName}`;

    // Detect "Subject: ..." in the first few lines
    const subjectMatch = text.match(/^Subject:\s*(.+)$/im);
    if (subjectMatch) {
      subject = subjectMatch[1].trim();
      text = text.replace(/^Subject:\s*.+\n*/im, "").trim();
    }

    // Clean placeholder brackets like [Name], [Business Name]
    text = text
      .replace(/\[Business Name\]/gi, businessName)
      .replace(/\[Name\]/gi, `${businessName} team`)
      .replace(/\[Your Name\]/gi, "Outreach Team")
      .replace(/\[Company\]/gi, "Digital Studio");

    subject = subject
      .replace(/\[Business Name\]/gi, businessName)
      .replace(/\[Name\]/gi, businessName);

    return { subject, body: text };
  }

  /**
   * Convert plain text / markdown newlines into clean HTML email
   */
  private static formatHtmlEmail(body: string, businessName?: string): string {
    const paragraphs = body
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => {
        // Convert single line breaks to <br/>
        const withBreaks = p.replace(/\n/g, "<br/>");
        return `<p style="margin: 0 0 16px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #1e293b;">${withBreaks}</p>`;
      })
      .join("");

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 24px; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          ${paragraphs}
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Send an automated email through Gmail SMTP
   */
  static async sendLeadEmail(params: SendEmailParams): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }> {
    const { to, subject, body, leadId, businessName } = params;

    if (!to || !to.includes("@")) {
      return { success: false, error: "Invalid recipient email address" };
    }

    try {
      const transporter = this.getTransporter();
      const user = process.env.GMAIL_USER?.trim();
      const fromAddress = `"${businessName ? "Lead Outreach" : "Business Development"}" <${user}>`;

      const htmlContent = this.formatHtmlEmail(body, businessName);

      const info = await transporter.sendMail({
        from: fromAddress,
        to: to.trim(),
        subject: subject.trim(),
        text: body.trim(),
        html: htmlContent,
      });

      console.log(`📧 [Email Outreach] Email dispatched to ${to} (MessageId: ${info.messageId})`);

      // Update lead status to CONTACTED if leadId provided
      if (leadId) {
        await prisma.business.update({
          where: { id: leadId },
          data: { status: "CONTACTED" },
        }).catch((e) => console.warn("[EmailService] Failed to update lead status:", e));
      }

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error: any) {
      console.error(`❌ [Email Outreach] Failed to send email to ${to}:`, error);
      return {
        success: false,
        error: error.message || "Failed to send email via Gmail SMTP",
      };
    }
  }
}
