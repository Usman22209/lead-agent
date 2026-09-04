/**
 * Next.js Instrumentation Hook
 * 
 * This file runs ONCE when the Next.js server starts.
 * It ensures the WhatsApp singleton is bootstrapped in the
 * same long-lived Node.js process that serves all API routes.
 * 
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  // Only run on the Node.js server runtime (not edge)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Dynamically import to avoid bundling client-side
    const { whatsAppManager } = await import("@/lib/outreach/whatsapp-service");
    console.log("🔧 [Instrumentation] WhatsApp singleton bootstrapped. Status:", whatsAppManager.getState().status);
  }
}
