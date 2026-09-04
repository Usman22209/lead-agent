import { RawBusinessLead } from "../types";

export interface GeminiAuditResult {
  businessSummary: string;
  problems: string[];
  opportunities: string[];
  recommendedFeatures: string[];
  suggestedPitch: {
    whatsapp: string;
    email: string;
  };
  modelUsed?: string;
}

// Clean JSON response from Gemini markdown codeblocks
export function cleanJsonOutput(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.replace(/^```json\s*/, "").replace(/\s*```$/, "");
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");
  }
  return cleaned.trim();
}

// ═══════════════════════════════════════════════════════════════════
// 🧠 DYNAMIC ACTIVE MODEL DISCOVERY & CASCADING AI ENGINE
// (Pattern from Marketing Agent for 100% resilient model compatibility)
// ═══════════════════════════════════════════════════════════════════
const DEFAULT_CANDIDATE_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-2.0-flash-exp",
  "gemini-flash-latest",
  "gemini-1.5-flash",
  "gemini-1.5-flash-latest",
  "gemini-pro-latest",
];

let cachedAvailableModels: string[] | null = null;
let lastModelFetchTime = 0;

/**
 * Dynamically queries Google AI Studio for all active models supported by the user's API key.
 * This completely prevents 404/400 errors from retired or regionally unavailable models.
 */
