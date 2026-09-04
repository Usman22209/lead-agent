import { NextResponse } from "next/server";
import { whatsAppManager } from "@/lib/outreach/whatsapp-service";

export async function GET() {
  try {
    const state = whatsAppManager.getState();
    return NextResponse.json({
      success: true,
      data: state,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action } = body;

    if (action === "connect" || action === "initialize") {
      const forceNew = Boolean(body.forceNewSession);
      await whatsAppManager.initialize(forceNew);
      const state = whatsAppManager.getState();
      return NextResponse.json({ success: true, message: "WhatsApp initialization triggered", data: state });
    }

    if (action === "disconnect") {
      await whatsAppManager.disconnect();
      const state = whatsAppManager.getState();
      return NextResponse.json({ success: true, message: "WhatsApp disconnected", data: state });
    }

    if (action === "reset") {
      await whatsAppManager.disconnect();
      await whatsAppManager.initialize(true);
      const state = whatsAppManager.getState();
      return NextResponse.json({ success: true, message: "WhatsApp session reset and fresh QR requested", data: state });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
