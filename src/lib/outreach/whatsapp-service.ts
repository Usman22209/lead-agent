import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  Browsers,
} from "@whiskeysockets/baileys";
import pino from "pino";
import QRCode from "qrcode";
import path from "path";
import fs from "fs";
import { prisma } from "@/lib/db";
import { normalizePhoneNumber } from "./phone-utils";

export type WhatsAppStatus = "DISCONNECTED" | "INITIALIZING" | "QR_READY" | "CONNECTED" | "RECONNECTING";

export interface WhatsAppServiceState {
  status: WhatsAppStatus;
  qrCodeDataUrl: string | null;
  phoneNumber: string | null;
  userName: string | null;
  lastConnectedAt: string | null;
  error: string | null;
}

export interface InboundMessageLog {
  id: string;
  senderPhone: string;
  senderName?: string;
  messageText: string;
  receivedAt: string;
  matchedBusinessName?: string;
  matchedBusinessId?: string;
}

class WhatsAppManager {
  private socket: WASocket | null = null;
  private status: WhatsAppStatus = "DISCONNECTED";
  private qrCodeDataUrl: string | null = null;
  private phoneNumber: string | null = null;
  private userName: string | null = null;
  private lastConnectedAt: string | null = null;
  private lastError: string | null = null;
  private inboundLogs: InboundMessageLog[] = [];
  private isInitializing = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private static MAX_RECONNECT_ATTEMPTS = 5;

  private authDir = path.join(process.cwd(), "auth_info_baileys");

  constructor() {
    // Ensure auth folder exists
    if (!fs.existsSync(this.authDir)) {
      fs.mkdirSync(this.authDir, { recursive: true });
    }
  }

  public clearAuth(): void {
    try {
      if (fs.existsSync(this.authDir)) {
        fs.rmSync(this.authDir, { recursive: true, force: true });
        fs.mkdirSync(this.authDir, { recursive: true });
        console.log("🧹 [WhatsApp] Stale auth credentials cleared from disk.");
      }
    } catch (e) {
      console.error("Failed to clear auth directory:", e);
    }
  }

  public getState(): WhatsAppServiceState & { recentInbound: InboundMessageLog[] } {
    return {
      status: this.status,
      qrCodeDataUrl: this.qrCodeDataUrl,
      phoneNumber: this.phoneNumber,
      userName: this.userName,
      lastConnectedAt: this.lastConnectedAt,
      error: this.lastError,
      recentInbound: this.inboundLogs.slice(-10).reverse(),
    };
  }