export async function getLiveAvailableModels(apiKey: string): Promise<string[]> {
  const now = Date.now();
  if (
    cachedAvailableModels &&
    cachedAvailableModels.length > 0 &&
    now - lastModelFetchTime < 600000 // 10 minute cache
  ) {
    return cachedAvailableModels;
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    if (res.ok) {
      const data = await res.json();
      if (data.models && Array.isArray(data.models)) {
        const validModels = data.models
          .filter((m: any) => m.supportedGenerationMethods?.includes("generateContent"))
          .map((m: any) => m.name.replace(/^models\//, ""))
          // Prioritize Flash and lightweight high-speed models
          .sort((a: string, b: string) => {
            const aIsFlash = a.includes("flash");
            const bIsFlash = b.includes("flash");
            if (aIsFlash && !bIsFlash) return -1;
            if (!aIsFlash && bIsFlash) return 1;
            return 0;
          });

        if (validModels.length > 0) {
          cachedAvailableModels = validModels;
          lastModelFetchTime = now;
          return validModels;
        }
      }
    }
  } catch (err) {
    console.warn("Could not dynamically query Gemini models list, using default candidate list", err);
  }

  return DEFAULT_CANDIDATE_MODELS;
}

/**
 * Cascading Gemini API caller that tries supported models sequentially with persistent retry
 */
export async function callGeminiAPIWithCascade(
  apiKey: string | undefined,
  prompt: string,
  systemPrompt?: string,
  jsonMode: boolean = true
): Promise<{ text: string; modelUsed: string }> {
  const key =
    apiKey ||
    process.env.GEMINI_API_KEY ||
    process.env.NEXT_PUBLIC_GEMINI_API_KEY;

  if (!key || key.trim() === "" || key === "your_gemini_api_key_here") {
    throw new Error("MISSING_KEY");
  }

  const fullPrompt = systemPrompt ? `${systemPrompt}\n\nTask:\n${prompt}` : prompt;
  const availableModels = await getLiveAvailableModels(key);
  let lastError: any = null;

  for (let i = 0; i < availableModels.length; i++) {
    const modelName = availableModels[i];
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${key}`;

    try {
      if (i > 0) {
        await new Promise((res) => setTimeout(res, 600));
      }

      const bodyPayload: any = {
        contents: [
          {
            parts: [
              {
                text: fullPrompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8192,
        },
      };

      if (jsonMode) {
        bodyPayload.generationConfig.responseMimeType = "application/json";
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(bodyPayload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`[Gemini API - ${modelName}] HTTP ${response.status}:`, errorText);
        lastError = new Error(`Gemini API [${modelName}] Error: ${response.status}`);
        continue;
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      if (text) {
        return { text: cleanJsonOutput(text), modelUsed: modelName };
      }
    } catch (err: any) {
      console.warn(`[Gemini API - ${modelName}] Request failed:`, err.message);
      lastError = err;
    }
  }

  throw lastError || new Error("All AI models in Gemini cascade failed.");
}

/**
 * Helper with retry loop
 */
export async function callGeminiWithPersistentRetry(
  apiKey: string | undefined,
  prompt: string,
  systemPrompt?: string,
  maxAttempts: number = 3,
  jsonMode: boolean = true
): Promise<{ text: string; modelUsed: string }> {
  let attempt = 0;
  let lastErr: any = null;

  while (attempt < maxAttempts) {
    attempt++;
    try {
      return await callGeminiAPIWithCascade(apiKey, prompt, systemPrompt, jsonMode);
    } catch (err: any) {
      lastErr = err;
      if (err.message === "MISSING_KEY") throw err;
      console.warn(`[Gemini Engine] Attempt ${attempt}/${maxAttempts} failed. Retrying...`);
      await new Promise((res) => setTimeout(res, attempt * 1000));
    }
  }

  throw lastErr || new Error(`Failed to generate after ${maxAttempts} attempts.`);
}

/**
 * Replaces any accidental model placeholders like [Name], [Business Name], [Owner]
 * with the actual business name and clean greetings.
 */
export function sanitizePitchText(text: string, business: { name: string; city: string }): string {
  if (!text) return "";
  let clean = text
    // Replace greetings with [Name] or [Owner]
    .replace(/\b(?:Hi|Hey|Hello|Dear)\s+\[(?:Name|Owner|Manager|First\s*Name|Recipient\s*Name|Business\s*Name|Company\s*Name)\]/gi, `Hi ${business.name} team`)
    // Replace any remaining [Name] / [Business Name]
    .replace(/\[(?:Business\s*Name|Company\s*Name|Business|Company)\]/gi, business.name)
    .replace(/\[(?:Owner\s*Name|Owner|Founder|Manager|Name|First\s*Name|Recipient\s*Name)\]/gi, `${business.name} team`)
    .replace(/\[(?:City|Location)\]/gi, business.city)
    .replace(/\[(?:Your\s*Name|My\s*Name|Sender\s*Name)\]/gi, "Usman")
    .replace(/\[(?:Your\s*Company|Agency\s*Name)\]/gi, "our team")
    .replace(/\[(?:insert\s*)?(?:demo\s*)?(?:link|preview|url)\]/gi, "our demo preview")
    // Remove any remaining bracketed placeholders
    .replace(/\[[^\]]{1,40}\]/g, business.name);

  // Clean up double spaces
  return clean.replace(/[ ]{2,}/g, " ").trim();
}

/**
 * Deep Lead Analysis & Strategy Pitch using Google Gemini
 */
export async function runGeminiLeadAnalysis(
  business: RawBusinessLead,
  apiKey?: string
): Promise<GeminiAuditResult> {
  const systemPrompt = `You are an elite SMB Digital Growth & Outbound Sales Strategist.
Your job is to analyze local businesses found on Google Maps, diagnose their digital presence, find revenue bottlenecks, and generate highly compelling personalized pitches for websites & digital upgrades.`;

  const prompt = `
Analyze the following local business profile:
- Business Name: ${business.name}
- Category / Niche: ${business.category}
- City / Location: ${business.city}
- Address: ${business.address || "Not provided"}
- Phone: ${business.phone || "Not provided"}
- Current Website: ${business.website || "NONE (No website detected)"}
- Google Rating: ${business.rating || 0} stars
- Google Reviews: ${business.reviewCount || 0} total reviews

IMPORTANT PERSONALIZATION RULES FOR OUTREACH PITCHES:
1. Address the business directly: start with "Hi ${business.name} team," or "Hi ${business.name},"
2. NEVER use template bracket placeholders like [Name], [Business Name], [Owner's Name], [Your Name], [Insert Link], or ANY square brackets [...].
3. The pitch must be completely written out and ready to dispatch immediately.
4. Sign off naturally as "Usman | Web Specialist" or "Usman".

Provide a strategic analysis formatted STRICTLY in this JSON structure:
{
  "businessSummary": "Concise 1-2 sentence executive summary of the business's local authority vs web funnel presence.",
  "problems": [
    "Specific problem/friction point 1",
    "Specific problem/friction point 2",
    "Specific problem/friction point 3"
  ],
  "opportunities": [
    "High-impact opportunity 1",
    "High-impact opportunity 2",
    "High-impact opportunity 3"
  ],
  "recommendedFeatures": [
    "Specific website feature 1 (e.g. WhatsApp Direct Booking)",
    "Specific website feature 2 (e.g. Verified Google Reviews Carousel)",
    "Specific website feature 3 (e.g. High-Ticket Service Landing Pages)",
    "Specific website feature 4"
  ],
  "suggestedPitch": {
    "whatsapp": "A short, punchy 2-3 sentence personalized WhatsApp message starting with 'Hi ${business.name} team,' referencing their ${business.reviewCount || 0} Google reviews and proposing a bespoke website concept. Zero brackets.",
    "email": "A professional 2-paragraph outreach email pitch starting with 'Hi ${business.name} team,' with clear value proposition and invitation to view a demo. Zero brackets."
  }
}
`;

  try {
    const result = await callGeminiWithPersistentRetry(apiKey, prompt, systemPrompt, 3, true);
    const parsed = JSON.parse(result.text) as GeminiAuditResult;
    parsed.modelUsed = result.modelUsed;

    // Sanitize any remaining accidental brackets from model output
    if (parsed.suggestedPitch) {
      if (parsed.suggestedPitch.whatsapp) {
        parsed.suggestedPitch.whatsapp = sanitizePitchText(parsed.suggestedPitch.whatsapp, business);
      }
      if (parsed.suggestedPitch.email) {
        parsed.suggestedPitch.email = sanitizePitchText(parsed.suggestedPitch.email, business);
      }
    }

    return parsed;
  } catch (error: any) {
    if (error.message !== "MISSING_KEY") {
      console.warn("[Gemini AI Audit] Falling back to heuristic reasoning engine:", error.message);
    }
    return generateFallbackAudit(business);
  }
}

export const generateGeminiAudit = runGeminiLeadAnalysis;

/**
 * Deterministic fallback audit when no API key is provided
 */
function generateFallbackAudit(business: RawBusinessLead): GeminiAuditResult {
  const hasSite = Boolean(business.website && business.website.trim().length > 0);
  const reviews = business.reviewCount || 0;
  const rating = business.rating || 0;

  if (!hasSite) {
    return {
      businessSummary: `${business.name} has built a trusted local presence in ${business.city} with ${rating.toFixed(1)} stars from ${reviews} reviews, but has zero digital conversion funnel.`,
      problems: [
        "No dedicated branded website on Google Maps profile",
        "Potential high-ticket customers cannot book or explore comprehensive services online",
        "Relying solely on foot traffic and third-party listings leaves market share vulnerable to competitors",
      ],
      opportunities: [
        "Deploy modern responsive website with instant WhatsApp / phone CTAs",
        "Showcase Google reviews and client testimonials directly on site",
        "Capture organic local search queries for high-ticket services in " + business.city,
      ],
      recommendedFeatures: [
        "Instant Online Appointment / Inquiry Booking",
        "WhatsApp Direct Chat Button",
        "Interactive Services & Pricing Catalog",
        "Embedded Google Maps & Verified Reviews Showcase",
      ],
      suggestedPitch: {
        whatsapp: `Hi ${business.name}! We noticed your strong Google profile in ${business.city} with ${reviews} reviews (${rating}★). We created a custom website concept specifically for your business to help capture more appointments online. Would love to share the preview with you!`,
        email: `Hi Team ${business.name},\n\nI was looking at top-rated ${business.category} businesses in ${business.city} and came across your impressive Google profile (${reviews} reviews, ${rating} stars).\n\nWe noticed there isn't currently a dedicated website where clients can explore your full service offerings and book directly. Our team created a personalized demo concept showing how a modern web presence could streamline new inquiries for ${business.name}.\n\nWould you be open to a quick 5-minute walkthrough of the concept?`,
      },
      modelUsed: "heuristic-engine",
    };
  }

  return {
    businessSummary: `${business.name} has an existing web presence and solid Google footprint (${rating.toFixed(1)}★, ${reviews} reviews), with clear opportunities for conversion rate optimization.`,
    problems: [
      "Existing website may lack optimized mobile call-to-actions",
      "Limited integration between Google Maps social proof and direct website conversion",
    ],
    opportunities: [
      "Modernize user experience and streamline appointment booking flow",
      "Improve local SEO and page load speed for mobile visitors",
    ],
    recommendedFeatures: [
      "High-Converting Hero CTA & Sticky Booking Bar",
      "Live Google Reviews Carousel",
      "Mobile-First Responsive Layout",
      "Automated Lead Capture & Fast Inquiry Form",
    ],
    suggestedPitch: {
      whatsapp: `Hi ${business.name}! We reviewed your online presence and found 4 quick opportunities to increase booking conversions from mobile visitors. We'd love to share our audit!`,
      email: `Hi Team ${business.name},\n\nWe recently conducted a complimentary digital presence audit for top ${business.category} businesses in ${business.city}.\n\nWhile your business has strong reputation metrics, we identified several conversion opportunities on your current site that could significantly increase inbound inquiries. Would you be open to reviewing the audit findings?`,
    },
    modelUsed: "heuristic-engine",
  };
}
