# 🚀 LeadAgent AI — Outbound AI Sales Pipeline (Phase 1)

An intelligent outbound sales lead generation and qualification platform for local businesses (SMEs/SMBs).

---

## 🌟 What is Built in Phase 1

### 1. 🔍 Google Maps / Local Business Discovery Engine
- Target any niche (*Dentists, Salons, Gyms, Restaurants, Real Estate, Law Firms, Clinics*) and any location (*Lahore, Karachi, Dubai, etc.*).
- Dual-mode collector:
  - **Google Places API** (Text Search + Place Details) when `GOOGLE_PLACES_API_KEY` is supplied in `.env`.
  - **Smart Built-in Lead Generator** for immediate offline and zero-API-cost prototyping.
- Extracts: Business Name, Category, Phone number, Website, Address, City, Rating (stars), Review Count, Google Maps URL, and Place ID.

### 2. 💎 Lead Qualification & 0–100 Scoring Algorithm
Automated scoring engine evaluating businesses on high-probability conversion criteria:
- **No Website Detected**: `+35 pts` (Prime target for website build pitch)
- **Social Media Only (Facebook/Instagram instead of website)**: `+25 pts`
- **Existing Website**: `+5 pts` (Target for AI Audit & Revamp pitch)
- **High Google Rating (4.3 - 5.0 stars)**: `+12 to +15 pts` (Trusted reputation)
- **High Review Volume (50 to 400+ reviews)**: `+12 to +20 pts` (High customer footfall)
- **Direct Phone/WhatsApp Available**: `+10 pts` (Accessible outreach channel)
- **High-ROI Niche Fit**: `+10 pts` (Dentists, Real Estate, Law, Salons, Gyms, Clinics)
- **High-Authority Gap Bonus**: `+10 pts` (Great reviews & reputation but 0 web conversion funnel)

#### Priority Tiers:
- 🟢 **Priority A (Score 80–100)**: High Value Target (Top outreach priority)
- 🔵 **Priority B (Score 60–79)**: Medium Value Target
- 🟡 **Priority C (Score 40–59)**: Low Value Target
- ⚪ **Priority D (<40)**: Disqualified

### 3. 🛡️ Multi-Factor Deduplication & Storage Engine
- Database schema managed via **Prisma ORM**.
- Default configured with **SQLite** (`dev.db`) for immediate zero-friction local development.
- Ready for **Supabase / PostgreSQL** in production by updating `DATABASE_URL` in `.env`.
- Deduplicates on `googlePlaceId`, `phone`, `website`, and `(name + city)`. Automatically updates ratings/reviews for existing businesses without creating duplicate records.

### 4. 🖥️ Full Next.js 15 Command Center Dashboard
- **Command Center (`/`)**: Real-time KPI cards (Total Leads, Priority A count, Missing Website ratio), high-opportunity leads stream, quick preset scans, and search history.
- **Lead Discovery Engine (`/discover`)**: Interactive discovery console with industry & city presets, batch size selection, live scanning animation, and instant scored results table.
- **Leads Pipeline (`/leads`)**: Filterable table by Priority (A/B/C/D), Website status (No Website vs Has Website), Search by query, Status tracking (New, Qualified, Audited, Demo Ready, Contacted, Meeting, Won), Bulk deletion, and CSV/JSON export.
- **Lead Detail Drawer/Modal**: Detailed breakdown of score points, qualification rationale, contact details, and direct WhatsApp / Maps shortcuts.

---

## 🛠️ Tech Stack

- **Frontend**: Next.js 15 (App Router), React 19, Tailwind CSS, Lucide React
- **Backend**: Next.js Server Actions & API Routes, TypeScript
- **Database & ORM**: Prisma ORM + SQLite (local) / PostgreSQL & Supabase (production)
- **APIs**: Google Places API, OpenAI API (ready for Phase 2/3)

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Database & Environment
Copy `.env.example` to `.env` and run Prisma migrations:
```bash
npx prisma db push
npx prisma generate
```

### 3. Run Dev Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📡 API Endpoints

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/discover` | `POST` | Discovers, deduplicates, and scores businesses for a keyword and city |
| `/api/leads` | `GET` | Filter, search, and paginate leads |
| `/api/leads` | `DELETE` | Bulk delete leads by array of IDs |
| `/api/leads/[id]` | `GET` | Get single lead with full audit data |
| `/api/leads/[id]` | `PATCH` | Update lead status (`QUALIFIED`, `CONTACTED`, `MEETING`, `WON`, etc.) |
| `/api/stats` | `GET` | Dashboard KPI summary statistics |
| `/api/export` | `GET` | Export filtered leads as `CSV` or `JSON` |

---

## 🗺️ Next Phases on Roadmap

- **Phase 2 — Business Research & AI Audit Agent**: Deep crawler (Firecrawl) + OpenAI analysis of website, SEO, mobile UX, and Google presence.
- **Phase 3 — AI Website Generator**: Generating personalized demo websites per business from industry-specific templates.
- **Phase 4 — Human-Approved Outreach**: WhatsApp Cloud API & Resend Email personalized pitch generator with meeting links (Cal.com).
