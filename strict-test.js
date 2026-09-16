/**
 * Strict Automated End-to-End Test Suite for Lead Agent
 * Tests all API endpoints, Edge Cases, Business Logic, Phone Normalization,
 * Email Scraping, Export formatting, and Page status codes.
 */

const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const { normalizePhoneNumber } = require('./src/lib/outreach/phone-utils');
const { EmailScraper } = require('./src/lib/collectors/email-scraper');

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:3000';

const results = {
  total: 0,
  passed: 0,
  failed: 0,
  failures: []
};

function recordTest(testName, success, errorMsg = '') {
  results.total++;
  if (success) {
    results.passed++;
    console.log(`  ✅ PASS: ${testName}`);
  } else {
    results.failed++;
    results.failures.push({ testName, errorMsg });
    console.error(`  ❌ FAIL: ${testName} -> ${errorMsg}`);
  }
}

async function runStrictTests() {
  console.log('================================================================');
  console.log('🧪 STRICT SYSTEM TESTING SUITE: LEAD AGENT PRO');
  console.log('================================================================\n');

  let sampleLeadId = null;

  // -------------------------------------------------------------
  // SUITE 1: API Status & Health Endpoints
  // -------------------------------------------------------------
  console.log('--- SUITE 1: API Core Endpoints ---');

  // 1.1 /api/stats
  try {
    const res = await axios.get(`${BASE_URL}/api/stats`);
    const isOk = res.status === 200 && res.data.success && typeof res.data.stats.totalBusinesses === 'number';
    recordTest('GET /api/stats returns status 200 and valid KPI metrics', isOk);
  } catch (e) {
    recordTest('GET /api/stats returns status 200', false, e.message);
  }

  // 1.2 /api/leads list & pagination
  try {
    const res = await axios.get(`${BASE_URL}/api/leads?limit=10`);
    const hasItems = res.status === 200 && Array.isArray(res.data.items) && res.data.items.length > 0;
    if (hasItems) sampleLeadId = res.data.items[0].id;
    recordTest('GET /api/leads returns array of lead items with status 200', hasItems);
  } catch (e) {
    recordTest('GET /api/leads returns array of lead items', false, e.message);
  }

  // 1.3 /api/leads filter by Priority
  try {
    const res = await axios.get(`${BASE_URL}/api/leads?priority=A`);
    const allA = res.status === 200 && Array.isArray(res.data.items) && res.data.items.every(l => l.lead?.priority === 'A');
    recordTest('GET /api/leads?priority=A strictly returns only Priority A leads', allA);
  } catch (e) {
    recordTest('GET /api/leads?priority=A filter', false, e.message);
  }

  // 1.4 /api/leads filter by Opportunity
  try {
    const res = await axios.get(`${BASE_URL}/api/leads?hasWebsite=no`);
    const allNoWeb = res.status === 200 && Array.isArray(res.data.items) && res.data.items.length > 0 && res.data.items.every(l => l.lead?.hasWebsite === false);
    recordTest('GET /api/leads?hasWebsite=no strictly returns leads without websites', allNoWeb);
  } catch (e) {
    recordTest('GET /api/leads?hasWebsite=no filter', false, e.message);
  }

  // 1.5 /api/leads/[id] single lead retrieval
  try {
    if (!sampleLeadId) throw new Error('No sample lead available');
    const res = await axios.get(`${BASE_URL}/api/leads/${sampleLeadId}`);
    const valid = res.status === 200 && res.data.success && res.data.lead.id === sampleLeadId;
    recordTest(`GET /api/leads/[id] successfully retrieves lead (${sampleLeadId})`, valid);
  } catch (e) {
    recordTest('GET /api/leads/[id] retrieval', false, e.message);
  }

  // 1.6 /api/leads/[id] with non-existent ID
  try {
    const res = await axios.get(`${BASE_URL}/api/leads/non-existent-cuid-12345`, { validateStatus: () => true });
    recordTest('GET /api/leads/[id] with invalid ID returns 404', res.status === 404);
  } catch (e) {
    recordTest('GET /api/leads/[id] with invalid ID returns 404', false, e.message);
  }

  // 1.7 PATCH /api/leads/[id] status transition
  try {
    if (!sampleLeadId) throw new Error('No sample lead available');
    const res = await axios.patch(`${BASE_URL}/api/leads/${sampleLeadId}`, { status: 'AUDITED' });
    const isUpdated = res.status === 200 && res.data.success && res.data.lead.status === 'AUDITED';
    recordTest(`PATCH /api/leads/[id] updates lead status to AUDITED`, isUpdated);
  } catch (e) {
    recordTest('PATCH /api/leads/[id] status update', false, e.message);
  }

  // -------------------------------------------------------------
  // SUITE 2: Channels (Gmail & WhatsApp)
  // -------------------------------------------------------------
  console.log('\n--- SUITE 2: Outreach Channels ---');

  // 2.1 /api/email/status
  try {
    const res = await axios.get(`${BASE_URL}/api/email/status`);
    const isConfigured = res.status === 200 && res.data.isConfigured === true && res.data.isValid === true;
    recordTest('GET /api/email/status reports Gmail SMTP configured and valid', isConfigured, res.data.error || '');
  } catch (e) {
    recordTest('GET /api/email/status', false, e.message);
  }

  // 2.2 POST /api/email/send input validations
  try {
    const resNoTo = await axios.post(`${BASE_URL}/api/email/send`, { to: '', subject: 'test', message: 'test' }, { validateStatus: () => true });
    recordTest('POST /api/email/send rejects empty recipient email with 400', resNoTo.status === 400);

    const resBadEmail = await axios.post(`${BASE_URL}/api/email/send`, { to: 'not-an-email', subject: 'test', message: 'test' }, { validateStatus: () => true });
    recordTest('POST /api/email/send rejects invalid email format with 400', resBadEmail.status === 400);

    const resNoSubject = await axios.post(`${BASE_URL}/api/email/send`, { to: 'test@example.com', subject: '', message: 'test' }, { validateStatus: () => true });
    recordTest('POST /api/email/send rejects empty subject line with 400', resNoSubject.status === 400);
  } catch (e) {
    recordTest('POST /api/email/send validation checks', false, e.message);
  }

  // 2.3 /api/whatsapp/status
  try {
    const res = await axios.get(`${BASE_URL}/api/whatsapp/status`);
    const valid = res.status === 200 && res.data.success && ['CONNECTED', 'QR_READY', 'INITIALIZING', 'DISCONNECTED'].includes(res.data.data.status);
    recordTest('GET /api/whatsapp/status returns valid state machine status', valid);
  } catch (e) {
    recordTest('GET /api/whatsapp/status', false, e.message);
  }

  // 2.4 POST /api/whatsapp/send input validation
  try {
    const resNoPhone = await axios.post(`${BASE_URL}/api/whatsapp/send`, { phone: '', message: 'Hello' }, { validateStatus: () => true });
    recordTest('POST /api/whatsapp/send rejects empty phone with 400', resNoPhone.status === 400);

    const resNoMsg = await axios.post(`${BASE_URL}/api/whatsapp/send`, { phone: '+971569684858', message: '' }, { validateStatus: () => true });
    recordTest('POST /api/whatsapp/send rejects empty message with 400', resNoMsg.status === 400);
  } catch (e) {
    recordTest('POST /api/whatsapp/send input validation', false, e.message);
  }

  // -------------------------------------------------------------
  // SUITE 3: AutoPilot Autonomous Outbound Engine
  // -------------------------------------------------------------
  console.log('\n--- SUITE 3: AutoPilot Engine ---');

  try {
    const res = await axios.get(`${BASE_URL}/api/autopilot`);
    const data = res.data;
    const isValidState = res.status === 200 && data.success &&
      typeof data.data.isActive === 'boolean' &&
      Array.isArray(data.data.targetQueues) &&
      typeof data.data.config.dailyWhatsAppLimit === 'number' &&
      typeof data.data.config.enableEmail === 'boolean';
    recordTest('GET /api/autopilot returns complete autonomous engine state & config', isValidState);
  } catch (e) {
    recordTest('GET /api/autopilot state retrieval', false, e.message);
  }

  // 3.2 Update Config
  try {
    const res = await axios.post(`${BASE_URL}/api/autopilot`, {
      action: 'update-config',
      config: {
        dailyWhatsAppLimit: 40,
        enableEmail: true,
        minDelaySeconds: 25,
        maxDelaySeconds: 50,
      }
    });
    const updated = res.status === 200 && res.data.data.config.dailyWhatsAppLimit === 40;
    recordTest('POST /api/autopilot action: update-config updates settings cleanly', updated);
  } catch (e) {
    recordTest('POST /api/autopilot update-config', false, e.message);
  }

  // -------------------------------------------------------------
  // SUITE 4: Export Formats & Document Generation
  // -------------------------------------------------------------
  console.log('\n--- SUITE 4: Export Engine & Spreadsheet Generation ---');

  // 4.1 CSV Export (Excel safe, no \n inside cells)
  try {
    const res = await axios.get(`${BASE_URL}/api/export?format=csv`);
    const csvContent = res.data;
    const hasHeader = csvContent.includes('"Business Name"') && csvContent.includes('"Phone"');
    const lines = csvContent.trim().split('\n');
    const noMultiLineTowers = lines.every(line => !line.startsWith(' ') && line.includes(','));
    recordTest('GET /api/export?format=csv generates single-line Excel-safe CSV', hasHeader && noMultiLineTowers);
  } catch (e) {
    recordTest('GET /api/export?format=csv', false, e.message);
  }

  // 4.2 Native Excel (.xls) Export
  try {
    const res = await axios.get(`${BASE_URL}/api/export?format=excel`);
    const isExcelHtml = res.headers['content-type'].includes('vnd.ms-excel') &&
      res.data.includes('<table') &&
      res.data.includes('background-color: #1e293b');
    recordTest('GET /api/export?format=excel produces styled XML/HTML spreadsheet with dark headers', isExcelHtml);
  } catch (e) {
    recordTest('GET /api/export?format=excel', false, e.message);
  }

  // 4.3 Printable Dossier HTML
  try {
    if (!sampleLeadId) throw new Error('No sample lead');
    const res = await axios.get(`${BASE_URL}/api/export?id=${sampleLeadId}&format=html`);
    const isDossier = res.headers['content-type'].includes('text/html') &&
      res.data.includes('window.print()') &&
      (res.data.includes('Executive Lead Report') || res.data.includes('Lead Agent'));
    recordTest('GET /api/export?format=html generates printable executive dossier', isDossier);
  } catch (e) {
    recordTest('GET /api/export?format=html', false, e.message);
  }

  // -------------------------------------------------------------
  // SUITE 5: Phone Normalization Logic (Strict Unit Matrix)
  // -------------------------------------------------------------
  console.log('\n--- SUITE 5: Phone Normalizer Unit Tests ---');

  const testCases = [
    // UAE cases
    { input: '056 968 4858', city: 'Dubai', expected: '971569684858' },
    { input: '+971 56 968 4858', city: 'Dubai', expected: '971569684858' },
    { input: '04 235 5384', city: 'Dubai', expected: '97142355384' },
    { input: '0501870994', city: 'Abu Dhabi', expected: '971501870994' },
    // UK cases
    { input: '07123 456789', city: 'London', expected: '447123456789' },
    { input: '+44 7123 456789', city: 'London', expected: '447123456789' },
    { input: '020 7946 0919', city: 'London', expected: '442079460919' },
    // Pakistan cases
    { input: '0300 1234567', city: 'Lahore', expected: '923001234567' },
    { input: '+92 300 1234567', city: 'Karachi', expected: '923001234567' },
    // International prefix 00
    { input: '00971569684858', city: '', expected: '971569684858' },
  ];

  for (const tc of testCases) {
    const result = normalizePhoneNumber(tc.input, tc.city);
    const pass = result === tc.expected;
    recordTest(`Normalize "${tc.input}" (${tc.city || 'general'}) -> "${tc.expected}"`, pass, `Got "${result}"`);
  }

  // -------------------------------------------------------------
  // SUITE 6: Email Scraper & Filtering Tests
  // -------------------------------------------------------------
  console.log('\n--- SUITE 6: Website Email Scraper ---');

  try {
    const scraped = await EmailScraper.scrapeEmailFromWebsite('https://www.sweetvioletspa.ae/');
    const ok = scraped && scraped.includes('@sweetvioletspa.ae');
    recordTest('EmailScraper successfully extracts email from live site (sweetvioletspa.ae)', ok, `Got: ${scraped}`);
  } catch (e) {
    recordTest('EmailScraper on live site', false, e.message);
  }

  try {
    const nonExistent = await EmailScraper.scrapeEmailFromWebsite('https://this-domain-definitely-does-not-exist-999.com');
    recordTest('EmailScraper handles non-existent/offline domains gracefully with null', nonExistent === null);
  } catch (e) {
    recordTest('EmailScraper non-existent domain', false, e.message);
  }

  // -------------------------------------------------------------
  // SUITE 7: Frontend Page SSR/HTML Rendering
  // -------------------------------------------------------------
  console.log('\n--- SUITE 7: Frontend Web Pages (HTTP 200) ---');
  const pages = [
    { path: '/', name: 'Dashboard Page (/)' },
    { path: '/leads', name: 'Leads Pipeline Page (/leads)' },
    { path: '/discover', name: 'Discovery Engine Page (/discover)' },
    { path: '/autopilot', name: 'AutoPilot Agent Page (/autopilot)' },
  ];

  if (sampleLeadId) {
    pages.push({ path: `/leads/${sampleLeadId}`, name: `Lead Detail Page (/leads/${sampleLeadId})` });
  }

  for (const p of pages) {
    try {
      const res = await axios.get(`${BASE_URL}${p.path}`);
      recordTest(`Page ${p.name} responds with HTTP 200`, res.status === 200);
    } catch (e) {
      recordTest(`Page ${p.name}`, false, e.message);
    }
  }

  // -------------------------------------------------------------
  // FINAL SUMMARY
  // -------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`📊 TEST SUITE SUMMARY: ${results.passed}/${results.total} PASSED`);
  if (results.failed === 0) {
    console.log('🎉 ALL TESTS PASSED! ZERO REGRESSIONS FOUND.');
  } else {
    console.log(`⚠️ ${results.failed} TEST(S) FAILED:`);
    results.failures.forEach((f, idx) => {
      console.log(`  ${idx + 1}. ${f.testName}: ${f.errorMsg}`);
    });
  }
  console.log('================================================================');

  await prisma.$disconnect();
  process.exit(results.failed > 0 ? 1 : 0);
}

runStrictTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