  public async initialize(forceNewSession: boolean = false): Promise<void> {
    console.log(`🔄 [WhatsApp] initialize() called. forceNew=${forceNewSession} status=${this.status} isInitializing=${this.isInitializing}`);
    if (this.status === "CONNECTED" || this.isInitializing) {
      console.log(`⏭️ [WhatsApp] Skipping — already ${this.status === "CONNECTED" ? "connected" : "initializing"}.`);
      return;
    }

    if (forceNewSession) {
      console.log("🧹 [WhatsApp] Force new session requested. Wiping authDir.");
      this.clearAuth();
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.isInitializing = true;
    if (this.status !== "QR_READY") {
      this.status = "INITIALIZING";
    }
    this.lastError = null;

    try {
      const { state, saveCreds } = await useMultiFileAuthState(this.authDir);
      const logger = pino({ level: "silent" });

      if (this.socket) {
        try {
          this.socket.ev.removeAllListeners("connection.update");
          this.socket.ev.removeAllListeners("creds.update");
          this.socket.ev.removeAllListeners("messages.upsert");
          this.socket.end(undefined);
        } catch {
          // ignore
        }
        this.socket = null;
      }

      console.log("🔌 [WhatsApp] Creating Baileys socket...");
      const sock = makeWASocket({
        auth: state,
        logger,
        browser: Browsers.windows("Desktop"),
        syncFullHistory: false,
        printQRInTerminal: true,
      });
      this.socket = sock;
      console.log("✅ [WhatsApp] Socket created. Waiting for connection.update events...");

      // 1. Credentials persistence
      sock.ev.on("creds.update", saveCreds);

      // 2. Listen for Connection Updates
      sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        // QR Code Received
        if (qr) {
          try {
            this.qrCodeDataUrl = await QRCode.toDataURL(qr, { margin: 2, scale: 6 });
            this.status = "QR_READY";
            this.isInitializing = false;
            console.log("\n📱 ==========================================");
            console.log("📱 [WhatsApp] QR Code Ready to Scan!");
            console.log("📱 ==========================================\n");
          } catch (qrErr) {
            console.error("Failed to generate QR data URL:", qrErr);
          }
        }

        // Connection Closed / Reconnect lifecycle
        if (connection === "close") {
          const error = lastDisconnect?.error as any;
          const statusCode = error?.output?.statusCode;
          const isLoggedOut = statusCode === DisconnectReason.loggedOut;

          console.log(`ℹ️ [WhatsApp] Connection closed. statusCode=${statusCode}, isLoggedOut=${isLoggedOut}, reconnectAttempts=${this.reconnectAttempts}`);
          this.isInitializing = false;

          if (isLoggedOut) {
            console.log("🔒 [WhatsApp] Session logged out (401). Clearing credentials. Manual re-pair required.");
            this.clearAuth();
            this.status = "DISCONNECTED";
            this.phoneNumber = null;
            this.userName = null;
            this.qrCodeDataUrl = null;
            this.socket = null;
            this.reconnectAttempts = 0;
            // Do NOT auto-reconnect after 401 — user must manually re-pair
            return;
          }

          // Guard against infinite reconnect loops
          this.reconnectAttempts++;
          if (this.reconnectAttempts > WhatsAppManager.MAX_RECONNECT_ATTEMPTS) {
            console.log(`🛑 [WhatsApp] Max reconnect attempts (${WhatsAppManager.MAX_RECONNECT_ATTEMPTS}) reached. Stopping. Manual re-pair required.`);
            this.status = "DISCONNECTED";
            this.lastError = "Max reconnect attempts reached. Please re-pair manually.";
            this.socket = null;
            this.reconnectAttempts = 0;
            return;
          }

          // If not logged out, reconnect to keep QR live or restore session
          const delay = Math.min(3000 * this.reconnectAttempts, 15000); // Back off: 3s, 6s, 9s... up to 15s
          console.log(`🔄 [WhatsApp] Reconnecting in ${delay / 1000}s (attempt ${this.reconnectAttempts}/${WhatsAppManager.MAX_RECONNECT_ATTEMPTS})...`);
          if (this.status === "CONNECTED") {
            this.status = "RECONNECTING";
          }
          this.reconnectTimer = setTimeout(() => {
            this.initialize();
          }, delay);
        } else if (connection === "open") {
          console.log("\n✅ ==========================================");
          console.log("✅ [WhatsApp] Connected successfully to WhatsApp Web!");
          console.log("✅ ==========================================\n");
          this.status = "CONNECTED";
          this.qrCodeDataUrl = null;
          this.lastConnectedAt = new Date().toISOString();
          this.lastError = null;
          this.isInitializing = false;
          this.reconnectAttempts = 0; // Reset on successful connection

          // Extract User Info
          const userJid = sock.user?.id || "";
          this.phoneNumber = userJid.split(":")[0]?.split("@")[0] || null;
          this.userName = sock.user?.name || "Connected User";
        }
      });

      // 3. Listen for Inbound Client Responses
      sock.ev.on("messages.upsert", async ({ messages, type }) => {
        if (type !== "notify") return;

        for (const msg of messages) {
          // Only process incoming messages from other parties
          if (!msg.key.fromMe && msg.message) {
            const rawJid = msg.key.remoteJid || "";
            if (!rawJid.endsWith("@s.whatsapp.net")) continue; // Ignore groups and status updates

            const senderPhone = rawJid.replace("@s.whatsapp.net", "");
            const messageText =
              msg.message.conversation ||
              msg.message.extendedTextMessage?.text ||
              "[Media message]";

            console.log(`📩 [WhatsApp Inbound] Reply from ${senderPhone}: "${messageText}"`);

            // Match against database leads
            let matchedBiz: any = null;
            try {
              // Try matching phone containing digits
              const cleanDigits = senderPhone.slice(-8); // Match last 8 digits
              matchedBiz = await prisma.business.findFirst({
                where: {
                  phone: {
                    contains: cleanDigits,
                  },
                },
              });

              if (matchedBiz) {
                // Update lead stage to MEETING / REPLIED and HALT follow-ups immediately
                await prisma.business.update({
                  where: { id: matchedBiz.id },
                  data: {
                    status: "MEETING",
                    nextFollowUpAt: null,
                  },
                });

                // Record inbound reply in persistent outreach log
                await (prisma as any).outreachLog.create({
                  data: {
                    businessId: matchedBiz.id,
                    channel: "WHATSAPP",
                    step: matchedBiz.followUpCount ?? 0,
                    message: `[INBOUND REPLY] ${messageText}`,
                    status: "REPLIED",
                  },
                }).catch(() => null);

                console.log(`🎯 [Lead Match] Auto-updated status to MEETING & halted all follow-ups for "${matchedBiz.name}"!`);
              }
            } catch (dbErr) {
              console.error("Failed to match inbound lead:", dbErr);
            }

            // Record log in memory
            const logEntry: InboundMessageLog = {
              id: msg.key.id || Math.random().toString(),
              senderPhone,
              senderName: msg.pushName || undefined,
              messageText,
              receivedAt: new Date().toISOString(),
              matchedBusinessName: matchedBiz?.name,
              matchedBusinessId: matchedBiz?.id,
            };

            this.inboundLogs.push(logEntry);
            if (this.inboundLogs.length > 50) this.inboundLogs.shift();
          }
        }
      });
    } catch (err: any) {
      console.error("❌ [WhatsApp] Initialization failed:", err);
      this.status = "DISCONNECTED";
      this.lastError = err.message || "Failed to initialize WhatsApp";
      this.isInitializing = false;
    }
  }

  public static normalizePhoneNumber(toPhone: string, contextCity?: string): string {
    return normalizePhoneNumber(toPhone, contextCity);
  }

  public async sendMessage(toPhone: string, text: string, contextCity?: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (this.status !== "CONNECTED" || !this.socket) {
      return { success: false, error: "WhatsApp is not connected. Please scan QR code first." };
    }

    try {
      const clean = WhatsAppManager.normalizePhoneNumber(toPhone, contextCity);
      const jid = `${clean}@s.whatsapp.net`;

      // Verify the number actually exists on WhatsApp before sending
      try {
        const checkResults = await this.socket.onWhatsApp(jid);
        const contact = checkResults && checkResults[0];
        if (!contact || !contact.exists) {
          console.warn(`⚠️ [WhatsApp Outbound] Phone ${toPhone} (${jid}) is NOT registered on WhatsApp. Skipping.`);
          return { success: false, error: "Phone number is not registered on WhatsApp" };
        }
      } catch (checkErr) {
        console.warn(`⚠️ [WhatsApp Outbound] WhatsApp number verification error for ${jid}:`, checkErr);
      }

      console.log(`📤 [WhatsApp Outbound] Sending message to ${jid}...`);
      const res = await this.socket.sendMessage(jid, { text });

      return {
        success: true,
        messageId: res?.key.id || undefined,
      };
    } catch (err: any) {
      console.error(`❌ [WhatsApp Send Error] To ${toPhone}:`, err);
      return { success: false, error: err.message || "Failed to send message" };
    }
  }

  public async disconnect(): Promise<void> {
    try {
      if (this.socket) {
        await this.socket.logout();
        this.socket.end(new Error("Manual logout"));
        this.socket = null;
      }
      this.status = "DISCONNECTED";
      this.qrCodeDataUrl = null;
      this.phoneNumber = null;
      this.userName = null;
      this.clearAuth();
      console.log("🔌 [WhatsApp] Logged out and cleared session.");
    } catch (err) {
      console.error("Failed to disconnect cleanly:", err);
      this.clearAuth();
    }
  }
}

// Global singleton instance — MUST persist in both dev and production
const globalForWhatsApp = globalThis as unknown as { whatsAppManager: WhatsAppManager };
if (!globalForWhatsApp.whatsAppManager) {
  globalForWhatsApp.whatsAppManager = new WhatsAppManager();
}
export const whatsAppManager = globalForWhatsApp.whatsAppManager;
