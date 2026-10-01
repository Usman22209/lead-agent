const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

const prisma = new PrismaClient();

async function main() {
  console.log("==================================================");
  console.log("🔍 CHECKING DATABASE OUTREACH LOGS FOR DENTAL");
  console.log("==================================================");

  // Check if ANY log ever had dental-site
  const anyWithLink = await prisma.outreachLog.findMany({
    where: {
      message: { contains: "dental-site" }
    },
    include: { business: true },
    take: 10
  });
  console.log(`Logs in DB containing 'dental-site': ${anyWithLink.length}`);
  for (const l of anyWithLink) {
    console.log(`✅ [Step ${l.step}] ${l.business?.name} (${l.channel}) at ${l.sentAt}`);
  }

  // Check Step 0 logs for dental
  const step0Logs = await prisma.outreachLog.findMany({
    where: {
      step: 0,
      business: {
        OR: [
          { category: { contains: "dent" } },
          { name: { contains: "dent" } }
        ]
      }
    },
    include: { business: true },
    orderBy: { sentAt: "desc" },
    take: 5
  });
  console.log(`\nMost recent Step 0 (Initial) Dental Outreach:`);
  for (const l of step0Logs) {
    console.log(`[Step 0] "${l.business?.name}" | Sent: ${l.sentAt} | Has link: ${l.message?.includes("dental-site")}`);
    console.log(`   Message snippet: ${l.message?.slice(0, 160)}...\n`);
  }

  // Count leads by status
  const counts = await prisma.business.groupBy({
    by: ['status'],
    where: {
      OR: [
        { category: { contains: "dent" } },
        { name: { contains: "dent" } }
      ]
    },
    _count: true
  });
  console.log(`Dental leads status breakdown:`, counts);

  console.log("==================================================");
  console.log("🔍 CHECKING DENTAL LEADS AI AUDITS IN DATABASE");
  console.log("==================================================");

  const dentalLeads = await prisma.business.findMany({
    where: {
      OR: [
        { category: { contains: "Dentist" } },
        { category: { contains: "dentist" } },
        { category: { contains: "Dental" } },
        { category: { contains: "dental" } },
      ],
    },
    include: { lead: true },
    orderBy: { updatedAt: "desc" },
    take: 10,
  });

  console.log(`Checked ${dentalLeads.length} dental leads for stored aiAnalysis:\n`);

  for (const b of dentalLeads) {
    let audit = null;
    try {
      if (b.lead?.aiAnalysis) {
        audit = JSON.parse(b.lead.aiAnalysis);
      }
    } catch {}

    const whatsappPitch = audit?.suggestedPitch?.whatsapp;
    const emailPitch = audit?.suggestedPitch?.email;
    const hasLinkInWhatsapp = whatsappPitch?.includes("dental-site");
    const hasLinkInEmail = emailPitch?.includes("dental-site");

    console.log(`Lead: "${b.name}" (${b.city}) | Status: ${b.status} | Updated: ${b.updatedAt}`);
    console.log(`Has aiAnalysis stored? ${audit ? "YES" : "NO"}`);
    console.log(`WhatsApp pitch has dental link? ${hasLinkInWhatsapp ? "✅ YES" : "❌ NO"}`);
    console.log(`Email pitch has dental link? ${hasLinkInEmail ? "✅ YES" : "❌ NO"}`);
    if (hasLinkInWhatsapp) {
      const match = whatsappPitch.match(/https?:\/\/[^\s\n]+/g);
      console.log(`  Link: ${match ? match[0] : "N/A"}`);
    }
    console.log("--------------------------------------------------");
  }

  console.log("==================================================");
  console.log("🔍 CHECKING AUTOPILOT STATE (data/autopilot_state.json)");
  console.log("==================================================");

  const statePath = path.join(process.cwd(), "data", "autopilot_state.json");
  if (fs.existsSync(statePath)) {
    try {
      const state = JSON.parse(fs.readFileSync(statePath, "utf-8"));
      console.log(`Autopilot Status: ${state.status}`);
      console.log(`Total sent today: ${state.sentToday || 0} | Follow-ups sent today: ${state.followUpsSentToday || 0}`);
      
      const sentLogs = (state.logs || []).filter((l) =>
        ["WHATSAPP_SENT", "EMAIL_SENT", "FOLLOWUP_SENT", "SKIPPED", "AUDIT"].includes(l.type)
      );

      console.log(`Recent activity logs (${sentLogs.length}):`);
      for (const entry of sentLogs.slice(-20)) {
        console.log(`[${entry.type}] ${entry.time || ""} - ${entry.message}`);
      }
    } catch (e) {
      console.log("Error reading autopilot state:", e.message);
    }
  }
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
