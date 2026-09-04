import { NextResponse } from "next/server";
import { LeadService } from "@/lib/services/lead-service";

/**
 * Strips internal point tags like "(+35 pts)", "(+18 pts)", "(0 pts)"
 */
function cleanQualificationReasons(raw: string | string[] | null | undefined): string[] {
  if (!raw) return [];
  let list: string[] = [];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) list = parsed;
      else list = [raw];
    } catch {
      list = raw.split(";").map((s) => s.trim()).filter(Boolean);
    }
  }

  return list
    .map((item) => {
      let cleaned = item.replace(/\s*\([+-]?\d+\s*pts\)/gi, "").trim();
      cleaned = cleaned.replace(/\s*—\s*/g, " — ");
      return cleaned;
    })
    .filter((item) => item.length > 0);
}

/**
 * Summarizes the reasons into concise, single-line spreadsheet highlights for Excel.
 * NEVER produces newlines (\n) to prevent Excel from expanding row height!
 */
function summarizeReasonsForSheet(cleanedReasons: string[]): string {
  if (!cleanedReasons || cleanedReasons.length === 0) return "—";

  const condensed = cleanedReasons.map((reason) => {
    let r = reason;
    if (/zero website/i.test(r)) return "No Website (High Opportunity)";
    if (/using social media link/i.test(r)) return "Social-Only Profile";
    if (/outdated/i.test(r)) return "Outdated / Unsecured Site";
    if (/high-traffic/i.test(r)) return "High-Traffic Target";
    if (/active local website/i.test(r)) return "Active Website";
    if (/market leader/i.test(r)) return r.replace(/Market Leader\s*\(([^)]+)\).*/i, "$1 (Market Leader)");
    if (/dominant local brand/i.test(r)) return r.replace(/Dominant Local Brand\s*\(([^)]+)\).*/i, "$1 (Top Brand)");
    if (/strong customer footfall/i.test(r)) return r.replace(/Strong Customer Footfall\s*\(([^)]+)\).*/i, "$1 (Strong Footfall)");
    if (/solid local presence/i.test(r)) return r.replace(/Solid Local Presence\s*\(([^)]+)\).*/i, "$1");
    if (/active local business/i.test(r)) return r.replace(/Active Local Business\s*\(([^)]+)\).*/i, "$1");
    if (/elite customer satisfaction/i.test(r)) return r.replace(/Elite Customer Satisfaction\s*\(([^)]+)\).*/i, "$1 (Elite Trust)");
    if (/strong customer reputation/i.test(r)) return r.replace(/Strong Customer Reputation\s*\(([^)]+)\).*/i, "$1");
    if (/high-ltv/i.test(r)) return r.replace(/High-LTV Premium Industry\s*\(([^)]+)\).*/i, "High-LTV $1");
    if (/direct phone/i.test(r)) return "Direct WhatsApp";
    if (/no direct phone/i.test(r)) return "No Direct Phone";

    return r.split(" — ")[0].trim();
  });

  const unique = Array.from(new Set(condensed));
  return unique.join(" | ");
}

function formatOpportunityType(type: string | null | undefined): string {
  switch (type) {
    case "NO_WEBSITE":
      return "No Website (Custom Build)";
    case "OUTDATED_WEBSITE":
      return "Outdated Site (Redesign & AI)";
    case "HIGH_RATING_UNCLAIMED":
      return "Social Only (Needs Website)";
    case "LOCAL_SEO_EXPANSION":
      return "Active Site (SEO & Conversion)";
    case "STANDARD_IMPROVEMENT":
      return "Digital Modernization";
    default:
      return type ? type.replace(/_/g, " ") : "Upgrade Candidate";
  }
}

function formatPriorityTier(priority: string | null | undefined): string {
  switch ((priority || "").toUpperCase()) {
    case "A":
      return "Tier A (Hot)";
    case "B":
      return "Tier B (Warm)";
    case "C":
      return "Tier C (Standard)";
    case "D":
      return "Tier D (Low)";
    default:
      return priority ? `Tier ${priority}` : "Tier D";
  }
}

