require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

const IGNORED_DOMAINS = [
  "sentry.io", "wixpress.com", "wix.com", "wordpress.org", "wordpress.com",
  "cloudflare.com", "googleapis.com", "google.com", "schema.org",
  "example.com", "domain.com", "email.com", "yourdomain.com", "bootstrap.com"
];

const IGNORED_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".css", ".js"];

function isValidEmail(email) {
  if (!email || email.length > 80 || email.length < 5) return false;
  if (!email.includes('@') || !email.includes('.')) return false;
  for (const ext of IGNORED_EXTENSIONS) {
    if (email.endsWith(ext)) return false;
  }
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return false;
  for (const ignored of IGNORED_DOMAINS) {
    if (domain === ignored || domain.endsWith(`.${ignored}`)) return false;
  }
  return true;
}

async function scrapeEmail(websiteUrl) {
  if (!websiteUrl) return null;
  let url = websiteUrl.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }

  try {
    const domain = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      },
      timeout: 5000,
      maxRedirects: 3,
      validateStatus: (s) => s < 400
    });

    const html = typeof res.data === 'string' ? res.data : '';
    if (!html) return null;

    // 1. mailto:
    const mailtos = (html.match(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi) || [])
      .map(m => m.replace(/^mailto:/i, '').toLowerCase())
      .filter(isValidEmail);

    if (mailtos.length > 0) return mailtos[0];

    // 2. raw regex
    const raw = (html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi) || [])
      .map(e => e.toLowerCase())
      .filter(isValidEmail);

    if (raw.length > 0) return raw[0];

    // 3. /contact
    try {
      const contactUrl = new URL('/contact', url).href;
      const cRes = await axios.get(contactUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        timeout: 4000
      });
      const cHtml = typeof cRes.data === 'string' ? cRes.data : '';
      const cMailtos = (cHtml.match(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi) || [])
        .map(m => m.replace(/^mailto:/i, '').toLowerCase())
        .filter(isValidEmail);
      if (cMailtos.length > 0) return cMailtos[0];
    } catch {}

    return null;
  } catch {
    return null;
  }
}

async function runEnrichment() {
  console.log('🔍 Starting website email enrichment for database leads...');
  const leads = await prisma.business.findMany({
    where: {
      website: { not: null },
      email: null
    },
    select: { id: true, name: true, website: true }
  });

  console.log(`Found ${leads.length} leads with website and missing email.`);
  let enriched = 0;

  for (const lead of leads) {
    process.stdout.write(`Scraping "${lead.name}" (${lead.website})... `);
    const email = await scrapeEmail(lead.website);
    if (email) {
      await prisma.business.update({
        where: { id: lead.id },
        data: { email }
      });
      console.log(`✅ FOUND: ${email}`);
      enriched++;
    } else {
      console.log(`❌ No email found`);
    }
  }

  console.log(`\n🎉 Enrichment complete! Found & saved emails for ${enriched} of ${leads.length} businesses.`);
}

runEnrichment()
  .catch(err => console.error(err))
  .finally(() => prisma.$disconnect());