function formatPipelineStatus(status: string | null | undefined): string {
  switch ((status || "").toUpperCase()) {
    case "NEW":
      return "New Lead";
    case "QUALIFIED":
      return "Qualified";
    case "AUDITED":
      return "Audited";
    case "DEMO_READY":
      return "Demo Created";
    case "CONTACTED":
      return "Contacted";
    case "MEETING":
      return "Meeting Booked";
    case "WON":
    case "CONVERTED":
      return "Won Deal 🎉";
    case "DISQUALIFIED":
      return "Disqualified";
    case "ARCHIVED":
      return "Archived";
    default:
      return status || "New Lead";
  }
}

function formatWebsiteStatus(website: string | null | undefined): string {
  if (!website || !website.trim()) {
    return "No Website";
  }
  const lower = website.toLowerCase();
  if (lower.includes("instagram.com") || lower.includes("facebook.com") || lower.includes("tiktok.com")) {
    return "Social Only";
  }
  return "Active Website";
}

function escapeCsv(val: any): string {
  if (val === null || val === undefined) return '""';
  // Strip any newlines (\r, \n) to prevent Excel from expanding row height!
  const singleLine = String(val).replace(/[\r\n]+/g, " ").trim();
  const escaped = singleLine.replace(/"/g, '""');
  return `"${escaped}"`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") || "csv";
    const priority = searchParams.get("priority") || undefined;
    const hasWebsite = searchParams.get("hasWebsite") || undefined;
    const city = searchParams.get("city") || undefined;
    const category = searchParams.get("category") || undefined;
    const id = searchParams.get("id") || undefined;

    let items: any[] = [];

    if (id) {
      const singleLead = await LeadService.getLeadById(id);
      if (singleLead) {
        items = [singleLead];
      }
    } else {
      const data = await LeadService.getLeads({
        priority,
        hasWebsite,
        city,
        category,
        limit: 2000,
      });
      items = data.items;
    }

    // 1. JSON Export
    if (format === "json") {
      const cleanedJson = items.map((item, idx) => ({
        index: idx + 1,
        id: item.id,
        name: item.name,
        category: item.category,
        city: item.city,
        phone: item.phone || null,
        email: item.email || null,
        website: item.website || null,
        websiteStatus: formatWebsiteStatus(item.website),
        rating: item.rating || 0,
        reviewCount: item.reviewCount || 0,
        leadScore: item.lead?.score || 0,
        priority: item.lead?.priority || "D",
        priorityTier: formatPriorityTier(item.lead?.priority),
        opportunityType: formatOpportunityType(item.lead?.opportunityType),
        status: formatPipelineStatus(item.status),
        qualificationReasons: cleanQualificationReasons(item.lead?.qualificationReasons),
        keySignals: summarizeReasonsForSheet(cleanQualificationReasons(item.lead?.qualificationReasons)),
        address: item.address || null,
        googleMapsUrl: item.googleMapsUrl || null,
      }));

      return new NextResponse(JSON.stringify(cleanedJson, null, 2), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="leads_export_${Date.now()}.json"`,
        },
      });
    }

    // 2. Native Excel (.xls) Export with Auto-Fitted Widths & Styled Headers
    if (format === "excel" || format === "xls") {
      const excelTableHtml = `
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
  <style>
    table { border-collapse: collapse; font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; }
    th {
      background-color: #1e293b;
      color: #ffffff;
      font-weight: bold;
      text-align: left;
      border: 1px solid #475569;
      padding: 10px 12px;
      white-space: nowrap;
    }
    td {
      border: 1px solid #cbd5e1;
      padding: 8px 12px;
      vertical-align: middle;
      white-space: nowrap;
      mso-number-format: "\\@";
    }
    .num { mso-number-format: "0"; text-align: right; }
    .dec { mso-number-format: "0.0"; text-align: right; }
    .tier-a { background-color: #dcfce7; color: #15803d; font-weight: bold; }
    .tier-b { background-color: #e0e7ff; color: #4338ca; font-weight: bold; }
    .tier-c { background-color: #fef3c7; color: #b45309; }
    .noweb { color: #dc2626; font-weight: 600; }
  </style>
</head>
<body>
  <table>
    <colgroup>
      <col style="width: 40px;">
      <col style="width: 200px;">
      <col style="width: 100px;">
      <col style="width: 100px;">
      <col style="width: 130px;">
      <col style="width: 140px;">
      <col style="width: 180px;">
      <col style="width: 120px;">
      <col style="width: 60px;">
      <col style="width: 70px;">
      <col style="width: 60px;">
      <col style="width: 100px;">
      <col style="width: 170px;">
      <col style="width: 100px;">
      <col style="width: 320px;">
      <col style="width: 250px;">
      <col style="width: 200px;">
    </colgroup>
    <thead>
      <tr>
        <th>#</th>
        <th>Business Name</th>
        <th>Category</th>
        <th>City</th>
        <th>Phone</th>
        <th>Email</th>
        <th>Website</th>
        <th>Web Status</th>
        <th>Rating</th>
        <th>Reviews</th>
        <th>Score</th>
        <th>Priority</th>
        <th>Opportunity</th>
        <th>Status</th>
        <th>Key Signals</th>
        <th>Address</th>
        <th>Google Maps</th>
      </tr>
    </thead>
    <tbody>
      ${items
        .map((item, idx) => {
          const reasons = cleanQualificationReasons(item.lead?.qualificationReasons);
          const signals = summarizeReasonsForSheet(reasons);
          const priority = (item.lead?.priority || "D").toUpperCase();
          const priorityClass = priority === "A" ? "tier-a" : priority === "B" ? "tier-b" : priority === "C" ? "tier-c" : "";
          const webStatus = formatWebsiteStatus(item.website);

          return `
          <tr>
            <td class="num">${idx + 1}</td>
            <td style="font-weight: 600;">${escapeHtml(item.name || "")}</td>
            <td>${escapeHtml(item.category || "")}</td>
            <td>${escapeHtml(item.city || "")}</td>
            <td>${escapeHtml(item.phone?.trim() || "Not Listed")}</td>
            <td>${escapeHtml(item.email?.trim() || "—")}</td>
            <td>${item.website ? `<a href="${escapeHtml(item.website)}">${escapeHtml(item.website)}</a>` : "—"}</td>
            <td class="${!item.website ? "noweb" : ""}">${escapeHtml(webStatus)}</td>
            <td class="dec">${item.rating ? Number(item.rating).toFixed(1) : "0.0"}</td>
            <td class="num">${item.reviewCount || 0}</td>
            <td class="num" style="font-weight: bold;">${item.lead?.score || 0}</td>
            <td class="${priorityClass}">${escapeHtml(formatPriorityTier(priority))}</td>
            <td>${escapeHtml(formatOpportunityType(item.lead?.opportunityType))}</td>
            <td>${escapeHtml(formatPipelineStatus(item.status))}</td>
            <td>${escapeHtml(signals)}</td>
            <td>${escapeHtml(item.address?.trim() || "—")}</td>
            <td>${item.googleMapsUrl ? `<a href="${escapeHtml(item.googleMapsUrl)}">Open Maps</a>` : "—"}</td>
          </tr>`;
        })
        .join("")}
    </tbody>
  </table>
</body>
</html>`;

      return new NextResponse(excelTableHtml, {
        headers: {
          "Content-Type": "application/vnd.ms-excel; charset=utf-8",
          "Content-Disposition": `attachment; filename="leads_pipeline_${Date.now()}.xls"`,
        },
      });
    }

    // 3. Executive HTML Document / Printable PDF Report
    if (format === "html" || format === "print") {
      const totalCount = items.length;
      const tierACount = items.filter((i) => i.lead?.priority === "A").length;
      const noWebsiteCount = items.filter((i) => !i.website || !i.website.trim()).length;
      const avgRating = totalCount > 0
        ? (items.reduce((acc, i) => acc + (i.rating || 0), 0) / totalCount).toFixed(1)
        : "0.0";

      const reportDate = new Date().toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      const filterSummary = [
        city && city !== "all" ? `City: ${city}` : "All Cities",
        category && category !== "all" ? `Category: ${category}` : "All Categories",
        priority && priority !== "all" ? `Priority: Tier ${priority}` : "All Priorities",
      ].join(" • ");

      const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Executive Lead Report — Lead Agent</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: #4f46e5;
      --primary-dark: #3730a3;
      --bg: #0b0f19;
      --card-bg: #111827;
      --border: rgba(255, 255, 255, 0.1);
      --text: #f3f4f6;
      --text-muted: #9ca3af;
      --success: #10b981;
      --warning: #f59e0b;
      --danger: #ef4444;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      line-height: 1.5;
      padding: 32px 24px;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    
    .action-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--border);
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.15s ease;
      border: 1px solid transparent;
    }
    .btn-primary { background: var(--primary); color: white; }
    .btn-primary:hover { background: var(--primary-dark); }
    .btn-outline { background: #1f2937; color: var(--text); border-color: var(--border); }
    .btn-outline:hover { background: #374151; }

    .header { margin-bottom: 28px; }
    .header h1 { font-size: 26px; font-weight: 800; letter-spacing: -0.02em; color: white; }
    .header .subtitle { color: var(--text-muted); font-size: 14px; margin-top: 4px; }
    .header .meta { display: inline-block; margin-top: 8px; font-size: 12px; background: rgba(79, 70, 229, 0.15); color: #a5b4fc; padding: 4px 10px; border: 1px solid rgba(79, 70, 229, 0.3); border-radius: 6px; }

    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-bottom: 32px;
    }
    .kpi-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 18px 20px;
    }
    .kpi-title { font-size: 12px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
    .kpi-val { font-size: 28px; font-weight: 800; color: white; margin-top: 6px; }
    .kpi-sub { font-size: 12px; color: var(--text-muted); margin-top: 2px; }

    .table-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
    }
    table { width: 100%; border-collapse: collapse; text-align: left; font-size: 13px; }
    th {
      background: rgba(0, 0, 0, 0.25);
      color: var(--text-muted);
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 14px 16px;
      border-bottom: 1px solid var(--border);
    }
    td {
      padding: 16px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      vertical-align: top;
    }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: rgba(255, 255, 255, 0.02); }

    .biz-name { font-size: 14px; font-weight: 700; color: white; }
    .biz-cat { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
    .biz-addr { font-size: 11px; color: #6b7280; margin-top: 4px; max-width: 280px; }

    .badge {
      display: inline-flex;
      align-items: center;
      padding: 3px 8px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.02em;
    }
    .badge-tier-a { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
    .badge-tier-b { background: rgba(79, 70, 229, 0.15); color: #a5b4fc; border: 1px solid rgba(79, 70, 229, 0.3); }
    .badge-tier-c { background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); }
    .badge-tier-d { background: rgba(107, 114, 128, 0.15); color: #9ca3af; border: 1px solid rgba(107, 114, 128, 0.3); }

    .score-badge { font-weight: 800; font-size: 14px; color: white; }
    .stars { color: #f59e0b; font-weight: 600; }

    .opportunity-tag {
      display: inline-block;
      font-size: 11px;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 6px;
      background: rgba(79, 70, 229, 0.1);
      color: #c7d2fe;
      border: 1px solid rgba(79, 70, 229, 0.2);
      margin-bottom: 6px;
    }

    .reasons-list { list-style: none; margin: 0; padding: 0; }
    .reasons-list li {
      font-size: 11px;
      color: #d1d5db;
      margin-bottom: 4px;
      line-height: 1.4;
      display: flex;
      align-items: baseline;
      gap: 6px;
    }
    .reasons-list li::before { content: "•"; color: #818cf8; font-weight: bold; }

    .contact-link {
      color: #38bdf8;
      text-decoration: none;
      font-weight: 500;
      font-size: 12px;
      display: block;
      margin-top: 2px;
    }
    .contact-link:hover { text-decoration: underline; }
    .phone-text { font-family: ui-monospace, monospace; font-size: 12px; color: #34d399; font-weight: 600; }

    @media print {
      body {
        background-color: #ffffff !important;
        color: #111827 !important;
        padding: 0 !important;
      }
      .no-print { display: none !important; }
      .container { max-width: 100% !important; margin: 0 !important; }
      .header h1 { color: #111827 !important; }
      .header .subtitle { color: #4b5563 !important; }
      .kpi-card {
        background: #f9fafb !important;
        border: 1px solid #e5e7eb !important;
        color: #111827 !important;
      }
      .kpi-val { color: #111827 !important; }
      .table-card {
        border: 1px solid #e5e7eb !important;
        background: #ffffff !important;
        box-shadow: none !important;
      }
      th {
        background: #f3f4f6 !important;
        color: #374151 !important;
        border-bottom: 2px solid #e5e7eb !important;
      }
      td {
        border-bottom: 1px solid #e5e7eb !important;
        color: #1f2937 !important;
      }
      .biz-name { color: #111827 !important; }
      .biz-cat, .biz-addr { color: #4b5563 !important; }
      .reasons-list li { color: #374151 !important; }
      .phone-text { color: #047857 !important; }
      .contact-link { color: #2563eb !important; }
      tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="action-bar no-print">
      <div style="display: flex; gap: 8px;">
        <button onclick="window.print()" class="btn btn-primary">
          🖨️ Print / Save as PDF
        </button>
        <a href="/api/export?format=excel${priority ? `&priority=${priority}` : ""}${city ? `&city=${city}` : ""}${category ? `&category=${category}` : ""}" class="btn btn-outline">
          📊 Download Excel (.xls)
        </a>
        <a href="/api/export?format=csv${priority ? `&priority=${priority}` : ""}${city ? `&city=${city}` : ""}${category ? `&category=${category}` : ""}" class="btn btn-outline">
          📥 Download CSV
        </a>
      </div>
      <a href="/leads" class="btn btn-outline">
        ← Back to Pipeline
      </a>
    </div>

    <div class="header">
      <h1>Executive Prospect Report</h1>
      <p class="subtitle">Generated on ${reportDate} • Lead Discovery & Outreach Engine</p>
      <span class="meta">${filterSummary} • ${totalCount} Qualified Leads</span>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-title">Total Qualified Leads</div>
        <div class="kpi-val">${totalCount}</div>
        <div class="kpi-sub">Ready in pipeline</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">Tier A (High Priority)</div>
        <div class="kpi-val" style="color: #34d399;">${tierACount}</div>
        <div class="kpi-sub">${totalCount > 0 ? Math.round((tierACount / totalCount) * 100) : 0}% of portfolio</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">Zero Website Detected</div>
        <div class="kpi-val" style="color: #818cf8;">${noWebsiteCount}</div>
        <div class="kpi-sub">Prime custom web builds</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">Average Google Rating</div>
        <div class="kpi-val" style="color: #fbbf24;">${avgRating} ★</div>
        <div class="kpi-sub">High consumer trust</div>
      </div>
    </div>

    <div class="table-card">
      <table>
        <thead>
          <tr>
            <th style="width: 40px;">#</th>
            <th style="width: 240px;">Business & Contact</th>
            <th style="width: 130px;">Score & Tier</th>
            <th style="width: 140px;">Website & Social</th>
            <th>Key Strategic Opportunities & Signals</th>
            <th style="width: 100px;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${items
            .map((item, idx) => {
              const reasons = cleanQualificationReasons(item.lead?.qualificationReasons);
              const oppLabel = formatOpportunityType(item.lead?.opportunityType);
              const priority = item.lead?.priority || "D";
              const score = item.lead?.score || 0;
              const badgeClass =
                priority === "A"
                  ? "badge-tier-a"
                  : priority === "B"
                  ? "badge-tier-b"
                  : priority === "C"
                  ? "badge-tier-c"
                  : "badge-tier-d";

              const webStatus = formatWebsiteStatus(item.website);
              const cleanPhone = item.phone ? item.phone.trim() : null;
              const waLink = cleanPhone ? `https://wa.me/${cleanPhone.replace(/[^0-9]/g, "")}` : null;

              return `
              <tr>
                <td style="font-weight: 700; color: #9ca3af;">${idx + 1}</td>
                <td>
                  <div class="biz-name">${escapeHtml(item.name || "Unknown Business")}</div>
                  <div class="biz-cat">${escapeHtml(item.category || "General")} • ${escapeHtml(item.city || "Unknown")}</div>
                  ${cleanPhone ? `<div style="margin-top: 6px;"><span class="phone-text">${escapeHtml(cleanPhone)}</span> ${waLink ? `<a href="${waLink}" target="_blank" class="contact-link no-print" style="display:inline; margin-left:4px;">(WhatsApp)</a>` : ""}</div>` : '<div style="font-size: 11px; color: #6b7280; margin-top: 4px;">Phone: Not Listed</div>'}
                  ${item.address ? `<div class="biz-addr">${escapeHtml(item.address)}</div>` : ""}
                  ${item.googleMapsUrl ? `<a href="${escapeHtml(item.googleMapsUrl)}" target="_blank" class="contact-link no-print">View on Google Maps ↗</a>` : ""}
                </td>
                <td>
                  <div class="score-badge">${score} <span style="font-size: 11px; font-weight: normal; color: #9ca3af;">/ 100</span></div>
                  <div style="margin-top: 4px;"><span class="badge ${badgeClass}">Tier ${priority}</span></div>
                  <div style="font-size: 11px; margin-top: 6px;" class="stars">${item.rating ? Number(item.rating).toFixed(1) : "0.0"} ★ <span style="color: #9ca3af;">(${item.reviewCount || 0} reviews)</span></div>
                </td>
                <td>
                  <div style="font-size: 12px; font-weight: 600; color: ${!item.website ? '#34d399' : '#e5e7eb'};">${webStatus}</div>
                  ${item.website ? `<a href="${escapeHtml(item.website)}" target="_blank" class="contact-link" style="max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(item.website.replace(/^https?:\/\//, ""))} ↗</a>` : '<div style="font-size: 11px; color: #9ca3af; margin-top: 2px;">No site detected</div>'}
                </td>
                <td>
                  <div class="opportunity-tag">${escapeHtml(oppLabel)}</div>
                  <ul class="reasons-list">
                    ${reasons.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}
                  </ul>
                </td>
                <td>
                  <span style="font-size: 12px; font-weight: 600; color: #d1d5db;">${escapeHtml(formatPipelineStatus(item.status))}</span>
                </td>
              </tr>
            `;
            })
            .join("")}
        </tbody>
      </table>
    </div>

    <div style="margin-top: 28px; text-align: center; font-size: 12px; color: #6b7280;" class="no-print">
      Lead Agent Local Discovery & Outreach System • Confidential Business Dossier
    </div>
  </div>
</body>
</html>`;

      return new NextResponse(htmlContent, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
        },
      });
    }

    // 4. Compact Single-Line CSV Export (Standard 1-line rows in Excel)
    const headers = [
      "#",
      "Business Name",
      "Category",
      "City",
      "Phone",
      "Email",
      "Website",
      "Web Status",
      "Rating",
      "Reviews",
      "Score",
      "Priority",
      "Opportunity",
      "Status",
      "Key Signals",
      "Address",
      "Google Maps",
    ];

    const rows = items.map((item, idx) => {
      const cleanedReasons = cleanQualificationReasons(item.lead?.qualificationReasons);
      // Strictly single-line summary with NO newlines!
      const signals = summarizeReasonsForSheet(cleanedReasons);

      return [
        idx + 1,
        escapeCsv(item.name || "Unknown"),
        escapeCsv(item.category || "General"),
        escapeCsv(item.city || "—"),
        escapeCsv(item.phone?.trim() || "Not Listed"),
        escapeCsv(item.email?.trim() || "—"),
        escapeCsv(item.website?.trim() || "—"),
        escapeCsv(formatWebsiteStatus(item.website)),
        item.rating ? Number(item.rating).toFixed(1) : "0.0",
        item.reviewCount || 0,
        item.lead?.score || 0,
        escapeCsv(formatPriorityTier(item.lead?.priority)),
        escapeCsv(formatOpportunityType(item.lead?.opportunityType)),
        escapeCsv(formatPipelineStatus(item.status)),
        escapeCsv(signals),
        escapeCsv(item.address?.trim() || "—"),
        escapeCsv(item.googleMapsUrl || "—"),
      ].join(",");
    });

    // Add UTF-8 Byte Order Mark (\uFEFF) so Excel on Windows opens natively with perfect Unicode
    const csvContent = "\uFEFF" + [headers.map(escapeCsv).join(","), ...rows].join("\r\n");

    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="leads_export_${Date.now()}.csv"`,
      },
    });
  } catch (error: any) {
    console.error("[API /export GET] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to export leads" },
      { status: 500 }
    );
  }
}
